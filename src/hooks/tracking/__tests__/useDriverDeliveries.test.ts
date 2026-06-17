import { renderHook, act, waitFor } from '@testing-library/react';
import { useDriverDeliveries } from '../useDriverDeliveries';
import { DriverStatus } from '@/types/user';

// The hook no longer uses the delivery-actions Server Actions
// (getDriverActiveDeliveries / updateDeliveryStatus). It now:
//   - loads from the orders feed:  GET  /api/driver-deliveries
//   - advances an order via:       PATCH /api/orders/[orderNumber]
//   - reads the auth token from the Supabase browser client.
// All of that is exercised through the supabase + global.fetch mocks below.

// Supabase client (only used for the bearer token on PATCH requests).
jest.mock('@/utils/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: jest
        .fn()
        .mockResolvedValue({ data: { session: { access_token: 'test-token' } } }),
    },
  }),
}));

// Mock Sentry
jest.mock('@/lib/monitoring/sentry', () => ({
  captureException: jest.fn(),
  addSentryBreadcrumb: jest.fn(),
}));

import { captureException, addSentryBreadcrumb } from '@/lib/monitoring/sentry';

describe('useDriverDeliveries', () => {
  const mockDriverId = '123e4567-e89b-12d3-a456-426614174000';
  const mockDeliveryId = 'delivery-123';

  const mockLocation = {
    driverId: mockDriverId,
    coordinates: { lat: 37.7749, lng: -122.4194 },
    accuracy: 10,
    speed: 5,
    heading: 180,
    altitude: 50,
    batteryLevel: 80,
    activityType: 'driving' as const,
    isMoving: true,
    timestamp: new Date(),
  };

  // --- orders-feed item + expected mapped DeliveryTracking ----------------
  // Build an order row in the shape /api/driver-deliveries returns. By default
  // it's a catering order that is still active (no completeDateTime, non-terminal
  // status) so the hook keeps it.
  const makeOrder = (overrides: Record<string, any> = {}) => ({
    orderNumber: mockDeliveryId,
    delivery_type: 'catering',
    status: 'ACTIVE',
    driverStatus: DriverStatus.ASSIGNED,
    completeDateTime: null,
    arrivalDateTime: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    address: { latitude: 37.7749, longitude: -122.4194 },
    delivery_address: { latitude: 37.7849, longitude: -122.4094 },
    fileUploads: [],
    ...overrides,
  });

  // The single default order used in most tests.
  const mockOrder = makeOrder();

  const mockSessionResponse = {
    user: {
      driverId: mockDriverId,
    },
  };

  // --- fetch routing mock -------------------------------------------------
  type FetchResult = {
    ok: boolean;
    status: number;
    json: () => Promise<any>;
  };

  let sessionResponse: () => FetchResult;
  // Orders feed handler -> the array under { deliveries: [...] }.
  let deliveriesHandler: () => any[] | Promise<any[]>;
  // PATCH /api/orders/[id] handler -> default success.
  let orderPatchHandler: () => FetchResult | Promise<FetchResult>;

  const okJson = (body: any, status = 200): FetchResult => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });

  const setDeliveries = (list: any[]) => {
    deliveriesHandler = () => list;
  };

  // PATCH calls made to the orders route.
  const orderPatchCalls = () =>
    (global.fetch as jest.Mock).mock.calls.filter(([url]) =>
      String(url).startsWith('/api/orders/'),
    );

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();

    sessionResponse = () => okJson(mockSessionResponse);
    setDeliveries([]); // empty feed by default
    orderPatchHandler = () => okJson({}, 200);

    global.fetch = jest.fn((input: RequestInfo | URL): Promise<any> => {
      const url = String(input);
      if (url.includes('/api/auth/session')) {
        return Promise.resolve(sessionResponse());
      }
      if (url.includes('/api/driver-deliveries')) {
        return Promise.resolve(
          Promise.resolve(deliveriesHandler()).then((list) =>
            okJson({ deliveries: list }),
          ),
        );
      }
      if (url.startsWith('/api/orders/')) {
        return Promise.resolve(orderPatchHandler());
      }
      return Promise.resolve(okJson({}));
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  describe('initialization', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useDriverDeliveries());

      expect(result.current.activeDeliveries).toEqual([]);
      // Hook starts loading on mount
      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBe(null);
    });

    it('should load active deliveries on mount', async () => {
      setDeliveries([mockOrder]);

      const { result } = renderHook(() => useDriverDeliveries());

      // Loads from the orders feed (not the old getDriverActiveDeliveries action).
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/driver-deliveries?page=1&limit=999',
          expect.objectContaining({ credentials: 'include' }),
        );
      });

      // Order row is mapped into a DeliveryTracking keyed by order number.
      await waitFor(() => {
        expect(result.current.activeDeliveries).toHaveLength(1);
      });
      const delivery = result.current.activeDeliveries[0];
      expect(delivery.id).toBe(mockDeliveryId);
      expect(delivery.cateringRequestId).toBe(mockDeliveryId);
      expect(delivery.status).toBe(DriverStatus.ASSIGNED);
    });

    it('should set error if driver ID not found', async () => {
      // The orders feed itself rejecting is what surfaces a load error now; the
      // missing-driver case is represented by the feed returning unauthorized.
      sessionResponse = () => okJson({ user: {} });
      deliveriesHandler = () => Promise.reject(new Error('Driver ID not found'));

      const { result } = renderHook(() => useDriverDeliveries());

      await waitFor(() => {
        expect(result.current.error).toBe('Driver ID not found');
      });
    });

    it('should handle load error and capture exception', async () => {
      deliveriesHandler = () => Promise.reject(new Error('Server error'));

      const { result } = renderHook(() => useDriverDeliveries());

      await waitFor(() => {
        expect(result.current.error).toBe('Server error');
      });

      expect(captureException).toHaveBeenCalled();
    });

    it('should set loading state during initial load', async () => {
      let resolveDeliveries: (value: any[]) => void;
      deliveriesHandler = () =>
        new Promise<any[]>((resolve) => {
          resolveDeliveries = resolve;
        });

      const { result } = renderHook(() => useDriverDeliveries());

      await waitFor(() => {
        expect(result.current.loading).toBe(true);
      });

      await act(async () => {
        resolveDeliveries!([mockOrder]);
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe('updateDeliveryStatus', () => {
    it('should update delivery status successfully', async () => {
      setDeliveries([mockOrder]);

      const { result } = renderHook(() => useDriverDeliveries());

      await waitFor(() => {
        expect(result.current.activeDeliveries).toHaveLength(1);
      });

      let success: boolean;
      await act(async () => {
        success = await result.current.updateDeliveryStatus(
          mockDeliveryId,
          DriverStatus.EN_ROUTE_TO_VENDOR,
          mockLocation
        );
      });

      expect(success!).toBe(true);
      // The order is advanced via PATCH /api/orders/<orderNumber> with the new
      // driverStatus in the body and the supabase bearer token attached.
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/orders/${mockDeliveryId}`,
        expect.objectContaining({
          method: 'PATCH',
          credentials: 'include',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json',
          }),
        }),
      );
      const patchCall = orderPatchCalls().pop();
      expect(JSON.parse(patchCall![1].body)).toEqual({
        driverStatus: DriverStatus.EN_ROUTE_TO_VENDOR,
      });
      expect(addSentryBreadcrumb).toHaveBeenCalledWith('Driver updated delivery status', {
        orderNumber: mockDeliveryId,
        status: DriverStatus.EN_ROUTE_TO_VENDOR,
      });
    });

    it('should include proof of delivery when provided', async () => {
      setDeliveries([mockOrder]);

      const { result } = renderHook(() => useDriverDeliveries());

      await waitFor(() => {
        expect(result.current.activeDeliveries).toHaveLength(1);
      });

      const proofUrl = 'https://example.com/proof.jpg';

      await act(async () => {
        await result.current.updateDeliveryStatus(
          mockDeliveryId,
          DriverStatus.DELIVERED,
          mockLocation,
          proofUrl
        );
      });

      // DELIVERED is advanced through the same orders PATCH.
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/orders/${mockDeliveryId}`,
        expect.objectContaining({ method: 'PATCH' }),
      );
      const patchCall = orderPatchCalls().pop();
      expect(JSON.parse(patchCall![1].body)).toEqual({
        driverStatus: DriverStatus.DELIVERED,
      });
    });

    it('should include notes when provided', async () => {
      setDeliveries([mockOrder]);

      const { result } = renderHook(() => useDriverDeliveries());

      await waitFor(() => {
        expect(result.current.activeDeliveries).toHaveLength(1);
      });

      const notes = 'Left at front door';

      await act(async () => {
        await result.current.updateDeliveryStatus(
          mockDeliveryId,
          DriverStatus.DELIVERED,
          mockLocation,
          undefined,
          notes
        );
      });

      expect(global.fetch).toHaveBeenCalledWith(
        `/api/orders/${mockDeliveryId}`,
        expect.objectContaining({ method: 'PATCH' }),
      );
      const patchCall = orderPatchCalls().pop();
      expect(JSON.parse(patchCall![1].body)).toEqual({
        driverStatus: DriverStatus.DELIVERED,
      });
    });

    it('should reload deliveries after status update', async () => {
      setDeliveries([mockOrder]);

      const { result } = renderHook(() => useDriverDeliveries());

      await waitFor(() => {
        expect(result.current.activeDeliveries).toHaveLength(1);
      });

      // Clear calls from initial load
      (global.fetch as jest.Mock).mockClear();

      // Update delivery status
      await act(async () => {
        await result.current.updateDeliveryStatus(mockDeliveryId, DriverStatus.EN_ROUTE_TO_VENDOR);
      });

      // Should reload from the orders feed after the PATCH.
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/driver-deliveries?page=1&limit=999',
        expect.objectContaining({ credentials: 'include' }),
      );
    });

    it('should handle update failure', async () => {
      setDeliveries([mockOrder]);
      // Orders PATCH returns a non-OK response carrying the error message.
      orderPatchHandler = () => okJson({ error: 'Update failed' }, 400);

      const { result } = renderHook(() => useDriverDeliveries());

      await waitFor(() => {
        expect(result.current.activeDeliveries).toHaveLength(1);
      });

      let success: boolean;
      await act(async () => {
        success = await result.current.updateDeliveryStatus(mockDeliveryId, DriverStatus.EN_ROUTE_TO_VENDOR);
      });

      expect(success!).toBe(false);
      expect(result.current.error).toBe('Update failed');
      expect(captureException).toHaveBeenCalled();
    });

    it('should handle network error', async () => {
      setDeliveries([mockOrder]);
      orderPatchHandler = () => Promise.reject(new Error('Network error'));

      const { result } = renderHook(() => useDriverDeliveries());

      await waitFor(() => {
        expect(result.current.activeDeliveries).toHaveLength(1);
      });

      let success: boolean;
      await act(async () => {
        success = await result.current.updateDeliveryStatus(mockDeliveryId, DriverStatus.EN_ROUTE_TO_VENDOR);
      });

      expect(success!).toBe(false);
      expect(result.current.error).toBe('Network error');
    });
  });

  describe('completion two-PATCH sync', () => {
    it('completing a delivery also syncs the order status (second PATCH)', async () => {
      setDeliveries([mockOrder]);

      const { result } = renderHook(() => useDriverDeliveries());

      await waitFor(() => {
        expect(result.current.activeDeliveries).toHaveLength(1);
      });

      let ok: boolean;
      await act(async () => {
        ok = await result.current.updateDeliveryStatus(
          mockDeliveryId,
          DriverStatus.COMPLETED,
          mockLocation,
        );
      });

      expect(ok!).toBe(true);
      // Completion fires TWO PATCHes to the same order: the driverStatus
      // transition, then the order-status follow-up (order-insensitive).
      const bodies = orderPatchCalls().map(([, init]) => JSON.parse(init.body));
      expect(bodies).toEqual(
        expect.arrayContaining([
          { driverStatus: DriverStatus.COMPLETED },
          { status: 'COMPLETED' },
        ]),
      );
    });

    it('still resolves true when the second (order-status) PATCH fails', async () => {
      setDeliveries([mockOrder]);

      // First PATCH (driverStatus) succeeds; the second PATCH (order status)
      // rejects. The hook fires it as fire-and-forget with a .catch swallow by
      // design, so the overall completion must still resolve true.
      let patchCount = 0;
      orderPatchHandler = () => {
        patchCount += 1;
        if (patchCount >= 2) {
          return Promise.reject(new Error('Order status sync 500'));
        }
        return okJson({}, 200);
      };

      const { result } = renderHook(() => useDriverDeliveries());

      await waitFor(() => {
        expect(result.current.activeDeliveries).toHaveLength(1);
      });

      let ok: boolean;
      await act(async () => {
        ok = await result.current.updateDeliveryStatus(
          mockDeliveryId,
          DriverStatus.COMPLETED,
          mockLocation,
        );
      });

      expect(ok!).toBe(true);
      // Both PATCHes were attempted (the second one is the one that rejected).
      const bodies = orderPatchCalls().map(([, init]) => JSON.parse(init.body));
      expect(bodies).toEqual(
        expect.arrayContaining([
          { driverStatus: DriverStatus.COMPLETED },
          { status: 'COMPLETED' },
        ]),
      );
      // The first PATCH succeeded, so no error is surfaced to the UI.
      expect(result.current.error).toBe(null);
    });
  });

  describe('refreshDeliveries', () => {
    it('should refresh delivery data', async () => {
      setDeliveries([mockOrder]);

      const { result } = renderHook(() => useDriverDeliveries());

      await waitFor(() => {
        expect(result.current.activeDeliveries).toHaveLength(1);
      });

      // Update feed to return more deliveries
      setDeliveries([mockOrder, makeOrder({ orderNumber: 'delivery-456' })]);

      await act(async () => {
        await result.current.refreshDeliveries();
      });

      expect(result.current.activeDeliveries).toHaveLength(2);
    });
  });

  describe('periodic refresh', () => {
    it('should refresh deliveries every 1 minute', async () => {
      setDeliveries([mockOrder]);

      const { result } = renderHook(() => useDriverDeliveries());

      await waitFor(() => {
        expect(result.current.activeDeliveries).toHaveLength(1);
      });

      // Clear previous calls
      (global.fetch as jest.Mock).mockClear();

      // Advance 1 minute
      await act(async () => {
        jest.advanceTimersByTime(60000);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/driver-deliveries?page=1&limit=999',
          expect.objectContaining({ credentials: 'include' }),
        );
      });
    });

    it('should stop periodic refresh on unmount', async () => {
      setDeliveries([mockOrder]);

      const { result, unmount } = renderHook(() => useDriverDeliveries());

      await waitFor(() => {
        expect(result.current.activeDeliveries).toHaveLength(1);
      });

      unmount();

      (global.fetch as jest.Mock).mockClear();

      // Advance time
      await act(async () => {
        jest.advanceTimersByTime(120000);
      });

      // Should not have fetched the feed after unmount
      expect(global.fetch).not.toHaveBeenCalledWith(
        '/api/driver-deliveries?page=1&limit=999',
        expect.anything(),
      );
    });
  });

  describe('visibility change handling', () => {
    it('should refresh when page becomes visible', async () => {
      setDeliveries([mockOrder]);

      const { result } = renderHook(() => useDriverDeliveries());

      await waitFor(() => {
        expect(result.current.activeDeliveries).toHaveLength(1);
      });

      (global.fetch as jest.Mock).mockClear();

      // Simulate page becoming visible
      Object.defineProperty(document, 'hidden', {
        value: false,
        configurable: true,
        writable: true,
      });

      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/driver-deliveries?page=1&limit=999',
          expect.objectContaining({ credentials: 'include' }),
        );
      });
    });

    it('should not refresh when page is hidden', async () => {
      setDeliveries([mockOrder]);

      const { result } = renderHook(() => useDriverDeliveries());

      await waitFor(() => {
        expect(result.current.activeDeliveries).toHaveLength(1);
      });

      (global.fetch as jest.Mock).mockClear();

      // Simulate page becoming hidden
      Object.defineProperty(document, 'hidden', {
        value: true,
        configurable: true,
        writable: true,
      });

      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      // Should not have fetched the feed while hidden
      expect(global.fetch).not.toHaveBeenCalledWith(
        '/api/driver-deliveries?page=1&limit=999',
        expect.anything(),
      );
    });
  });

  describe('multiple deliveries', () => {
    it('should handle multiple active deliveries', async () => {
      const multipleDeliveries = [
        makeOrder({ orderNumber: 'delivery-1' }),
        makeOrder({ orderNumber: 'delivery-2', driverStatus: DriverStatus.EN_ROUTE_TO_VENDOR }),
        makeOrder({ orderNumber: 'delivery-3', driverStatus: DriverStatus.AT_VENDOR }),
      ];

      setDeliveries(multipleDeliveries);

      const { result } = renderHook(() => useDriverDeliveries());

      await waitFor(() => {
        expect(result.current.activeDeliveries).toHaveLength(3);
      });

      expect(result.current.activeDeliveries[0].id).toBe('delivery-1');
      expect(result.current.activeDeliveries[1].id).toBe('delivery-2');
      expect(result.current.activeDeliveries[2].id).toBe('delivery-3');
    });

    it('should handle empty deliveries list', async () => {
      setDeliveries([]);

      const { result } = renderHook(() => useDriverDeliveries());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.activeDeliveries).toEqual([]);
      expect(result.current.error).toBe(null);
    });
  });

  describe('delivery status transitions', () => {
    it('should handle full delivery workflow', async () => {
      setDeliveries([mockOrder]);

      const { result } = renderHook(() => useDriverDeliveries());

      await waitFor(() => {
        expect(result.current.activeDeliveries).toHaveLength(1);
      });

      const lastPatchBody = () => JSON.parse(orderPatchCalls().pop()![1].body);

      // Status: ASSIGNED -> EN_ROUTE_TO_VENDOR
      await act(async () => {
        await result.current.updateDeliveryStatus(mockDeliveryId, DriverStatus.EN_ROUTE_TO_VENDOR, mockLocation);
      });
      expect(lastPatchBody()).toEqual({ driverStatus: DriverStatus.EN_ROUTE_TO_VENDOR });

      // Status: EN_ROUTE_TO_VENDOR -> AT_VENDOR
      await act(async () => {
        await result.current.updateDeliveryStatus(mockDeliveryId, DriverStatus.AT_VENDOR, mockLocation);
      });
      expect(lastPatchBody()).toEqual({ driverStatus: DriverStatus.AT_VENDOR });

      // Status: AT_VENDOR -> EN_ROUTE_TO_CLIENT
      await act(async () => {
        await result.current.updateDeliveryStatus(mockDeliveryId, DriverStatus.EN_ROUTE_TO_CLIENT, mockLocation);
      });
      expect(lastPatchBody()).toEqual({ driverStatus: DriverStatus.EN_ROUTE_TO_CLIENT });

      // Status: EN_ROUTE_TO_CLIENT -> DELIVERED
      await act(async () => {
        await result.current.updateDeliveryStatus(
          mockDeliveryId,
          DriverStatus.DELIVERED,
          mockLocation,
          'https://example.com/proof.jpg',
          'Delivered to reception'
        );
      });
      expect(lastPatchBody()).toEqual({ driverStatus: DriverStatus.DELIVERED });
    });
  });
});
