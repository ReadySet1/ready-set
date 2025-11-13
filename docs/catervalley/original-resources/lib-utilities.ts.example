// lib/catervalley/auth.ts
import { Headers } from "next/dist/server/web/spec-extension/request";

export interface AuthResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validate CaterValley authentication headers
 */
export function validateCaterValleyAuth(headers: Headers): AuthResult {
  const contentType = headers.get("content-type");
  const partner = headers.get("partner");
  const apiKey = headers.get("x-api-key");

  // Check Content-Type
  if (contentType !== "application/json") {
    return {
      valid: false,
      reason: "Invalid Content-Type header. Expected application/json",
    };
  }

  // Check partner header
  if (partner !== "catervalley") {
    return {
      valid: false,
      reason: "Invalid or missing partner header",
    };
  }

  // Check API key
  const expectedApiKey = process.env.CATERVALLEY_API_KEY || "ready-set";
  if (apiKey !== expectedApiKey) {
    return {
      valid: false,
      reason: "Invalid or missing API key",
    };
  }

  return { valid: true };
}

// lib/catervalley/time.ts
import { parseISO, format, toDate } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

const PACIFIC_TIMEZONE = "America/Los_Angeles";

/**
 * Convert local time string (Pacific) to UTC Date object
 * @param localTime - Time string in format "HH:mm" (e.g., "11:00")
 * @param date - Optional date, defaults to today
 * @returns UTC Date object
 */
export function convertLocalToUTC(
  localTime: string,
  date?: string
): Date {
  try {
    // Parse time components
    const [hours, minutes] = localTime.split(":").map(Number);

    // Use provided date or default to today
    const baseDate = date ? parseISO(date) : new Date();

    // Create date in Pacific timezone
    const pacificDate = new Date(baseDate);
    pacificDate.setHours(hours, minutes, 0, 0);

    // Convert Pacific time to UTC
    const utcDate = fromZonedTime(pacificDate, PACIFIC_TIMEZONE);

    return utcDate;
  } catch (error) {
    console.error("[Time Conversion Error]", error);
    throw new Error(`Invalid time format: ${localTime}`);
  }
}

/**
 * Convert UTC Date to local time string (Pacific)
 * @param utcDate - UTC Date object
 * @returns Time string in format "HH:mm"
 */
export function convertUTCToLocal(utcDate: Date): string {
  try {
    const pacificDate = toZonedTime(utcDate, PACIFIC_TIMEZONE);
    return format(pacificDate, "HH:mm");
  } catch (error) {
    console.error("[Time Conversion Error]", error);
    throw new Error("Failed to convert UTC to local time");
  }
}

/**
 * Check if time is during peak hours
 * @param timeString - Time string in format "HH:mm"
 * @returns boolean indicating if time is during peak hours
 */
export function isPeakTime(timeString: string): boolean {
  const [hours, minutes] = timeString.split(":").map(Number);
  const totalMinutes = hours * 60 + minutes;

  // Peak hours: 11:30 AM - 1:30 PM and 5:30 PM - 7:30 PM
  const morningPeakStart = 11 * 60 + 30; // 11:30 AM
  const morningPeakEnd = 13 * 60 + 30; // 1:30 PM
  const eveningPeakStart = 17 * 60 + 30; // 5:30 PM
  const eveningPeakEnd = 19 * 60 + 30; // 7:30 PM

  return (
    (totalMinutes >= morningPeakStart && totalMinutes <= morningPeakEnd) ||
    (totalMinutes >= eveningPeakStart && totalMinutes <= eveningPeakEnd)
  );
}

// lib/catervalley/webhook.ts
import { StatusUpdateWebhook, WebhookResponse } from "@/types/catervalley";
import { logWebhookDelivery } from "./database";

const WEBHOOK_URL =
  process.env.CATERVALLEY_WEBHOOK_URL ||
  "https://api.catervalley.com/api/operation/order/update-order-status";

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000; // 2 seconds

/**
 * Send status update webhook to CaterValley
 */
export async function sendStatusUpdateWebhook(
  payload: StatusUpdateWebhook,
  orderId: string
): Promise<{ success: boolean; error?: string }> {
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      console.log(
        `[Webhook Attempt ${attempt}/${MAX_RETRY_ATTEMPTS}]`,
        payload.orderNumber,
        payload.status
      );

      const response = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      const responseData: WebhookResponse = await response.json();

      // Log the delivery attempt
      await logWebhookDelivery({
        orderId,
        orderNumber: payload.orderNumber,
        status: payload.status,
        webhookUrl: WEBHOOK_URL,
        payload,
        response: responseData,
        httpStatus: response.status,
        attempt,
        maxAttempts: MAX_RETRY_ATTEMPTS,
        success: response.ok && responseData.success,
      });

      if (response.ok && responseData.success) {
        console.log("[Webhook Success]", payload.orderNumber, payload.status);
        return { success: true };
      }

      lastError = `HTTP ${response.status}: ${responseData.message || "Unknown error"}`;
      console.warn(
        `[Webhook Failed Attempt ${attempt}]`,
        payload.orderNumber,
        lastError
      );

      // Wait before retry (except on last attempt)
      if (attempt < MAX_RETRY_ATTEMPTS) {
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_DELAY_MS * attempt)
        );
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      console.error(
        `[Webhook Error Attempt ${attempt}]`,
        payload.orderNumber,
        error
      );

      // Log the failed attempt
      await logWebhookDelivery({
        orderId,
        orderNumber: payload.orderNumber,
        status: payload.status,
        webhookUrl: WEBHOOK_URL,
        payload,
        httpStatus: 0,
        attempt,
        maxAttempts: MAX_RETRY_ATTEMPTS,
        success: false,
        error: lastError,
      });

      // Wait before retry (except on last attempt)
      if (attempt < MAX_RETRY_ATTEMPTS) {
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_DELAY_MS * attempt)
        );
      }
    }
  }

  console.error(
    "[Webhook Failed All Attempts]",
    payload.orderNumber,
    lastError
  );

  return {
    success: false,
    error: lastError || "Failed to deliver webhook after all retry attempts",
  };
}

/**
 * Send status update with simplified interface
 */
export async function updateOrderStatus(
  orderNumber: string,
  orderId: string,
  status: StatusUpdateWebhook["status"],
  additionalData?: Partial<StatusUpdateWebhook>
): Promise<{ success: boolean; error?: string }> {
  const payload: StatusUpdateWebhook = {
    orderNumber,
    status,
    timestamp: new Date().toISOString(),
    ...additionalData,
  };

  return sendStatusUpdateWebhook(payload, orderId);
}

// lib/catervalley/utils.ts
/**
 * Generate ReadySet order number from CaterValley order code
 * Format: CV-{orderCode}
 */
export function generateOrderNumber(orderCode: string): string {
  return `CV-${orderCode}`;
}

/**
 * Calculate distance between two addresses (simplified)
 * In production, use a proper geocoding service
 */
export async function calculateDistance(
  from: { address: string; city: string; state: string },
  to: { address: string; city: string; state: string }
): Promise<number> {
  // TODO: Implement actual distance calculation using Google Maps API or similar
  // For now, return a mock distance
  console.warn("[Mock Distance Calculation]", { from, to });
  return 10.5; // miles
}

/**
 * Format currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

/**
 * Validate UUID
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}
