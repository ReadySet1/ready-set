/**
 * Driver-portal handler for the realtime "order cancelled" event. Pure so the
 * portal component (too heavy for jsdom) stays untested while the decision
 * logic is covered: alert + refresh only for a CANCELLED event addressed to
 * the logged-in driver.
 */

import {
  cancelledOrderAlertMessage,
  createCancelledOrderAlertHandler,
} from '../cancelled-order-alert';
import type { DeliveryStatusUpdatedPayload } from '@/lib/realtime/schemas';

const makePayload = (
  overrides: Partial<DeliveryStatusUpdatedPayload> = {},
): DeliveryStatusUpdatedPayload => ({
  orderId: 'order-123',
  orderNumber: 'Test 0821261',
  orderType: 'catering',
  driverId: 'driver-456',
  status: 'CANCELLED',
  timestamp: '2026-08-22T18:00:00.000Z',
  ...overrides,
});

describe('cancelledOrderAlertMessage', () => {
  it('names the order and tells the driver to stop', () => {
    expect(cancelledOrderAlertMessage('Test 0821261')).toBe(
      'Order Test 0821261 was cancelled by dispatch. Do not proceed.',
    );
  });
});

describe('createCancelledOrderAlertHandler', () => {
  let notify: jest.Mock;
  let refresh: jest.Mock;

  beforeEach(() => {
    notify = jest.fn();
    refresh = jest.fn().mockResolvedValue(undefined);
  });

  it('alerts and refreshes on a CANCELLED event for this driver', () => {
    const handle = createCancelledOrderAlertHandler({
      driverProfileId: 'driver-456',
      notify,
      refresh,
    });

    const handled = handle(makePayload());

    expect(handled).toBe(true);
    expect(notify).toHaveBeenCalledWith(
      'Order Test 0821261 was cancelled by dispatch. Do not proceed.',
    );
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('ignores non-cancel statuses', () => {
    const handle = createCancelledOrderAlertHandler({
      driverProfileId: 'driver-456',
      notify,
      refresh,
    });

    expect(handle(makePayload({ status: 'PICKED_UP' }))).toBe(false);
    expect(handle(makePayload({ status: 'COMPLETED' }))).toBe(false);
    expect(notify).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('ignores cancellations addressed to another driver', () => {
    const handle = createCancelledOrderAlertHandler({
      driverProfileId: 'driver-456',
      notify,
      refresh,
    });

    expect(handle(makePayload({ driverId: 'driver-999' }))).toBe(false);
    expect(notify).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('ignores everything while the driver identity is unknown', () => {
    const handle = createCancelledOrderAlertHandler({
      driverProfileId: null,
      notify,
      refresh,
    });

    expect(handle(makePayload())).toBe(false);
    expect(notify).not.toHaveBeenCalled();
  });

  it('still alerts when the refresh rejects', async () => {
    refresh.mockRejectedValue(new Error('offline'));
    const handle = createCancelledOrderAlertHandler({
      driverProfileId: 'driver-456',
      notify,
      refresh,
    });

    expect(() => handle(makePayload())).not.toThrow();
    expect(notify).toHaveBeenCalledTimes(1);
    await Promise.resolve();
  });
});
