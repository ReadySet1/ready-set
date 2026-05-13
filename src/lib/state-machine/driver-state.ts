import { CateringStatus, DriverStatus } from '@/types/user';
import type { OrderStatus } from './types';
import { StateTransitionError } from './types';

type DriverStateKey = DriverStatus | 'null';

/**
 * Driver-status transition graph. Lifted from the validated graph in
 * src/app/api/catering-requests/[orderId]/status/route.ts (canUpdateToStatus),
 * extended to include EN_ROUTE_TO_VENDOR which exists in the Prisma enum and
 * the DRIVER_STATUS_TO_ORDER_STATUS map but was missing from the original graph.
 *
 * Any state may transition directly to COMPLETED (early-finish) — preserved
 * from the original validation behavior.
 */
export const DRIVER_TRANSITIONS: Record<DriverStateKey, readonly DriverStatus[]> = {
  null: [DriverStatus.ASSIGNED],
  [DriverStatus.ASSIGNED]: [
    DriverStatus.EN_ROUTE_TO_VENDOR,
    DriverStatus.ARRIVED_AT_VENDOR,
    DriverStatus.COMPLETED,
  ],
  [DriverStatus.EN_ROUTE_TO_VENDOR]: [
    DriverStatus.ARRIVED_AT_VENDOR,
    DriverStatus.COMPLETED,
  ],
  [DriverStatus.ARRIVED_AT_VENDOR]: [
    DriverStatus.PICKED_UP,
    DriverStatus.EN_ROUTE_TO_CLIENT,
    DriverStatus.COMPLETED,
  ],
  [DriverStatus.PICKED_UP]: [
    DriverStatus.EN_ROUTE_TO_CLIENT,
    DriverStatus.COMPLETED,
  ],
  [DriverStatus.EN_ROUTE_TO_CLIENT]: [
    DriverStatus.ARRIVED_TO_CLIENT,
    DriverStatus.COMPLETED,
  ],
  [DriverStatus.ARRIVED_TO_CLIENT]: [DriverStatus.COMPLETED],
  [DriverStatus.COMPLETED]: [],
} as const;

export function canTransitionDriver(
  from: DriverStatus | null,
  to: DriverStatus,
): boolean {
  const key: DriverStateKey = from ?? 'null';
  return DRIVER_TRANSITIONS[key].includes(to);
}

export function assertDriverTransition(
  from: DriverStatus | null,
  to: DriverStatus,
): void {
  if (!canTransitionDriver(from, to)) {
    throw new StateTransitionError(from, to, 'driver');
  }
}

/**
 * Maps a driver-lifecycle status to the corresponding order-lifecycle status.
 * Lifted from DRIVER_STATUS_TO_ORDER_STATUS in
 * src/app/api/orders/[order_number]/route.ts.
 *
 * ASSIGNED is intentionally absent: the order's ASSIGNED transition is owned
 * by the assignDriver flow, not derived from the driver's own status.
 */
export const DRIVER_TO_ORDER: Partial<Record<DriverStatus, OrderStatus>> = {
  [DriverStatus.EN_ROUTE_TO_VENDOR]: CateringStatus.IN_PROGRESS,
  [DriverStatus.ARRIVED_AT_VENDOR]: CateringStatus.IN_PROGRESS,
  [DriverStatus.PICKED_UP]: CateringStatus.IN_PROGRESS,
  [DriverStatus.EN_ROUTE_TO_CLIENT]: CateringStatus.IN_PROGRESS,
  [DriverStatus.ARRIVED_TO_CLIENT]: CateringStatus.IN_PROGRESS,
  [DriverStatus.COMPLETED]: CateringStatus.COMPLETED,
};

export function deriveOrderStatusFromDriver(
  driverStatus: DriverStatus,
): OrderStatus | null {
  return DRIVER_TO_ORDER[driverStatus] ?? null;
}

const CUSTOMER_NOTIFY_STATUSES: ReadonlySet<DriverStatus> = new Set([
  DriverStatus.EN_ROUTE_TO_VENDOR,
  DriverStatus.ARRIVED_AT_VENDOR,
  DriverStatus.EN_ROUTE_TO_CLIENT,
  DriverStatus.ARRIVED_TO_CLIENT,
  DriverStatus.COMPLETED,
]);

const ADMIN_NOTIFY_STATUSES: ReadonlySet<DriverStatus> = new Set([
  DriverStatus.COMPLETED,
]);

export function shouldNotifyCustomer(status: DriverStatus): boolean {
  return CUSTOMER_NOTIFY_STATUSES.has(status);
}

export function shouldNotifyAdmin(status: DriverStatus): boolean {
  return ADMIN_NOTIFY_STATUSES.has(status);
}
