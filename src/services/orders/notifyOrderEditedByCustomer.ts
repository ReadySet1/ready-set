/**
 * Notify ops when a customer (vendor/client) edits their own catering order.
 *
 * Modelled on notifyOrderCreated.ts — same recipients, same kill switch,
 * same fail-closed behaviour outside production. Never throws.
 */
import * as Sentry from "@sentry/nextjs";
import {
  generateUnifiedEmailTemplate,
  generateDetailsTable,
  generateInfoBox,
  BRAND_COLORS,
} from "@/utils/email-templates";
import { sendEmailWithResilience } from "@/utils/email-resilience";
import { Resend } from "resend";
import { getOrderNotificationConfig } from "@/config/order-notifications";
import { escapeHtml } from "@/lib/utils/escape-html";

// ---------------------------------------------------------------------------
// Lazy Resend client — avoids build-time errors when the key is missing
// ---------------------------------------------------------------------------

const getResendClient = () => {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not configured");
    return null;
  }
  return new Resend(process.env.RESEND_API_KEY);
};

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const fromEmail =
  process.env.EMAIL_FROM || "solutions@updates.readysetllc.com";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface FieldChange {
  readonly field: "headcount" | "orderTotal";
  readonly label: string;
  readonly oldValue: string;
  readonly newValue: string;
}

export interface NotifyOrderEditedInput {
  readonly orderNumber: string;
  readonly editorName: string;
  readonly editorEmail: string;
  readonly editorRole: string;
  readonly changes: readonly FieldChange[];
}

export interface NotifyOrderEditedResult {
  readonly sent: boolean;
  readonly reason?: "disabled" | "send_failed";
}

// ---------------------------------------------------------------------------
// Build the email HTML
// ---------------------------------------------------------------------------

function buildEmailHtml(input: NotifyOrderEditedInput): string {
  const changeRows: Array<{ label: string; value: string }> = input.changes.map(
    (c) => ({
      label: escapeHtml(c.label),
      value: `${escapeHtml(c.oldValue)} → ${escapeHtml(c.newValue)}`,
    }),
  );

  const editorDetails = generateDetailsTable([
    { label: "Name", value: escapeHtml(input.editorName) },
    { label: "Email", value: escapeHtml(input.editorEmail) },
    { label: "Role", value: escapeHtml(input.editorRole) },
  ]);

  const content = `
    <p style="font-size: 16px; color: ${BRAND_COLORS.text.primary};">
      A customer has edited their catering order. Please review the changes below.
    </p>

    <h3 style="color: ${BRAND_COLORS.text.primary}; font-size: 18px; margin-top: 25px;">Order</h3>
    ${generateDetailsTable([{ label: "Order Number", value: escapeHtml(input.orderNumber) }])}

    <h3 style="color: ${BRAND_COLORS.text.primary}; font-size: 18px; margin-top: 25px;">Edited By</h3>
    ${editorDetails}

    <h3 style="color: ${BRAND_COLORS.text.primary}; font-size: 18px; margin-top: 25px;">Changes</h3>
    ${generateDetailsTable(changeRows)}

    ${generateInfoBox(
      "Review these changes promptly — headcount and order total may affect vehicle choice and billing.",
      "warning",
    )}
  `;

  return generateUnifiedEmailTemplate({
    title: "Order Edited by Customer",
    greeting: `Order #${escapeHtml(input.orderNumber)} ✏️`,
    content,
    ctaUrl: `${siteUrl}/admin/catering-orders/${encodeURIComponent(input.orderNumber)}`,
    ctaText: "View Order in Dashboard",
  });
}

// ---------------------------------------------------------------------------
// Sentry context
// ---------------------------------------------------------------------------

function sentryContext(input: NotifyOrderEditedInput) {
  return {
    tags: {
      operation: "notifyOrderEditedByCustomer" as const,
      editorRole: input.editorRole,
    },
    extra: { orderNumber: input.orderNumber },
  };
}

// ---------------------------------------------------------------------------
// Dispatcher — never throws
// ---------------------------------------------------------------------------

export async function notifyOrderEditedByCustomer(
  input: NotifyOrderEditedInput,
): Promise<NotifyOrderEditedResult> {
  const config = getOrderNotificationConfig();
  if (!config.enabled) return { sent: false, reason: "disabled" };

  try {
    const html = buildEmailHtml(input);

    await sendEmailWithResilience(async () => {
      const resend = getResendClient();
      if (!resend) {
        throw new Error("Email service not configured");
      }

      return await resend.emails.send({
        to: [...config.recipients],
        from: fromEmail,
        subject: `Order Edited by Customer - ${input.orderNumber}`,
        html,
      });
    });

    return { sent: true };
  } catch (error) {
    console.error("[notifyOrderEditedByCustomer] Send failed:", error);
    Sentry.captureException(error, sentryContext(input));
    return { sent: false, reason: "send_failed" };
  }
}
