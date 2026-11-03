import { renderHook, act, waitFor } from '@testing-library/react';
import { useLocationTracking, DRIVER_ID_LOOKUP_TIMEOUT_MS } from '../useLocationTracking';

// The hook no longer uses the updateDriverLocation Server Action; it POSTs each
// location to the /api/tracking/locations route. Location sync is therefore
// driven and asserted through the global.fetch routing mock below.

// Mock the location store
const mockLocationStore = {
  init: jest.fn().mockResolvedValue(undefined),
  addLocation: jest.fn().mockResolvedValue(undefined),
  getUnsyncedLocations: jest.fn().mockResolvedValue([]),
  getUnsyncedCount: jest.fn().mockResolvedValue(0),
  markAsSynced: jest.fn().mockResolvedValue(undefined),
  incrementSyncAttempts: jest.fn().mockResolvedValue(undefined),
  deleteLocation: jest.fn().mockResolvedValue(undefined),
  deleteLocations: jest.fn().mockResolvedValue(undefined),
  clearOldSyncedLocations: jest.fn().mockResolvedValue(0),
};

jest.mock('@/utils/indexedDB/locationStore', () => ({
  getLocationStore: jest.fn(() => mockLocationStore),
}));

// Import mocked modules
import { getLocationStore } from '@/utils/indexedDB/locationStore';
import { __resetLocationOutboxForTests } from '@/lib/tracking/location-outbox';
import { MemoryLocationStore } from '@/__tests__/helpers/memory-location-store';

// Tracking settings are fetched via TanStack Query in production; tests run
// without a QueryClientProvider, so pin the hook to the fail-open defaults.
// Individual tests may override via mockTrackingSettingsOverride.
const mockTrackingSettingsOverride: { current: Record<string, number> | null } =
  { current: null };
jest.mock("@/hooks/tracking/useTrackingSettings", () => ({
  TRACKING_SETTINGS_QUERY_KEY: ["tracking-settings"],
  useTrackingSettings: () => ({
    settings:
      mockTrackingSettingsOverride.current ??
      jest.requireActual("@/types/tracking-settings").TRACKING_SETTINGS_DEFAULTS,
    isLoaded: true,
  }),
}));

import { locationRateLimiter } from '@/lib/rate-limiting/location-rate-limiter';
import { setNativeLocationIssue } from '@/lib/tracking/native-location-issue';

// Native-wrapper gate (card android-location-prompt-every-run). Default: a
// plain browser, so every pre-existing test exercises the unchanged web path.
const mockNativeShell = { isNative: false };
const mockCheckNativeLocationPermission = jest.fn();
jest.mock('@/lib/tracking/native-shift-tracking', () => ({
  isCapacitorNative: () => mockNativeShell.isNative,
  checkNativeLocationPermission: (...args: unknown[]) =>
    mockCheckNativeLocationPermission(...args),
}));


// Helper to mock navigator properties
const mockNavigatorProperty = (property: string, value: unknown) => {
  Object.defineProperty(navigator, property, {
    value,
    configurable: true,
    writable: true,
  });
};

// Helper to mock window properties
const mockWindowProperty = (property: string, value: unknown) => {
  Object.defineProperty(window, property, {
    value,
    configurable: true,
    writable: true,
  });
};

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

  // --- fetch routing mock -------------------------------------------------
  // '/api/auth/session'        -> driver-id session json
  // '/api/tracking/locations'  -> POST result for a single location (replaces
  //                               the old updateDriverLocation action).
  type FetchResult = {
    ok: boolean;
    status: number;
    json: () => Promise<any>;
  };

  let sessionResponse: () => FetchResult;
  // Handler for the locations POST route; default = success (201).
  let postLocationHandler: () => FetchResult | Promise<FetchResult>;
  // Handler for the offline-backlog batch route; default = success (201).
  let postBatchHandler: () => FetchResult | Promise<FetchResult>;

  const okJson = (body: any, status = 200): FetchResult => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });

  // Convenience: number of POSTs made to the (single-point) locations route.
  const locationPostCalls = () =>
    (global.fetch as jest.Mock).mock.calls.filter(
      ([url]) => String(url) === '/api/tracking/locations',
    );
  // POSTs of the offline backlog to the batch route.
  const batchPostCalls = () =>
    (global.fetch as jest.Mock).mock.calls.filter(
      ([url]) => String(url) === '/api/tracking/locations/batch',
    );
  const batchedTimestamps = () =>
    batchPostCalls().flatMap(([, init]) =>
      JSON.parse(init.body).points.map((p: { timestamp: string }) => p.timestamp),
    );

  /** Route the store mock to a real in-memory queue for end-to-end outage tests. */
  const backStoreWith = (memory: MemoryLocationStore) => {
    mockLocationStore.addLocation.mockImplementation((loc) => memory.addLocation(loc));
    mockLocationStore.getUnsyncedLocations.mockImplementation(() => memory.getUnsyncedLocations());
    mockLocationStore.getUnsyncedCount.mockImplementation(() => memory.getUnsyncedCount());
    mockLocationStore.deleteLocations.mockImplementation((ids: string[]) => memory.deleteLocations(ids));
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    __resetLocationOutboxForTests();

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

    // Mock window.isSecureContext (default to true for most tests)
    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      configurable: true,
      writable: true,
    });

    // Default route handlers.
    sessionResponse = () => okJson(mockSessionResponse);
    postLocationHandler = () => okJson({ success: true }, 201);
    postBatchHandler = () => okJson({ success: true, accepted: 1, dropped: 0 }, 201);

    // Mock fetch with URL routing.
    global.fetch = jest.fn((input: RequestInfo | URL): Promise<any> => {
      const url = String(input);
      if (url.includes('/api/auth/session')) {
        return Promise.resolve(sessionResponse());
      }
      if (url === '/api/tracking/locations/batch') {
        return Promise.resolve(postBatchHandler());
      }
      if (url.includes('/api/tracking/locations')) {
        return Promise.resolve(postLocationHandler());
      }
      return Promise.resolve(okJson({}));
    }) as unknown as typeof fetch;

    // Reset location store mocks
    mockLocationStore.init.mockResolvedValue(undefined);
    mockLocationStore.getUnsyncedCount.mockResolvedValue(0);
    mockLocationStore.getUnsyncedLocations.mockResolvedValue([]);
    mockLocationStore.addLocation.mockResolvedValue(undefined);
    mockLocationStore.deleteLocations.mockResolvedValue(undefined);
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  describe('admin-configured sync interval', () => {
    afterEach(() => {
      mockTrackingSettingsOverride.current = null;
      // The hook configures the module singleton — restore the default so
      // later tests in this file aren't order-dependent on a 12s interval.
      const { RATE_LIMIT_CONFIG } = jest.requireActual('@/constants/realtime-config');
      locationRateLimiter.configure(RATE_LIMIT_CONFIG.MIN_UPDATE_INTERVAL_MS);
    });

    it('pushes the settings interval into the shared client rate limiter on mount', async () => {
      const { TRACKING_SETTINGS_DEFAULTS } = jest.requireActual(
        '@/types/tracking-settings',
      );
      mockTrackingSettingsOverride.current = {
        ...TRACKING_SETTINGS_DEFAULTS,
        locationUpdateIntervalSeconds: 12,
      };
      const configureSpy = jest.spyOn(locationRateLimiter, 'configure');

      renderHook(() => useLocationTracking());

      expect(configureSpy).toHaveBeenCalledWith(12_000);
      configureSpy.mockRestore();
    });
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
      // Offline at load, so the queued fixes stay queued (and counted).
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true, writable: true });
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

    it('is idempotent: a second startTracking while already tracking does not open another watch', async () => {
      const { result } = renderHook(() => useLocationTracking());

      await act(async () => {
        result.current.startTracking();
      });
      await act(async () => {
        result.current.startTracking();
      });

      expect(result.current.isTracking).toBe(true);
      expect(navigator.geolocation.watchPosition).toHaveBeenCalledTimes(1);
    });

    it('sets up continuous tracking + the periodic offline sync', async () => {
      const { result } = renderHook(() => useLocationTracking());

      // Wait for initial mount effects
      await waitFor(() => {
        expect(result.current.isTracking).toBe(false);
      });

      await act(async () => {
        result.current.startTracking();
      });

      // Fast-forward to the 2-minute offline-sync interval
      await act(async () => {
        jest.advanceTimersByTime(120000);
      });

      // Continuous GPS comes from watchPosition (not a getCurrentPosition poll —
      // that was removed); startTracking also schedules a 2-minute offline sync.
      expect(navigator.geolocation.watchPosition).toHaveBeenCalled();
      expect(mockLocationStore.getUnsyncedLocations).toHaveBeenCalled();
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
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/tracking/locations',
          expect.objectContaining({ method: 'POST' }),
        );
      });
    });

    it('includes the GPS fix timestamp in the POST body', async () => {
      const { result } = renderHook(() => useLocationTracking());

      await act(async () => {
        result.current.startTracking();
      });

      await act(async () => {
        mockWatchCallback(mockPosition);
      });

      await waitFor(() => {
        expect(locationPostCalls().length).toBeGreaterThan(0);
      });

      // The body carries the fix time from the geolocation position, not the
      // send time — offline-replayed points then keep their original time.
      const body = JSON.parse(locationPostCalls().pop()![1].body);
      expect(body.timestamp).toBe(new Date(mockPosition.timestamp).toISOString());
    });

    it('includes the device send time (client_sent_at) in the POST body', async () => {
      const { result } = renderHook(() => useLocationTracking());

      await act(async () => {
        result.current.startTracking();
      });

      const before = Date.now();
      await act(async () => {
        mockWatchCallback(mockPosition);
      });

      await waitFor(() => {
        expect(locationPostCalls().length).toBeGreaterThan(0);
      });

      // Epoch ms from the device clock at send time — the server compares it
      // with its own clock to correct a skewed phone's fix times.
      const body = JSON.parse(locationPostCalls().pop()![1].body);
      expect(typeof body.client_sent_at).toBe('number');
      expect(body.client_sent_at).toBeGreaterThanOrEqual(before);
      expect(body.client_sent_at).toBeLessThanOrEqual(Date.now());
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

  describe('wake lock + foreground re-arm (Track C)', () => {
    it('acquires a screen wake lock on start and releases it on stop', async () => {
      const release = jest.fn().mockResolvedValue(undefined);
      const request = jest.fn().mockResolvedValue({ release });
      mockNavigatorProperty('wakeLock', { request });

      const { result } = renderHook(() => useLocationTracking());

      await act(async () => {
        result.current.startTracking();
        await Promise.resolve();
      });
      await waitFor(() => expect(request).toHaveBeenCalledWith('screen'));

      // Let the wakeLockRef assignment settle before tearing down.
      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        result.current.stopTracking();
        await Promise.resolve();
      });
      await waitFor(() => expect(release).toHaveBeenCalled());
    });

    it('re-arms watchPosition when returning to the foreground while tracking', async () => {
      const { result } = renderHook(() => useLocationTracking());

      await act(async () => {
        result.current.startTracking();
      });

      (navigator.geolocation.clearWatch as jest.Mock).mockClear();
      const watchCallsBefore = (navigator.geolocation.watchPosition as jest.Mock).mock.calls.length;

      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      // Stale watch cleared + a fresh watch armed.
      expect(navigator.geolocation.clearWatch).toHaveBeenCalled();
      expect(
        (navigator.geolocation.watchPosition as jest.Mock).mock.calls.length,
      ).toBeGreaterThan(watchCallsBefore);
    });

    it('does not re-arm on a visibility change when not tracking', async () => {
      renderHook(() => useLocationTracking());

      (navigator.geolocation.clearWatch as jest.Mock).mockClear();

      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      expect(navigator.geolocation.clearWatch).not.toHaveBeenCalled();
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
      // Server POST rejects (network error) -> falls back to IndexedDB.
      postLocationHandler = () => Promise.reject(new Error('Network error'));

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

    it('should NOT store offline when the server returns 429 (rate limited)', async () => {
      // A 429 maps to { success:false, error:'Rate limit exceeded' }. Unlike the
      // generic-error path above, a rate-limited POST must be dropped silently:
      // the location is NOT queued to IndexedDB (queuing it would replay the same
      // burst and keep tripping the limiter), and unsyncedCount must not grow.
      postLocationHandler = () => okJson({ error: 'Rate limit exceeded' }, 429);
      mockLocationStore.getUnsyncedCount.mockResolvedValue(0);

      const { result } = renderHook(() => useLocationTracking());

      await act(async () => {
        result.current.startTracking();
      });

      // Trigger a position update (this attempts the server sync).
      await act(async () => {
        mockWatchCallback(mockPosition);
      });

      // Wait until the POST actually happened so we know the sync path ran.
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/tracking/locations',
          expect.objectContaining({ method: 'POST' }),
        );
      });

      // The rate-limited location must NOT be persisted offline.
      expect(mockLocationStore.addLocation).not.toHaveBeenCalled();
      expect(result.current.unsyncedCount).toBe(0);
    });

    it('should update unsyncedCount when storing offline', async () => {
      postLocationHandler = () => Promise.reject(new Error('Network error'));

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
        expect(result.current.unsyncedCount).toBe(mockLocationStore.addLocation.mock.calls.length);
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

  describe('data outage (gps-points-lost-during-data-outage, 2026-10-17)', () => {
    // One GPS fix per second from watchPosition, `seconds` long.
    const driveFor = async (seconds: number) => {
      for (let i = 0; i < seconds; i++) {
        await act(async () => {
          jest.advanceTimersByTime(1_000);
          mockWatchCallback({ ...mockPosition, timestamp: Date.now() });
        });
      }
    };

    it('queues the fixes of a 10-minute outage at the tracking cadence and replays them in order when the network is back', async () => {
      const memory = new MemoryLocationStore();
      backStoreWith(memory);
      const { result } = renderHook(() => useLocationTracking());
      await act(async () => {
        result.current.startTracking();
      });

      postLocationHandler = () => Promise.reject(new TypeError('Failed to fetch'));
      postBatchHandler = () => Promise.reject(new TypeError('Failed to fetch'));
      const outageStart = Date.now();
      await driveFor(600);

      // One queued fix per 5 s interval (not one per GPS callback).
      const queued = memory.pendingTimestamps();
      expect(queued.length).toBeGreaterThanOrEqual(118);
      expect(queued.length).toBeLessThanOrEqual(121);
      expect(Date.parse(queued[0]!)).toBeGreaterThanOrEqual(outageStart);

      // Signal returns: the next live post succeeds and the backlog follows.
      // (Forget the retries that failed during the outage.)
      (global.fetch as jest.Mock).mockClear();
      postLocationHandler = () => okJson({ success: true }, 201);
      postBatchHandler = () => okJson({ success: true }, 201);
      await driveFor(6);

      await waitFor(() => {
        expect(memory.pendingTimestamps()).toHaveLength(0);
      });
      const replayed = batchedTimestamps();
      expect(replayed).toEqual(queued);
      expect(result.current.unsyncedCount).toBe(0);
    });

    it('flushes a backlog left over after End shift (tracking stopped)', async () => {
      const memory = new MemoryLocationStore();
      backStoreWith(memory);
      const { result } = renderHook(() => useLocationTracking());
      await act(async () => {
        result.current.startTracking();
      });
      postLocationHandler = () => Promise.reject(new TypeError('Failed to fetch'));
      postBatchHandler = () => Promise.reject(new TypeError('Failed to fetch'));
      await driveFor(30);
      expect(memory.pendingTimestamps().length).toBeGreaterThan(0);

      await act(async () => {
        result.current.stopTracking();
      });
      postBatchHandler = () => okJson({ success: true }, 201);
      await act(async () => {
        jest.advanceTimersByTime(60_000);
      });

      await waitFor(() => {
        expect(memory.pendingTimestamps()).toHaveLength(0);
      });
    });

    it('replays a backlog left by a previous page load as soon as the hook mounts', async () => {
      const memory = new MemoryLocationStore();
      await memory.addLocation({
        driverId: mockDriverId,
        coordinates: { lat: 21.1, lng: -101.6 },
        accuracy: 2,
        speed: 8,
        heading: 270,
        isMoving: true,
        timestamp: new Date(Date.now() - 20 * 60_000),
      });
      backStoreWith(memory);

      renderHook(() => useLocationTracking());

      await waitFor(() => {
        expect(memory.pendingTimestamps()).toHaveLength(0);
      });
      expect(batchPostCalls()).toHaveLength(1);
    });

    it('flushes on the online event even right after an offline event', async () => {
      const memory = new MemoryLocationStore();
      backStoreWith(memory);
      renderHook(() => useLocationTracking());
      await act(async () => {
        await Promise.resolve();
      });

      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true, writable: true });
      await act(async () => {
        window.dispatchEvent(new Event('offline'));
      });
      await memory.addLocation({
        driverId: mockDriverId,
        coordinates: { lat: 21.1, lng: -101.6 },
        accuracy: 2,
        speed: 8,
        heading: 270,
        timestamp: new Date(Date.now() - 60_000),
      });

      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true, writable: true });
      await act(async () => {
        window.dispatchEvent(new Event('online'));
      });

      await waitFor(() => {
        expect(memory.pendingTimestamps()).toHaveLength(0);
      });
    });
  });

  describe('syncOfflineLocations', () => {
    const makeUnsynced = (id: string, timestamp = new Date().toISOString()) => ({
      id,
      driverId: mockDriverId,
      coordinates: { lat: 37.7749, lng: -122.4194 },
      accuracy: 10,
      speed: 5,
      heading: 180,
      altitude: 50,
      batteryLevel: 80,
      activityType: 'driving' as const,
      isMoving: true,
      timestamp,
      synced: false,
      syncAttempts: 0,
    });

    it('replays pending locations through the batch route with their original fix times', async () => {
      const unsyncedLocation = makeUnsynced('loc-1');
      mockLocationStore.getUnsyncedLocations.mockResolvedValue([unsyncedLocation]);

      const { result } = renderHook(() => useLocationTracking());

      await act(async () => {
        await result.current.syncOfflineLocations();
      });

      await waitFor(() => {
        expect(batchPostCalls().length).toBeGreaterThan(0);
      });
      const body = JSON.parse(batchPostCalls().pop()![1].body);
      expect(body.driver_id).toBe(mockDriverId);
      expect(body.points).toHaveLength(1);
      expect(body.points[0].latitude).toBe(unsyncedLocation.coordinates.lat);
      expect(body.points[0].longitude).toBe(unsyncedLocation.coordinates.lng);
      // Replayed points carry their ORIGINAL fix time, not the replay time...
      expect(body.points[0].timestamp).toBe(unsyncedLocation.timestamp);
      // ...but client_sent_at is the REPLAY time, so the server measures the
      // device clock offset at flush time and corrects the old fix with it.
      expect(typeof body.client_sent_at).toBe('number');
      expect(body.client_sent_at).toBeGreaterThanOrEqual(
        Date.parse(unsyncedLocation.timestamp),
      );
      expect(mockLocationStore.deleteLocations).toHaveBeenCalledWith(['loc-1']);
      // The backlog never goes through the single-point (cadence-limited) route.
      expect(locationPostCalls()).toHaveLength(0);
    });

    it('keeps queued locations when the server fails', async () => {
      mockLocationStore.getUnsyncedLocations.mockResolvedValue([makeUnsynced('loc-1')]);
      postBatchHandler = () => okJson({ error: 'Server error' }, 500);

      const { result } = renderHook(() => useLocationTracking());

      await act(async () => {
        await result.current.syncOfflineLocations();
      });

      expect(batchPostCalls().length).toBeGreaterThan(0);
      expect(mockLocationStore.deleteLocations).not.toHaveBeenCalled();
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

    describe('burst protection (2026-08 field 429 storm)', () => {
      it('sends a 10-minute backlog as a few batch requests, not one POST per point', async () => {
        const base = Date.now() - 15 * 60_000;
        mockLocationStore.getUnsyncedLocations.mockResolvedValue(
          Array.from({ length: 120 }, (_, i) =>
            makeUnsynced(`loc-${i}`, new Date(base + i * 5_000).toISOString()),
          ),
        );

        const { result } = renderHook(() => useLocationTracking());

        await act(async () => {
          await result.current.syncOfflineLocations();
        });

        expect(locationPostCalls()).toHaveLength(0);
        expect(batchPostCalls()).toHaveLength(3);
        expect(batchedTimestamps()).toHaveLength(120);
      });

      it('stops the flush on 429, keeps the queue intact, and backs off ~30s', async () => {
        postBatchHandler = () => okJson({ error: 'Rate limit exceeded' }, 429);
        mockLocationStore.getUnsyncedLocations.mockResolvedValue([
          makeUnsynced('loc-1'),
          makeUnsynced('loc-2'),
        ]);

        const { result } = renderHook(() => useLocationTracking());
        await act(async () => {
          await Promise.resolve();
        });
        (global.fetch as jest.Mock).mockClear();

        await act(async () => {
          await result.current.syncOfflineLocations();
        });

        // Mount already hit the 429; inside the backoff window the flush is a
        // no-op and nothing was deleted.
        expect(batchPostCalls()).toHaveLength(0);
        expect(mockLocationStore.deleteLocations).not.toHaveBeenCalled();

        // After the backoff elapses the flush retries the queue.
        postBatchHandler = () => okJson({ success: true }, 201);
        await act(async () => {
          jest.advanceTimersByTime(30_001);
        });
        await act(async () => {
          await result.current.syncOfflineLocations();
        });
        expect(batchPostCalls().length).toBeGreaterThanOrEqual(1);
        expect(mockLocationStore.deleteLocations).toHaveBeenCalledWith(['loc-1', 'loc-2']);
      });
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

  describe('battery level', () => {
    afterEach(() => {
      delete (navigator as unknown as Record<string, unknown>).getBattery;
    });

    async function postOneFix() {
      const { result } = renderHook(() => useLocationTracking());
      await act(async () => {
        result.current.startTracking();
      });
      await act(async () => {
        mockWatchCallback(mockPosition);
      });
      await waitFor(() => {
        expect(locationPostCalls().length).toBeGreaterThan(0);
      });
      return { result, body: JSON.parse(locationPostCalls().pop()![1].body) };
    }

    it('sends battery_level as a 0-100 integer when the Battery API is present', async () => {
      mockNavigatorProperty('getBattery', jest.fn().mockResolvedValue({ level: 0.64 }));

      const { result, body } = await postOneFix();

      expect(body.battery_level).toBe(64);
      // The same LocationUpdate feeds the Realtime broadcast payload.
      expect(result.current.currentLocation?.batteryLevel).toBe(64);
    });

    it('sends battery_level: null when the Battery API is absent (iOS Safari)', async () => {
      delete (navigator as unknown as Record<string, unknown>).getBattery;

      const { body } = await postOneFix();

      expect(body).toHaveProperty('battery_level', null);
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

    it('should set isMoving after two consecutive vehicle-speed samples (hysteresis)', async () => {
      const movingPosition = {
        ...mockPosition,
        coords: { ...mockPosition.coords, speed: 5 },
      };

      // The mount effect may request more than one fix, so count samples
      // instead of assuming the first render saw exactly one.
      let samples = 0;
      (navigator.geolocation.getCurrentPosition as jest.Mock).mockImplementation(
        (success: PositionCallback) => {
          samples += 1;
          success(movingPosition as GeolocationPosition);
        }
      );

      const { result } = renderHook(() => useLocationTracking());

      await waitFor(() => {
        expect(result.current.currentLocation).not.toBe(null);
      });
      // The 2-sample rule: "moving" only once two vehicle-speed fixes landed.
      expect(result.current.currentLocation?.isMoving).toBe(samples >= 2);

      while (samples < 2) {
        await act(async () => {
          await result.current.updateLocationManually();
        });
      }
      await waitFor(() => {
        expect(result.current.currentLocation?.isMoving).toBe(true);
      });
    });

    it('should not flicker isMoving at walking pace', async () => {
      const speeds = [0.9, 1.1, 0.9, 1.2, 0.8, 0.4, 0.3];
      let call = 0;
      (navigator.geolocation.getCurrentPosition as jest.Mock).mockImplementation(
        (success: PositionCallback) => {
          const speed = speeds[Math.min(call, speeds.length - 1)];
          call += 1;
          success({
            ...mockPosition,
            coords: { ...mockPosition.coords, speed },
          } as GeolocationPosition);
        }
      );

      const { result } = renderHook(() => useLocationTracking());
      await waitFor(() => {
        expect(result.current.currentLocation).not.toBe(null);
      });

      const seen: boolean[] = [result.current.currentLocation!.isMoving];
      while (call < speeds.length) {
        await act(async () => {
          await result.current.updateLocationManually();
        });
        seen.push(result.current.currentLocation!.isMoving);
      }

      const flips = seen.filter((v, i) => i > 0 && v !== seen[i - 1]).length;
      expect(flips).toBeLessThanOrEqual(1);
      expect(seen.at(-1)).toBe(false);
    });
  });

  describe('driver ID handling', () => {
    it('should fetch driver ID from session', async () => {
      renderHook(() => useLocationTracking());

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/auth/session', expect.anything());
      });
    });

    it('should set error if driver ID not found', async () => {
      sessionResponse = () => okJson({ user: {} }); // No driverId

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
      sessionResponse = () => {
        throw new Error('Network error');
      };

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

  describe('permission request never strands the spinner (2026-10 iPhone X)', () => {
    it('clears isRequestingPermission when the driver-id lookup hangs', async () => {
      sessionResponse = () => new Promise(() => undefined) as unknown as FetchResult;

      const { result } = renderHook(() => useLocationTracking());

      let pending!: Promise<boolean>;
      act(() => {
        pending = result.current.requestLocationPermission();
      });
      expect(result.current.isRequestingPermission).toBe(true);

      let granted: boolean | undefined;
      await act(async () => {
        await jest.advanceTimersByTimeAsync(DRIVER_ID_LOOKUP_TIMEOUT_MS);
        granted = await pending;
      });

      expect(granted).toBe(true);
      expect(result.current.isRequestingPermission).toBe(false);
    });

    it('clears isRequestingPermission when the native permission check throws', async () => {
      mockNativeShell.isNative = true;
      // Only the tap-driven check (explain: true) fails; the mount check answers.
      mockCheckNativeLocationPermission.mockImplementation((opts?: { explain?: boolean }) =>
        opts?.explain ? Promise.reject(new Error('bridge gone')) : Promise.resolve('granted'),
      );

      try {
        const { result } = renderHook(() => useLocationTracking());

        await act(async () => {
          await result.current.requestLocationPermission().catch(() => false);
        });

        expect(result.current.isRequestingPermission).toBe(false);
      } finally {
        mockNativeShell.isNative = false;
        mockCheckNativeLocationPermission.mockReset();
      }
    });
  });

  describe('Capacitor native wrapper (android-location-prompt-every-run)', () => {
    beforeEach(() => {
      mockNativeShell.isNative = true;
      mockCheckNativeLocationPermission.mockResolvedValue('granted');
      // Android WebView reports 'prompt' on every run regardless of the OS grant.
      (navigator.permissions.query as jest.Mock).mockResolvedValue({ state: 'prompt' });
    });

    afterEach(() => {
      mockNativeShell.isNative = false;
      act(() => setNativeLocationIssue(null));
    });

    it('trusts the native grant: fetches location on mount, no yellow button', async () => {
      const { result } = renderHook(() => useLocationTracking());

      await waitFor(() => {
        expect(result.current.permissionState).toBe('granted');
      });
      expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalled();
      expect(navigator.permissions.query).not.toHaveBeenCalled();
      expect(mockCheckNativeLocationPermission).toHaveBeenCalledWith({ explain: false });
    });

    it('keeps the prompt path without touching geolocation when not granted', async () => {
      mockCheckNativeLocationPermission.mockResolvedValue('not-granted');
      const { result } = renderHook(() => useLocationTracking());

      await waitFor(() => {
        expect(result.current.permissionState).toBe('prompt');
      });
      // getCurrentPosition would make the WebView pop the Android dialog.
      expect(navigator.geolocation.getCurrentPosition).not.toHaveBeenCalled();
      expect(navigator.permissions.query).not.toHaveBeenCalled();
    });

    it('routes the permission request to the in-app explanation, never the OS dialog', async () => {
      mockCheckNativeLocationPermission.mockResolvedValue('not-granted');
      const { result } = renderHook(() => useLocationTracking());
      await waitFor(() => expect(result.current.permissionState).toBe('prompt'));

      let granted: boolean | undefined;
      await act(async () => {
        granted = await result.current.requestLocationPermission();
      });

      expect(granted).toBe(false);
      expect(mockCheckNativeLocationPermission).toHaveBeenLastCalledWith({ explain: true });
      expect(navigator.geolocation.getCurrentPosition).not.toHaveBeenCalled();
      expect(result.current.isRequestingPermission).toBe(false);
    });

    it('picks up a grant made through the explanation and fetches location', async () => {
      mockCheckNativeLocationPermission.mockResolvedValue('not-granted');
      const { result } = renderHook(() => useLocationTracking());
      await waitFor(() => expect(result.current.permissionState).toBe('prompt'));

      act(() => setNativeLocationIssue('permission-needed'));
      mockCheckNativeLocationPermission.mockResolvedValue('granted');
      act(() => setNativeLocationIssue(null));

      await waitFor(() => {
        expect(result.current.permissionState).toBe('granted');
      });
      expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalled();
    });

    it('falls back to the web flow when the native check has no answer (iOS wrapper)', async () => {
      mockCheckNativeLocationPermission.mockResolvedValue(null);
      const originalUserAgent = navigator.userAgent;
      mockNavigatorProperty(
        'userAgent',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
      );
      try {
        const { result } = renderHook(() => useLocationTracking());
        await waitFor(() => expect(result.current.permissionState).toBe('prompt'));
        expect(navigator.permissions.query).not.toHaveBeenCalled();
        expect(navigator.geolocation.getCurrentPosition).not.toHaveBeenCalled();
      } finally {
        mockNavigatorProperty('userAgent', originalUserAgent);
      }
    });
  });

  describe('web browsers keep the Permissions API gate', () => {
    it("shows the request button on 'prompt' and never consults the native bridge", async () => {
      (navigator.permissions.query as jest.Mock).mockResolvedValue({
        state: 'prompt',
        addEventListener: jest.fn(),
      });
      const { result } = renderHook(() => useLocationTracking());

      await waitFor(() => expect(result.current.permissionState).toBe('prompt'));
      expect(navigator.geolocation.getCurrentPosition).not.toHaveBeenCalled();
      expect(mockCheckNativeLocationPermission).not.toHaveBeenCalled();
    });

    it('still asks the browser when the request button is tapped', async () => {
      const { result } = renderHook(() => useLocationTracking());
      await act(async () => {
        await result.current.requestLocationPermission();
      });
      expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalled();
      expect(mockCheckNativeLocationPermission).not.toHaveBeenCalled();
    });
  });

  describe('iOS browser detection', () => {
    const originalUserAgent = navigator.userAgent;
    const originalPlatform = navigator.platform;
    const originalMaxTouchPoints = navigator.maxTouchPoints;

    afterEach(() => {
      // Restore original values
      mockNavigatorProperty('userAgent', originalUserAgent);
      mockNavigatorProperty('platform', originalPlatform);
      mockNavigatorProperty('maxTouchPoints', originalMaxTouchPoints);
    });

    it('should detect iPhone Safari and set permissionState to prompt', async () => {
      mockNavigatorProperty('userAgent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');
      mockNavigatorProperty('platform', 'iPhone');
      mockNavigatorProperty('maxTouchPoints', 5);

      const { result } = renderHook(() => useLocationTracking());

      await waitFor(() => {
        // iOS browsers should get 'prompt' state and not auto-request
        expect(result.current.permissionState).toBe('prompt');
      });

      // Should NOT attempt to query permissions on iOS
      expect(navigator.permissions.query).not.toHaveBeenCalled();
    });

    it('should detect iPhone Chrome (CriOS) and set permissionState to prompt', async () => {
      mockNavigatorProperty('userAgent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/108.0.5359.112 Mobile/15E148 Safari/604.1');
      mockNavigatorProperty('platform', 'iPhone');
      mockNavigatorProperty('maxTouchPoints', 5);

      const { result } = renderHook(() => useLocationTracking());

      await waitFor(() => {
        expect(result.current.permissionState).toBe('prompt');
      });

      expect(navigator.permissions.query).not.toHaveBeenCalled();
    });

    it('should detect iPhone Firefox (FxiOS) and set permissionState to prompt', async () => {
      mockNavigatorProperty('userAgent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/108.0 Mobile/15E148 Safari/605.1.15');
      mockNavigatorProperty('platform', 'iPhone');
      mockNavigatorProperty('maxTouchPoints', 5);

      const { result } = renderHook(() => useLocationTracking());

      await waitFor(() => {
        expect(result.current.permissionState).toBe('prompt');
      });

      expect(navigator.permissions.query).not.toHaveBeenCalled();
    });

    it('should detect iPad Pro (MacIntel with touch) and set permissionState to prompt', async () => {
      mockNavigatorProperty('userAgent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15');
      mockNavigatorProperty('platform', 'MacIntel');
      mockNavigatorProperty('maxTouchPoints', 5);

      const { result } = renderHook(() => useLocationTracking());

      await waitFor(() => {
        expect(result.current.permissionState).toBe('prompt');
      });

      expect(navigator.permissions.query).not.toHaveBeenCalled();
    });

    it('should NOT detect desktop Mac Safari as iOS', async () => {
      mockNavigatorProperty('userAgent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15');
      mockNavigatorProperty('platform', 'MacIntel');
      mockNavigatorProperty('maxTouchPoints', 0); // No touch = desktop

      const { result } = renderHook(() => useLocationTracking());

      // Desktop should use Permissions API
      await waitFor(() => {
        expect(navigator.permissions.query).toHaveBeenCalled();
      });
    });

    it('should NOT detect Android Chrome as iOS', async () => {
      mockNavigatorProperty('userAgent', 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Mobile Safari/537.36');
      mockNavigatorProperty('platform', 'Linux armv8l');
      mockNavigatorProperty('maxTouchPoints', 5);

      const { result } = renderHook(() => useLocationTracking());

      // Android should use Permissions API
      await waitFor(() => {
        expect(navigator.permissions.query).toHaveBeenCalled();
      });
    });
  });

  describe('iOS browser-specific error messages', () => {
    const originalUserAgent = navigator.userAgent;
    const originalPlatform = navigator.platform;
    const originalMaxTouchPoints = navigator.maxTouchPoints;

    beforeEach(() => {
      // Make getCurrentPosition fail with permission denied
      (navigator.geolocation.getCurrentPosition as jest.Mock).mockImplementation(
        (success: PositionCallback, error?: PositionErrorCallback) => {
          error?.({ code: 1, message: 'User denied', PERMISSION_DENIED: 1 } as GeolocationPositionError);
        }
      );
    });

    afterEach(() => {
      mockNavigatorProperty('userAgent', originalUserAgent);
      mockNavigatorProperty('platform', originalPlatform);
      mockNavigatorProperty('maxTouchPoints', originalMaxTouchPoints);
    });

    it('should show Safari-specific instructions for iOS Safari permission denied', async () => {
      mockNavigatorProperty('userAgent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');
      mockNavigatorProperty('platform', 'iPhone');
      mockNavigatorProperty('maxTouchPoints', 5);

      const { result } = renderHook(() => useLocationTracking());

      await act(async () => {
        await result.current.requestLocationPermission();
      });

      expect(result.current.error).toContain('Settings > Safari > Location');
    });

    it('should show Chrome-specific instructions for iOS Chrome permission denied', async () => {
      mockNavigatorProperty('userAgent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/108.0.5359.112 Mobile/15E148 Safari/604.1');
      mockNavigatorProperty('platform', 'iPhone');
      mockNavigatorProperty('maxTouchPoints', 5);

      const { result } = renderHook(() => useLocationTracking());

      await act(async () => {
        await result.current.requestLocationPermission();
      });

      expect(result.current.error).toContain('Settings > Chrome > Location');
    });

    it('should show Firefox-specific instructions for iOS Firefox permission denied', async () => {
      mockNavigatorProperty('userAgent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/108.0 Mobile/15E148 Safari/605.1.15');
      mockNavigatorProperty('platform', 'iPhone');
      mockNavigatorProperty('maxTouchPoints', 5);

      const { result } = renderHook(() => useLocationTracking());

      await act(async () => {
        await result.current.requestLocationPermission();
      });

      expect(result.current.error).toContain('Settings > Firefox > Location');
    });

    it('should show generic instructions for non-iOS permission denied', async () => {
      mockNavigatorProperty('userAgent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36');
      mockNavigatorProperty('platform', 'Win32');
      mockNavigatorProperty('maxTouchPoints', 0);

      const { result } = renderHook(() => useLocationTracking());

      await act(async () => {
        await result.current.requestLocationPermission();
      });

      expect(result.current.error).toBe('Location access denied. Please enable location permissions for this site.');
    });
  });

  describe('secure context detection', () => {
    const originalIsSecureContext = window.isSecureContext;

    afterEach(() => {
      mockWindowProperty('isSecureContext', originalIsSecureContext);
    });

    it('should set error when not in secure context', async () => {
      mockWindowProperty('isSecureContext', false);

      const { result } = renderHook(() => useLocationTracking());

      await waitFor(() => {
        // Should show HTTPS requirement error
        expect(result.current.error).toContain('HTTPS');
      });

      expect(result.current.permissionState).toBe('denied');
    });

    it('should deny permission request when not in secure context', async () => {
      mockWindowProperty('isSecureContext', false);

      const { result } = renderHook(() => useLocationTracking());

      await act(async () => {
        const granted = await result.current.requestLocationPermission();
        expect(granted).toBe(false);
      });

      expect(result.current.error).toContain('HTTPS');
      expect(result.current.permissionState).toBe('denied');
    });

    it('should NOT set error when in secure context', async () => {
      // Default is secure context (set in global beforeEach)
      mockWindowProperty('isSecureContext', true);

      const { result } = renderHook(() => useLocationTracking());

      await waitFor(() => {
        // Should attempt to query permissions (not be blocked by secure context check)
        expect(navigator.permissions.query).toHaveBeenCalled();
      });

      // Error should not mention HTTPS requirement
      if (result.current.error) {
        expect(result.current.error).not.toContain('HTTPS');
      }
    });
  });

  // 2026-08-20 León drive: every location POST was rejected (403) for a whole
  // shift and the driver saw nothing. Server rejections must surface to the
  // driver once they repeat; transient noise (429, network drops) must not.
  describe('server rejection alert (locationSyncError)', () => {
    // startTracking already POSTs the initial fixes, so tests can't equate
    // "N watch callbacks" with "N POSTs". Instead the server answers from a
    // status queue; once it's drained it answers 429, which never counts as a
    // rejection and closes the client throttle so no further POSTs go out.
    const respondWith = (statuses: number[]) => {
      const queue = [...statuses];
      postLocationHandler = () => {
        const status = queue.shift() ?? 429;
        return okJson(status < 300 ? { success: true } : { error: `HTTP ${status}` }, status);
      };
      return () => queue.length;
    };

    const startAndSend = async (points: number) => {
      const hook = renderHook(() => useLocationTracking());
      await act(async () => {
        hook.result.current.startTracking();
      });
      for (let i = 0; i < points; i++) {
        await act(async () => {
          await mockWatchCallback(mockPosition);
        });
      }
      return hook;
    };

    it('is null while location POSTs succeed', async () => {
      const { result } = await startAndSend(3);

      await waitFor(() => expect(locationPostCalls().length).toBeGreaterThan(0));
      expect(result.current.locationSyncError).toBeNull();
    });

    it('stays null for fewer than 3 consecutive server rejections', async () => {
      const remaining = respondWith([403, 403]);

      const { result } = await startAndSend(3);

      await waitFor(() => expect(remaining()).toBe(0));
      expect(result.current.locationSyncError).toBeNull();
    });

    it('tells the driver to contact dispatch after 3 consecutive 403s', async () => {
      postLocationHandler = () => okJson({ error: 'Driver not found or access denied' }, 403);

      const { result } = await startAndSend(3);

      await waitFor(() => expect(result.current.locationSyncError).not.toBeNull());
      expect(result.current.locationSyncError).toMatch(/location isn.t being saved/i);
      expect(result.current.locationSyncError).toMatch(/dispatch/i);
    });

    it('tells the driver to sign in again after 3 consecutive 401s', async () => {
      postLocationHandler = () => okJson({ error: 'Unauthorized' }, 401);

      const { result } = await startAndSend(3);

      await waitFor(() => expect(result.current.locationSyncError).not.toBeNull());
      expect(result.current.locationSyncError).toMatch(/sign in/i);
    });

    it('reports repeated server errors (5xx) too', async () => {
      postLocationHandler = () => okJson({ error: 'Internal error' }, 500);

      const { result } = await startAndSend(3);

      await waitFor(() => expect(result.current.locationSyncError).not.toBeNull());
      expect(result.current.locationSyncError).toMatch(/location isn.t being saved/i);
    });

    it('clears as soon as a location POST succeeds again', async () => {
      postLocationHandler = () => okJson({ error: 'Driver not found or access denied' }, 403);
      const { result } = await startAndSend(3);
      await waitFor(() => expect(result.current.locationSyncError).not.toBeNull());

      postLocationHandler = () => okJson({ success: true }, 201);
      await act(async () => {
        await mockWatchCallback(mockPosition);
      });

      await waitFor(() => expect(result.current.locationSyncError).toBeNull());
    });

    // A success closes the client throttle, and the fake clock is frozen, so
    // advance system time (without firing timers) past the sync interval
    // before each point. One tracking session throughout: stopTracking also
    // resets the count, and using it here would hide a missing success reset.
    const sendUntilDrained = async (remaining: () => number) => {
      const hook = await startAndSend(0);
      for (let i = 0; i < 10 && remaining() > 0; i++) {
        jest.setSystemTime(Date.now() + 60_000);
        await act(async () => {
          await mockWatchCallback(mockPosition);
        });
      }
      expect(remaining()).toBe(0);
      return hook;
    };

    it('resets the count on success, so failures must be consecutive', async () => {
      const remaining = respondWith([403, 403, 201, 403, 403]);

      const { result } = await sendUntilDrained(remaining);

      expect(result.current.locationSyncError).toBeNull();
    });

    it('alerts when a success is followed by 3 new consecutive rejections', async () => {
      const remaining = respondWith([403, 403, 201, 403, 403, 403]);

      const { result } = await sendUntilDrained(remaining);

      await waitFor(() => expect(result.current.locationSyncError).not.toBeNull());
    });

    it('does not count rate limiting (429) as a rejection', async () => {
      postLocationHandler = () => okJson({ error: 'Rate limit exceeded' }, 429);

      const { result } = await startAndSend(3);

      await waitFor(() => expect(locationPostCalls().length).toBeGreaterThan(0));
      expect(result.current.locationSyncError).toBeNull();
    });

    it('does not count network failures (the offline queue already covers them)', async () => {
      postLocationHandler = () => Promise.reject(new Error('Network error'));

      const { result } = await startAndSend(1);
      // A network failure closes the cadence gate, so send one fix per interval.
      for (let i = 0; i < 3; i++) {
        await act(async () => {
          jest.advanceTimersByTime(5_001);
          await mockWatchCallback(mockPosition);
        });
      }

      await waitFor(() => expect(locationPostCalls().length).toBeGreaterThanOrEqual(3));
      expect(result.current.locationSyncError).toBeNull();
    });

    it('clears when tracking stops', async () => {
      postLocationHandler = () => okJson({ error: 'Driver not found or access denied' }, 403);
      const { result } = await startAndSend(3);
      await waitFor(() => expect(result.current.locationSyncError).not.toBeNull());

      act(() => {
        result.current.stopTracking();
      });

      expect(result.current.locationSyncError).toBeNull();
    });
  });
});
