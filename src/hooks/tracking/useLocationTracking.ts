'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { LocationUpdate } from '@/types/tracking';
import { getLocationStore } from '@/utils/indexedDB/locationStore';
import { locationRateLimiter } from '@/lib/rate-limiting/location-rate-limiter';
import { setNativePostThrottleMs } from '@/lib/tracking/capacitor-tracking';
import { createMotionState, nextMotionState } from '@/lib/tracking/motion-state';
import { readBatteryLevel } from '@/lib/tracking/battery';
import {
  checkNativeLocationPermission,
  isCapacitorNative,
} from '@/lib/tracking/native-shift-tracking';
import {
  getNativeLocationIssue,
  subscribeNativeLocationIssue,
} from '@/lib/tracking/native-location-issue';
import { useTrackingSettings } from '@/hooks/tracking/useTrackingSettings';
import { withDeadline } from '@/lib/driver/with-deadline';
import {
  createBatchSender,
  enqueueLocation,
  flushLocationOutbox,
  getPendingHint,
} from '@/lib/tracking/location-outbox';

interface UseLocationTrackingReturn {
  currentLocation: LocationUpdate | null;
  isTracking: boolean;
  accuracy: number | null;
  error: string | null;
  /**
   * Driver-facing message once the server has rejected several location
   * POSTs in a row (401/403/5xx). Null while locations are being saved.
   */
  locationSyncError: string | null;
  unsyncedCount: number;
  isOnline: boolean;
  permissionState: 'prompt' | 'granted' | 'denied' | 'unknown';
  isRequestingPermission: boolean;
  startTracking: () => void;
  stopTracking: () => void;
  updateLocationManually: () => Promise<void>;
  syncOfflineLocations: () => Promise<void>;
  requestLocationPermission: () => Promise<boolean>;
}

/**
 * Detects if the current browser is running on iOS (iPhone, iPad, iPod)
 * This includes ALL browsers on iOS since they all use WebKit and have the same
 * geolocation limitations (Permissions API doesn't work without user interaction)
 */
const isIOSBrowser = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // Check for explicit iOS device identifiers
  const isExplicitIOS = /iPad|iPhone|iPod/.test(ua);
  // Check for iPad Pro running iPadOS 13+ which reports as MacIntel but has touch support
  const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return isExplicitIOS || isIPadOS;
};

/**
 * Detects specifically iOS Safari (not Chrome, Firefox, etc. on iOS)
 * Useful for Safari-specific instructions in error messages
 */
const isIOSSafari = (): boolean => {
  if (!isIOSBrowser()) return false;
  // Safari does not include CriOS (Chrome), FxiOS (Firefox), EdgiOS (Edge), or OPR (Opera)
  return /^((?!crios|fxios|edgios|opr).)*safari/i.test(navigator.userAgent);
};

const isIOSChrome = (): boolean => isIOSBrowser() && /crios/i.test(navigator.userAgent);
const isIOSFirefox = (): boolean => isIOSBrowser() && /fxios/i.test(navigator.userAgent);

/**
 * Gets a human-readable browser name for iOS browsers
 * Used for providing browser-specific instructions in error messages
 */
const getIOSBrowserName = (): string => {
  if (!isIOSBrowser()) return 'browser';
  if (isIOSChrome()) return 'Chrome';
  if (isIOSFirefox()) return 'Firefox';
  if (/edgios/i.test(navigator.userAgent)) return 'Edge';
  return 'Safari';
};

const TRACKING_INTERVAL = 30000; // 30 seconds

/**
 * Upper bound for the /api/auth/session driver-id lookup. 2026-10 field
 * failure (iPhone X, iOS 16.7): the lookup had no timeout, and the location
 * permission request awaited it before clearing its spinner, so "Start shift"
 * spun until the page was reloaded.
 */
export const DRIVER_ID_LOOKUP_TIMEOUT_MS = 10_000;
const MAX_RETRY_ATTEMPTS = 3;

// Offline backlog (src/lib/tracking/location-outbox.ts). Fixes that could not
// be sent are queued in IndexedDB and replayed through the batch route — one
// request per 50 points instead of one cadence-limited POST per point (the
// 2026-08 drive 429'd 78/84 replayed POSTs; the 2026-10-17 outage never
// drained). Retried on mount, on the 'online' event, after every successful
// live post, and on this timer while the driver app is open — also after End
// shift, so a backlog from the last minutes of a shift still lands.
const OUTBOX_RETRY_INTERVAL_MS = 60_000;

// Web transport for the backlog: the session cookie authenticates it.
const webBatchSender = createBatchSender(async () => ({}));

// Consecutive server rejections of live location POSTs before the driver is
// told. The 2026-08-20 León drive had every point 403'd for a whole shift with
// nothing on screen. Rate limiting (429) and network drops don't count: the
// throttle and the offline queue already handle those.
const SYNC_REJECTION_ALERT_THRESHOLD = 3;

const describeSyncRejection = (status: number): string => {
  if (status === 401) {
    return "Your location isn't being saved because your session expired. Sign out and sign in again.";
  }
  if (status === 403) {
    return "Your location isn't being saved. Contact dispatch so they can check your driver account.";
  }
  return "Your location isn't being saved (server error). Contact dispatch if this message stays.";
};

// High accuracy options - for GPS when available
const HIGH_ACCURACY_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15000, // Increased from 10s to 15s for GPS acquisition
  maximumAge: 5000
};

// Low accuracy fallback - faster response using network/WiFi
const LOW_ACCURACY_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 10000,
  maximumAge: 30000 // Accept older cached positions as fallback
};

export function useLocationTracking(): UseLocationTrackingReturn {
  const [currentLocation, setCurrentLocation] = useState<LocationUpdate | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locationSyncError, setLocationSyncError] = useState<string | null>(null);
  const consecutiveSyncRejectionsRef = useRef(0);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'unknown'>('unknown');
  // Live mirror for long-lived subscribers (native location-issue listener).
  const permissionStateRef = useRef(permissionState);
  permissionStateRef.current = permissionState;
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);
  const lastLocationRef = useRef<LocationUpdate | null>(null);
  const locationStoreRef = useRef(getLocationStore());
  const isMountedRef = useRef(true); // Track if component is mounted
  const cachedDriverIdRef = useRef<string | null>(null);
  const lastSyncTimeRef = useRef<number>(0);
  // Moving/stopped hysteresis (see src/lib/tracking/motion-state.ts). Kept in
  // a ref so it survives re-renders without re-creating the callback chain.
  const motionStateRef = useRef(createMotionState());
  // Admin-configurable sync throttle (matches the server rate limit). Kept in
  // a ref so a settings refetch doesn't re-create the callback chain and tear
  // down the geolocation watcher.
  const { settings } = useTrackingSettings();
  const minSyncIntervalMsRef = useRef(5000);
  useEffect(() => {
    const intervalMs = settings.locationUpdateIntervalSeconds * 1000;
    minSyncIntervalMsRef.current = intervalMs;
    // Keep the browser-side realtime rate limiter (src/lib/realtime/client.ts
    // uses the same module singleton) and the native background-GPS post
    // throttle (Capacitor shell shares this JS context) in step with the server.
    locationRateLimiter.configure(intervalMs);
    setNativePostThrottleMs(intervalMs);
  }, [settings.locationUpdateIntervalSeconds]);
  // Mirror isTracking into a ref so the long-lived watchPosition callback always
  // reads the live value. The callback registered in startTracking() captures the
  // isTracking *state* from the same render that calls setIsTracking(true) — i.e.
  // still false — so the `if (isTracking)` sync gate stayed shut: the device
  // painted the dot but never POSTed. Bit iOS Safari specifically (Android's
  // render/callback timing happened to resolve the gate open).
  const isTrackingRef = useRef(false);
  // Screen wake lock held while a shift is actively tracking, so the device
  // doesn't sleep mid-delivery (sleeping suspends watchPosition). The browser
  // auto-releases it when the page is hidden; we re-acquire it on the way back.
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);

  // Get driver ID from session, cached to avoid repeated /api/auth/session fetches
  const getDriverId = useCallback(async (): Promise<string | null> => {
    if (cachedDriverIdRef.current) {
      return cachedDriverIdRef.current;
    }
    try {
      return await withDeadline(async (signal) => {
        const response = await fetch('/api/auth/session', { signal });
        if (response.ok) {
          const session = await response.json();
          const driverId = session.user?.driverId || null;
          if (driverId) {
            cachedDriverIdRef.current = driverId;
          }
          return driverId;
        }
        return null;
      }, DRIVER_ID_LOOKUP_TIMEOUT_MS);
    } catch (error) {
      console.error('Error getting driver ID:', error);
      return null;
    }
  }, []);

  // Get current position with retry logic and accuracy fallback
  const getCurrentPosition = useCallback((
    options: PositionOptions = HIGH_ACCURACY_OPTIONS,
    retryCount = 0
  ): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        resolve,
        (error) => {
          // On timeout (code 3), retry with same or lower accuracy
          if (error.code === 3 && retryCount < MAX_RETRY_ATTEMPTS) {
            // First retries: keep trying high accuracy
            // Last retry: fall back to low accuracy for faster response
            const isLastRetry = retryCount === MAX_RETRY_ATTEMPTS - 1;
            const retryOptions = isLastRetry ? LOW_ACCURACY_OPTIONS : options;

            if (isLastRetry) {
              console.debug(`Location timeout, falling back to low accuracy (attempt ${retryCount + 1}/${MAX_RETRY_ATTEMPTS})`);
            }

            getCurrentPosition(retryOptions, retryCount + 1)
              .then(resolve)
              .catch(reject);
          } else {
            reject(error);
          }
        },
        options
      );
    });
  }, []);

  // Convert GeolocationPosition to LocationUpdate
  const formatLocationUpdate = useCallback(async (position: GeolocationPosition): Promise<LocationUpdate | null> => {
    const driverId = await getDriverId();
    if (!driverId) {
      throw new Error('Driver ID not found');
    }

    // Ensure numeric values are never null/undefined - use 0 as default
    // This prevents database NOT NULL constraint violations
    const speed = position.coords.speed ?? 0;
    const heading = position.coords.heading ?? 0;
    const accuracy = position.coords.accuracy ?? 0;

    motionStateRef.current = nextMotionState(motionStateRef.current, position.coords.speed);

    return {
      driverId,
      coordinates: {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      },
      accuracy,
      speed,
      heading,
      altitude: position.coords.altitude ?? undefined,
      batteryLevel: (await readBatteryLevel()) ?? undefined,
      activityType: determineActivityType(speed),
      isMoving: motionStateRef.current.isMoving,
      timestamp: new Date(position.timestamp)
    };
  }, [getDriverId]);

  // Determine activity type based on speed
  const determineActivityType = (speed: number): 'walking' | 'driving' | 'stationary' => {
    if (speed < 1) return 'stationary';
    if (speed < 5) return 'walking'; // < 5 m/s (~11 mph)
    return 'driving';
  };

  // POST a single location to the tracking API route. Replaces the legacy
  // `updateDriverLocation` Server Action: server-action digests break when the
  // deployed bundle changes mid-shift ("Server Action not found"), which silently
  // dropped every breadcrumb (driver_locations had no inserts for weeks). A stable
  // API route is deployment-proof. Returns the {success,error} shape callers expect.
  const postLocation = useCallback(
    async (
      location: LocationUpdate,
    ): Promise<{ success: boolean; error?: string; status?: number }> => {
      try {
        // GPS fix time (not send time) — offline-replayed points keep their
        // original timestamp because the queue stores full LocationUpdates.
        const fixMs = new Date(location.timestamp as Date | string).getTime();
        const res = await fetch('/api/tracking/locations', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            driver_id: location.driverId,
            latitude: location.coordinates.lat,
            longitude: location.coordinates.lng,
            accuracy: location.accuracy,
            speed: location.speed,
            heading: location.heading,
            altitude: location.altitude,
            battery_level:
              location.batteryLevel != null ? Math.round(location.batteryLevel) : null,
            is_moving: location.isMoving,
            timestamp: Number.isFinite(fixMs)
              ? new Date(fixMs).toISOString()
              : undefined,
            // Device clock at SEND time (also for offline replays): the server
            // compares it with its own clock and corrects a skewed phone.
            client_sent_at: Date.now(),
          }),
        });
        if (res.status === 429) {
          return { success: false, error: 'Rate limit exceeded' };
        }
        if (!res.ok) {
          let error = `HTTP ${res.status}`;
          try {
            const body = await res.json();
            error = body.error || body.message || error;
          } catch {
            /* non-JSON error body */
          }
          // `status` marks a server rejection (vs. a network failure below).
          return { success: false, error, status: res.status };
        }
        return { success: true };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to post location',
        };
      }
    },
    [],
  );

  // Replay the offline backlog. Reads connectivity live: the captured
  // `isOnline` state went stale across offline -> online and skipped the flush.
  // Single-flight and the 429 back-off live in the shared outbox, so the
  // native bridge (same page) never flushes concurrently with this one.
  const syncOfflineLocations = useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    const locationStore = locationStoreRef.current;
    const result = await flushLocationOutbox(webBatchSender, locationStore);
    if (isMountedRef.current) setUnsyncedCount(result.remaining);
    if (result.sent > 0) {
      // Legacy rows the pre-outbox flush marked synced instead of deleting.
      try {
        await locationStore.clearOldSyncedLocations(7);
      } catch {
        /* cleanup is best-effort */
      }
    }
  }, []);

  // Update location to server with client-side throttling
  // Skips server sync if the admin-configured interval hasn't elapsed since
  // the last successful sync (matches the server rate limit).
  const syncLocationToServer = useCallback(async (location: LocationUpdate) => {
    const now = Date.now();
    const timeSinceLastSync = now - lastSyncTimeRef.current;
    if (timeSinceLastSync < minSyncIntervalMsRef.current) {
      // Too soon since last sync - skip to avoid rate limit spam
      return;
    }

    try {
      const result = await postLocation(location);
      if (!result.success) {
        if (result.error?.includes('Rate limit')) {
          // Close the throttle gate too: without this, every subsequent GPS
          // tick re-POSTs immediately and keeps tripping the server limiter
          // (the 2026-08 429 storm on the live path). A 429 is the cadence
          // throttle, not a lost fix: never queued.
          lastSyncTimeRef.current = now;
          return;
        }
        if (result.status === undefined) {
          // No connection: close the gate as well, so an outage queues one
          // fix per interval (like the live trail), not one per GPS callback.
          lastSyncTimeRef.current = now;
        } else {
          consecutiveSyncRejectionsRef.current += 1;
          if (consecutiveSyncRejectionsRef.current >= SYNC_REJECTION_ALERT_THRESHOLD) {
            setLocationSyncError(describeSyncRejection(result.status));
          }
        }
        throw new Error(result.error || 'Failed to update location');
      }
      lastSyncTimeRef.current = now;
      consecutiveSyncRejectionsRef.current = 0;
      setLocationSyncError(null);
      // The connection works: send whatever the outage left behind.
      if (getPendingHint() !== 0) void syncOfflineLocations();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Rate limit')) {
        return;
      }

      console.error('Error syncing location to server:', error);

      // Keep the fix (with its GPS time) for replay once the network is back.
      const count = await enqueueLocation(location, locationStoreRef.current);
      if (isMountedRef.current) setUnsyncedCount(count);
    }
  }, [postLocation, syncOfflineLocations]);

  // Handle position update
  const handlePositionUpdate = useCallback(async (position: GeolocationPosition) => {
    try {
      const locationUpdate = await formatLocationUpdate(position);
      if (!locationUpdate) return;

      setCurrentLocation(locationUpdate);
      setAccuracy(position.coords.accuracy);
      setError(null);
      
      // Update last location reference
      lastLocationRef.current = locationUpdate;

      // Sync to server if tracking is active. Read the ref, not the captured
      // `isTracking` state, so the long-lived watchPosition callback always sees
      // the current value (see isTrackingRef note above).
      if (isTrackingRef.current) {
        await syncLocationToServer(locationUpdate);
      }
    } catch (error) {
      console.error('Error handling position update:', error);
      setError(error instanceof Error ? error.message : 'Location update failed');
    }
  }, [formatLocationUpdate, syncLocationToServer]);

  // Handle geolocation errors
  const handleGeolocationError = useCallback((err: unknown, silent = false) => {
    // Normalize different error shapes to a readable message
    let code: number | undefined;
    let name: string | undefined;
    let detailMessage: string | undefined;
    let message = 'Location error: ';

    if (typeof err === 'object' && err !== null) {
      const maybeError = err as Partial<GeolocationPositionError> & { name?: string; message?: string; toString?: () => string };
      code = typeof (maybeError as any).code === 'number' ? (maybeError as any).code : undefined;
      name = typeof maybeError.name === 'string' ? maybeError.name : undefined;
      if (typeof maybeError.message === 'string' && maybeError.message.length > 0) {
        detailMessage = maybeError.message;
      }
    }

    if (code === 1) {
      message = 'Location access denied. Please enable location permissions for this site.';
    } else if (code === 2) {
      message = 'Location information unavailable. Check GPS settings or signal.';
    } else if (code === 3) {
      // Timeout after all retries exhausted
      message = 'Location request timed out after multiple attempts. Check GPS signal and try again.';
    } else if (detailMessage) {
      message = `Location error: ${detailMessage}`;
    } else {
      message = 'Location error: An unknown error occurred.';
    }

    setError(message);

    // Only log to console for non-timeout errors or when not silent
    // Timeout errors are expected and handled by retry logic, so we use a softer log level
    if (!silent) {
      if (code === 3) {
        // Use warn for timeouts since they're recoverable and retries were attempted
        console.warn('Geolocation timeout after retries:', message);
      } else {
        // Log structured details for other error types
        const toStringValue = (err as any)?.toString ? (err as any).toString() : undefined;
        console.error('Geolocation error:', message, { code, name, detailMessage }, toStringValue);
      }
    }
  }, []);

  // Acquire a screen wake lock so the device doesn't sleep mid-shift (sleeping
  // suspends watchPosition). Best-effort: unsupported/denied is non-fatal.
  const requestWakeLock = useCallback(async () => {
    try {
      const nav = navigator as any;
      if (
        typeof document !== 'undefined' &&
        document.visibilityState === 'visible' &&
        nav?.wakeLock?.request
      ) {
        wakeLockRef.current = await nav.wakeLock.request('screen');
      }
    } catch {
      /* wake lock denied or unsupported — non-fatal */
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    try {
      await wakeLockRef.current?.release();
    } catch {
      /* already released — ignore */
    }
    wakeLockRef.current = null;
  }, []);

  // Tear down any existing watch and start a fresh one. Used on return to the
  // foreground: the OS may have suspended or killed the long-lived watch while
  // backgrounded (notably iOS Safari), leaving a stale watchId that never fires.
  const reArmWatch = useCallback(() => {
    if (!navigator.geolocation) return;
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePositionUpdate,
      handleGeolocationError,
      HIGH_ACCURACY_OPTIONS,
    );
  }, [handlePositionUpdate, handleGeolocationError]);

  // Start continuous location tracking
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser');
      return;
    }

    // Idempotent: the provider's auto-resume effect and explicit callers
    // (Start-shift flow) can both fire; a second start would open another
    // watchPosition and leak the first watch id. Use reArmWatch() to restart.
    if (isTrackingRef.current) return;

    setIsTracking(true);
    isTrackingRef.current = true;
    setError(null);

    // Start watching position — watchPosition provides continuous updates,
    // so no additional setInterval polling is needed (removed redundant GPS polling)
    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePositionUpdate,
      handleGeolocationError,
      HIGH_ACCURACY_OPTIONS
    );

    // Trigger initial sync on start (the retry timer lives for the whole
    // mount, not just the shift — see OUTBOX_RETRY_INTERVAL_MS).
    void syncOfflineLocations();

    // Keep the screen awake for the active shift (best-effort).
    void requestWakeLock();
  }, [handlePositionUpdate, handleGeolocationError, syncOfflineLocations, requestWakeLock]);

  // Stop location tracking
  const stopTracking = useCallback(() => {
    setIsTracking(false);
    isTrackingRef.current = false;
    motionStateRef.current = createMotionState();

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (intervalIdRef.current !== null) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }

    // Reset cached driver ID so it refreshes on next session
    cachedDriverIdRef.current = null;
    lastSyncTimeRef.current = 0;
    consecutiveSyncRejectionsRef.current = 0;
    setLocationSyncError(null);

    // Release the screen wake lock.
    void releaseWakeLock();
  }, [releaseWakeLock]);

  // Manually update location once
  const updateLocationManually = useCallback(async () => {
    try {
      const position = await getCurrentPosition();
      await handlePositionUpdate(position);
    } catch (error) {
      handleGeolocationError(error);
    }
  }, [getCurrentPosition, handlePositionUpdate, handleGeolocationError]);

  // Request location permission explicitly (MUST be called from user interaction for iOS Safari)
  const requestLocationPermission = useCallback(async (): Promise<boolean> => {
    // Check for secure context first - this is the most common issue in development
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      const hostname = window.location.hostname;
      if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
        setError(`Location requires HTTPS. Access via localhost:${window.location.port} instead of ${hostname}`);
      } else {
        setError('Location requires a secure connection (HTTPS).');
      }
      setPermissionState('denied');
      return false;
    }

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser');
      setPermissionState('denied');
      return false;
    }

    setIsRequestingPermission(true);
    setError(null);

    // Every exit clears the spinner, including a native-bridge throw.
    try {
      // Native wrapper: getCurrentPosition below would make the WebView pop the
      // Android permission dialog with no context. If the OS permission is
      // missing, show the in-app explanation instead (its button is the only path
      // to the OS dialog) and report not-granted. No native answer (web, iOS
      // wrapper) → the web flow below, unchanged.
      if (isCapacitorNative()) {
        const native = await checkNativeLocationPermission({ explain: true });
        if (native === 'not-granted') {
          setPermissionState('prompt');
          return false;
        }
      }

      try {
        // This call MUST be triggered by user interaction for iOS Safari to show the prompt
        const position = await getCurrentPosition();

        // If we get here, permission was granted
        setPermissionState('granted');
        // Bounded: the driver-id lookup inside gives up after
        // DRIVER_ID_LOOKUP_TIMEOUT_MS, so it can't hold the spinner.
        await handlePositionUpdate(position);
        return true;
      } catch (err) {
        const maybeError = err as Partial<GeolocationPositionError>;
        if (maybeError.code === 1) {
          // Permission denied
          setPermissionState('denied');
          if (isIOSBrowser()) {
            // All iOS browsers use WebKit and require Settings app for location permissions
            const browserName = getIOSBrowserName();
            setError(`Location access denied. Go to Settings > ${browserName} > Location and enable access for this website.`);
          } else {
            setError('Location access denied. Please enable location permissions for this site.');
          }
          return false;
        } else if (maybeError.code === 2) {
          // Position unavailable - but permission might be granted
          setPermissionState('granted');
          setError('Location information unavailable. Check GPS settings or signal.');
          return true; // Permission was granted, just couldn't get position
        } else if (maybeError.code === 3) {
          // Timeout - but permission might be granted
          setPermissionState('granted');
          setError('Location request timed out. This can happen in areas with weak GPS signal. Try again or move to a better location.');
          return true; // Permission was granted, just timed out
        }

        handleGeolocationError(err);
        return false;
      }
    } finally {
      setIsRequestingPermission(false);
    }
  }, [getCurrentPosition, handlePositionUpdate, handleGeolocationError]);

  // Check support and permissions on mount for better UX
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check for secure context (HTTPS or localhost) - required for Geolocation API
    // This is a common issue when testing on local network IPs like 192.168.x.x
    if (!window.isSecureContext) {
      const hostname = window.location.hostname;
      const isLocalIP = /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|localhost|127\.)/.test(hostname);
      if (isLocalIP && hostname !== 'localhost' && hostname !== '127.0.0.1') {
        setError(`Location tracking requires HTTPS. You're accessing via ${hostname} which is not secure. Use localhost:${window.location.port} or set up HTTPS.`);
      } else {
        setError('Location tracking requires a secure connection (HTTPS). Please access this site via HTTPS.');
      }
      setPermissionState('denied');
      return;
    }

    if (!('geolocation' in navigator)) {
      setError('Geolocation is not supported in this browser.');
      setPermissionState('denied');
      return;
    }

    const runWebPermissionCheck = () => {
      // For ALL iOS browsers, we can't reliably check permissions without user interaction
      // All iOS browsers use WebKit and have the same limitation
      // Set state to 'prompt' and wait for user to explicitly request
      if (isIOSBrowser()) {
        setPermissionState('prompt');
        // Don't auto-request on iOS - it won't work without user interaction
        return;
      }

      // For other browsers, try to check permission state
      try {
        if ('permissions' in navigator && (navigator as any).permissions?.query) {
          (navigator as any).permissions
            .query({ name: 'geolocation' as PermissionName })
            .then((status: PermissionStatus) => {
              setPermissionState(status.state as 'prompt' | 'granted' | 'denied');
              if (status.state === 'denied') {
                setError('Location permission is denied. Enable it in your browser settings.');
              } else if (status.state === 'granted') {
                // Permission already granted, get initial location
                updateLocationManually();
              }
              // Listen for permission changes
              status.addEventListener('change', () => {
                setPermissionState(status.state as 'prompt' | 'granted' | 'denied');
                if (status.state === 'granted') {
                  setError(null);
                  updateLocationManually();
                }
              });
            })
            .catch(() => {
              // Permissions API not reliable, try getting location directly
              setPermissionState('unknown');
              updateLocationManually();
            });
        } else {
          // No Permissions API, try getting location directly
          setPermissionState('unknown');
          updateLocationManually();
        }
      } catch {
        setPermissionState('unknown');
        updateLocationManually();
      }
    };

    // Native wrapper: the Android WebView's Permissions API answers 'prompt' on
    // every run (it doesn't persist web-permission state), which used to park
    // the driver on the "Request location permission" button even with the OS
    // permission granted. Trust the native permission instead; never prompt
    // from here. No native answer (iOS wrapper, bridge failure) → web flow.
    if (isCapacitorNative()) {
      let cancelled = false;
      void checkNativeLocationPermission({ explain: false }).then((native) => {
        if (cancelled) return;
        if (native === 'granted') {
          setPermissionState('granted');
          updateLocationManually();
        } else if (native === 'not-granted') {
          setPermissionState('prompt');
        } else {
          runWebPermissionCheck();
        }
      });
      return () => {
        cancelled = true;
      };
    }

    runWebPermissionCheck();
  }, [updateLocationManually]);

  // Native wrapper: when the in-app location explanation closes (the driver
  // granted via its button, or came back from Settings), re-read the native
  // permission and pick up the first fix — the WebView fires no permission
  // 'change' event for an OS-level grant.
  useEffect(() => {
    if (!isCapacitorNative()) return;
    return subscribeNativeLocationIssue(() => {
      if (getNativeLocationIssue() !== null) return;
      if (permissionStateRef.current === 'granted') return;
      void checkNativeLocationPermission({ explain: false }).then((native) => {
        if (native !== 'granted' || !isMountedRef.current) return;
        setPermissionState('granted');
        void updateLocationManually();
      });
    });
  }, [updateLocationManually]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopTracking();
    };
  }, [stopTracking]);

  // Keep the tracking ref in lock-step with state (belt-and-suspenders for the
  // eager assignments in start/stopTracking).
  useEffect(() => {
    isTrackingRef.current = isTracking;
  }, [isTracking]);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      void syncOfflineLocations();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    // Set initial state
    setIsOnline(navigator.onLine);

    // A backlog left by a previous page load (reload, app restart) goes out
    // now; afterwards retry while anything is queued, shift or not.
    void syncOfflineLocations();
    const retryId = setInterval(() => {
      if (getPendingHint() !== 0) void syncOfflineLocations();
    }, OUTBOX_RETRY_INTERVAL_MS);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(retryId);
    };
  }, [syncOfflineLocations]);

  // Load initial unsynced count on mount
  useEffect(() => {
    const loadUnsyncedCount = async () => {
      try {
        const locationStore = locationStoreRef.current;
        await locationStore.init();
        const count = await locationStore.getUnsyncedCount();
        setUnsyncedCount(count);
      } catch (error) {
        console.error('Failed to load unsynced count:', error);
      }
    };

    loadUnsyncedCount();
  }, []);

  // Re-arm tracking when returning to the foreground. While backgrounded the OS
  // can suspend or kill the long-lived watchPosition (notably iOS Safari), and the
  // browser auto-releases the screen wake lock. On the way back we re-arm the
  // watch, grab an immediate fix, and re-acquire the wake lock so the breadcrumb
  // trail (and shift mileage) doesn't silently stall after a tab switch.
  //
  // NOTE: this does NOT give true background tracking — web JS is suspended while
  // backgrounded, so points aren't captured until the app is foregrounded again.
  // Continuous background capture requires the native wrapper (see the
  // 2026-06-17 native-driver-app spec).
  useEffect(() => {
    const handleVisibilityChange = () => {
      // Read the live ref, not the captured `isTracking` state, so a tab return
      // is honored even when the effect closed over a stale value.
      if (!isMountedRef.current || !isTrackingRef.current) return;
      if (!document.hidden) {
        reArmWatch();
        void updateLocationManually();
        void requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [reArmWatch, updateLocationManually, requestWakeLock]);

  // Listen for geolocation mock state changes (development only)
  // When the location simulator enables/disables the mock, we need to restart our watch
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const handleMockStateChange = () => {
      console.debug('[useLocationTracking] Geolocation mock state changed, restarting watch');

      // Clear existing watch
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }

      // Clear existing intervals
      if (intervalIdRef.current !== null) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }

      // If we were tracking, restart with the new geolocation (mocked or real)
      if (isTracking) {
        // Re-establish watch with (potentially) mocked geolocation
        watchIdRef.current = navigator.geolocation.watchPosition(
          handlePositionUpdate,
          handleGeolocationError,
          HIGH_ACCURACY_OPTIONS
        );

        // Restart periodic updates
        intervalIdRef.current = setInterval(async () => {
          if (!isMountedRef.current) return;
          try {
            const position = await getCurrentPosition();
            if (isMountedRef.current) {
              await handlePositionUpdate(position);
            }
          } catch (error) {
            if (isMountedRef.current) {
              console.debug('Periodic location update failed:', error);
            }
          }
        }, TRACKING_INTERVAL);
      }

      // Also trigger an immediate position update
      updateLocationManually();
    };

    window.addEventListener('geolocation-mock-state-changed', handleMockStateChange);
    return () => {
      window.removeEventListener('geolocation-mock-state-changed', handleMockStateChange);
    };
  }, [isTracking, handlePositionUpdate, handleGeolocationError, getCurrentPosition, updateLocationManually]);

  return {
    currentLocation,
    isTracking,
    accuracy,
    error,
    locationSyncError,
    unsyncedCount,
    isOnline,
    permissionState,
    isRequestingPermission,
    startTracking,
    stopTracking,
    updateLocationManually,
    syncOfflineLocations,
    requestLocationPermission
  };
}