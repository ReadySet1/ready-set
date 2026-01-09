import { renderHook, act, waitFor } from '@testing-library/react';
import { useAdminRealtimeTracking } from '../useAdminRealtimeTracking';

// Mock useRealTimeTracking hook
const mockSseTracking = {
  activeDrivers: [],
  recentLocations: [],
  activeDeliveries: [],
  isConnected: false,
  error: null,
  reconnect: jest.fn(),
};

jest.mock('../useRealTimeTracking', () => ({
  useRealTimeTracking: jest.fn(() => mockSseTracking),
}));

// Mock channel subscribe/unsubscribe
const mockChannelSubscribe = jest.fn();
const mockChannelUnsubscribe = jest.fn().mockResolvedValue(undefined);

const mockChannel = {
  subscribe: mockChannelSubscribe,
  unsubscribe: mockChannelUnsubscribe,
};

// Mock realtime module
jest.mock('@/lib/realtime', () => ({
  createDriverLocationChannel: jest.fn(() => mockChannel),
}));

// Mock feature flags
jest.mock('@/lib/feature-flags', () => ({
  FEATURE_FLAGS: {
    USE_REALTIME_ADMIN_DASHBOARD: 'use_realtime_admin_dashboard',
  },
  isFeatureEnabled: jest.fn(() => true),
}));

// Mock realtime logger
jest.mock('@/lib/logging/realtime-logger', () => ({
  realtimeLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock MEMORY_CONFIG
jest.mock('@/constants/realtime-config', () => ({
  MEMORY_CONFIG: {
    MAX_RECENT_LOCATIONS: 100,
    PROCESSED_LOCATIONS_THRESHOLD: 500,
    PROCESSED_LOCATIONS_CLEANUP_BATCH: 250,
    LOCATION_ENTRY_MAX_AGE_MS: 3600000, // 1 hour
    TIME_BASED_CLEANUP_INTERVAL_MS: 900000, // 15 minutes
  },
}));

import { useRealTimeTracking } from '../useRealTimeTracking';
import { createDriverLocationChannel } from '@/lib/realtime';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { realtimeLogger } from '@/lib/logging/realtime-logger';

// Helper to simulate channel callbacks
let channelCallbacks: {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
  onLocationUpdate?: (payload: any) => void;
} = {};

describe('useAdminRealtimeTracking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    channelCallbacks = {};

    // Reset mocks to default state
    (useRealTimeTracking as jest.Mock).mockReturnValue({
      ...mockSseTracking,
      isConnected: true,
    });

    (isFeatureEnabled as jest.Mock).mockReturnValue(true);

    mockChannelSubscribe.mockImplementation(async (callbacks) => {
      channelCallbacks = callbacks;
      // Simulate successful connection
      callbacks.onConnect?.();
    });
    mockChannelUnsubscribe.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('initialization', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useAdminRealtimeTracking());

      expect(result.current.activeDrivers).toEqual([]);
      expect(result.current.recentLocations).toEqual([]);
      expect(result.current.activeDeliveries).toEqual([]);
      expect(result.current.error).toBe(null);
      expect(typeof result.current.reconnect).toBe('function');
      expect(typeof result.current.toggleMode).toBe('function');
    });

    it('should use SSE tracking as fallback', () => {
      renderHook(() => useAdminRealtimeTracking());

      expect(useRealTimeTracking).toHaveBeenCalled();
    });

    it('should initialize Realtime channel when feature is enabled', async () => {
      renderHook(() => useAdminRealtimeTracking());

      await waitFor(() => {
        expect(createDriverLocationChannel).toHaveBeenCalled();
      });
    });

    it('should not initialize Realtime when feature is disabled', async () => {
      (isFeatureEnabled as jest.Mock).mockReturnValue(false);

      const { result } = renderHook(() => useAdminRealtimeTracking());

      await waitFor(() => {
        expect(result.current.connectionMode).toBe('sse');
      });

      expect(createDriverLocationChannel).not.toHaveBeenCalled();
    });

    it('should not initialize Realtime when enableRealtimeReceive is false', async () => {
      const { result } = renderHook(() =>
        useAdminRealtimeTracking({ enableRealtimeReceive: false })
      );

      await waitFor(() => {
        expect(result.current.connectionMode).toBe('sse');
      });

      expect(createDriverLocationChannel).not.toHaveBeenCalled();
    });

    it('should not initialize Realtime when useRealtimeMode is false', async () => {
      const { result } = renderHook(() =>
        useAdminRealtimeTracking({ useRealtimeMode: false })
      );

      await waitFor(() => {
        expect(result.current.connectionMode).toBe('sse');
      });

      expect(createDriverLocationChannel).not.toHaveBeenCalled();
    });
  });

  describe('Realtime connection', () => {
    it('should set isRealtimeConnected on successful connection', async () => {
      const { result } = renderHook(() => useAdminRealtimeTracking());

      await waitFor(() => {
        expect(result.current.isRealtimeConnected).toBe(true);
      });

      expect(result.current.connectionMode).toBe('realtime');
    });

    it('should call onRealtimeConnect callback when connected', async () => {
      const onRealtimeConnect = jest.fn();

      renderHook(() =>
        useAdminRealtimeTracking({ onRealtimeConnect })
      );

      await waitFor(() => {
        expect(onRealtimeConnect).toHaveBeenCalled();
      });
    });

    it('should handle disconnect', async () => {
      const onRealtimeDisconnect = jest.fn();

      const { result } = renderHook(() =>
        useAdminRealtimeTracking({ onRealtimeDisconnect })
      );

      await waitFor(() => {
        expect(result.current.isRealtimeConnected).toBe(true);
      });

      // Simulate disconnect
      await act(async () => {
        channelCallbacks.onDisconnect?.();
      });

      expect(result.current.isRealtimeConnected).toBe(false);
      // connectionMode is 'hybrid' because useRealtime is still true (user still wants Realtime)
      // but isRealtimeConnected is false, so it's attempting to reconnect while using SSE fallback
      expect(result.current.connectionMode).toBe('hybrid');
      expect(onRealtimeDisconnect).toHaveBeenCalled();
    });

    it('should handle connection error', async () => {
      const onRealtimeError = jest.fn();

      const { result } = renderHook(() =>
        useAdminRealtimeTracking({ onRealtimeError })
      );

      await waitFor(() => {
        expect(result.current.isRealtimeConnected).toBe(true);
      });

      // Simulate error
      const error = new Error('Connection lost');
      await act(async () => {
        channelCallbacks.onError?.(error);
      });

      expect(result.current.isRealtimeConnected).toBe(false);
      // connectionMode is 'hybrid' because useRealtime is still true (user still wants Realtime)
      // but isRealtimeConnected is false, so it's attempting to reconnect while using SSE fallback
      expect(result.current.connectionMode).toBe('hybrid');
      expect(result.current.error).toBe('Connection lost');
      expect(onRealtimeError).toHaveBeenCalledWith(error);
      expect(realtimeLogger.error).toHaveBeenCalled();
    });

    it('should handle initialization error', async () => {
      const onRealtimeError = jest.fn();
      mockChannelSubscribe.mockRejectedValueOnce(new Error('Init failed'));

      const { result } = renderHook(() =>
        useAdminRealtimeTracking({ onRealtimeError })
      );

      await waitFor(() => {
        expect(result.current.error).toBe('Init failed');
      });

      expect(result.current.connectionMode).toBe('sse');
      expect(onRealtimeError).toHaveBeenCalled();
    });
  });

  describe('location updates', () => {
    it('should handle valid location update', async () => {
      const { result } = renderHook(() => useAdminRealtimeTracking());

      await waitFor(() => {
        expect(result.current.isRealtimeConnected).toBe(true);
      });

      const payload = {
        driverId: 'driver-123',
        lat: 37.7749,
        lng: -122.4194,
        accuracy: 10,
        speed: 5,
        heading: 180,
        batteryLevel: 80,
        isMoving: true,
        activityType: 'driving',
        timestamp: new Date().toISOString(),
        driverName: 'John Doe',
        vehicleNumber: 'ABC123',
      };

      await act(async () => {
        channelCallbacks.onLocationUpdate?.(payload);
      });

      expect(result.current.recentLocations).toHaveLength(1);
      expect(result.current.recentLocations[0].driverId).toBe('driver-123');
      expect(result.current.activeDrivers).toHaveLength(1);
      expect(result.current.activeDrivers[0].id).toBe('driver-123');
    });

    it('should reject invalid coordinates', async () => {
      const { result } = renderHook(() => useAdminRealtimeTracking());

      await waitFor(() => {
        expect(result.current.isRealtimeConnected).toBe(true);
      });

      // Invalid latitude (> 90)
      await act(async () => {
        channelCallbacks.onLocationUpdate?.({
          driverId: 'driver-123',
          lat: 100,
          lng: -122.4194,
          timestamp: new Date().toISOString(),
        });
      });

      expect(result.current.recentLocations).toHaveLength(0);
      expect(realtimeLogger.warn).toHaveBeenCalledWith(
        'Invalid coordinates in location payload',
        expect.any(Object)
      );
    });

    it('should reject missing required fields', async () => {
      const { result } = renderHook(() => useAdminRealtimeTracking());

      await waitFor(() => {
        expect(result.current.isRealtimeConnected).toBe(true);
      });

      // Missing driverId
      await act(async () => {
        channelCallbacks.onLocationUpdate?.({
          lat: 37.7749,
          lng: -122.4194,
          timestamp: new Date().toISOString(),
        });
      });

      expect(result.current.recentLocations).toHaveLength(0);
      expect(realtimeLogger.warn).toHaveBeenCalledWith(
        'Missing required fields in location payload',
        expect.any(Object)
      );
    });

    it('should prevent duplicate location processing', async () => {
      const { result } = renderHook(() => useAdminRealtimeTracking());

      await waitFor(() => {
        expect(result.current.isRealtimeConnected).toBe(true);
      });

      const timestamp = new Date().toISOString();
      const payload = {
        driverId: 'driver-123',
        lat: 37.7749,
        lng: -122.4194,
        timestamp,
      };

      // Send same location twice
      await act(async () => {
        channelCallbacks.onLocationUpdate?.(payload);
        channelCallbacks.onLocationUpdate?.(payload);
      });

      // Should only process once
      expect(result.current.recentLocations).toHaveLength(1);
    });

    it('should update existing driver location', async () => {
      const { result } = renderHook(() => useAdminRealtimeTracking());

      await waitFor(() => {
        expect(result.current.isRealtimeConnected).toBe(true);
      });

      // First location
      await act(async () => {
        channelCallbacks.onLocationUpdate?.({
          driverId: 'driver-123',
          lat: 37.7749,
          lng: -122.4194,
          timestamp: new Date().toISOString(),
        });
      });

      expect(result.current.activeDrivers).toHaveLength(1);

      // Update location (different timestamp)
      await act(async () => {
        channelCallbacks.onLocationUpdate?.({
          driverId: 'driver-123',
          lat: 37.7850,
          lng: -122.4094,
          timestamp: new Date(Date.now() + 1000).toISOString(),
        });
      });

      // Should still have 1 driver but with updated location
      expect(result.current.activeDrivers).toHaveLength(1);
      expect(result.current.activeDrivers[0].lastKnownLocation?.coordinates).toEqual([
        -122.4094,
        37.785,
      ]);
    });

    it('should limit recent locations to 100', async () => {
      const { result } = renderHook(() => useAdminRealtimeTracking());

      await waitFor(() => {
        expect(result.current.isRealtimeConnected).toBe(true);
      });

      // Add 105 different driver locations
      for (let i = 0; i < 105; i++) {
        await act(async () => {
          channelCallbacks.onLocationUpdate?.({
            driverId: `driver-${i}`,
            lat: 37.7749 + i * 0.001,
            lng: -122.4194,
            timestamp: new Date(Date.now() + i * 1000).toISOString(),
          });
        });
      }

      // Should be limited to 100
      expect(result.current.recentLocations.length).toBeLessThanOrEqual(100);
    });
  });

  describe('mode toggling', () => {
    it('should toggle between Realtime and SSE modes', async () => {
      const { result } = renderHook(() => useAdminRealtimeTracking());

      await waitFor(() => {
        expect(result.current.isRealtimeConnected).toBe(true);
      });

      expect(result.current.connectionMode).toBe('realtime');

      // Toggle to SSE mode
      await act(async () => {
        result.current.toggleMode();
      });

      // Should cleanup and switch to SSE
      await waitFor(() => {
        expect(result.current.connectionMode).toBe('sse');
      });
    });
  });

  describe('reconnect', () => {
    it('should reconnect Realtime when in Realtime mode', async () => {
      const { result } = renderHook(() => useAdminRealtimeTracking());

      await waitFor(() => {
        expect(result.current.isRealtimeConnected).toBe(true);
      });

      // Clear previous calls
      (createDriverLocationChannel as jest.Mock).mockClear();

      await act(async () => {
        result.current.reconnect();
      });

      // Should cleanup and reinitialize
      expect(mockChannelUnsubscribe).toHaveBeenCalled();
      await waitFor(() => {
        expect(createDriverLocationChannel).toHaveBeenCalled();
      });
    });

    it('should call SSE reconnect when in SSE mode', async () => {
      const mockReconnect = jest.fn();
      (useRealTimeTracking as jest.Mock).mockReturnValue({
        ...mockSseTracking,
        reconnect: mockReconnect,
      });

      const { result } = renderHook(() =>
        useAdminRealtimeTracking({ useRealtimeMode: false })
      );

      await act(async () => {
        result.current.reconnect();
      });

      expect(mockReconnect).toHaveBeenCalled();
    });
  });

  describe('data source selection', () => {
    it('should use Realtime data when connected', async () => {
      (useRealTimeTracking as jest.Mock).mockReturnValue({
        ...mockSseTracking,
        activeDrivers: [{ id: 'sse-driver', employeeId: 'SSE' }],
        isConnected: true,
      });

      const { result } = renderHook(() => useAdminRealtimeTracking());

      await waitFor(() => {
        expect(result.current.isRealtimeConnected).toBe(true);
      });

      // Add Realtime driver
      await act(async () => {
        channelCallbacks.onLocationUpdate?.({
          driverId: 'realtime-driver',
          lat: 37.7749,
          lng: -122.4194,
          timestamp: new Date().toISOString(),
        });
      });

      // Should use Realtime data, not SSE
      expect(result.current.activeDrivers).toHaveLength(1);
      expect(result.current.activeDrivers[0].id).toBe('realtime-driver');
    });

    it('should fallback to SSE data when Realtime disconnected', async () => {
      (useRealTimeTracking as jest.Mock).mockReturnValue({
        ...mockSseTracking,
        activeDrivers: [{ id: 'sse-driver', employeeId: 'SSE' }],
        isConnected: true,
      });

      const { result } = renderHook(() => useAdminRealtimeTracking());

      await waitFor(() => {
        expect(result.current.isRealtimeConnected).toBe(true);
      });

      // Disconnect Realtime
      await act(async () => {
        channelCallbacks.onDisconnect?.();
      });

      // Should fallback to SSE data
      expect(result.current.activeDrivers).toHaveLength(1);
      expect(result.current.activeDrivers[0].id).toBe('sse-driver');
    });

    it('should always use SSE for deliveries', async () => {
      const mockDeliveries = [{ id: 'delivery-1', status: 'en_route' }];
      (useRealTimeTracking as jest.Mock).mockReturnValue({
        ...mockSseTracking,
        activeDeliveries: mockDeliveries,
        isConnected: true,
      });

      const { result } = renderHook(() => useAdminRealtimeTracking());

      await waitFor(() => {
        expect(result.current.isRealtimeConnected).toBe(true);
      });

      // Should always use SSE deliveries
      expect(result.current.activeDeliveries).toEqual(mockDeliveries);
    });
  });

  describe('connection status', () => {
    it('should be connected when Realtime is connected', async () => {
      const { result } = renderHook(() => useAdminRealtimeTracking());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });
    });

    it('should be connected when only SSE is connected', async () => {
      (isFeatureEnabled as jest.Mock).mockReturnValue(false);
      (useRealTimeTracking as jest.Mock).mockReturnValue({
        ...mockSseTracking,
        isConnected: true,
      });

      const { result } = renderHook(() => useAdminRealtimeTracking());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });
    });

    it('should show hybrid mode when attempting Realtime', async () => {
      mockChannelSubscribe.mockImplementation(async (callbacks) => {
        channelCallbacks = callbacks;
        // Don't call onConnect immediately
      });

      const { result } = renderHook(() => useAdminRealtimeTracking());

      // Initially should be in hybrid mode (attempting Realtime)
      await waitFor(() => {
        expect(result.current.connectionMode).toBe('hybrid');
      });
    });
  });

  describe('error handling', () => {
    it('should show Realtime error when present', async () => {
      const { result } = renderHook(() => useAdminRealtimeTracking());

      await waitFor(() => {
        expect(result.current.isRealtimeConnected).toBe(true);
      });

      await act(async () => {
        channelCallbacks.onError?.(new Error('Realtime error'));
      });

      expect(result.current.error).toBe('Realtime error');
    });

    it('should show SSE error when Realtime is not connected', async () => {
      (useRealTimeTracking as jest.Mock).mockReturnValue({
        ...mockSseTracking,
        error: 'SSE error',
        isConnected: false,
      });
      (isFeatureEnabled as jest.Mock).mockReturnValue(false);

      const { result } = renderHook(() => useAdminRealtimeTracking());

      expect(result.current.error).toBe('SSE error');
    });

    it('should not show SSE error when Realtime is connected', async () => {
      (useRealTimeTracking as jest.Mock).mockReturnValue({
        ...mockSseTracking,
        error: 'SSE error',
        isConnected: false,
      });

      const { result } = renderHook(() => useAdminRealtimeTracking());

      await waitFor(() => {
        expect(result.current.isRealtimeConnected).toBe(true);
      });

      // SSE error should be hidden when Realtime is connected
      expect(result.current.error).toBe(null);
    });
  });

  describe('isRealtimeEnabled flag', () => {
    it('should expose isRealtimeEnabled based on feature flag', async () => {
      (isFeatureEnabled as jest.Mock).mockReturnValue(true);

      const { result } = renderHook(() => useAdminRealtimeTracking());

      expect(result.current.isRealtimeEnabled).toBe(true);
    });

    it('should be false when feature flag is disabled', async () => {
      (isFeatureEnabled as jest.Mock).mockReturnValue(false);

      const { result } = renderHook(() => useAdminRealtimeTracking());

      expect(result.current.isRealtimeEnabled).toBe(false);
    });

    it('should be false when enableRealtimeReceive is false', async () => {
      const { result } = renderHook(() =>
        useAdminRealtimeTracking({ enableRealtimeReceive: false })
      );

      expect(result.current.isRealtimeEnabled).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should cleanup channel on unmount', async () => {
      const { unmount } = renderHook(() => useAdminRealtimeTracking());

      await waitFor(() => {
        expect(createDriverLocationChannel).toHaveBeenCalled();
      });

      unmount();

      expect(mockChannelUnsubscribe).toHaveBeenCalled();
    });

    it('should cleanup channel when feature is disabled', async () => {
      const { rerender } = renderHook(
        ({ enabled }) => useAdminRealtimeTracking({ enableRealtimeReceive: enabled }),
        { initialProps: { enabled: true } }
      );

      await waitFor(() => {
        expect(createDriverLocationChannel).toHaveBeenCalled();
      });

      // Disable feature
      (isFeatureEnabled as jest.Mock).mockReturnValue(false);
      rerender({ enabled: false });

      await waitFor(() => {
        expect(mockChannelUnsubscribe).toHaveBeenCalled();
      });
    });

    it('should run time-based cleanup for processed locations', async () => {
      renderHook(() => useAdminRealtimeTracking());

      await waitFor(() => {
        expect(createDriverLocationChannel).toHaveBeenCalled();
      });

      // Advance by cleanup interval (15 minutes)
      await act(async () => {
        jest.advanceTimersByTime(900000);
      });

      // Cleanup runs but doesn't log if no entries removed
      // This just verifies the interval doesn't throw
    });

    it('should clear cleanup interval on unmount', async () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      const { unmount } = renderHook(() => useAdminRealtimeTracking());

      await waitFor(() => {
        expect(createDriverLocationChannel).toHaveBeenCalled();
      });

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });
  });

  describe('memory management', () => {
    it('should cleanup processed locations when threshold exceeded', async () => {
      const { result } = renderHook(() => useAdminRealtimeTracking());

      await waitFor(() => {
        expect(result.current.isRealtimeConnected).toBe(true);
      });

      // Add many locations to trigger cleanup (threshold is 500)
      for (let i = 0; i < 510; i++) {
        await act(async () => {
          channelCallbacks.onLocationUpdate?.({
            driverId: `driver-${i}`,
            lat: 37.7749,
            lng: -122.4194,
            timestamp: new Date(Date.now() + i).toISOString(),
          });
        });
      }

      // Should have logged cleanup
      expect(realtimeLogger.warn).toHaveBeenCalledWith(
        'Processed locations size-based cleanup performed',
        expect.any(Object)
      );
    });
  });
});
