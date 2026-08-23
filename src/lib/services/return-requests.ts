import { Prisma, type DeliveryReturnRequest } from '@prisma/client';
import { prisma } from '@/utils/prismaDB';
import { returnOrderToDispatch } from '@/lib/state-machine/transition';
import { getPartnerByOrderNumber } from '@/lib/services/partner-registry';

/**
 * Return-to-dispatch domain service (issue #508 + helpdesk-approval follow-up).
 *
 * Two paths share the same unwind:
 * - Privileged callers (ADMIN / SUPER_ADMIN / HELPDESK) return an order
 *   immediately via `executeReturnToDispatch`.
 * - Drivers file a PENDING `DeliveryReturnRequest` via `createReturnRequest`;
 *   a dispatcher later runs `approveReturnRequest` (which executes the same
 *   unwind) or `rejectReturnRequest`. A pending request auto-voids when the
 *   driver advances the order past pickup (`voidPendingReturnRequests`).
 */

export type ReturnOrderType = 'catering' | 'on_demand';

export const RETURN_REASONS = [
  'CANNOT_MAKE_PICKUP',
  'VEHICLE_ISSUE',
  'EMERGENCY',
  'STALE_ORDER',
  'ADMIN_UNASSIGNED',
  'OTHER',
] as const;
export type ReturnReason = (typeof RETURN_REASONS)[number];

export const MAX_RETURN_DETAILS_LENGTH = 500;

export const TERMINAL_ORDER_STATUSES = ['COMPLETED', 'CANCELLED'];

// Once the driver holds the food, a silent hand-back would strand the order —
// post-pickup returns must go through dispatch (admins can still force).
export const POST_PICKUP_DRIVER_STATUSES = [
  'PICKED_UP',
  'EN_ROUTE_TO_CLIENT',
  'ARRIVED_TO_CLIENT',
  'COMPLETED',
];

/** Guard failure inside a return transaction, mappable to an HTTP response. */
export class ReturnGuardError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ReturnGuardError';
  }
}

type Db = Prisma.TransactionClient | typeof prisma;

/** Durable free-text note stamped on the mirror + audit rows. */
export function buildReturnReasonNote(
  reason: string,
  details?: string | null,
): string {
  return `Returned to dispatch (${reason})${details ? `: ${details}` : ''}`;
}

interface ReturnableOrder {
  id: string;
  orderNumber: string | null;
  status: unknown;
  driverStatus: unknown;
}

/**
 * Fresh in-tx read + the guards every return path shares: the order must
 * exist (404) and must not be terminal (409 TERMINAL). Reading inside the
 * transaction means a concurrent driver PATCH to PICKED_UP can't race past
 * the pre-pickup check.
 */
export async function loadReturnableOrder(
  tx: Db,
  orderType: ReturnOrderType,
  orderId: string,
): Promise<ReturnableOrder> {
  const order =
    orderType === 'catering'
      ? await tx.cateringRequest.findFirst({
          where: { id: orderId, deletedAt: null },
          select: { id: true, orderNumber: true, status: true, driverStatus: true },
        })
      : await tx.onDemand.findFirst({
          where: { id: orderId, deletedAt: null },
          select: { id: true, orderNumber: true, status: true, driverStatus: true },
        });

  if (!order) {
    throw new ReturnGuardError(404, 'NOT_FOUND', 'Order not found');
  }
  if (TERMINAL_ORDER_STATUSES.includes(String(order.status))) {
    throw new ReturnGuardError(
      409,
      'TERMINAL',
      `Order is already ${String(order.status).toLowerCase()} and cannot be returned.`,
    );
  }
  return order;
}

export interface ExecuteReturnParams {
  orderType: ReturnOrderType;
  orderId: string;
  /** Order number exactly as stored in the DB (mirror rows key on it). */
  dbOrderNumber: string;
  reasonNote: string;
  /** Profile id recorded on the audit history row. */
  changedBy: string;
}

/**
 * The return-to-dispatch unwind, exactly as the return route has always run
 * it. Callers own the guards (terminal / assigned / post-pickup) and must run
 * this inside a transaction.
 *
 * - Tombstone the deliveries mirror: the admin SSE feed filters on live
 *   lowercase statuses, so the row must be both CANCELLED and soft-deleted to
 *   drop off every surface. The reason lands in deliveryNotes (the model has
 *   no deletionReason column).
 * - Delete the dispatch rows — the driver feed, the end-shift guard, and the
 *   admin map are all dispatch-keyed.
 * - Put the order back in the assignable pool (ACTIVE, driverStatus null).
 * - Audit trail for catering non-partner orders only. order_status_history
 *   FKs to catering_requests, and partner orders must not get a lifecycle row
 *   the partner contract has no status for (never call
 *   recordAndDispatchLifecycleEvent here — it fires partner webhooks).
 */
export async function executeReturnToDispatch(
  tx: Db,
  params: ExecuteReturnParams,
): Promise<void> {
  const { orderType, orderId, dbOrderNumber, reasonNote, changedBy } = params;
  const now = new Date();

  await tx.delivery.updateMany({
    where: { orderNumber: dbOrderNumber, deletedAt: null },
    data: {
      status: 'CANCELLED',
      cancelledAt: now,
      deletedAt: now,
      deliveryNotes: reasonNote,
    },
  });

  await tx.dispatch.deleteMany({
    where:
      orderType === 'catering'
        ? { cateringRequestId: orderId }
        : { onDemandId: orderId },
  });

  await returnOrderToDispatch(tx, orderType, orderId);

  if (orderType === 'catering') {
    const partner = await getPartnerByOrderNumber(dbOrderNumber);
    if (!partner) {
      await tx.orderStatusHistory.create({
        data: {
          cateringRequestId: orderId,
          partnerStatus: 'RETURNED_TO_DISPATCH',
          driverStatus: null,
          changedBy,
          notes: reasonNote,
        },
      });
    }
  }
}

export interface ReleaseCancelledOrderParams {
  orderType: ReturnOrderType;
  orderId: string;
  /** Order number exactly as stored in the DB (mirror rows key on it). */
  dbOrderNumber: string;
}

/**
 * Clear the driver-side rows of an order that is already CANCELLED
 * (2026-08-21 finding #8). Returning a cancelled order is a no-op for the
 * order itself — it must never go back in the pool — but stale `dispatches`
 * / `deliveries` rows left by a pre-cascade cancel would keep the driver's
 * end-shift guard blocking, so drop them here. Idempotent.
 */
export async function releaseCancelledOrder(
  tx: Db,
  params: ReleaseCancelledOrderParams,
): Promise<void> {
  const { orderType, orderId, dbOrderNumber } = params;
  const now = new Date();

  await tx.delivery.updateMany({
    where: {
      orderNumber: dbOrderNumber,
      deletedAt: null,
      status: { notIn: ['COMPLETED', 'CANCELLED', 'DELIVERED'] },
    },
    data: { status: 'CANCELLED', cancelledAt: now },
  });

  await tx.dispatch.deleteMany({
    where:
      orderType === 'catering'
        ? { cateringRequestId: orderId }
        : { onDemandId: orderId },
  });
}

export interface CreateReturnRequestParams {
  orderType: ReturnOrderType;
  orderId: string;
  /** Requesting driver's profile id (matches dispatches.driverId). */
  driverId: string;
  reason: ReturnReason;
  details?: string;
}

export interface CreateReturnRequestResult {
  request: DeliveryReturnRequest;
  /** false when an existing PENDING request was returned (idempotent repeat). */
  created: boolean;
  /** The driver's dispatch row id — used for the admin push notification. */
  dispatchId: string | null;
}

/**
 * File a driver return request. Runs the same guards as the pre-approval
 * driver return path (own dispatch, not post-pickup, not terminal) and then
 * inserts a PENDING row. Idempotent: an existing PENDING request for the
 * order is returned instead of creating a duplicate (backed by a partial
 * unique index on order_id WHERE status = 'PENDING').
 */
export async function createReturnRequest(
  params: CreateReturnRequestParams,
  db: typeof prisma = prisma,
): Promise<CreateReturnRequestResult> {
  const { orderType, orderId, driverId, reason, details } = params;

  try {
    return await db.$transaction(async (tx) => {
      const order = await loadReturnableOrder(tx, orderType, orderId);

      const dispatches = await tx.dispatch.findMany({
        where:
          orderType === 'catering'
            ? { cateringRequestId: orderId }
            : { onDemandId: orderId },
        select: { id: true, driverId: true },
      });
      if (dispatches.length === 0) {
        throw new ReturnGuardError(
          409,
          'NOT_ASSIGNED',
          'This order is not assigned to a driver.',
        );
      }
      const ownDispatch = dispatches.find((d) => d.driverId === driverId);
      if (!ownDispatch) {
        throw new ReturnGuardError(
          403,
          'NOT_YOUR_ORDER',
          'Access denied - not assigned to this order',
        );
      }
      if (POST_PICKUP_DRIVER_STATUSES.includes(String(order.driverStatus))) {
        throw new ReturnGuardError(
          409,
          'POST_PICKUP',
          'The order has already been picked up. Contact dispatch to hand it back.',
        );
      }

      const existing = await tx.deliveryReturnRequest.findFirst({
        where: { orderId, status: 'PENDING' },
      });
      if (existing) {
        return { request: existing, created: false, dispatchId: ownDispatch.id };
      }

      const request = await tx.deliveryReturnRequest.create({
        data: {
          orderType,
          orderId,
          orderNumber: order.orderNumber!,
          driverId,
          reason,
          details: details || null,
        },
      });
      return { request, created: true, dispatchId: ownDispatch.id };
    });
  } catch (err) {
    // Partial-unique-index race: two concurrent requests for the same order.
    // The losing transaction aborted, so re-read outside it and hand back the
    // winner's PENDING row (same idempotent contract as the in-tx check).
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      const raced = await db.deliveryReturnRequest.findFirst({
        where: { orderId, status: 'PENDING' },
      });
      if (raced) {
        return { request: raced, created: false, dispatchId: null };
      }
    }
    throw err;
  }
}

export type ApproveReturnResult =
  | {
      outcome: 'APPROVED';
      request: DeliveryReturnRequest;
      orderId: string;
      orderNumber: string;
      driverId: string;
      /** Pre-delete dispatch id, for the notification plumbing. */
      dispatchId: string | null;
    }
  | {
      outcome: 'VOIDED';
      request: DeliveryReturnRequest;
      /** Why the request could no longer be honored. */
      reason: 'NOT_FOUND' | 'TERMINAL' | 'NOT_ASSIGNED' | 'ORDER_ADVANCED';
    };

/**
 * Approve a PENDING return request: re-check the order is still returnable
 * and run the shared unwind. If the world moved on since the driver asked —
 * order finished/cancelled, driver unassigned or reassigned, or the driver
 * advanced past pickup — the request is marked VOIDED instead and the caller
 * is told why (approving would otherwise yank a live delivery).
 *
 * Throws ReturnGuardError(404) for an unknown id and 409 ALREADY_RESOLVED for
 * a request that is no longer PENDING.
 */
export async function approveReturnRequest(
  requestId: string,
  resolverId: string,
  db: typeof prisma = prisma,
): Promise<ApproveReturnResult> {
  return db.$transaction(async (tx) => {
    const request = await tx.deliveryReturnRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) {
      throw new ReturnGuardError(404, 'NOT_FOUND', 'Return request not found');
    }
    if (request.status !== 'PENDING') {
      throw new ReturnGuardError(
        409,
        'ALREADY_RESOLVED',
        `This request was already ${request.status.toLowerCase()}.`,
      );
    }
    const orderType = request.orderType as ReturnOrderType;

    const voidRequest = async (note: string) =>
      tx.deliveryReturnRequest.update({
        where: { id: request.id },
        data: {
          status: 'VOIDED',
          resolvedAt: new Date(),
          resolvedBy: resolverId,
          resolutionNotes: note,
        },
      });

    let order: ReturnableOrder;
    try {
      order = await loadReturnableOrder(tx, orderType, request.orderId);
    } catch (err) {
      if (err instanceof ReturnGuardError) {
        const voided = await voidRequest(`Voided on review: ${err.message}`);
        return {
          outcome: 'VOIDED' as const,
          request: voided,
          reason: err.code === 'TERMINAL' ? ('TERMINAL' as const) : ('NOT_FOUND' as const),
        };
      }
      throw err;
    }

    const dispatches = await tx.dispatch.findMany({
      where:
        orderType === 'catering'
          ? { cateringRequestId: request.orderId }
          : { onDemandId: request.orderId },
      select: { id: true, driverId: true },
    });
    // The REQUESTING driver must still hold the dispatch — if the order was
    // unassigned or handed to another driver, this request is stale.
    const ownDispatch = dispatches.find((d) => d.driverId === request.driverId);
    if (!ownDispatch) {
      const voided = await voidRequest(
        'Voided on review: the requesting driver is no longer assigned to this order.',
      );
      return { outcome: 'VOIDED' as const, request: voided, reason: 'NOT_ASSIGNED' as const };
    }

    if (POST_PICKUP_DRIVER_STATUSES.includes(String(order.driverStatus))) {
      const voided = await voidRequest(
        'Voided on review: the driver advanced the delivery past pickup.',
      );
      return { outcome: 'VOIDED' as const, request: voided, reason: 'ORDER_ADVANCED' as const };
    }

    await executeReturnToDispatch(tx, {
      orderType,
      orderId: request.orderId,
      dbOrderNumber: order.orderNumber!,
      reasonNote: buildReturnReasonNote(request.reason, request.details),
      changedBy: resolverId,
    });

    const approved = await tx.deliveryReturnRequest.update({
      where: { id: request.id },
      data: {
        status: 'APPROVED',
        resolvedAt: new Date(),
        resolvedBy: resolverId,
      },
    });

    return {
      outcome: 'APPROVED' as const,
      request: approved,
      orderId: request.orderId,
      orderNumber: order.orderNumber!,
      driverId: request.driverId,
      dispatchId: ownDispatch.id,
    };
  });
}

/**
 * Reject a PENDING return request. The assignment stays untouched.
 * Throws ReturnGuardError(404) / 409 ALREADY_RESOLVED like approve.
 */
export async function rejectReturnRequest(
  requestId: string,
  resolverId: string,
  notes?: string,
  db: typeof prisma = prisma,
): Promise<DeliveryReturnRequest> {
  return db.$transaction(async (tx) => {
    const request = await tx.deliveryReturnRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) {
      throw new ReturnGuardError(404, 'NOT_FOUND', 'Return request not found');
    }
    if (request.status !== 'PENDING') {
      throw new ReturnGuardError(
        409,
        'ALREADY_RESOLVED',
        `This request was already ${request.status.toLowerCase()}.`,
      );
    }
    return tx.deliveryReturnRequest.update({
      where: { id: request.id },
      data: {
        status: 'REJECTED',
        resolvedAt: new Date(),
        resolvedBy: resolverId,
        resolutionNotes: notes?.trim() || null,
      },
    });
  });
}

/**
 * Void every PENDING request for an order. Fired when the driver advances the
 * delivery to PICKED_UP or beyond — keeping the food means keeping the job.
 * Safe to call when there is nothing pending (no-op).
 */
export async function voidPendingReturnRequests(
  orderId: string,
  note = 'Auto-voided: the driver advanced the delivery past pickup.',
  db: Db = prisma,
): Promise<number> {
  const result = await db.deliveryReturnRequest.updateMany({
    where: { orderId, status: 'PENDING' },
    data: {
      status: 'VOIDED',
      resolvedAt: new Date(),
      resolutionNotes: note,
    },
  });
  return result.count;
}
