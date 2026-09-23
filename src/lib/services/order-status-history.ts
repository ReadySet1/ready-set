import type { DriverStatus } from '@/types/user';
import { prisma } from '@/utils/prismaDB';
import { getPartnerByOrderNumber } from '@/lib/services/partner-registry';
import { realtimeLogger } from '@/lib/logging/realtime-logger';

/**
 * Driver-transition audit trail on `order_status_history`.
 *
 * Scope: non-partner catering orders only, mirroring the return-to-dispatch
 * audit row (src/lib/services/return-requests.ts). For registry partners
 * (CaterCow, CaterValley) this table is the partner-facing lifecycle log read
 * by GET /orders/{id} — its newest row IS the partner's `lifecycleStatus` —
 * so internal driver rows must never land there. On-demand orders are out of
 * scope because the table FKs to catering_requests.
 */

export interface DriverTransitionHistoryInput {
  cateringRequestId: string;
  /** The NEW driver status the order just moved to. */
  driverStatus: DriverStatus;
  /** Order-level status after the transition (non-partner orders have no partner lifecycle). */
  partnerStatus: string;
  /** Profile id of whoever made the change. */
  changedBy: string | null;
  /** Driver's last known position, only when the caller already has it. */
  location?: { lat: number; lng: number } | null;
}

/**
 * Whether a driver transition on this order gets a history row. Callers run
 * it before opening the status transaction so the (cached) partner lookup
 * adds nothing to the transaction's lock hold time. Never throws: a lookup
 * failure skips the row.
 */
export async function shouldRecordDriverHistory(
  orderType: 'catering' | 'on_demand',
  orderNumber: string,
): Promise<boolean> {
  if (orderType !== 'catering') return false;
  try {
    return (await getPartnerByOrderNumber(orderNumber)) === null;
  } catch (err) {
    realtimeLogger.error('[order-status-history] partner lookup failed', {
      eventType: 'order_status_history',
      error: err,
      metadata: { orderNumber },
    });
    return false;
  }
}

/**
 * Append one history row for a driver transition with a single INSERT on the
 * global client. Call it AFTER the status transaction has committed and await
 * it; it never throws, so the transition's response is unaffected.
 *
 * Trade-off (accepted): the row is written outside the status transaction, so
 * if this insert fails after the commit, the transition stands and its history
 * row is missing. The failure is logged. Writing it inside the transaction
 * would couple the driver's status update to an audit write and add round
 * trips while the order row is locked.
 */
export async function recordDriverStatusTransition(
  input: DriverTransitionHistoryInput,
): Promise<boolean> {
  try {
    await prisma.orderStatusHistory.create({
      data: {
        cateringRequestId: input.cateringRequestId,
        driverStatus: input.driverStatus,
        partnerStatus: input.partnerStatus,
        changedBy: input.changedBy,
        location: input.location ?? undefined,
        notes: `driver:${input.driverStatus}`,
      },
    });
    return true;
  } catch (err) {
    realtimeLogger.error('[order-status-history] failed to record driver transition', {
      eventType: 'order_status_history',
      error: err,
      metadata: {
        cateringRequestId: input.cateringRequestId,
        driverStatus: input.driverStatus,
      },
    });
    return false;
  }
}
