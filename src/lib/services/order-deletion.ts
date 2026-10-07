import type { Prisma } from '@prisma/client';
import { prisma } from '@/utils/prismaDB';
import { runAfterResponse } from '@/lib/api/after-response';
import { broadcastDeliveryStatus } from '@/lib/realtime/server-broadcast';
import type { DeliveryStatusUpdatedPayload } from '@/lib/realtime/schemas';
import { notifyDriverOrderCancelled } from '@/services/notifications/driver-cancellation';
import {
  releaseCancelledOrder,
  type ReturnOrderType,
} from '@/lib/services/return-requests';

/**
 * Order deletion domain service (REA-342 single delete, REA-343 bulk delete).
 *
 * Every "delete order" entry point — the two API routes and the two admin
 * server actions — runs through here, so they cannot drift apart again.
 *
 * What a delete does:
 * - Order row: SOFT delete. `deletedAt` / `deletedBy` / `deletionReason` are
 *   stamped and the row stays. The claim is conditional on `deletedAt IS NULL`,
 *   so two concurrent deletes cannot both win.
 * - Driver-side rows: the same cascade as an admin cancel
 *   (`releaseCancelledOrder`). Dispatch rows are REMOVED, not soft-deleted:
 *   the driver feed, the end-shift guard and the admin map are all
 *   dispatch-keyed and none of them filter a deleted dispatch, so a lingering
 *   row would keep a deleted order in a driver's feed. The live `deliveries`
 *   mirror is closed (CANCELLED) — a leftover ASSIGNED mirror row is what
 *   deadlocks a driver's End Shift. An assigned driver is told on the same
 *   two channels a cancel uses (SMS + realtime CANCELLED).
 * - Files: RETAINED. `file_uploads` rows (order attachments, proof-of-delivery
 *   photos, pickup signatures) and their storage objects stay with the
 *   soft-deleted order. Hard deletion and file removal belong to the purge
 *   job (src/jobs/orderPurge.ts), which runs after the retention window.
 *
 * Missing and already-deleted orders are outcomes, not exceptions.
 */

export type DeletableOrderType = ReturnOrderType;

/** An order by id (type known) or by order number (type looked up). */
export type OrderRef =
  | { orderType: DeletableOrderType; orderId: string }
  | { orderNumber: string };

export interface OrderDeletionActor {
  /** Profile id of the admin performing the delete. */
  deletedBy: string;
  reason?: string | null;
}

interface OrderIdentity {
  orderType: DeletableOrderType;
  orderId: string;
  orderNumber: string;
}

export type OrderDeletionResult =
  | (OrderIdentity & {
      outcome: 'DELETED';
      deletedAt: Date;
      deletedBy: string;
      deletedDispatches: number;
    })
  | (OrderIdentity & { outcome: 'ALREADY_DELETED' })
  | { outcome: 'NOT_FOUND' };

export type BulkOrderDeletionResult = { orderNumber: string } & (
  | OrderDeletionResult
  | { outcome: 'FAILED'; reason: string }
);

/** What the admin "delete order" server actions hand back to their dialogs. */
export interface DeleteOrderActionResult {
  success: boolean;
  error?: string;
  message?: string;
}

export function toDeleteOrderActionResult(
  result: OrderDeletionResult,
  orderId: string,
): DeleteOrderActionResult {
  if (result.outcome === 'NOT_FOUND') {
    return { success: false, error: `Order with ID ${orderId} not found.` };
  }
  if (result.outcome === 'ALREADY_DELETED') {
    return {
      success: false,
      error: `Order ${result.orderNumber} has already been deleted.`,
    };
  }
  return { success: true, message: 'Order deleted successfully' };
}

/** Order statuses after which a "cancelled, stop working it" alert is wrong. */
const SETTLED_ORDER_STATUSES = ['COMPLETED', 'CANCELLED', 'DELIVERED'];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ORDER_SELECT = {
  id: true,
  orderNumber: true,
  status: true,
  driverStatus: true,
} as const;

interface OrderRow {
  id: string;
  orderNumber: string;
  status: string;
  driverStatus: string | null;
}

interface AssignedDriver {
  id: string;
  name: string | null;
  contactNumber: string | null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Tell each driver who held the order that it is gone — the same SMS and
 * realtime CANCELLED alert an admin cancel sends, deferred past the response
 * and never able to fail the delete.
 */
function alertAssignedDrivers(
  order: OrderIdentity & { driverStatus: string | null },
  drivers: AssignedDriver[],
): void {
  for (const driver of drivers) {
    runAfterResponse('Failed to SMS driver about order deletion:', () =>
      notifyDriverOrderCancelled({
        driverProfileId: driver.id,
        driverName: driver.name,
        phone: driver.contactNumber,
        orderNumber: order.orderNumber,
        orderType: order.orderType,
      }),
    );

    const payload: DeliveryStatusUpdatedPayload = {
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      orderType: order.orderType,
      driverId: driver.id,
      status: 'CANCELLED',
      previousStatus:
        (order.driverStatus as DeliveryStatusUpdatedPayload['previousStatus']) || undefined,
      driverName: driver.name || undefined,
      timestamp: new Date().toISOString(),
    };
    runAfterResponse('Failed to broadcast order deletion to driver:', () =>
      broadcastDeliveryStatus(payload),
    );
  }
}

/** Explicit `deletedAt` filter on both branches: the soft-delete client
 *  extension would otherwise hide deleted rows from the second lookup. */
async function findOrder(
  tx: Prisma.TransactionClient,
  orderType: DeletableOrderType,
  key: { id: string } | { orderNumber: string },
  deleted: boolean,
): Promise<OrderRow | null> {
  const args = {
    where: { ...key, deletedAt: deleted ? { not: null } : null },
    select: ORDER_SELECT,
  };
  return orderType === 'catering'
    ? tx.cateringRequest.findFirst(args)
    : tx.onDemand.findFirst(args);
}

/** Live rows win over deleted ones; catering is checked before on-demand. */
async function locateOrder(
  tx: Prisma.TransactionClient,
  ref: OrderRef,
): Promise<{ orderType: DeletableOrderType; order: OrderRow; deleted: boolean } | null> {
  const orderTypes: DeletableOrderType[] =
    'orderId' in ref ? [ref.orderType] : ['catering', 'on_demand'];
  const key = 'orderId' in ref ? { id: ref.orderId } : { orderNumber: ref.orderNumber };

  for (const deleted of [false, true]) {
    for (const orderType of orderTypes) {
      const order = await findOrder(tx, orderType, key, deleted);
      if (order) return { orderType, order, deleted };
    }
  }
  return null;
}

/**
 * Soft-delete one order. See the module comment for what that covers.
 * Throws only when the database transaction itself fails; in that case
 * nothing was changed.
 */
export async function softDeleteOrder(
  ref: OrderRef,
  actor: OrderDeletionActor,
  db: typeof prisma = prisma,
): Promise<OrderDeletionResult> {
  // A malformed id can never match a uuid column — and would make Postgres
  // raise instead of returning no rows.
  if ('orderId' in ref && !UUID_PATTERN.test(ref.orderId)) {
    return { outcome: 'NOT_FOUND' };
  }

  const committed = await db.$transaction(async (tx) => {
    const located = await locateOrder(tx, ref);
    if (!located) return { outcome: 'NOT_FOUND' as const };

    const { orderType, order } = located;
    const identity: OrderIdentity = {
      orderType,
      orderId: order.id,
      orderNumber: order.orderNumber,
    };
    const alreadyDeleted = { outcome: 'ALREADY_DELETED' as const, ...identity };
    if (located.deleted) return alreadyDeleted;

    const deletedAt = new Date();
    const claim = {
      where: { id: order.id, deletedAt: null },
      data: {
        deletedAt,
        deletedBy: actor.deletedBy,
        deletionReason: actor.reason?.trim() || null,
      },
    };
    const claimed =
      orderType === 'catering'
        ? await tx.cateringRequest.updateMany(claim)
        : await tx.onDemand.updateMany(claim);
    // A concurrent delete got there between the read and the claim.
    if (claimed.count === 0) return alreadyDeleted;

    const orderFk =
      orderType === 'catering'
        ? { cateringRequestId: order.id }
        : { onDemandId: order.id };

    // Read before the cascade removes them: the count is reported and the
    // drivers are who must be told.
    const dispatches = await tx.dispatch.findMany({
      where: orderFk,
      select: {
        id: true,
        driver: { select: { id: true, name: true, contactNumber: true } },
      },
    });

    await releaseCancelledOrder(tx, {
      orderType,
      orderId: order.id,
      dbOrderNumber: order.orderNumber,
    });

    return {
      outcome: 'DELETED' as const,
      ...identity,
      deletedAt,
      status: String(order.status),
      driverStatus: order.driverStatus,
      dispatches,
    };
  });

  if (committed.outcome !== 'DELETED') return committed;

  const { status, driverStatus, dispatches, ...deleted } = committed;

  if (!SETTLED_ORDER_STATUSES.includes(status)) {
    const drivers = new Map<string, AssignedDriver>();
    for (const { driver } of dispatches) {
      if (driver) drivers.set(driver.id, driver);
    }
    alertAssignedDrivers({ ...deleted, driverStatus }, [...drivers.values()]);
  }

  return {
    ...deleted,
    deletedBy: actor.deletedBy,
    deletedDispatches: dispatches.length,
  };
}

/**
 * Soft-delete several orders by order number, one transaction each, so one
 * bad order never blocks the rest. Each requested number gets exactly one
 * result; a repeated number is processed once.
 */
export async function softDeleteOrders(
  orderNumbers: string[],
  actor: OrderDeletionActor,
  db: typeof prisma = prisma,
): Promise<BulkOrderDeletionResult[]> {
  const results: BulkOrderDeletionResult[] = [];

  for (const orderNumber of new Set(orderNumbers)) {
    try {
      const result = await softDeleteOrder({ orderNumber }, actor, db);
      results.push({ ...result, orderNumber });
    } catch (error) {
      console.error(`[order-deletion] failed to delete order ${orderNumber}:`, error);
      results.push({ orderNumber, outcome: 'FAILED', reason: errorMessage(error) });
    }
  }
  return results;
}
