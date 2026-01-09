/**
 * Order Update Notification Service
 *
 * Sends email notifications to customers when significant changes are made
 * to their orders by admin users.
 *
 * Significant changes that trigger notifications:
 * - Date/time changes (pickupDateTime, arrivalDateTime)
 * - Address changes (pickupAddress, deliveryAddress)
 * - Pricing changes (orderTotal)
 */

import { Resend } from "resend";
import { sendEmailWithResilience } from "@/utils/email-resilience";
import {
  generateUnifiedEmailTemplate,
  generateDetailsTable,
  generateInfoBox,
  BRAND_COLORS
} from "@/utils/email-templates";
import type { FieldChange } from "@/app/api/orders/[order_number]/schemas";

// Lazy initialization to avoid build-time errors when API key is not set
const getResendClient = () => {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not configured");
    return null;
  }
  return new Resend(process.env.RESEND_API_KEY);
};

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';
const fromEmail = process.env.EMAIL_FROM || "solutions@updates.readysetllc.com";

interface OrderUpdateNotificationParams {
  order: {
    orderNumber: string;
    order_type: 'catering' | 'on_demand';
    pickupDateTime?: string | Date | null;
    arrivalDateTime?: string | Date | null;
    orderTotal?: number | string | null;
    pickupAddress?: {
      street1: string;
      city: string;
      state: string;
      zip: string;
    };
    deliveryAddress?: {
      street1: string;
      city: string;
      state: string;
      zip: string;
    };
  };
  changes: FieldChange[];
  customerEmail: string;
  customerName: string;
}

// Human-readable field labels
const FIELD_LABELS: Record<string, string> = {
  pickupDateTime: 'Pickup Date/Time',
  arrivalDateTime: 'Arrival Date/Time',
  pickupAddress: 'Pickup Address',
  deliveryAddress: 'Delivery Address',
  orderTotal: 'Order Total',
  headcount: 'Headcount',
  needHost: 'Host Required',
  hoursNeeded: 'Hours Needed',
  numberOfHosts: 'Number of Hosts',
  itemDelivered: 'Item Delivered',
  vehicleType: 'Vehicle Type',
  tip: 'Tip',
  appliedDiscount: 'Discount',
  deliveryCost: 'Delivery Cost',
  clientAttention: 'Contact Person',
  pickupNotes: 'Pickup Notes',
  specialNotes: 'Special Notes',
};

/**
 * Format a value for display in the email
 */
function formatValue(field: string, value: unknown): string {
  if (value === null || value === undefined) {
    return 'Not set';
  }

  // Handle dates
  if (field.includes('DateTime') || field.includes('Date')) {
    const date = new Date(value as string | Date);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return String(value);
  }

  // Handle addresses
  if (field.includes('Address') && typeof value === 'object') {
    const addr = value as { street1?: string; city?: string; state?: string; zip?: string };
    const parts = [addr.street1, addr.city, addr.state, addr.zip].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'Not set';
  }

  // Handle currency
  if (field === 'orderTotal' || field === 'tip' || field === 'appliedDiscount' || field === 'deliveryCost') {
    const num = typeof value === 'number' ? value : parseFloat(String(value));
    return !isNaN(num) ? `$${num.toFixed(2)}` : String(value);
  }

  return String(value);
}

/**
 * Generate the changes summary section for the email
 */
function generateChangesSummary(changes: FieldChange[]): string {
  // Filter to only significant changes for the email
  const significantChanges = changes.filter(c => c.isSignificant);

  if (significantChanges.length === 0) {
    return '';
  }

  const changeRows = significantChanges.map(change => ({
    label: FIELD_LABELS[change.field] || change.field,
    value: `<span style="text-decoration: line-through; color: ${BRAND_COLORS.text.secondary};">${formatValue(change.field, change.oldValue)}</span>
            <br>
            <span style="color: ${BRAND_COLORS.primary}; font-weight: 600;">${formatValue(change.field, change.newValue)}</span>`,
  }));

  return generateDetailsTable(changeRows);
}

/**
 * Send order update notification to customer
 */
export async function sendOrderUpdateNotification(
  params: OrderUpdateNotificationParams
): Promise<{ success: boolean; error?: string }> {
  const { order, changes, customerEmail, customerName } = params;

  // Filter to significant changes only
  const significantChanges = changes.filter(c => c.isSignificant);

  if (significantChanges.length === 0) {
    // No significant changes, don't send email
    return { success: true };
  }

  const orderTypeLabel = order.order_type === 'catering' ? 'Catering' : 'On-Demand';

  // Build the email content
  const content = `
    <p style="font-size: 16px; color: ${BRAND_COLORS.text.primary};">
      We wanted to let you know that there have been some updates to your ${orderTypeLabel.toLowerCase()} order.
    </p>

    <h3 style="color: ${BRAND_COLORS.text.primary}; font-size: 18px; margin-top: 25px;">What's Changed</h3>
    ${generateChangesSummary(changes)}

    <h3 style="color: ${BRAND_COLORS.text.primary}; font-size: 18px; margin-top: 25px;">Current Order Details</h3>
    ${generateDetailsTable([
      { label: 'Order Number', value: order.orderNumber },
      { label: 'Order Type', value: orderTypeLabel },
      { label: 'Pickup Time', value: formatValue('pickupDateTime', order.pickupDateTime) },
      { label: 'Arrival Time', value: formatValue('arrivalDateTime', order.arrivalDateTime) },
      { label: 'Order Total', value: formatValue('orderTotal', order.orderTotal) },
    ])}

    ${generateInfoBox(
      'If you have any questions about these changes, please don\'t hesitate to contact us.',
      'info'
    )}
  `;

  const emailBody = generateUnifiedEmailTemplate({
    title: 'Order Update',
    greeting: `Hello ${customerName}! 👋`,
    content,
    ctaUrl: `${siteUrl}/dashboard/orders`,
    ctaText: 'View Your Order',
    infoMessage: 'You\'re receiving this email because your order details have been updated.',
    infoType: 'info',
  });

  try {
    await sendEmailWithResilience(async () => {
      const resend = getResendClient();
      if (!resend) {
        console.warn("⚠️  Resend client not available - skipping order update notification email");
        throw new Error("Email service not configured");
      }

      return await resend.emails.send({
        to: customerEmail,
        from: fromEmail,
        subject: `Order Update - ${order.orderNumber}`,
        html: emailBody,
      });
    });

    console.log(`✅ Sent order update notification for ${order.orderNumber} to ${customerEmail}`);
    return { success: true };
  } catch (error) {
    console.error("❌ Error sending order update notification email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
