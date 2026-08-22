/**
 * Shared shape + copy for the end-shift guard (server action and driver
 * portal). Pure — safe to import from either side.
 */

export type BlockingOrderReason =
  /** Non-terminal row in the `deliveries` mirror. */
  | 'ACTIVE_DELIVERY'
  /** Order in a movement stage (en route / arrived / picked up). */
  | 'IN_PROGRESS'
  /** ASSIGNED order whose pickup is imminent or overdue. */
  | 'PICKUP_DUE';

export interface BlockingOrder {
  orderNumber: string;
  reason: BlockingOrderReason | string;
}

const GENERIC_MESSAGE =
  'You still have an active or due delivery. Complete it or return it to dispatch before ending your shift.';

/**
 * "Order X is still assigned to you. Complete it or return it to dispatch
 * before ending your shift." — pluralised and listing every order number.
 * Falls back to a generic sentence when no order number is known.
 */
export function formatBlockingOrdersMessage(orders: BlockingOrder[]): string {
  const numbers = orders.map((o) => o.orderNumber).filter(Boolean);
  if (numbers.length === 0) return GENERIC_MESSAGE;
  if (numbers.length === 1) {
    return `Order ${numbers[0]} is still assigned to you. Complete it or return it to dispatch before ending your shift.`;
  }
  const list =
    numbers.length === 2
      ? `${numbers[0]} and ${numbers[1]}`
      : `${numbers.slice(0, -1).join(', ')}, and ${numbers[numbers.length - 1]}`;
  return `Orders ${list} are still assigned to you. Complete them or return them to dispatch before ending your shift.`;
}
