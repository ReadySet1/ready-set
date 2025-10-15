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
  startTracking: () => void;
  stopTracking: () => void;
  updateLocationManually: () => Promise<void>;
  syncOfflineLocations: () => Promise<void>;
}

const TRACKING_INTERVAL = 30000; // 30 seconds
const HIGH_ACCURACY_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 5000
};

export function useLocationTracking(): UseLocationTrackingReturn {
  const [currentLocation, setCurrentLocation] = useState<LocationUpdate | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);

  const watchIdRef = useRef<number | null>(null);
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);
  const lastLocationRef = useRef<LocationUpdate | null>(null);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const locationStoreRef = useRef(getLocationStore());

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

  // Get current position
  const getCurrentPosition = useCallback((): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        HIGH_ACCURACY_OPTIONS
      );
    });
  }, []);

  // Convert GeolocationPosition to LocationUpdate
  const formatLocationUpdate = useCallback(async (position: GeolocationPosition): Promise<LocationUpdate | null> => {
    const driverId = await getDriverId();
    if (!driverId) {
      throw new Error('Driver ID not found');
    }

    return {
      driverId,
      coordinates: {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      },
      accuracy: position.coords.accuracy,
      speed: position.coords.speed || 0,
      heading: position.coords.heading || 0,
      altitude: position.coords.altitude || undefined,
      batteryLevel: await getBatteryLevel(),
      activityType: determineActivityType(position.coords.speed || 0),
      isMoving: (position.coords.speed || 0) > 1, // Moving if speed > 1 m/s
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

      console.log(`Syncing ${unsyncedLocations.length} offline locations...`);

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

      console.log(`Sync complete: ${successCount} succeeded, ${failureCount} failed`);

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
        throw new Error(result.error || 'Failed to update location');
      }
    } catch (error) {
      console.error('Error syncing location to server:', error);

      // Store in IndexedDB for offline sync
      try {
        const locationStore = locationStoreRef.current;
        await locationStore.addLocation(location);
        const count = await locationStore.getUnsyncedCount();
        setUnsyncedCount(count);
        console.log(`Location stored offline. Total unsynced: ${count}`);
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
  const handleGeolocationError = useCallback((err: unknown) => {
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
      message = 'Location request timed out. Try again.';
    } else if (detailMessage) {
      message = `Location error: ${detailMessage}`;
    } else {
      message = 'Location error: An unknown error occurred.';
    }

    setError(message);
    // Log structured details and multiple render-friendly forms to avoid empty {}
    const toStringValue = (err as any)?.toString ? (err as any).toString() : undefined;
    console.error('Geolocation error:', message, { code, name, detailMessage }, toStringValue);
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

  // Check support and permissions on mount for better UX
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('geolocation' in navigator)) {
      setError('Geolocation is not supported in this browser.');
      return;
    }
    try {
      if ('permissions' in navigator && (navigator as any).permissions?.query) {
        (navigator as any).permissions
          .query({ name: 'geolocation' as PermissionName })
          .then((status: PermissionStatus) => {
            if (status.state === 'denied') {
              setError('Location permission is denied. Enable it in your browser settings.');
            }
          })
          .catch(() => {
            // Ignore permission query errors; not all browsers support it reliably
          });
      }
    } catch {
      // no-op
    }
  }, []);

  // Get initial location on mount
  useEffect(() => {
    updateLocationManually();
  }, [updateLocationManually]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      console.log('Connection restored - syncing offline locations...');
      setIsOnline(true);
      syncOfflineLocations();
    };

    const handleOffline = () => {
      console.log('Connection lost - locations will be stored offline');
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

        if (count > 0) {
          console.log(`Found ${count} unsynced locations on startup`);
        }
      } catch (error) {
        console.error('Failed to load unsynced count:', error);
      }
    };

    loadUnsyncedCount();
  }, []);

  // Handle page visibility changes (pause tracking when hidden)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isTracking) {
        // Reduce update frequency when app is in background
        if (intervalIdRef.current) {
          clearInterval(intervalIdRef.current);
          intervalIdRef.current = setInterval(async () => {
            try {
              const position = await getCurrentPosition();
              await handlePositionUpdate(position);
            } catch (error) {
              console.error('Background location update failed:', error);
            }
          }, TRACKING_INTERVAL * 2); // Double the interval when in background
        }
      } else if (!document.hidden && isTracking) {
        // Resume normal frequency when app is visible
        if (intervalIdRef.current) {
          clearInterval(intervalIdRef.current);
          intervalIdRef.current = setInterval(async () => {
            try {
              const position = await getCurrentPosition();
              await handlePositionUpdate(position);
            } catch (error) {
              console.error('Foreground location update failed:', error);
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
    startTracking,
    stopTracking,
    updateLocationManually,
    syncOfflineLocations
  };
}