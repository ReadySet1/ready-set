// app/actions/send-email.ts
"use server";

import { Resend } from "resend";
import * as cheerio from "cheerio";
import { SpamProtectionManager, extractClientIp } from "@/lib/spam-protection";
import { verifyRecaptchaToken } from "@/lib/recaptcha";
import { headers } from "next/headers";

interface FormInputs {
  name: string;
  email: string;
  phone?: string;
  message: string;
  subject?: string;
  honeypot?: string; // Hidden field for bot detection
  recaptchaToken?: string; // reCAPTCHA token
}

// Lazy initialization to avoid build-time errors when API key is not set
const getResendClient = () => {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not configured");
    return null;
  }
  return new Resend(process.env.RESEND_API_KEY);
};

/**
 * Sanitize email address for logging
 * Masks the username part to prevent information disclosure in logs
 */
function sanitizeEmailForLogging(email: string): string {
  const [username, domain] = email.split('@');
  if (!username || !domain) return '[invalid-email]';

  // Show first and last character of username, mask the rest
  const sanitized = username.length > 2
    ? `${username[0]}${'*'.repeat(username.length - 2)}${username[username.length - 1]}`
    : '*'.repeat(username.length);

  return `${sanitized}@${domain}`;
}

export type SendEmailFailureReason =
  | "validation"
  | "rate_limited"
  | "spam"
  | "recaptcha"
  | "config"
  | "send_failed";

/**
 * Server actions that throw have their message masked in production, so
 * expected failures are returned instead of thrown. Callers show `error`.
 */
export type SendEmailResult =
  | { success: true; message: string }
  | { success: false; error: string; reason: SendEmailFailureReason };

const GENERIC_SEND_ERROR =
  "Unable to send message. Please try again later or contact us directly.";

const fail = (
  reason: SendEmailFailureReason,
  error: string,
): SendEmailResult => ({ success: false, reason, error });

const sendEmail = async (data: FormInputs): Promise<SendEmailResult> => {
  try {
    return await sendEmailUnsafe(data);
  } catch (error) {
    // Anything unexpected (header access, template parsing, SDK bugs) must
    // still resolve: a thrown server-action error reaches the user masked.
    console.error("[Email] Unexpected error:", error);
    return fail("send_failed", GENERIC_SEND_ERROR);
  }
};

const sendEmailUnsafe = async (data: FormInputs): Promise<SendEmailResult> => {
  // Basic validation
  if (data.message.length > 1000) {
    return fail("validation", "Message cannot exceed 1000 characters.");
  }

  // Get client IP for rate limiting
  // SECURITY: Only trust x-forwarded-for from Vercel's trusted proxy
  const headersList = await headers();
  const forwardedFor = headersList.get('x-forwarded-for');
  const realIp = headersList.get('x-real-ip');
  const clientIp = extractClientIp(forwardedFor, realIp);

  // Bucket per form type so e.g. five contact submissions cannot block the
  // sign-up notification from the same IP.
  const notificationType = determineNotificationType(data);

  // Spam protection check
  const spamCheck = await SpamProtectionManager.checkForSpam({
    email: data.email,
    message: data.message,
    name: data.name,
    phone: data.phone,
    honeypot: data.honeypot,
    identifier: `${notificationType}:${clientIp}`,
  });

  if (spamCheck.isSpam) {
    // Sanitize email in logs to prevent information disclosure
    const sanitizedEmail = process.env.NODE_ENV === 'development'
      ? data.email
      : sanitizeEmailForLogging(data.email);

    // Log minimal information in production, detailed in development
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[SPAM BLOCKED] ${sanitizedEmail} - ${spamCheck.reason} (score: ${spamCheck.score})`);
    } else {
      console.warn(`[SPAM BLOCKED] IP: ${clientIp.substring(0, 10)}... Score: ${spamCheck.score}`);
    }

    // Rate limiting is expected for legitimate users, so say what happened
    if (spamCheck.details?.rateLimitExceeded) {
      return fail(
        "rate_limited",
        "Too many submissions. Please wait a few minutes and try again.",
      );
    }

    // Return generic error to avoid giving spammers feedback
    return fail("spam", GENERIC_SEND_ERROR);
  }

  // Log spam score for monitoring (even if not spam)
  if (spamCheck.score > 0 && process.env.NODE_ENV === 'development') {
    console.log(`[SPAM CHECK] ${data.email} - Score: ${spamCheck.score} - Allowed`);
  }

  // Verify reCAPTCHA token (if provided)
  if (data.recaptchaToken) {
    // Use configurable threshold (default 0.5 per Google's recommendation)
    // 0.0 = Very likely a bot, 0.5 = Neutral, 1.0 = Very likely a human
    // Validate that the threshold is between 0.0 and 1.0
    const rawThreshold = parseFloat(process.env.RECAPTCHA_MIN_SCORE || '0.5');
    const threshold = Math.max(0, Math.min(1, isNaN(rawThreshold) ? 0.5 : rawThreshold));

    // Log warning if invalid value was configured
    if (isNaN(rawThreshold) || rawThreshold < 0 || rawThreshold > 1) {
      console.warn(
        `[SECURITY] Invalid RECAPTCHA_MIN_SCORE configured: "${process.env.RECAPTCHA_MIN_SCORE}". ` +
        `Using safe default of ${threshold}. Valid range is 0.0 to 1.0.`
      );
    }

    const recaptchaResult = await verifyRecaptchaToken(data.recaptchaToken, threshold);

    if (!recaptchaResult.success) {
      // Sanitize email in logs
      const sanitizedEmail = process.env.NODE_ENV === 'development'
        ? data.email
        : sanitizeEmailForLogging(data.email);

      // Log minimal information in production
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[reCAPTCHA BLOCKED] ${sanitizedEmail} - ${recaptchaResult.message} (score: ${recaptchaResult.score})`);
      } else {
        console.warn(`[reCAPTCHA BLOCKED] IP: ${clientIp.substring(0, 10)}... Score: ${recaptchaResult.score}`);
      }

      // Return generic error to avoid giving bots feedback
      return fail("recaptcha", "Unable to verify submission. Please try again.");
    }

    // Log reCAPTCHA score for monitoring (development only)
    if (process.env.NODE_ENV === 'development') {
      console.log(`[reCAPTCHA] ${data.email} - Score: ${recaptchaResult.score.toFixed(2)} - Verified`);
    }
  }

  // Validate recipient address
  const recipient = process.env.NOTIFICATION_RECIPIENT || "info@readysetllc.com";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    console.error("Invalid recipient email address:", recipient);
    return fail("config", GENERIC_SEND_ERROR);
  }

  const resend = getResendClient();
  if (!resend) {
    console.error("⚠️  Resend client not available - RESEND_API_KEY missing or invalid");
    return fail("config", GENERIC_SEND_ERROR);
  }

  const { subject, html } = await createEmailContent(data, notificationType);

  try {
    console.log(`[Email] Sending email to: ${recipient}, from: solutions@updates.readysetllc.com`);
    console.log(`[Email] Subject: ${subject}`);

    const result = await resend.emails.send({
      to: recipient,
      from: "Ready Set Website <solutions@updates.readysetllc.com>",
      subject,
      html,
    });

    // Resend reports API failures in the result instead of throwing
    if (result.error) {
      console.error("[Email] Resend API error:", result.error);
      return fail("send_failed", GENERIC_SEND_ERROR);
    }

    console.log("[Email] Email sent successfully:", result);

    return { success: true, message: "Your message was sent successfully." };
  } catch (error) {
    console.error("[Email] Email sending error:", error);

    if (error instanceof Error) {
      console.error("[Email] Error message:", error.message);
      console.error("[Email] Error stack:", error.stack);
    }

    return fail("send_failed", GENERIC_SEND_ERROR);
  }
};

// Helper functions
const determineNotificationType = (data: FormInputs) => {
  if (data.subject?.includes("Vendor Registration")) return "vendor";
  if (data.subject?.includes("Client Registration")) return "client";
  if (data.subject?.includes("Food Delivery")) return "delivery";
  return !data.phone ? "job" : "general";
};

const createEmailContent = async (data: FormInputs, type: string) => {
  let subject = data.subject || "Website Message - Ready Set";
  let html = "";

  switch (type) {
    case "vendor":
    case "client":
      const registration = parseRegistration(data.message);
      subject = `New ${registration.userType} Registration - Ready Set`;
      html = createRegistrationHTML(registration);
      break;

    case "delivery":
      const deliveryData = parseDelivery(data.message);
      subject = "New Food Delivery Quote Request";
      html = createDeliveryHTML(deliveryData);
      break;

    case "job":
      subject = "New Job Application - Ready Set";
      html = createJobHTML(data);
      break;

    default:
      html = createGeneralHTML(data);
  }

  return { subject, html };
};

const parseRegistration = (message: string) => {
  const $ = cheerio.load(message);
  return {
    userType: $('p:contains("User Type:")').text().split(": ")[1],
    name: $('p:contains("Name:")').text().split(": ")[1],
    email: $('p:contains("Email:")').text().split(": ")[1],
    company: $('p:contains("Company:")').text().split(": ")[1],
  };
};

const parseDelivery = (message: string) => {
  const sections: { [key: string]: string } = {};
  let currentSection = "";

  message.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    if (trimmed.endsWith(":")) {
      currentSection = trimmed.replace(":", "");
      sections[currentSection] = "";
    } else if (currentSection) {
      sections[currentSection] += trimmed + "\n";
    }
  });

  return sections;
};

import { escapeHtml } from '@/lib/utils/escape-html';

// HTML templates with XSS protection
const createRegistrationHTML = (data: any) => `
  <h2>New ${escapeHtml(data.userType)} Registration</h2>
  <p>User Type: ${escapeHtml(data.userType)}</p>
  <p>Name: ${escapeHtml(data.name)}</p>
  <p>Email: ${escapeHtml(data.email)}</p>
  <p>Company: ${escapeHtml(data.company)}</p>
  <p>Please review this registration in the admin dashboard.</p>
`;

const createDeliveryHTML = (sections: any) => `
  <h2>New Food Delivery Quote Request</h2>
  ${Object.entries(sections)
    .map(
      ([title, content]) => `
    <h3>${escapeHtml(title)}</h3>
    <pre>${escapeHtml(content as string)}</pre>
  `,
    )
    .join("")}
`;

const createJobHTML = (data: FormInputs) => `
  <h2>New Job Application</h2>
  <p>Name: ${escapeHtml(data.name)}</p>
  <p>Email: ${escapeHtml(data.email)}</p>
  <p>Message: ${escapeHtml(data.message)}</p>
`;

const createGeneralHTML = (data: FormInputs) => `
  <h2>Website Message</h2>
  <p>Name: ${escapeHtml(data.name)}</p>
  <p>Email: ${escapeHtml(data.email)}</p>
  ${data.phone ? `<p>Phone: ${escapeHtml(data.phone)}</p>` : ""}
  <p>Message: ${escapeHtml(data.message)}</p>
`;

export default sendEmail;
