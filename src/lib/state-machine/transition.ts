import { Prisma } from '@prisma/client';
import { DriverStatus } from '@/types/user';
import { prisma as defaultPrisma } from '@/lib/prisma';
import { assertOrderTransition } from './order-state';
import {
  assertDriverTransition,
  deriveOrderStatusFromDriver,
  shouldNotifyAdmin,
  shouldNotifyCustomer,
} from './driver-state';
import type {
  OrderStatus,
  OrderType,
  SideEffectDescriptor,
  TransitionRequest,
  TransitionResult,
} from './types';

type Db = Prisma.TransactionClient | typeof defaultPrisma;

/**
 * Validates and applies an order state transition.
 *
 * - Accepts an optional `tx` so callers that already opened a $transaction
 *   compose without nesting (e.g. assignDriver).
 * - Validates both order-level and driver-level transitions before any write.
 * - Writes status + driverStatus atomically on the matching order row.
 * - Returns the side-effect descriptors the caller should fire (notifications,
 *   webhooks, dispatch upsert, etc.). The state machine never fires side
 *   effects itself — routes stay in control of I/O.
 */
export async function transitionOrder(
  req: TransitionRequest,
  tx?: Db,
): Promise<TransitionResult> {
  const db = tx ?? defaultPrisma;

  const resolvedOrderStatus = resolveNextOrderStatus(req);
  const targetDriverStatus = req.nextDriverStatus ?? null;

  // Only treat the order status as "changing" if it actually differs from current.
  const orderStatusChanged =
    resolvedOrderStatus !== null && resolvedOrderStatus !== req.currentStatus;
  const driverStatusChanged =
    targetDriverStatus !== null && targetDriverStatus !== req.currentDriverStatus;

  if (orderStatusChanged) {
    assertOrderTransition(req.currentStatus, resolvedOrderStatus);
  }
  if (driverStatusChanged) {
    assertDriverTransition(req.currentDriverStatus, targetDriverStatus);
  }

  await applyUpdate(db, req.orderType, req.orderId, {
    nextOrderStatus: orderStatusChanged ? resolvedOrderStatus : null,
    nextDriverStatus: driverStatusChanged ? targetDriverStatus : null,
  });

  // Final values for the result: keep whatever was actually written, fall back
  // to the current values otherwise.
  const finalOrderStatus = orderStatusChanged ? resolvedOrderStatus : req.currentStatus;
  const finalDriverStatus = driverStatusChanged ? targetDriverStatus : req.currentDriverStatus;

  return {
    previousStatus: req.currentStatus,
    newStatus: finalOrderStatus,
    previousDriverStatus: req.currentDriverStatus,
    newDriverStatus: finalDriverStatus,
    sideEffects: collectSideEffects(req, driverStatusChanged ? targetDriverStatus : null),
  };
}

function resolveNextOrderStatus(req: TransitionRequest): OrderStatus | null {
  // Explicit override wins (used by assignDriver to set ASSIGNED, by status
  // route to set CONFIRMED/CANCELLED, etc.)
  if (req.nextOrderStatus !== undefined) {
    return req.nextOrderStatus;
  }
  // Otherwise derive from driver status (mirrors DRIVER_STATUS_TO_ORDER_STATUS)
  if (req.nextDriverStatus) {
    return deriveOrderStatusFromDriver(req.nextDriverStatus);
  }
  return req.currentStatus;
}

async function applyUpdate(
  db: Db,
  orderType: OrderType,
  orderId: string,
  patch: {
    nextOrderStatus: OrderStatus | null;
    nextDriverStatus: DriverStatus | null;
  },
): Promise<void> {
  const data: { status?: OrderStatus; driverStatus?: DriverStatus; updatedAt: Date } = {
    updatedAt: new Date(),
  };
  if (patch.nextOrderStatus !== null) {
    data.status = patch.nextOrderStatus;
  }
  if (patch.nextDriverStatus !== null) {
    data.driverStatus = patch.nextDriverStatus;
  }

  // Nothing to write — early-return.
  if (data.status === undefined && data.driverStatus === undefined) {
    return;
  }

  if (orderType === 'catering') {
    await db.cateringRequest.update({
      where: { id: orderId },
      data: data as Prisma.CateringRequestUpdateInput,
    });
  } else {
    await db.onDemand.update({
      where: { id: orderId },
      data: data as Prisma.OnDemandUpdateInput,
    });
  }
}

function collectSideEffects(
  req: TransitionRequest,
  newDriverStatus: DriverStatus | null,
): SideEffectDescriptor[] {
  const out: SideEffectDescriptor[] = [];
  if (newDriverStatus && newDriverStatus !== req.currentDriverStatus) {
    if (shouldNotifyCustomer(newDriverStatus)) {
      out.push({ kind: 'notify_customer', driverStatus: newDriverStatus });
    }
    if (shouldNotifyAdmin(newDriverStatus)) {
      out.push({ kind: 'notify_admin', driverStatus: newDriverStatus });
    }
    out.push({ kind: 'upsert_delivery_timestamp', driverStatus: newDriverStatus });
    if (newDriverStatus === DriverStatus.COMPLETED) {
      out.push({ kind: 'webhook', provider: 'catervalley', orderId: req.orderId });
    }
  }
  // Any successful transition warrants cache invalidation on the order.
  out.push({ kind: 'invalidate_cache', orderId: req.orderId });
  return out;
}

// Re-export so callers can import everything from one path.
export { canTransitionOrder, assertOrderTransition } from './order-state';
export {
  canTransitionDriver,
  assertDriverTransition,
  deriveOrderStatusFromDriver,
  shouldNotifyCustomer,
  shouldNotifyAdmin,
} from './driver-state';
export { StateTransitionError } from './types';
export type {
  OrderStatus,
  OrderType,
  TransitionRequest,
  TransitionResult,
  SideEffectDescriptor,
} from './types';
