import { renderHook, act, waitFor } from '@testing-library/react';
import { useLocationTracking } from '../useLocationTracking';

// Mock the server action
jest.mock('@/app/actions/tracking/driver-actions', () => ({
  updateDriverLocation: jest.fn(),
}));

// Mock the location store
const mockLocationStore = {
  init: jest.fn().mockResolvedValue(undefined),
  addLocation: jest.fn().mockResolvedValue(undefined),
  getUnsyncedLocations: jest.fn().mockResolvedValue([]),
  getUnsyncedCount: jest.fn().mockResolvedValue(0),
  markAsSynced: jest.fn().mockResolvedValue(undefined),
  incrementSyncAttempts: jest.fn().mockResolvedValue(undefined),
  deleteLocation: jest.fn().mockResolvedValue(undefined),
  clearOldSyncedLocations: jest.fn().mockResolvedValue(0),
};

jest.mock('@/utils/indexedDB/locationStore', () => ({
  getLocationStore: jest.fn(() => mockLocationStore),
}));

// Import mocked modules
import { updateDriverLocation } from '@/app/actions/tracking/driver-actions';
import { getLocationStore } from '@/utils/indexedDB/locationStore';

const mockUpdateDriverLocation = updateDriverLocation as jest.MockedFunction<typeof updateDriverLocation>;

describe('useLocationTracking', () => {
  // Mock geolocation position
  const mockPosition: GeolocationPosition = {
    coords: {
      latitude: 37.7749,
      longitude: -122.4194,
      accuracy: 10,
      altitude: 50,
      altitudeAccuracy: 5,
      heading: 180,
      speed: 5,
    },
    timestamp: Date.now(),
  };

  // Mock session response with driver ID
  const mockDriverId = '123e4567-e89b-12d3-a456-426614174000';
  const mockSessionResponse = {
    user: {
      driverId: mockDriverId,
    },
  };

  let mockWatchId: number;
  let mockWatchCallback: PositionCallback;
  let mockWatchErrorCallback: PositionErrorCallback;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();

    mockWatchId = 1;

    // Mock navigator.geolocation
    const mockGeolocation = {
      getCurrentPosition: jest.fn((success: PositionCallback, error?: PositionErrorCallback) => {
        success(mockPosition);
      }),
      watchPosition: jest.fn((success: PositionCallback, error?: PositionErrorCallback) => {
        mockWatchCallback = success;
        mockWatchErrorCallback = error!;
        return mockWatchId;
      }),
      clearWatch: jest.fn(),
    };

    Object.defineProperty(navigator, 'geolocation', {
      value: mockGeolocation,
      configurable: true,
      writable: true,
    });

    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
      writable: true,
    });

    // Mock navigator.permissions.query
    Object.defineProperty(navigator, 'permissions', {
      value: {
        query: jest.fn().mockResolvedValue({ state: 'granted' }),
      },
      configurable: true,
      writable: true,
    });

    // Mock fetch for session
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSessionResponse),
    });

    // Mock updateDriverLocation server action
    mockUpdateDriverLocation.mockResolvedValue({ success: true });

    // Reset location store mocks
    mockLocationStore.init.mockResolvedValue(undefined);
    mockLocationStore.getUnsyncedCount.mockResolvedValue(0);
    mockLocationStore.getUnsyncedLocations.mockResolvedValue([]);
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  describe('initialization', () => {
    it('should initialize with default values', async () => {
      const { result } = renderHook(() => useLocationTracking());

      // Initial state before location update
      expect(result.current.isTracking).toBe(false);
      expect(result.current.isOnline).toBe(true);
      expect(result.current.error).toBe(null);
    });

    it('should get initial location on mount', async () => {
      renderHook(() => useLocationTracking());

      await waitFor(() => {
        expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalled();
      });
    });

    it('should check geolocation permission on mount', async () => {
      renderHook(() => useLocationTracking());

      await waitFor(() => {
        expect(navigator.permissions.query).toHaveBeenCalledWith({ name: 'geolocation' });
      });
    });

    it('should set error if geolocation is not supported', async () => {
      // Remove geolocation
      Object.defineProperty(navigator, 'geolocation', {
        value: undefined,
        configurable: true,
        writable: true,
      });

      const { result } = renderHook(() => useLocationTracking());

      // The error indicates geolocation is not supported (message may vary based on which check catches it first)
      await waitFor(() => {
        expect(result.current.error).toContain('not supported');
      });
    });

    it('should set error if permission is denied', async () => {
      // Mock permission query to return denied
      (navigator.permissions.query as jest.Mock).mockResolvedValue({ state: 'denied' });

      // Also make getCurrentPosition fail with permission denied error
      (navigator.geolocation.getCurrentPosition as jest.Mock).mockImplementation(
        (success: PositionCallback, error?: PositionErrorCallback) => {
          error?.({ code: 1, message: 'User denied', PERMISSION_DENIED: 1 } as GeolocationPositionError);
        }
      );

      const { result } = renderHook(() => useLocationTracking());

      await waitFor(() => {
        // The error should indicate permission is denied
        expect(result.current.error).toContain('denied');
      });
    });

    it('should load initial unsynced count from IndexedDB', async () => {
      mockLocationStore.getUnsyncedCount.mockResolvedValue(5);

      const { result } = renderHook(() => useLocationTracking());

      await waitFor(() => {
        expect(result.current.unsyncedCount).toBe(5);
      });
    });
  });

  describe('startTracking', () => {
    it('should start watching position when startTracking is called', async () => {
      const { result } = renderHook(() => useLocationTracking());

      await act(async () => {
        result.current.startTracking();
      });

      expect(result.current.isTracking).toBe(true);
      expect(navigator.geolocation.watchPosition).toHaveBeenCalled();
    });

    it('should set up periodic location updates', async () => {
      const { result } = renderHook(() => useLocationTracking());

      // Wait for initial mount effects
      await waitFor(() => {
        expect(result.current.isTracking).toBe(false);
      });

      // Clear initial calls from mount
      (navigator.geolocation.getCurrentPosition as jest.Mock).mockClear();

      await act(async () => {
        result.current.startTracking();
      });

      // Fast-forward 30 seconds (TRACKING_INTERVAL)
      await act(async () => {
        jest.advanceTimersByTime(30000);
      });

      // getCurrentPosition should be called for periodic update
      expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalled();
    });

    it('should sync location to server when tracking', async () => {
      const { result } = renderHook(() => useLocationTracking());

      await act(async () => {
        result.current.startTracking();
      });

      // Wait for position update processing
      await waitFor(() => {
        expect(result.current.currentLocation).not.toBe(null);
      });

      // Trigger a position update
      await act(async () => {
        mockWatchCallback(mockPosition);
      });

      await waitFor(() => {
        expect(mockUpdateDriverLocation).toHaveBeenCalled();
      });
    });

    it('should trigger offline sync when starting tracking', async () => {
      const { result } = renderHook(() => useLocationTracking());

      await act(async () => {
        result.current.startTracking();
      });

      // syncOfflineLocations is called on start
      await waitFor(() => {
        expect(mockLocationStore.getUnsyncedLocations).toHaveBeenCalled();
      });
    });

    it('should set error if geolocation is not supported when starting', async () => {
      Object.defineProperty(navigator, 'geolocation', {
        value: undefined,
        configurable: true,
        writable: true,
      });

      const { result } = renderHook(() => useLocationTracking());

      await act(async () => {
        result.current.startTracking();
      });

      // The error can be from the mount effect check or from startTracking
      // Both indicate geolocation is not supported
      await waitFor(() => {
        expect(result.current.error).toContain('not supported');
      });
      expect(result.current.isTracking).toBe(false);
    });
  });

  describe('stopTracking', () => {
    it('should stop watching position when stopTracking is called', async () => {
      const { result } = renderHook(() => useLocationTracking());

      await act(async () => {
        result.current.startTracking();
      });

      expect(result.current.isTracking).toBe(true);

      await act(async () => {
        result.current.stopTracking();
      });

      expect(result.current.isTracking).toBe(false);
      expect(navigator.geolocation.clearWatch).toHaveBeenCalledWith(mockWatchId);
    });

    it('should clear periodic update interval', async () => {
      const { result } = renderHook(() => useLocationTracking());

      await act(async () => {
        result.current.startTracking();
      });

      await act(async () => {
        result.current.stopTracking();
      });

      // Reset mock call count
      (navigator.geolocation.getCurrentPosition as jest.Mock).mockClear();

      // Fast-forward - no more periodic updates should happen
      await act(async () => {
        jest.advanceTimersByTime(60000);
      });

      expect(navigator.geolocation.getCurrentPosition).not.toHaveBeenCalled();
    });
  });

  describe('updateLocationManually', () => {
    it('should get current position and update state', async () => {
      const { result } = renderHook(() => useLocationTracking());

      await act(async () => {
        await result.current.updateLocationManually();
      });

      expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalled();
      expect(result.current.currentLocation).not.toBe(null);
      expect(result.current.accuracy).toBe(mockPosition.coords.accuracy);
    });

    it('should set error on geolocation failure', async () => {
      const mockError = { code: 1, message: 'User denied' };
      (navigator.geolocation.getCurrentPosition as jest.Mock).mockImplementation(
        (success: PositionCallback, error?: PositionErrorCallback) => {
          error?.(mockError as GeolocationPositionError);
        }
      );

      const { result } = renderHook(() => useLocationTracking());

      await act(async () => {
        await result.current.updateLocationManually();
      });

      expect(result.current.error).toBe('Location access denied. Please enable location permissions for this site.');
    });
  });

  describe('offline handling', () => {
    it('should store location in IndexedDB when server sync fails', async () => {
      mockUpdateDriverLocation.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useLocationTracking());

      await act(async () => {
        result.current.startTracking();
      });

      // Trigger a position update
      await act(async () => {
        mockWatchCallback(mockPosition);
      });

      await waitFor(() => {
        expect(mockLocationStore.addLocation).toHaveBeenCalled();
      });
    });

    it('should update unsyncedCount when storing offline', async () => {
      mockUpdateDriverLocation.mockRejectedValue(new Error('Network error'));
      mockLocationStore.getUnsyncedCount.mockResolvedValue(1);

      const { result } = renderHook(() => useLocationTracking());

      await act(async () => {
        result.current.startTracking();
      });

      // Trigger a position update
      await act(async () => {
        mockWatchCallback(mockPosition);
      });

      await waitFor(() => {
        expect(result.current.unsyncedCount).toBe(1);
      });
    });

    it('should detect online/offline status changes', async () => {
      const { result } = renderHook(() => useLocationTracking());

      // Simulate going offline
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        configurable: true,
        writable: true,
      });

      await act(async () => {
        window.dispatchEvent(new Event('offline'));
      });

      expect(result.current.isOnline).toBe(false);

      // Simulate coming back online
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        configurable: true,
        writable: true,
      });

      await act(async () => {
        window.dispatchEvent(new Event('online'));
      });

      expect(result.current.isOnline).toBe(true);
    });

    it('should trigger sync when coming back online', async () => {
      const { result } = renderHook(() => useLocationTracking());

      // Go offline then back online
      await act(async () => {
        window.dispatchEvent(new Event('offline'));
      });

      mockLocationStore.getUnsyncedLocations.mockClear();

      await act(async () => {
        window.dispatchEvent(new Event('online'));
      });

      await waitFor(() => {
        expect(mockLocationStore.getUnsyncedLocations).toHaveBeenCalled();
      });
    });
  });

  describe('syncOfflineLocations', () => {
    it('should sync pending locations to server', async () => {
      const unsyncedLocation = {
        id: 'loc-1',
        driverId: mockDriverId,
        coordinates: { lat: 37.7749, lng: -122.4194 },
        accuracy: 10,
        speed: 5,
        heading: 180,
        altitude: 50,
        batteryLevel: 80,
        activityType: 'driving' as const,
        isMoving: true,
        timestamp: new Date().toISOString(),
        synced: false,
        syncAttempts: 0,
      };

      mockLocationStore.getUnsyncedLocations.mockResolvedValue([unsyncedLocation]);

      const { result } = renderHook(() => useLocationTracking());

      await act(async () => {
        await result.current.syncOfflineLocations();
      });

      expect(mockUpdateDriverLocation).toHaveBeenCalledWith(
        mockDriverId,
        expect.objectContaining({
          driverId: mockDriverId,
          coordinates: unsyncedLocation.coordinates,
        })
      );
      expect(mockLocationStore.markAsSynced).toHaveBeenCalledWith('loc-1');
    });

    it('should increment sync attempts on failure', async () => {
      const unsyncedLocation = {
        id: 'loc-1',
        driverId: mockDriverId,
        coordinates: { lat: 37.7749, lng: -122.4194 },
        accuracy: 10,
        speed: 5,
        heading: 180,
        altitude: 50,
        activityType: 'driving' as const,
        isMoving: true,
        timestamp: new Date().toISOString(),
        synced: false,
        syncAttempts: 0,
      };

      mockLocationStore.getUnsyncedLocations.mockResolvedValue([unsyncedLocation]);
      mockUpdateDriverLocation.mockResolvedValue({ success: false, error: 'Server error' });

      const { result } = renderHook(() => useLocationTracking());

      await act(async () => {
        await result.current.syncOfflineLocations();
      });

      expect(mockLocationStore.incrementSyncAttempts).toHaveBeenCalledWith('loc-1');
    });

    it('should remove locations after 10 failed attempts', async () => {
      const unsyncedLocation = {
        id: 'loc-1',
        driverId: mockDriverId,
        coordinates: { lat: 37.7749, lng: -122.4194 },
        accuracy: 10,
        speed: 5,
        heading: 180,
        altitude: 50,
        activityType: 'driving' as const,
        isMoving: true,
        timestamp: new Date().toISOString(),
        synced: false,
        syncAttempts: 10, // Already at max attempts
      };

      mockLocationStore.getUnsyncedLocations.mockResolvedValue([unsyncedLocation]);
      mockUpdateDriverLocation.mockResolvedValue({ success: false, error: 'Server error' });

      const { result } = renderHook(() => useLocationTracking());

      await act(async () => {
        await result.current.syncOfflineLocations();
      });

      expect(mockLocationStore.deleteLocation).toHaveBeenCalledWith('loc-1');
    });

    it('should not sync when offline', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        configurable: true,
        writable: true,
      });

      const { result } = renderHook(() => useLocationTracking());

      // Simulate offline event
      await act(async () => {
        window.dispatchEvent(new Event('offline'));
      });

      mockLocationStore.getUnsyncedLocations.mockClear();

      await act(async () => {
        await result.current.syncOfflineLocations();
      });

      expect(mockLocationStore.getUnsyncedLocations).not.toHaveBeenCalled();
    });

    it('should clean up old synced locations after sync', async () => {
      // clearOldSyncedLocations is only called when there are unsynced locations to process
      const unsyncedLocation = {
        id: 'loc-1',
        driverId: mockDriverId,
        coordinates: { lat: 37.7749, lng: -122.4194 },
        accuracy: 10,
        speed: 5,
        heading: 180,
        altitude: 50,
        activityType: 'driving' as const,
        isMoving: true,
        timestamp: new Date().toISOString(),
        synced: false,
        syncAttempts: 0,
      };

      mockLocationStore.getUnsyncedLocations.mockResolvedValue([unsyncedLocation]);

      const { result } = renderHook(() => useLocationTracking());

      await act(async () => {
        await result.current.syncOfflineLocations();
      });

      expect(mockLocationStore.clearOldSyncedLocations).toHaveBeenCalledWith(7);
    });
  });

  describe('geolocation error handling', () => {
    it('should handle PERMISSION_DENIED error', async () => {
      const mockError = { code: 1, message: 'User denied', PERMISSION_DENIED: 1 };
      (navigator.geolocation.getCurrentPosition as jest.Mock).mockImplementation(
        (success: PositionCallback, error?: PositionErrorCallback) => {
          error?.(mockError as GeolocationPositionError);
        }
      );

      const { result } = renderHook(() => useLocationTracking());

      await act(async () => {
        await result.current.updateLocationManually();
      });

      expect(result.current.error).toContain('Location access denied');
    });

    it('should handle POSITION_UNAVAILABLE error', async () => {
      const mockError = { code: 2, message: 'Position unavailable', POSITION_UNAVAILABLE: 2 };
      (navigator.geolocation.getCurrentPosition as jest.Mock).mockImplementation(
        (success: PositionCallback, error?: PositionErrorCallback) => {
          error?.(mockError as GeolocationPositionError);
        }
      );

      const { result } = renderHook(() => useLocationTracking());

      await act(async () => {
        await result.current.updateLocationManually();
      });

      expect(result.current.error).toContain('Location information unavailable');
    });

    it('should handle TIMEOUT error', async () => {
      const mockError = { code: 3, message: 'Timeout', TIMEOUT: 3 };
      (navigator.geolocation.getCurrentPosition as jest.Mock).mockImplementation(
        (success: PositionCallback, error?: PositionErrorCallback) => {
          error?.(mockError as GeolocationPositionError);
        }
      );

      const { result } = renderHook(() => useLocationTracking());

      await act(async () => {
        await result.current.updateLocationManually();
      });

      expect(result.current.error).toContain('Location request timed out');
    });
  });

  describe('visibility change handling', () => {
    it('should reduce update frequency when page is hidden', async () => {
      const { result } = renderHook(() => useLocationTracking());

      await act(async () => {
        result.current.startTracking();
      });

      // Simulate page becoming hidden
      Object.defineProperty(document, 'hidden', {
        value: true,
        configurable: true,
        writable: true,
      });

      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      // The hook should adjust the interval but continue tracking
      expect(result.current.isTracking).toBe(true);
    });

    it('should resume normal frequency when page becomes visible', async () => {
      const { result } = renderHook(() => useLocationTracking());

      await act(async () => {
        result.current.startTracking();
      });

      // First hide
      Object.defineProperty(document, 'hidden', {
        value: true,
        configurable: true,
        writable: true,
      });

      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      // Then show again
      Object.defineProperty(document, 'hidden', {
        value: false,
        configurable: true,
        writable: true,
      });

      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      expect(result.current.isTracking).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should stop tracking on unmount', async () => {
      const { result, unmount } = renderHook(() => useLocationTracking());

      await act(async () => {
        result.current.startTracking();
      });

      unmount();

      expect(navigator.geolocation.clearWatch).toHaveBeenCalled();
    });

    it('should clear all intervals on unmount', async () => {
      const { result, unmount } = renderHook(() => useLocationTracking());

      await act(async () => {
        result.current.startTracking();
      });

      unmount();

      // Advance time - no errors should occur
      await act(async () => {
        jest.advanceTimersByTime(120000);
      });
    });
  });

  describe('location formatting', () => {
    it('should correctly format location update with all fields', async () => {
      const { result } = renderHook(() => useLocationTracking());

      await waitFor(() => {
        expect(result.current.currentLocation).not.toBe(null);
      });

      const location = result.current.currentLocation!;
      expect(location.driverId).toBe(mockDriverId);
      expect(location.coordinates.lat).toBe(mockPosition.coords.latitude);
      expect(location.coordinates.lng).toBe(mockPosition.coords.longitude);
      expect(location.accuracy).toBe(mockPosition.coords.accuracy);
      expect(location.speed).toBe(mockPosition.coords.speed);
      expect(location.heading).toBe(mockPosition.coords.heading);
      expect(location.altitude).toBe(mockPosition.coords.altitude);
    });

    it('should determine activity type based on speed', async () => {
      // Test stationary (speed < 1)
      const stationaryPosition = {
        ...mockPosition,
        coords: { ...mockPosition.coords, speed: 0.5 },
      };

      (navigator.geolocation.getCurrentPosition as jest.Mock).mockImplementation(
        (success: PositionCallback) => success(stationaryPosition as GeolocationPosition)
      );

      const { result } = renderHook(() => useLocationTracking());

      await waitFor(() => {
        expect(result.current.currentLocation?.activityType).toBe('stationary');
      });
    });

    it('should set isMoving based on speed', async () => {
      // Test moving (speed > 1)
      const movingPosition = {
        ...mockPosition,
        coords: { ...mockPosition.coords, speed: 5 },
      };

      (navigator.geolocation.getCurrentPosition as jest.Mock).mockImplementation(
        (success: PositionCallback) => success(movingPosition as GeolocationPosition)
      );

      const { result } = renderHook(() => useLocationTracking());

      await waitFor(() => {
        expect(result.current.currentLocation?.isMoving).toBe(true);
      });
    });
  });

  describe('driver ID handling', () => {
    it('should fetch driver ID from session', async () => {
      renderHook(() => useLocationTracking());

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/auth/session');
      });
    });

    it('should set error if driver ID not found', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ user: {} }), // No driverId
      });

      const { result } = renderHook(() => useLocationTracking());

      // Try to start tracking which will try to format location
      await act(async () => {
        result.current.startTracking();
      });

      // Wait for the watch callback to be triggered
      await act(async () => {
        mockWatchCallback(mockPosition);
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Driver ID not found');
      });
    });

    it('should handle session fetch failure', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useLocationTracking());

      await act(async () => {
        result.current.startTracking();
      });

      await act(async () => {
        mockWatchCallback(mockPosition);
      });

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });
    });
  });
});
