/**
 * Driver cancellation notification (SMS).
 *
 * When dispatch cancels an order that already has a driver assigned, the driver
 * must hear about it immediately — on 2026-08-21 a driver kept working a
 * cancelled order because nothing told them. This helper sends the SMS leg;
 * the in-app leg is the realtime `delivery:status:updated` broadcast with
 * `status: 'CANCELLED'` emitted by the orders PATCH route.
 *
 * Contract: never throws. A missing phone, an unconfigured Twilio provider, or
 * a provider failure all degrade to a logged result so the cancel itself is
 * never blocked by the notification.
 */

import { getSmsProvider } from '@/lib/sms';

export const DRIVER_CANCELLATION_SMS_RESULT = {
  SENT: 'sent',
  SKIPPED: 'skipped',
  FAILED: 'failed',
} as const;

export type DriverCancellationSmsResult =
  (typeof DRIVER_CANCELLATION_SMS_RESULT)[keyof typeof DRIVER_CANCELLATION_SMS_RESULT];

export interface NotifyDriverOrderCancelledInput {
  driverProfileId: string;
  driverName?: string | null;
  phone?: string | null;
  orderNumber: string;
  orderType: 'catering' | 'on_demand';
}

export interface NotifyDriverOrderCancelledResult {
  sms: DriverCancellationSmsResult;
  error?: string;
}

/** Single GSM-7 SMS segment. */
const SMS_SEGMENT_MAX_CHARS = 160;

export function buildDriverCancellationSms(orderNumber: string): string {
  const body = `Ready Set: order ${orderNumber} has been cancelled by dispatch. Do not proceed with pickup or delivery. Check the app for details.`;
  return body.length <= SMS_SEGMENT_MAX_CHARS ? body : body.slice(0, SMS_SEGMENT_MAX_CHARS);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function notifyDriverOrderCancelled(
  input: NotifyDriverOrderCancelledInput,
): Promise<NotifyDriverOrderCancelledResult> {
  const { driverProfileId, phone, orderNumber } = input;

  if (!phone) {
    console.warn(
      `[driver-cancellation] Driver ${driverProfileId} has no phone number; skipping SMS for order ${orderNumber}`,
    );
    return { sms: DRIVER_CANCELLATION_SMS_RESULT.SKIPPED };
  }

  let provider: ReturnType<typeof getSmsProvider>;
  try {
    provider = getSmsProvider();
  } catch (error) {
    const message = errorMessage(error);
    console.warn(
      `[driver-cancellation] SMS provider unavailable; skipping SMS for order ${orderNumber}: ${message}`,
    );
    return { sms: DRIVER_CANCELLATION_SMS_RESULT.SKIPPED, error: message };
  }

  try {
    const result = await provider.send(phone, buildDriverCancellationSms(orderNumber));
    if (!result.success) {
      console.warn(
        `[driver-cancellation] SMS to driver ${driverProfileId} for order ${orderNumber} failed: ${result.error ?? 'unknown error'}`,
      );
      return { sms: DRIVER_CANCELLATION_SMS_RESULT.FAILED, error: result.error };
    }
    return { sms: DRIVER_CANCELLATION_SMS_RESULT.SENT };
  } catch (error) {
    const message = errorMessage(error);
    console.warn(
      `[driver-cancellation] SMS to driver ${driverProfileId} for order ${orderNumber} threw: ${message}`,
    );
    return { sms: DRIVER_CANCELLATION_SMS_RESULT.FAILED, error: message };
  }
}
