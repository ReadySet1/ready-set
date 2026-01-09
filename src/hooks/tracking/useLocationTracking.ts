'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { LocationUpdate } from '@/types/tracking';
import { updateDriverLocation } from '@/app/actions/tracking/driver-actions';
import { getLocationStore } from '@/utils/indexedDB/locationStore';

interface UseLocationTrackingReturn {
  currentLocation: LocationUpdate | null;
  isTracking: boolean;
  accuracy: number | null;
  error: string | null;
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

// Helper to detect iOS Safari
const isIOSSafari = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
  return isIOS && isSafari;
};

const TRACKING_INTERVAL = 30000; // 30 seconds
const MAX_RETRY_ATTEMPTS = 3;

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
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'unknown'>('unknown');
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);
  const lastLocationRef = useRef<LocationUpdate | null>(null);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const locationStoreRef = useRef(getLocationStore());
  const isMountedRef = useRef(true); // Track if component is mounted

  // Get driver ID from session (simplified - you'll need to implement proper session management)
  const getDriverId = useCallback(async (): Promise<string | null> => {
    try {
      // This would normally come from your auth context/session
      // For now, we'll simulate getting it from the API
      const response = await fetch('/api/auth/session');
      if (response.ok) {
        const session = await response.json();
        // Assuming the session contains driver info
        return session.user?.driverId || null;
      }
      return null;
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
      batteryLevel: await getBatteryLevel(),
      activityType: determineActivityType(speed),
      isMoving: speed > 1, // Moving if speed > 1 m/s
      timestamp: new Date(position.timestamp)
    };
  }, [getDriverId]);

  // Get battery level if available
  const getBatteryLevel = async (): Promise<number | undefined> => {
    try {
      if ('getBattery' in navigator) {
        const battery = await (navigator as any).getBattery();
        return battery.level * 100;
      }
    } catch (error) {
          }
    return undefined;
  };

  // Determine activity type based on speed
  const determineActivityType = (speed: number): 'walking' | 'driving' | 'stationary' => {
    if (speed < 1) return 'stationary';
    if (speed < 5) return 'walking'; // < 5 m/s (~11 mph)
    return 'driving';
  };

  // Sync offline locations to server
  const syncOfflineLocations = useCallback(async () => {
    if (!isOnline) return;

    try {
      const locationStore = locationStoreRef.current;
      const unsyncedLocations = await locationStore.getUnsyncedLocations();

      if (unsyncedLocations.length === 0) {
        setUnsyncedCount(0);
        return;
      }

      let successCount = 0;
      let failureCount = 0;

      for (const storedLocation of unsyncedLocations) {
        try {
          // Convert stored location back to LocationUpdate format
          const locationUpdate: LocationUpdate = {
            driverId: storedLocation.driverId,
            coordinates: storedLocation.coordinates,
            accuracy: storedLocation.accuracy,
            speed: storedLocation.speed,
            heading: storedLocation.heading,
            altitude: storedLocation.altitude,
            batteryLevel: storedLocation.batteryLevel,
            activityType: storedLocation.activityType,
            isMoving: storedLocation.isMoving,
            timestamp: new Date(storedLocation.timestamp)
          };

          const result = await updateDriverLocation(storedLocation.driverId, locationUpdate);

          if (result.success) {
            await locationStore.markAsSynced(storedLocation.id);
            successCount++;
          } else {
            await locationStore.incrementSyncAttempts(storedLocation.id);
            failureCount++;

            // Remove locations that have failed too many times (10 attempts)
            if (storedLocation.syncAttempts >= 10) {
              console.warn(`Removing location ${storedLocation.id} after 10 failed attempts`);
              await locationStore.deleteLocation(storedLocation.id);
            }
          }
        } catch (error) {
          console.error('Error syncing individual location:', error);
          await locationStore.incrementSyncAttempts(storedLocation.id);
          failureCount++;
        }
      }

      // Update unsynced count
      const remaining = await locationStore.getUnsyncedCount();
      setUnsyncedCount(remaining);

      // Cleanup old synced locations (older than 7 days)
      await locationStore.clearOldSyncedLocations(7);
    } catch (error) {
      console.error('Error during offline sync:', error);
    }
  }, [isOnline]);

  // Update location to server
  const syncLocationToServer = useCallback(async (location: LocationUpdate) => {
    try {
      const result = await updateDriverLocation(location.driverId, location);
      if (!result.success) {
        // Check if this is a rate limit error - handle silently since next update will succeed
        if (result.error?.includes('Rate limit')) {
          // Rate limiting is expected behavior - don't log as error
          // The next update after the rate limit window will succeed
          return;
        }
        throw new Error(result.error || 'Failed to update location');
      }
    } catch (error) {
      // Check if this is a rate limit error message
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Rate limit')) {
        // Rate limiting is expected - silently skip
        return;
      }

      console.error('Error syncing location to server:', error);

      // Store in IndexedDB for offline sync
      try {
        const locationStore = locationStoreRef.current;
        await locationStore.addLocation(location);
        const count = await locationStore.getUnsyncedCount();
        setUnsyncedCount(count);
      } catch (storageError) {
        console.error('Failed to store location offline:', storageError);
      }
    }
  }, []);

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

      // Sync to server if tracking is active
      if (isTracking) {
        await syncLocationToServer(locationUpdate);
      }
    } catch (error) {
      console.error('Error handling position update:', error);
      setError(error instanceof Error ? error.message : 'Location update failed');
    }
  }, [formatLocationUpdate, isTracking, syncLocationToServer]);

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

  // Start continuous location tracking
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser');
      return;
    }

    setIsTracking(true);
    setError(null);

    // Start watching position
    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePositionUpdate,
      handleGeolocationError,
      HIGH_ACCURACY_OPTIONS
    );

    // Set up periodic location updates
    intervalIdRef.current = setInterval(async () => {
      try {
        const position = await getCurrentPosition();
        await handlePositionUpdate(position);
      } catch (error) {
        console.error('Periodic location update failed:', error);
      }
    }, TRACKING_INTERVAL);

    // Set up periodic offline sync (every 2 minutes)
    syncIntervalRef.current = setInterval(() => {
      syncOfflineLocations();
    }, 120000); // 2 minutes

    // Trigger initial sync on start
    syncOfflineLocations();

      }, [handlePositionUpdate, handleGeolocationError, getCurrentPosition, syncOfflineLocations]);

  // Stop location tracking
  const stopTracking = useCallback(() => {
    setIsTracking(false);

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (intervalIdRef.current !== null) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }

    if (syncIntervalRef.current !== null) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }

      }, []);

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
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser');
      setPermissionState('denied');
      return false;
    }

    setIsRequestingPermission(true);
    setError(null);

    try {
      // This call MUST be triggered by user interaction for iOS Safari to show the prompt
      const position = await getCurrentPosition();

      // If we get here, permission was granted
      setPermissionState('granted');
      await handlePositionUpdate(position);
      setIsRequestingPermission(false);
      return true;
    } catch (err) {
      setIsRequestingPermission(false);

      const maybeError = err as Partial<GeolocationPositionError>;
      if (maybeError.code === 1) {
        // Permission denied
        setPermissionState('denied');
        if (isIOSSafari()) {
          setError('Location access denied. Go to Settings > Safari > Location and enable location access for this website.');
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
  }, [getCurrentPosition, handlePositionUpdate, handleGeolocationError]);

  // Check support and permissions on mount for better UX
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('geolocation' in navigator)) {
      setError('Geolocation is not supported in this browser.');
      setPermissionState('denied');
      return;
    }

    // For iOS Safari, we can't reliably check permissions without user interaction
    // Set state to 'prompt' and wait for user to explicitly request
    if (isIOSSafari()) {
      setPermissionState('prompt');
      // Don't auto-request on iOS Safari - it won't work without user interaction
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
  }, [updateLocationManually]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopTracking();
    };
  }, [stopTracking]);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineLocations();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    // Set initial state
    setIsOnline(navigator.onLine);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
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

  // Handle page visibility changes (pause tracking when hidden)
  useEffect(() => {
    const handleVisibilityChange = () => {
      // Skip if component is unmounting or not tracking
      if (!isMountedRef.current || !isTracking) return;

      if (document.hidden) {
        // Reduce update frequency when app is in background
        if (intervalIdRef.current) {
          clearInterval(intervalIdRef.current);
          intervalIdRef.current = setInterval(async () => {
            // Check mounted state before async operations
            if (!isMountedRef.current) return;
            try {
              const position = await getCurrentPosition();
              if (isMountedRef.current) {
                await handlePositionUpdate(position);
              }
            } catch (error) {
              // Only log if still mounted (ignore errors during navigation)
              if (isMountedRef.current) {
                console.debug('Background location update skipped:', error);
              }
            }
          }, TRACKING_INTERVAL * 2); // Double the interval when in background
        }
      } else {
        // Resume normal frequency when app is visible
        if (intervalIdRef.current) {
          clearInterval(intervalIdRef.current);
          intervalIdRef.current = setInterval(async () => {
            // Check mounted state before async operations
            if (!isMountedRef.current) return;
            try {
              const position = await getCurrentPosition();
              if (isMountedRef.current) {
                await handlePositionUpdate(position);
              }
            } catch (error) {
              // Only log if still mounted (ignore errors during navigation)
              if (isMountedRef.current) {
                console.debug('Foreground location update skipped:', error);
              }
            }
          }, TRACKING_INTERVAL);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isTracking, getCurrentPosition, handlePositionUpdate]);

  return {
    currentLocation,
    isTracking,
    accuracy,
    error,
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