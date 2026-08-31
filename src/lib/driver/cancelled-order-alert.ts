/**
 * Driver-portal reaction to a realtime "order cancelled" event.
 *
 * Kept as a pure factory (no React, no toast import) so the decision logic is
 * unit-testable without rendering the portal: act only on a `CANCELLED`
 * delivery-status event addressed to the logged-in driver, then alert and
 * refresh the deliveries feed so the order drops off the list right away
 * instead of waiting on the 60s poll.
 */

import type { DeliveryStatusUpdatedPayload } from '@/lib/realtime/schemas';

/** Long enough for a driver glancing at a mounted phone to notice it. */
export const CANCELLED_ORDER_ALERT_DURATION_MS = 10_000;

export interface CancelledOrderAlertDeps {
  /** Profile id of the logged-in driver (the dispatch `driverId`). */
  driverProfileId: string | null | undefined;
  notify: (message: string) => void;
  refresh: () => Promise<unknown>;
}

export type CancelledOrderAlertHandler = (payload: DeliveryStatusUpdatedPayload) => boolean;

export function cancelledOrderAlertMessage(orderNumber: string): string {
  return `Order ${orderNumber} was cancelled by dispatch. Do not proceed.`;
}

/**
 * Returns a handler that reports whether it acted on the payload.
 */
export function createCancelledOrderAlertHandler({
  driverProfileId,
  notify,
  refresh,
}: CancelledOrderAlertDeps): CancelledOrderAlertHandler {
  return (payload) => {
    if (!driverProfileId) return false;
    if (payload.status !== 'CANCELLED') return false;
    if (payload.driverId !== driverProfileId) return false;

    notify(cancelledOrderAlertMessage(payload.orderNumber));
    void refresh().catch(() => {
      // Best-effort: the periodic poll still reconciles the list.
    });
    return true;
  };
}
