/**
 * Regression tests for useDriverDeliveriesFeed.activeCount.
 *
 * Fix: activeCount now excludes terminal statuses (COMPLETED / CANCELLED /
 * DELIVERED) on either `status` or `driverStatus`, in addition to the existing
 * `completeDateTime` guard. This stops a finished delivery whose completion
 * timestamp is missing (historical-data bug) from resurrecting itself as active
 * — the "N active" card and the list now agree.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useDriverDeliveriesFeed, type ApiDelivery } from '@/hooks/driver/useDriverDeliveriesFeed';

const mockFetch = global.fetch as jest.Mock;

const mkDelivery = (overrides: Partial<ApiDelivery>): ApiDelivery => ({
  id: 'd-1',
  orderNumber: 'CAT-001',
  delivery_type: 'catering',
  status: 'ACTIVE',
  driverStatus: 'ASSIGNED',
  pickupDateTime: '2024-01-01T00:00:00Z',
  completeDateTime: null,
  order_total: 100,
  ...overrides,
});

const respondWith = (deliveries: ApiDelivery[]) => {
  mockFetch.mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue({ deliveries }),
  });
};

describe('useDriverDeliveriesFeed — activeCount terminal-status exclusion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('counts only non-terminal deliveries with no completeDateTime', async () => {
    respondWith([
      mkDelivery({ id: 'a', status: 'ACTIVE', driverStatus: 'EN_ROUTE_TO_CLIENT' }), // active
      mkDelivery({ id: 'b', status: 'ASSIGNED', driverStatus: 'ASSIGNED' }), // active
      mkDelivery({ id: 'c', status: 'COMPLETED', driverStatus: 'COMPLETED' }), // terminal
    ]);

    const { result } = renderHook(() => useDriverDeliveriesFeed());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.deliveries).toHaveLength(3);
    expect(result.current.activeCount).toBe(2);
  });

  it('excludes a delivery terminal on status even when completeDateTime is null', async () => {
    // The exact historical-data bug: status=COMPLETED but completion timestamp
    // never stamped. Must NOT be counted as active.
    respondWith([mkDelivery({ status: 'COMPLETED', driverStatus: 'ASSIGNED', completeDateTime: null })]);

    const { result } = renderHook(() => useDriverDeliveriesFeed());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.activeCount).toBe(0);
  });

  it('excludes deliveries terminal on driverStatus (CANCELLED/DELIVERED), case-insensitively', async () => {
    respondWith([
      mkDelivery({ id: 'x', status: 'ACTIVE', driverStatus: 'CANCELLED', completeDateTime: null }),
      mkDelivery({ id: 'y', status: 'ACTIVE', driverStatus: 'delivered', completeDateTime: null }),
    ]);

    const { result } = renderHook(() => useDriverDeliveriesFeed());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.activeCount).toBe(0);
  });
});
