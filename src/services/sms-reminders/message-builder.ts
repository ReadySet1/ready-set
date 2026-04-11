import type { SheetDeliveryRow } from "@/lib/google-sheets/parser";

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
}

function getOrdinalSuffix(n: number): string {
  if (n === 1) return "ST";
  if (n === 2) return "ND";
  if (n === 3) return "RD";
  return "TH";
}

/**
 * Next-day confirmation SMS — detailed message with full order info.
 * Based on src/components/Templates/form-next-day.tsx
 */
export function buildNextDayMessage(
  driverName: string,
  date: Date,
  orders: SheetDeliveryRow[],
  helpdeskAgent: string,
): string {
  const formattedDate = formatDate(date);

  let message = `Hi ${driverName}! This is ${helpdeskAgent}. Here are your food drive for tomorrow, ${formattedDate}. Please check the details and confirm. Thank you!\n`;

  orders.forEach((order, index) => {
    if (orders.length > 1) {
      message += `\n---------${index + 1}${getOrdinalSuffix(index + 1)} ORDER----------\n`;
    }

    message += `\nORDER# ${order.routeOrder}\n`;
    message += `PICK UP: ${order.pickupTime}\n`;
    message += `${order.vendorPickupLocation || order.vendor} - ${order.vendorAddress}\n`;
    message += `\n`;
    message += `DROP OFF:\n`;
    message += `${order.client} - ${order.clientAddress}\n`;

    if (order.driverPay) {
      message += `\nPAY: ${order.driverPay}\n`;
    }
    if (order.headcount) {
      message += `HEADCOUNT: ${order.headcount}\n`;
    }
  });

  return message;
}

/**
 * Same-day confirmation SMS — condensed route summary.
 * Based on src/components/Templates/form-same-day.tsx
 */
export function buildSameDayMessage(
  driverName: string,
  date: Date,
  orders: SheetDeliveryRow[],
  helpdeskAgent: string,
): string {
  const formattedDate = formatDate(date);

  let message = `Hi ${driverName}! This is ${helpdeskAgent}. Here are your food drive for today, ${formattedDate}. Please check the details and confirm. Thank you!\n\n`;

  message += `Route/Order  Pick Up\n`;

  for (const order of orders) {
    message += `${order.routeOrder}  ${order.pickupTime}\n`;
  }

  message += `\nPlease confirm your readiness for today's food drive by replying. If unavailable, inform us ASAP to arrange a replacement to avoid penalties.\n\n`;
  message += `✅ Ensure restaurant sign-off via Coolfire app with location updates activated.\n`;
  message += `✅ Check Coolfire app for drive details. Notify promptly of app issues.\n\n`;
  message += `Arrive 15 mins early at the resto. Thanks, and drive safely!`;

  return message;
}
