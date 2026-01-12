/**
 * Admin Realtime Tracking Hook
 *
 * Extends useRealTimeTracking (SSE) to receive location updates via Supabase Realtime.
 * Provides toggle between Realtime and SSE modes with graceful fallback.
 */

'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useRealTimeTracking } from './useRealTimeTracking';
import {
  createDriverLocationChannel,
  type DriverLocationChannel,
  type DriverLocationUpdatedPayload,
} from '@/lib/realtime';
import {
  FEATURE_FLAGS,
  isFeatureEnabled,
  type FeatureFlagContext,
} from '@/lib/feature-flags';
import type { TrackedDriver, DeliveryTracking } from '@/types/tracking';
import { realtimeLogger } from '@/lib/logging/realtime-logger';
import { MEMORY_CONFIG } from '@/constants/realtime-config';

interface LocationData {
  driverId: string;
  location: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  accuracy: number;
  speed: number;
  heading: number;
  batteryLevel?: number;
  isMoving: boolean;
  activityType: 'walking' | 'driving' | 'stationary';
  recordedAt: string;
}

interface UseAdminRealtimeTrackingOptions {
  /**
   * Feature flag context for determining if Realtime is enabled
   */
  featureFlagContext?: FeatureFlagContext;

  /**
   * Whether to use Realtime mode (can be toggled by user)
   * If false, falls back to SSE mode
   */
  useRealtimeMode?: boolean;

  /**
   * Callback when Realtime connection is established
   */
  onRealtimeConnect?: () => void;

  /**
   * Callback when Realtime connection is lost
   */
  onRealtimeDisconnect?: () => void;

  /**
   * Callback when Realtime error occurs
   */
  onRealtimeError?: (error: Error) => void;

  /**
   * Whether to enable Realtime receive (listening for broadcasts)
   * If false, only uses SSE (useful for testing)
   */
  enableRealtimeReceive?: boolean;
}

interface UseAdminRealtimeTrackingReturn {
  /**
   * Active drivers with current location and status
   */
  activeDrivers: TrackedDriver[];

  /**
   * Recent location updates from drivers
   */
  recentLocations: LocationData[];

  /**
   * Active deliveries being tracked
   */
  activeDeliveries: DeliveryTracking[];

  /**
   * Whether connected to data source (SSE or Realtime)
   */
  isConnected: boolean;

  /**
   * Whether initial data is still loading
   */
  isLoading: boolean;

  /**
   * Whether Realtime is connected and active
   */
  isRealtimeConnected: boolean;

  /**
   * Whether the Realtime feature is enabled via flags/configuration.
   *
   * NOTE: This indicates that Realtime *can* be used for this user/role.
   * The actual active mode (Realtime vs SSE) is determined by connectionMode
   * and the internal user toggle (WebSocket vs SSE mode).
   */
  isRealtimeEnabled: boolean;

  /**
   * Connection mode: 'realtime', 'sse', or 'hybrid'
   */
  connectionMode: 'realtime' | 'sse' | 'hybrid';

  /**
   * Error message if any
   */
  error: string | null;

  /**
   * Manual reconnect function
   */
  reconnect: () => void;

  /**
   * Toggle between Realtime and SSE modes
   */
  toggleMode: () => void;
}

export function useAdminRealtimeTracking(
  options: UseAdminRealtimeTrackingOptions = {},
): UseAdminRealtimeTrackingReturn {
  const {
    featureFlagContext,
    useRealtimeMode = true,
    onRealtimeConnect,
    onRealtimeDisconnect,
    onRealtimeError,
    enableRealtimeReceive = true,
  } = options;

  // Use the existing SSE tracking hook as fallback
  const sseTracking = useRealTimeTracking();
  const {
    activeDrivers: sseActiveDrivers,
    recentLocations: sseRecentLocations,
    activeDeliveries: sseActiveDeliveries,
    isConnected: sseIsConnected,
    isLoading: sseIsLoading,
    error: sseError,
    reconnect: sseReconnect,
  } = sseTracking;

  // Realtime state
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [connectionMode, setConnectionMode] = useState<'realtime' | 'sse' | 'hybrid'>('sse');
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  const [useRealtime, setUseRealtime] = useState(useRealtimeMode);

  // Realtime data (merged with SSE data)
  const [realtimeDrivers, setRealtimeDrivers] = useState<Map<string, TrackedDriver>>(new Map());
  const [realtimeLocations, setRealtimeLocations] = useState<LocationData[]>([]);

  /**
   * Global Realtime enablement based on feature flags and configuration.
   * This determines whether the admin dashboard *supports* Realtime at all.
   */
  const isRealtimeFeatureEnabled =
    enableRealtimeReceive &&
    isFeatureEnabled(FEATURE_FLAGS.USE_REALTIME_ADMIN_DASHBOARD, featureFlagContext);

  /**
   * Effective Realtime enablement for the current session.
   * Combines the global feature flag with the user's WebSocket/SSE toggle.
   */
  const isRealtimeEnabled = isRealtimeFeatureEnabled && useRealtime;

  // Realtime channel reference
  const channelRef = useRef<DriverLocationChannel | null>(null);
  const processedLocationsRef = useRef<Set<string>>(new Set());

  // Ref to track SSE drivers for lookup in Realtime updates (avoids stale closure)
  const sseActiveDriversRef = useRef<TrackedDriver[]>([]);

  // Ref to track SSE deliveries for driver name enrichment (deliveries have more accurate driver assignments)
  const sseActiveDeliveriesRef = useRef<DeliveryTracking[]>([]);

  /**
   * Initialize Realtime channel
   * Includes pre-connection auth check and graceful fallback handling
   */
  const initializeRealtime = useCallback(async () => {
    if (!isRealtimeEnabled) {
      return;
    }

    try {
      // Pre-check: Verify authentication is established before attempting realtime connection
      // This prevents timeout errors when auth is still loading
      const { createClient } = await import('@/utils/supabase/client');
      const supabase = createClient();
      const { data: { session }, error: authError } = await supabase.auth.getSession();

      if (authError || !session) {
        realtimeLogger.warn('Skipping Realtime initialization - no active session', {
          metadata: { hasError: !!authError, hasSession: !!session }
        });
        setConnectionMode('sse');
        return;
      }

      const channel = createDriverLocationChannel();

      await channel.subscribe({
        onConnect: () => {
          setIsRealtimeConnected(true);
          setConnectionMode('realtime');
          setRealtimeError(null);
          onRealtimeConnect?.();
        },
        onDisconnect: () => {
          setIsRealtimeConnected(false);
          setConnectionMode('sse');
          onRealtimeDisconnect?.();
        },
        onError: (error) => {
          setIsRealtimeConnected(false);
          setConnectionMode('sse');
          // Only set error message if it's not a timeout (timeout is expected during fallback)
          const isTimeoutError = error.message?.includes('timed out') || error.message?.includes('timeout');
          if (!isTimeoutError) {
            setRealtimeError(error.message);
          }
          onRealtimeError?.(error);
          // Log as warning since we gracefully fall back to SSE
          realtimeLogger.warn('Admin location channel error - falling back to SSE', { error });
        },
        onLocationUpdate: (payload) => {
          handleLocationUpdate(payload);
        },
      });

      channelRef.current = channel;
    } catch (error) {
      // Log as warning since we gracefully fall back to SSE
      const errorMessage = (error as Error).message || 'Unknown error';
      const isTimeoutError = errorMessage.includes('timed out') || errorMessage.includes('timeout');

      if (isTimeoutError) {
        realtimeLogger.warn('Realtime connection timed out - using SSE fallback', {
          metadata: { message: errorMessage }
        });
      } else {
        realtimeLogger.warn('Admin failed to initialize location channel - using SSE fallback', { error });
      }

      setConnectionMode('sse');
      // Don't show timeout errors to user since SSE fallback works fine
      if (!isTimeoutError) {
        setRealtimeError(errorMessage);
      }
      onRealtimeError?.(error as Error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRealtimeEnabled, onRealtimeConnect, onRealtimeDisconnect, onRealtimeError]);

  // Track if component is mounted to prevent setState after unmount
  const isMountedRef = useRef(true);

  // Set mounted flag to false on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Keep SSE drivers ref up to date (for lookup in Realtime location updates)
  useEffect(() => {
    sseActiveDriversRef.current = sseActiveDrivers;
  }, [sseActiveDrivers]);

  // Keep SSE deliveries ref up to date (for driver name enrichment in Realtime mode)
  useEffect(() => {
    sseActiveDeliveriesRef.current = sseActiveDeliveries;
  }, [sseActiveDeliveries]);

  /**
   * Cleanup Realtime channel with cancellation support
   * Prevents state updates after component unmount (race condition fix)
   */
  const cleanupRealtime = useCallback(async () => {
    if (channelRef.current) {
      const channelToCleanup = channelRef.current;

      try {
        await channelToCleanup.unsubscribe();

        // Only update state if component is still mounted
        if (isMountedRef.current) {
          channelRef.current = null;
          setIsRealtimeConnected(false);
          setConnectionMode('sse');
        }
      } catch (error) {
        // Only log if component is still mounted
        if (isMountedRef.current) {
          realtimeLogger.error('Admin error unsubscribing from channel', { error });
        }
      }
    }
  }, []);

  /**
   * Handle incoming location update from Realtime
   */
  const handleLocationUpdate = useCallback((payload: DriverLocationUpdatedPayload) => {
    try {
      // Prevent duplicate processing
      const locationKey = `${payload.driverId}:${payload.timestamp}`;
      if (processedLocationsRef.current.has(locationKey)) {
        return;
      }
      processedLocationsRef.current.add(locationKey);

      // Clean up old entries to prevent memory leak
      // When threshold exceeded, delete batch of oldest entries for efficiency
      if (processedLocationsRef.current.size > MEMORY_CONFIG.PROCESSED_LOCATIONS_THRESHOLD) {
        const entriesToDelete = Array.from(processedLocationsRef.current).slice(
          0,
          MEMORY_CONFIG.PROCESSED_LOCATIONS_CLEANUP_BATCH
        );
        entriesToDelete.forEach(key => processedLocationsRef.current.delete(key));

        realtimeLogger.warn('Processed locations size-based cleanup performed', {
          metadata: {
            beforeSize: processedLocationsRef.current.size + MEMORY_CONFIG.PROCESSED_LOCATIONS_CLEANUP_BATCH,
            afterSize: processedLocationsRef.current.size,
            removed: MEMORY_CONFIG.PROCESSED_LOCATIONS_CLEANUP_BATCH,
          },
        });
      }

      // Convert Realtime payload to LocationData format
      // Add defensive null checks for required fields
      if (!payload.driverId || !payload.timestamp) {
        realtimeLogger.warn('Missing required fields in location payload', {
          driverId: payload.driverId,
          metadata: {
            timestamp: payload.timestamp,
          },
        });
        return;
      }

      // Validate coordinate ranges
      if (
        typeof payload.lat !== 'number' ||
        typeof payload.lng !== 'number' ||
        payload.lat < -90 ||
        payload.lat > 90 ||
        payload.lng < -180 ||
        payload.lng > 180
      ) {
        realtimeLogger.warn('Invalid coordinates in location payload', {
          driverId: payload.driverId,
          metadata: {
            lat: payload.lat,
            lng: payload.lng,
          },
        });
        return;
      }

      const locationData: LocationData = {
        driverId: payload.driverId,
        location: {
          type: 'Point',
          coordinates: [payload.lng, payload.lat],
        },
        accuracy: payload.accuracy ?? 0,
        speed: payload.speed ?? 0,
        heading: payload.heading ?? 0,
        batteryLevel: payload.batteryLevel ?? undefined,
        isMoving: payload.isMoving ?? false,
        activityType: (payload.activityType as 'walking' | 'driving' | 'stationary') ?? 'stationary',
        recordedAt: payload.timestamp,
      };

      // Update recent locations (keep last 100)
      setRealtimeLocations((prev) => {
        const updated = [locationData, ...prev.filter((loc) => loc.driverId !== payload.driverId)];
        return updated.slice(0, 100);
      });

      // Update driver in Realtime drivers map
      setRealtimeDrivers((prev) => {
        const updated = new Map(prev);
        const existing = updated.get(payload.driverId);

        // Look up driver info from SSE data first (has complete info like name, employeeId)
        const sseDriver = sseActiveDriversRef.current.find(d => d.id === payload.driverId);

        // Look up driver name from deliveries (more reliable than drivers.profile_id)
        // Legacy dispatches have driverName from the actual dispatch assignment
        // This handles the case where drivers.profile_id points to wrong profile
        //
        // Match criteria:
        // 1. delivery.driverId === payload.driverId (direct driver ID match)
        // 2. delivery.dispatchDriverId correlation (for legacy dispatches with profile ID)
        const deliveryWithDriver = sseActiveDeliveriesRef.current.find((d) => {
          const deliveryWithDriverInfo = d as DeliveryTracking & {
            driverName?: string;
            dispatchDriverId?: string;
          };
          if (!deliveryWithDriverInfo.driverName) return false;
          // Try direct match first
          if (d.driverId === payload.driverId) return true;
          return false;
        }) as (DeliveryTracking & { driverName?: string }) | undefined;

        let deliveryDriverName = deliveryWithDriver?.driverName;

        // Heuristic fallback: if no direct match found, look for delivery with
        // driverName that doesn't exist in any SSE driver's name.
        // This handles the case where driver record has wrong profile_id,
        // resulting in SSE driver having wrong name but delivery having correct name.
        if (!deliveryDriverName && sseActiveDeliveriesRef.current.length > 0) {
          const sseDriverNames = new Set(
            sseActiveDriversRef.current.map((d) => d.name).filter(Boolean),
          );

          const unmatchedDelivery = sseActiveDeliveriesRef.current.find((d) => {
            const info = d as DeliveryTracking & { driverName?: string };
            // Find delivery with driverName that's NOT in any SSE driver's name
            return info.driverName && !sseDriverNames.has(info.driverName);
          }) as (DeliveryTracking & { driverName?: string }) | undefined;

          if (unmatchedDelivery) {
            deliveryDriverName = unmatchedDelivery.driverName;
          }
        }

        // Priority for driver name:
        // 1. Delivery/dispatch name (most accurate - actual assignment)
        // 2. Existing name from previous updates
        // 3. SSE driver name (from drivers.profile_id - may be incorrect)
        // 4. Payload driver name (from Realtime broadcast)
        const resolvedName = deliveryDriverName ?? existing?.name ?? sseDriver?.name ?? payload.driverName;

        const updatedDriver: TrackedDriver = {
          id: payload.driverId,
          userId: existing?.userId ?? sseDriver?.userId,
          employeeId: existing?.employeeId ?? sseDriver?.employeeId ?? 'Unknown',
          name: resolvedName,
          vehicleNumber: payload.vehicleNumber ?? existing?.vehicleNumber ?? sseDriver?.vehicleNumber,
          phoneNumber: existing?.phoneNumber ?? sseDriver?.phoneNumber ?? '',
          isActive: true,
          isOnDuty: true, // Assume on duty if sending updates
          lastKnownLocation: {
            coordinates: [payload.lng, payload.lat],
          },
          lastLocationUpdate: new Date(payload.timestamp),
          currentShiftId: existing?.currentShiftId ?? sseDriver?.currentShiftId,
          shiftStartTime: existing?.shiftStartTime ?? sseDriver?.shiftStartTime,
          deliveryCount: existing?.deliveryCount ?? sseDriver?.deliveryCount,
          totalDistanceMiles: existing?.totalDistanceMiles ?? sseDriver?.totalDistanceMiles ?? 0,
          activeDeliveries: existing?.activeDeliveries ?? sseDriver?.activeDeliveries ?? 0,
          metadata: existing?.metadata ?? {},
          createdAt: existing?.createdAt ?? new Date(),
          updatedAt: new Date(),
        };

        updated.set(payload.driverId, updatedDriver);
        return updated;
      });
    } catch (error) {
      realtimeLogger.error('Admin error handling location update', {
        driverId: payload.driverId,
        error
      });
    }
  }, []);

  /**
   * Toggle between Realtime and SSE modes
   */
  const toggleMode = useCallback(() => {
    setUseRealtime((prev) => !prev);
  }, []);

  /**
   * Manual reconnect function
   */
  const reconnect = useCallback(() => {
    if (isRealtimeEnabled && useRealtime) {
      cleanupRealtime().then(() => initializeRealtime());
    } else {
      sseReconnect();
    }
  }, [isRealtimeEnabled, useRealtime, cleanupRealtime, initializeRealtime, sseReconnect]);

  /**
   * Initialize Realtime on mount if enabled
   * Uses cancellation pattern to prevent race conditions
   */
  useEffect(() => {
    let isActive = true;

    if (isRealtimeEnabled && useRealtime) {
      initializeRealtime().then(() => {
        // If component unmounted or deps changed during init, cleanup
        if (!isActive && channelRef.current) {
          channelRef.current.unsubscribe().catch((error) => {
            realtimeLogger.error('Failed to unsubscribe from channel', { error });
          });
          channelRef.current = null;
        }
      });
    }

    return () => {
      isActive = false;
      cleanupRealtime();
    };
    // initializeRealtime and cleanupRealtime are stable refs created with useCallback
    // Including them in deps would cause infinite re-renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRealtimeEnabled, useRealtime]);

  /**
   * Handle Realtime feature flag or mode changes
   * Uses cancellation pattern to prevent race conditions
   */
  useEffect(() => {
    let isActive = true;

    if (!isRealtimeEnabled && channelRef.current) {
      cleanupRealtime();
    } else if (isRealtimeEnabled && !channelRef.current && useRealtime) {
      initializeRealtime().then(() => {
        // If component unmounted or deps changed during init, cleanup
        if (!isActive && channelRef.current) {
          channelRef.current.unsubscribe().catch((error) => {
            realtimeLogger.error('Failed to unsubscribe from channel', { error });
          });
          channelRef.current = null;
        }
      });
    }

    return () => {
      isActive = false;
    };
  }, [isRealtimeEnabled, useRealtime, initializeRealtime, cleanupRealtime]);

  /**
   * Update connection mode based on Realtime status
   */
  useEffect(() => {
    if (isRealtimeEnabled && isRealtimeConnected && useRealtime) {
      setConnectionMode('realtime');
    } else if (isRealtimeEnabled && !isRealtimeConnected && useRealtime) {
      setConnectionMode('hybrid'); // Attempting Realtime, falling back to SSE
    } else {
      setConnectionMode('sse');
    }
  }, [isRealtimeEnabled, isRealtimeConnected, useRealtime]);

  /**
   * Time-based cleanup for processedLocations
   * Removes entries older than 1 hour every 15 minutes
   * Prevents unbounded memory growth from long-running sessions
   */
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      const cutoffTime = now - MEMORY_CONFIG.LOCATION_ENTRY_MAX_AGE_MS;
      let removedCount = 0;

      // Iterate through all entries and remove old ones
      processedLocationsRef.current.forEach((key) => {
        // Key format: "driverId:timestamp"
        const timestamp = key.split(':')[1];
        if (timestamp) {
          const entryTime = new Date(timestamp).getTime();
          if (entryTime < cutoffTime) {
            processedLocationsRef.current.delete(key);
            removedCount++;
          }
        }
      });

      // Log cleanup if entries were removed
      if (removedCount > 0) {
        realtimeLogger.info('Processed locations time-based cleanup performed', {
          metadata: {
            removedCount,
            remainingCount: processedLocationsRef.current.size,
            cutoffAge: `${MEMORY_CONFIG.LOCATION_ENTRY_MAX_AGE_MS / (60 * 1000)} minutes`,
          },
        });
      }
    }, MEMORY_CONFIG.TIME_BASED_CLEANUP_INTERVAL_MS);

    return () => {
      clearInterval(cleanupInterval);
    };
  }, []);

  /**
   * Merge Realtime and SSE data
   * Priority: Realtime > SSE (Realtime is more up-to-date)
   */
  const activeDrivers =
    isRealtimeConnected && useRealtime
      ? Array.from(realtimeDrivers.values())
      : sseActiveDrivers;

  const recentLocations =
    isRealtimeConnected && useRealtime ? realtimeLocations : sseRecentLocations;

  // Always use SSE for deliveries (Realtime doesn't handle these yet)
  const activeDeliveries = sseActiveDeliveries;

  // Determine connection status
  const isConnected =
    (isRealtimeEnabled && isRealtimeConnected && useRealtime) || sseIsConnected;

  // Combine errors - only show SSE error if Realtime is not connected
  const error = realtimeError || (isRealtimeConnected ? null : sseError);

  return {
    activeDrivers,
    recentLocations,
    activeDeliveries,
    isConnected,
    isLoading: sseIsLoading,
    isRealtimeConnected,
    // Expose global feature availability so the UI can always show the
    // WebSocket/SSE controls when Realtime is turned on for this environment.
    isRealtimeEnabled: isRealtimeFeatureEnabled,
    connectionMode,
    error,
    reconnect,
    toggleMode,
  };
}
