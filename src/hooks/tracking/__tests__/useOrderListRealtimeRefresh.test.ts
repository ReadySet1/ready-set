/**
 * useOrderListRealtimeRefresh: an admin orders list refreshes when a
 * `delivery:status:updated` event (e.g. the ASSIGNED broadcast from
 * POST /api/orders/assignDriver) arrives for an order of its type (REA-344).
 */

import { renderHook, act } from '@testing-library/react';
import type { DeliveryStatusUpdatedPayload } from '@/lib/realtime/schemas';

type HookOptions = {
  orderId?: string | null;
  orderIds?: string[];
  enabled?: boolean;
  showNotifications?: boolean;
  onStatusUpdate?: (payload: DeliveryStatusUpdatedPayload) => void;
};

const mockUseDeliveryStatusRealtime = jest.fn((_options: HookOptions) => ({
  latestStatus: null,
  statusByOrder: new Map(),
  isConnected: true,
  isConnecting: false,
  error: null,
  reconnect: jest.fn(),
}));

jest.mock('@/hooks/tracking/useDeliveryStatusRealtime', () => ({
  useDeliveryStatusRealtime: (options: HookOptions) => mockUseDeliveryStatusRealtime(options),
}));

import { useOrderListRealtimeRefresh } from '../useOrderListRealtimeRefresh';

const event = (overrides: Partial<DeliveryStatusUpdatedPayload> = {}): DeliveryStatusUpdatedPayload => ({
  orderId: '11111111-1111-4111-8111-111111111111',
  orderNumber: 'CAT001',
  orderType: 'catering',
  driverId: '22222222-2222-4222-8222-222222222222',
  status: 'ASSIGNED',
  timestamp: new Date().toISOString(),
  ...overrides,
});

const lastOptions = (): HookOptions => {
  const calls = mockUseDeliveryStatusRealtime.mock.calls;
  return calls[calls.length - 1]![0];
};

const emit = (payload: DeliveryStatusUpdatedPayload) => {
  act(() => {
    lastOptions().onStatusUpdate?.(payload);
  });
};

describe('useOrderListRealtimeRefresh', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockUseDeliveryStatusRealtime.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('subscribes to every order (no order filter) without per-event toasts', () => {
    renderHook(() => useOrderListRealtimeRefresh({ orderType: 'catering', onRefresh: jest.fn() }));

    const options = lastOptions();
    expect(options.enabled).toBe(true);
    expect(options.showNotifications).toBe(false);
    expect(options.orderId).toBeUndefined();
    expect(options.orderIds).toBeUndefined();
  });

  it('passes enabled: false through to the realtime subscription', () => {
    renderHook(() =>
      useOrderListRealtimeRefresh({ orderType: 'catering', onRefresh: jest.fn(), enabled: false }),
    );

    expect(lastOptions().enabled).toBe(false);
  });

  it('refreshes once after a burst of events for its order type', () => {
    const onRefresh = jest.fn();
    renderHook(() =>
      useOrderListRealtimeRefresh({ orderType: 'catering', onRefresh, debounceMs: 500 }),
    );

    emit(event());
    emit(event({ orderNumber: 'CAT002' }));
    emit(event({ status: 'EN_ROUTE_TO_VENDOR' }));
    expect(onRefresh).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('ignores events for the other order type', () => {
    const onRefresh = jest.fn();
    renderHook(() =>
      useOrderListRealtimeRefresh({ orderType: 'catering', onRefresh, debounceMs: 500 }),
    );

    emit(event({ orderType: 'on_demand' }));
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('does not refresh after unmount (pending debounce is cleared)', () => {
    const onRefresh = jest.fn();
    const { unmount } = renderHook(() =>
      useOrderListRealtimeRefresh({ orderType: 'on_demand', onRefresh, debounceMs: 500 }),
    );

    emit(event({ orderType: 'on_demand' }));
    unmount();
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(onRefresh).not.toHaveBeenCalled();
  });
});
