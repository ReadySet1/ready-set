import {
  formatBlockingOrdersMessage,
  type BlockingOrder,
} from '../end-shift-blockers';

describe('formatBlockingOrdersMessage', () => {
  it('names a single blocking order', () => {
    const orders: BlockingOrder[] = [
      { orderNumber: 'Test 0821261', reason: 'ACTIVE_DELIVERY' },
    ];
    expect(formatBlockingOrdersMessage(orders)).toBe(
      'Order Test 0821261 is still assigned to you. Complete it or return it to dispatch before ending your shift.',
    );
  });

  it('lists every blocking order when there are several', () => {
    const orders: BlockingOrder[] = [
      { orderNumber: 'CAT-001', reason: 'IN_PROGRESS' },
      { orderNumber: 'OD-002', reason: 'PICKUP_DUE' },
    ];
    expect(formatBlockingOrdersMessage(orders)).toBe(
      'Orders CAT-001 and OD-002 are still assigned to you. Complete them or return them to dispatch before ending your shift.',
    );
  });

  it('falls back to a count-only message when no order number is known', () => {
    expect(formatBlockingOrdersMessage([])).toBe(
      'You still have an active or due delivery. Complete it or return it to dispatch before ending your shift.',
    );
  });
});
