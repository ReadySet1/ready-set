import { CateringStatus, OnDemandStatus } from '@/types/user';
import type { OrderStatus } from './types';
import { StateTransitionError } from './types';

export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  [CateringStatus.PENDING]:     [CateringStatus.CONFIRMED, CateringStatus.ACTIVE, CateringStatus.CANCELLED],
  [CateringStatus.CONFIRMED]:   [CateringStatus.ACTIVE, CateringStatus.ASSIGNED, CateringStatus.CANCELLED],
  [CateringStatus.ACTIVE]:      [CateringStatus.ASSIGNED, CateringStatus.CANCELLED],
  [CateringStatus.ASSIGNED]:    [CateringStatus.IN_PROGRESS, CateringStatus.CANCELLED],
  [CateringStatus.IN_PROGRESS]: [CateringStatus.DELIVERED, CateringStatus.COMPLETED, CateringStatus.CANCELLED],
  [CateringStatus.DELIVERED]:   [CateringStatus.COMPLETED],
  [CateringStatus.COMPLETED]:   [],
  [CateringStatus.CANCELLED]:   [],
} as const;

export function canTransitionOrder(
  from: OrderStatus | null,
  to: OrderStatus,
): boolean {
  // Initial state: any order can start at PENDING or ACTIVE.
  if (from === null) {
    return to === CateringStatus.PENDING || to === CateringStatus.ACTIVE;
  }
  const allowed = ORDER_TRANSITIONS[from] ?? [];
  return allowed.includes(to);
}

export function assertOrderTransition(
  from: OrderStatus | null,
  to: OrderStatus,
): void {
  if (!canTransitionOrder(from, to)) {
    throw new StateTransitionError(from, to, 'order');
  }
}

export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return (ORDER_TRANSITIONS[status]?.length ?? 0) === 0;
}
