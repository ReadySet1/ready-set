import { renderHook, act, waitFor } from '@testing-library/react';
import { useDriverDeliveries } from '../useDriverDeliveries';
import { DriverStatus } from '@/types/user';

// Mock the server actions
jest.mock('@/app/actions/tracking/delivery-actions', () => ({
  getDriverActiveDeliveries: jest.fn(),
  updateDeliveryStatus: jest.fn(),
}));

// Mock Sentry
jest.mock('@/lib/monitoring/sentry', () => ({
  captureException: jest.fn(),
  addSentryBreadcrumb: jest.fn(),
}));

import {
  getDriverActiveDeliveries,
  updateDeliveryStatus,
} from '@/app/actions/tracking/delivery-actions';
import { captureException, addSentryBreadcrumb } from '@/lib/monitoring/sentry';

const mockGetDriverActiveDeliveries = getDriverActiveDeliveries as jest.MockedFunction<typeof getDriverActiveDeliveries>;
const mockUpdateDeliveryStatus = updateDeliveryStatus as jest.MockedFunction<typeof updateDeliveryStatus>;

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

  const mockDelivery = {
    id: mockDeliveryId,
    cateringRequestId: 'catering-123',
    driverId: mockDriverId,
    status: DriverStatus.ASSIGNED,
    pickupLocation: {
      coordinates: [-122.4194, 37.7749] as [number, number],
    },
    deliveryLocation: {
      coordinates: [-122.4094, 37.7849] as [number, number],
    },
    estimatedArrival: new Date(),
    route: [],
    metadata: {},
    assignedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSessionResponse = {
    user: {
      driverId: mockDriverId,
    },
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();

    // Mock fetch for session
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSessionResponse),
    });

    // Default mock implementations
    mockGetDriverActiveDeliveries.mockResolvedValue([]);
    mockUpdateDeliveryStatus.mockResolvedValue({ success: true });
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
      mockGetDriverActiveDeliveries.mockResolvedValue([mockDelivery]);

      const { result } = renderHook(() => useDriverDeliveries());

      await waitFor(() => {
        expect(mockGetDriverActiveDeliveries).toHaveBeenCalledWith(mockDriverId);
      });

      await waitFor(() => {
        expect(result.current.activeDeliveries).toEqual([mockDelivery]);
      });
    });

    it('should set error if driver ID not found', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ user: {} }),
      });

      const { result } = renderHook(() => useDriverDeliveries());

      await waitFor(() => {
        expect(result.current.error).toBe('Driver ID not found');
      });
    });

    it('should handle load error and capture exception', async () => {
      mockGetDriverActiveDeliveries.mockRejectedValue(new Error('Server error'));

      const { result } = renderHook(() => useDriverDeliveries());

      await waitFor(() => {
        expect(result.current.error).toBe('Server error');
      });

      expect(captureException).toHaveBeenCalled();
    });

    it('should set loading state during initial load', async () => {
      let resolveDeliveries: (value: typeof mockDelivery[]) => void;
      mockGetDriverActiveDeliveries.mockImplementation(() => {
        return new Promise((resolve) => {
          resolveDeliveries = resolve;
        });
      });

      const { result } = renderHook(() => useDriverDeliveries());

      await waitFor(() => {
        expect(result.current.loading).toBe(true);
      });

      await act(async () => {
        resolveDeliveries!([mockDelivery]);
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe('updateDeliveryStatus', () => {
    it('should update delivery status successfully', async () => {
      mockGetDriverActiveDeliveries.mockResolvedValue([mockDelivery]);

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
      expect(mockUpdateDeliveryStatus).toHaveBeenCalledWith(
        mockDeliveryId,
        DriverStatus.EN_ROUTE_TO_VENDOR,
        mockLocation,
        undefined,
        undefined
      );
      expect(addSentryBreadcrumb).toHaveBeenCalledWith('Driver updated delivery status', {
        deliveryId: mockDeliveryId,
        status: DriverStatus.EN_ROUTE_TO_VENDOR,
      });
    });

    it('should include proof of delivery when provided', async () => {
      mockGetDriverActiveDeliveries.mockResolvedValue([mockDelivery]);

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

      expect(mockUpdateDeliveryStatus).toHaveBeenCalledWith(
        mockDeliveryId,
        DriverStatus.DELIVERED,
        mockLocation,
        proofUrl,
        undefined
      );
    });

    it('should include notes when provided', async () => {
      mockGetDriverActiveDeliveries.mockResolvedValue([mockDelivery]);

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

      expect(mockUpdateDeliveryStatus).toHaveBeenCalledWith(
        mockDeliveryId,
        DriverStatus.DELIVERED,
        mockLocation,
        undefined,
        notes
      );
    });

    it('should reload deliveries after status update', async () => {
      mockGetDriverActiveDeliveries.mockResolvedValue([mockDelivery]);

      const { result } = renderHook(() => useDriverDeliveries());

      await waitFor(() => {
        expect(result.current.activeDeliveries).toHaveLength(1);
      });

      // Clear calls from initial load
      mockGetDriverActiveDeliveries.mockClear();

      // Update delivery status
      await act(async () => {
        await result.current.updateDeliveryStatus(mockDeliveryId, DriverStatus.EN_ROUTE_TO_VENDOR);
      });

      // Should reload deliveries
      expect(mockGetDriverActiveDeliveries).toHaveBeenCalled();
    });

    it('should handle update failure', async () => {
      mockGetDriverActiveDeliveries.mockResolvedValue([mockDelivery]);
      mockUpdateDeliveryStatus.mockResolvedValue({ success: false, error: 'Update failed' });

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
      mockGetDriverActiveDeliveries.mockResolvedValue([mockDelivery]);
      mockUpdateDeliveryStatus.mockRejectedValue(new Error('Network error'));

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

  describe('refreshDeliveries', () => {
    it('should refresh delivery data', async () => {
      mockGetDriverActiveDeliveries.mockResolvedValue([mockDelivery]);

      const { result } = renderHook(() => useDriverDeliveries());

      await waitFor(() => {
        expect(result.current.activeDeliveries).toHaveLength(1);
      });

      // Update mock to return more deliveries
      const updatedDeliveries = [
        mockDelivery,
        { ...mockDelivery, id: 'delivery-456' },
      ];
      mockGetDriverActiveDeliveries.mockResolvedValue(updatedDeliveries);

      await act(async () => {
        await result.current.refreshDeliveries();
      });

      expect(result.current.activeDeliveries).toHaveLength(2);
    });
  });

  describe('periodic refresh', () => {
    it('should refresh deliveries every 1 minute', async () => {
      mockGetDriverActiveDeliveries.mockResolvedValue([mockDelivery]);

      const { result } = renderHook(() => useDriverDeliveries());

      await waitFor(() => {
        expect(result.current.activeDeliveries).toHaveLength(1);
      });

      // Clear previous calls
      mockGetDriverActiveDeliveries.mockClear();

      // Advance 1 minute
      await act(async () => {
        jest.advanceTimersByTime(60000);
      });

      await waitFor(() => {
        expect(mockGetDriverActiveDeliveries).toHaveBeenCalled();
      });
    });

    it('should stop periodic refresh on unmount', async () => {
      mockGetDriverActiveDeliveries.mockResolvedValue([mockDelivery]);

      const { result, unmount } = renderHook(() => useDriverDeliveries());

      await waitFor(() => {
        expect(result.current.activeDeliveries).toHaveLength(1);
      });

      unmount();

      mockGetDriverActiveDeliveries.mockClear();

      // Advance time
      await act(async () => {
        jest.advanceTimersByTime(120000);
      });

      // Should not have been called after unmount
      expect(mockGetDriverActiveDeliveries).not.toHaveBeenCalled();
    });
  });

  describe('visibility change handling', () => {
    it('should refresh when page becomes visible', async () => {
      mockGetDriverActiveDeliveries.mockResolvedValue([mockDelivery]);

      const { result } = renderHook(() => useDriverDeliveries());

      await waitFor(() => {
        expect(result.current.activeDeliveries).toHaveLength(1);
      });

      mockGetDriverActiveDeliveries.mockClear();

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
        expect(mockGetDriverActiveDeliveries).toHaveBeenCalled();
      });
    });

    it('should not refresh when page is hidden', async () => {
      mockGetDriverActiveDeliveries.mockResolvedValue([mockDelivery]);

      const { result } = renderHook(() => useDriverDeliveries());

      await waitFor(() => {
        expect(result.current.activeDeliveries).toHaveLength(1);
      });

      mockGetDriverActiveDeliveries.mockClear();

      // Simulate page becoming hidden
      Object.defineProperty(document, 'hidden', {
        value: true,
        configurable: true,
        writable: true,
      });

      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      // Should not have called getDriverActiveDeliveries
      expect(mockGetDriverActiveDeliveries).not.toHaveBeenCalled();
    });
  });

  describe('multiple deliveries', () => {
    it('should handle multiple active deliveries', async () => {
      const multipleDeliveries = [
        { ...mockDelivery, id: 'delivery-1' },
        { ...mockDelivery, id: 'delivery-2', status: DriverStatus.EN_ROUTE_TO_VENDOR },
        { ...mockDelivery, id: 'delivery-3', status: DriverStatus.AT_VENDOR },
      ];

      mockGetDriverActiveDeliveries.mockResolvedValue(multipleDeliveries);

      const { result } = renderHook(() => useDriverDeliveries());

      await waitFor(() => {
        expect(result.current.activeDeliveries).toHaveLength(3);
      });

      expect(result.current.activeDeliveries[0].id).toBe('delivery-1');
      expect(result.current.activeDeliveries[1].id).toBe('delivery-2');
      expect(result.current.activeDeliveries[2].id).toBe('delivery-3');
    });

    it('should handle empty deliveries list', async () => {
      mockGetDriverActiveDeliveries.mockResolvedValue([]);

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
      mockGetDriverActiveDeliveries.mockResolvedValue([mockDelivery]);

      const { result } = renderHook(() => useDriverDeliveries());

      await waitFor(() => {
        expect(result.current.activeDeliveries).toHaveLength(1);
      });

      // Status: ASSIGNED -> EN_ROUTE_TO_VENDOR
      await act(async () => {
        await result.current.updateDeliveryStatus(mockDeliveryId, DriverStatus.EN_ROUTE_TO_VENDOR, mockLocation);
      });
      expect(mockUpdateDeliveryStatus).toHaveBeenLastCalledWith(
        mockDeliveryId,
        DriverStatus.EN_ROUTE_TO_VENDOR,
        mockLocation,
        undefined,
        undefined
      );

      // Status: EN_ROUTE_TO_VENDOR -> AT_VENDOR
      await act(async () => {
        await result.current.updateDeliveryStatus(mockDeliveryId, DriverStatus.AT_VENDOR, mockLocation);
      });
      expect(mockUpdateDeliveryStatus).toHaveBeenLastCalledWith(
        mockDeliveryId,
        DriverStatus.AT_VENDOR,
        mockLocation,
        undefined,
        undefined
      );

      // Status: AT_VENDOR -> EN_ROUTE_TO_CLIENT
      await act(async () => {
        await result.current.updateDeliveryStatus(mockDeliveryId, DriverStatus.EN_ROUTE_TO_CLIENT, mockLocation);
      });
      expect(mockUpdateDeliveryStatus).toHaveBeenLastCalledWith(
        mockDeliveryId,
        DriverStatus.EN_ROUTE_TO_CLIENT,
        mockLocation,
        undefined,
        undefined
      );

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
      expect(mockUpdateDeliveryStatus).toHaveBeenLastCalledWith(
        mockDeliveryId,
        DriverStatus.DELIVERED,
        mockLocation,
        'https://example.com/proof.jpg',
        'Delivered to reception'
      );
    });
  });
});
