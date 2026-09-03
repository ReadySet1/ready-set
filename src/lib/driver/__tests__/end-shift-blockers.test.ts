import {
  END_SHIFT_STALE_PICKUP_HOURS,
  formatBlockingOrdersMessage,
  isPickupInsideEndShiftWindow,
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

describe('isPickupInsideEndShiftWindow', () => {
  const HOUR = 60 * 60 * 1000;
  const now = Date.parse('2026-08-26T18:00:00Z');
  const guardMs = 2 * HOUR;

  it('exposes a 24h stale bound', () => {
    expect(END_SHIFT_STALE_PICKUP_HOURS).toBe(24);
  });

  it('is inside for an imminent pickup within the guard window', () => {
    expect(isPickupInsideEndShiftWindow(now + HOUR, guardMs, now)).toBe(true);
  });

  it('is inside for an overdue pickup less than 24h old', () => {
    expect(isPickupInsideEndShiftWindow(now - 23 * HOUR, guardMs, now)).toBe(true);
  });

  it('is outside for a pickup older than 24h (stale assignment)', () => {
    expect(isPickupInsideEndShiftWindow(now - 25 * HOUR, guardMs, now)).toBe(false);
  });

  it('is outside for a pickup beyond the guard window', () => {
    expect(isPickupInsideEndShiftWindow(now + 3 * HOUR, guardMs, now)).toBe(false);
  });

  it('is outside whenever the guard is disabled (0)', () => {
    expect(isPickupInsideEndShiftWindow(now + HOUR, 0, now)).toBe(false);
    expect(isPickupInsideEndShiftWindow(now - HOUR, 0, now)).toBe(false);
  });

  it('is outside for an unknown pickup time', () => {
    expect(isPickupInsideEndShiftWindow(null, guardMs, now)).toBe(false);
    expect(isPickupInsideEndShiftWindow(Number.NaN, guardMs, now)).toBe(false);
  });
});
