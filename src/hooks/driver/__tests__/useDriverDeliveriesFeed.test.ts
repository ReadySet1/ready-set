/**
 * Regression tests for useDriverDeliveriesFeed.activeCount.
 *
 * Fix: activeCount now excludes terminal statuses (COMPLETED / CANCELLED /
 * DELIVERED) on either `status` or `driverStatus`, in addition to the existing
 * `completeDateTime` guard. This stops a finished delivery whose completion
 * timestamp is missing (historical-data bug) from resurrecting itself as active
 * — the "N active" card and the list now agree.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
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

describe('useDriverDeliveriesFeed — polling resilience', () => {
  const FEED_URL = '/api/driver-deliveries?page=1&limit=999';

  const okResponse = (deliveries: ApiDelivery[]) => ({
    ok: true,
    json: jest.fn().mockResolvedValue({ deliveries }),
  });

  /** A fetch that stays pending until the test resolves it. */
  const deferredFetch = () => {
    let resolve!: (value: unknown) => void;
    const promise = new Promise((r) => {
      resolve = r;
    });
    return { promise, resolve };
  };

  const flush = async () => {
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
  };

  const setHidden = (hidden: boolean) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  };

  beforeEach(() => {
    jest.useFakeTimers();
    mockFetch.mockReset();
    setHidden(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    setHidden(false);
  });

  it('fires exactly one fetch on mount', async () => {
    mockFetch.mockResolvedValue(okResponse([mkDelivery({})]));

    const { result } = renderHook(() => useDriverDeliveriesFeed());
    await flush();

    expect(result.current.loading).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toBe(FEED_URL);
  });

  it('keeps the last good data and shows no error when a background poll fails', async () => {
    mockFetch.mockResolvedValueOnce(okResponse([mkDelivery({ id: 'a' })]));

    const { result } = renderHook(() => useDriverDeliveriesFeed());
    await flush();
    expect(result.current.deliveries).toHaveLength(1);

    mockFetch.mockResolvedValueOnce({ ok: false, json: jest.fn() });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(60_000);
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.current.deliveries).toHaveLength(1);
    expect(result.current.deliveries[0].id).toBe('a');
    expect(result.current.error).toBeNull();
  });

  it('keeps the last good data when a poll rejects with a network error', async () => {
    mockFetch.mockResolvedValueOnce(okResponse([mkDelivery({ id: 'a' })]));

    const { result } = renderHook(() => useDriverDeliveriesFeed());
    await flush();

    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(60_000);
    });

    expect(result.current.deliveries.map((d) => d.id)).toEqual(['a']);
    expect(result.current.error).toBeNull();
  });

  it('still reports an error when the very first load fails (nothing to show)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, json: jest.fn() });

    const { result } = renderHook(() => useDriverDeliveriesFeed());
    await flush();

    expect(result.current.loading).toBe(false);
    expect(result.current.deliveries).toEqual([]);
    expect(result.current.error).toBe('Failed to fetch deliveries');
  });

  it('clears the first-load error once a retry succeeds', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, json: jest.fn() });

    const { result } = renderHook(() => useDriverDeliveriesFeed());
    await flush();
    expect(result.current.error).toBe('Failed to fetch deliveries');

    mockFetch.mockResolvedValueOnce(okResponse([mkDelivery({ id: 'a' })]));
    await act(async () => {
      result.current.refresh();
      await jest.advanceTimersByTimeAsync(0);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.deliveries.map((d) => d.id)).toEqual(['a']);
  });

  it('aborts the in-flight request on unmount and never reads the late response', async () => {
    const pending = deferredFetch();
    mockFetch.mockReturnValueOnce(pending.promise);

    const { unmount } = renderHook(() => useDriverDeliveriesFeed());
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const init = mockFetch.mock.calls[0][1] as RequestInit | undefined;
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(init?.signal?.aborted).toBe(false);

    unmount();
    expect(init?.signal?.aborted).toBe(true);

    // The response lands after unmount: the hook must not parse it or set state.
    const late = okResponse([mkDelivery({})]);
    await act(async () => {
      pending.resolve(late);
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(late.json).not.toHaveBeenCalled();

    // No more polling after unmount.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(120_000);
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('refetches when the tab becomes visible again, but not while hidden', async () => {
    mockFetch.mockResolvedValue(okResponse([mkDelivery({})]));

    renderHook(() => useDriverDeliveriesFeed());
    await flush();
    expect(mockFetch).toHaveBeenCalledTimes(1);

    setHidden(true);
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);

    setHidden(false);
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('keeps polling every 60s', async () => {
    mockFetch.mockResolvedValue(okResponse([mkDelivery({})]));

    renderHook(() => useDriverDeliveriesFeed());
    await flush();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(120_000);
    });

    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});
