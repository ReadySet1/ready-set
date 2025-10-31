// app/actions/send-email.ts
"use server";

import { Resend } from "resend";
import * as cheerio from "cheerio";
import { sendOrderConfirmationToCustomer } from "@/services/email-notification";
import { prisma } from "@/utils/prismaDB";
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

const sendEmail = async (data: FormInputs) => {
  // Basic validation
  if (data.message.length > 1000) {
    throw new Error("Message cannot exceed 1000 characters.");
  }

  // Get client IP for rate limiting
  // SECURITY: Only trust x-forwarded-for from Vercel's trusted proxy
  const headersList = await headers();
  const forwardedFor = headersList.get('x-forwarded-for');
  const realIp = headersList.get('x-real-ip');
  const clientIp = extractClientIp(forwardedFor, realIp);

  // Spam protection check
  const spamCheck = await SpamProtectionManager.checkForSpam({
    email: data.email,
    message: data.message,
    name: data.name,
    phone: data.phone,
    honeypot: data.honeypot,
    identifier: clientIp, // Use IP for rate limiting
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

    // Return generic error to avoid giving spammers feedback
    throw new Error("Unable to send message. Please try again later or contact us directly.");
  }

  // Log spam score for monitoring (even if not spam)
  if (spamCheck.score > 0 && process.env.NODE_ENV === 'development') {
    console.log(`[SPAM CHECK] ${data.email} - Score: ${spamCheck.score} - Allowed`);
  }

  // Verify reCAPTCHA token (if provided)
  if (data.recaptchaToken) {
    const recaptchaResult = await verifyRecaptchaToken(data.recaptchaToken, 0.7);

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
      throw new Error("Unable to verify submission. Please try again.");
    }

    // Log reCAPTCHA score for monitoring (development only)
    if (process.env.NODE_ENV === 'development') {
      console.log(`[reCAPTCHA] ${data.email} - Score: ${recaptchaResult.score.toFixed(2)} - Verified`);
    }
  }

  // Validate recipient address
  const recipient = process.env.NOTIFICATION_RECIPIENT || "info@readysetllc.com";
  if (!recipient) {
    throw new Error("No recipient configured for emails");
  }

  const notificationType = determineNotificationType(data);
  const { subject, html } = await createEmailContent(data, notificationType);

  try {
    const resend = getResendClient();
    if (!resend) {
      console.warn("⚠️  Resend client not available - skipping email");
      throw new Error("Email service not configured");
    }

    // Add this validation before sending
    if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      throw new Error("Invalid recipient email address");
    }

    await resend.emails.send({
      to: recipient,
      from: "Ready Set Website <solutions@updates.readysetllc.com>",
      subject,
      html,
    });

    return "Your message was sent successfully.";
  } catch (error) {
    console.error("Email sending error:", error);
    throw new Error("Error trying to send the message.");
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

// HTML templates
const createRegistrationHTML = (data: any) => `
  <h2>New ${data.userType} Registration</h2>
  <p>User Type: ${data.userType}</p>
  <p>Name: ${data.name}</p>
  <p>Email: ${data.email}</p>
  <p>Company: ${data.company}</p>
  <p>Please review this registration in the admin dashboard.</p>
`;

const createDeliveryHTML = (sections: any) => `
  <h2>New Food Delivery Quote Request</h2>
  ${Object.entries(sections)
    .map(
      ([title, content]) => `
    <h3>${title}</h3>
    <pre>${content}</pre>
  `,
    )
    .join("")}
`;

const createJobHTML = (data: FormInputs) => `
  <h2>New Job Application</h2>
  <p>Name: ${data.name}</p>
  <p>Email: ${data.email}</p>
  <p>Message: ${data.message}</p>
`;

const createGeneralHTML = (data: FormInputs) => `
  <h2>Website Message</h2>
  <p>Name: ${data.name}</p>
  <p>Email: ${data.email}</p>
  ${data.phone ? `<p>Phone: ${data.phone}</p>` : ""}
  <p>Message: ${data.message}</p>
`;

// Delivery notification functionality
interface DeliveryNotificationData {
  orderId: string;
  customerEmail: string | null;
  driverName?: string;
  estimatedDelivery?: Date;
}

/**
 * Send delivery/order notifications to customer
 * This function fetches the order details and sends a confirmation email
 */
export async function sendDeliveryNotifications(
  data: DeliveryNotificationData
): Promise<{ success: boolean; error?: string }> {
  try {
    // Fetch order details from database
    // Try catering first
    const cateringOrder = await prisma.cateringRequest.findUnique({
      where: { id: data.orderId },
      include: {
        user: true,
        pickupAddress: true,
        deliveryAddress: true,
      },
    });

    if (cateringOrder && cateringOrder.user) {
      // Send catering order confirmation
      const emailSuccess = await sendOrderConfirmationToCustomer({
        orderNumber: cateringOrder.orderNumber,
        orderType: 'catering',
        customerName: cateringOrder.user.name || 'Valued Customer',
        customerEmail: data.customerEmail || cateringOrder.user.email || '',
        pickupTime: cateringOrder.pickupDateTime,
        arrivalTime: cateringOrder.arrivalDateTime,
        orderTotal: cateringOrder.orderTotal?.toString() || '0',
        pickupAddress: cateringOrder.pickupAddress,
        deliveryAddress: cateringOrder.deliveryAddress,
      });

      if (!emailSuccess) {
        return {
          success: false,
          error: 'Failed to send confirmation email'
        };
      }

      return { success: true };
    }

    // If not found in catering, try on-demand
    const onDemandOrder = await prisma.onDemand.findUnique({
      where: { id: data.orderId },
      include: {
        user: true,
        pickupAddress: true,
        deliveryAddress: true,
      },
    });

    if (onDemandOrder && onDemandOrder.user) {
      // Send on-demand order confirmation
      const emailSuccess = await sendOrderConfirmationToCustomer({
        orderNumber: onDemandOrder.orderNumber,
        orderType: 'on_demand',
        customerName: onDemandOrder.user.name || 'Valued Customer',
        customerEmail: data.customerEmail || onDemandOrder.user.email || '',
        pickupTime: onDemandOrder.pickupDateTime,
        arrivalTime: onDemandOrder.arrivalDateTime,
        orderTotal: onDemandOrder.orderTotal?.toString() || '0',
        pickupAddress: onDemandOrder.pickupAddress,
        deliveryAddress: onDemandOrder.deliveryAddress,
      });

      if (!emailSuccess) {
        return {
          success: false,
          error: 'Failed to send confirmation email'
        };
      }

      return { success: true };
    }

    // Order not found in either table
    console.error('Order not found for ID:', data.orderId);
    return { success: false, error: 'Order not found' };
  } catch (error) {
    console.error('Error sending delivery notification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export default sendEmail;
