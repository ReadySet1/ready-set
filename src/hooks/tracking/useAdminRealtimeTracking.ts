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
   * Whether Realtime is connected and active
   */
  isRealtimeConnected: boolean;

  /**
   * Whether Realtime feature is enabled
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

  // Check if Realtime is enabled via feature flags
  const isRealtimeEnabled =
    enableRealtimeReceive &&
    useRealtime &&
    isFeatureEnabled(FEATURE_FLAGS.USE_REALTIME_ADMIN_DASHBOARD, featureFlagContext);

  // Realtime channel reference
  const channelRef = useRef<DriverLocationChannel | null>(null);
  const processedLocationsRef = useRef<Set<string>>(new Set());

  /**
   * Initialize Realtime channel
   */
  const initializeRealtime = useCallback(async () => {
    if (!isRealtimeEnabled) {
      return;
    }

    try {
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
          setRealtimeError(error.message);
          onRealtimeError?.(error);
          realtimeLogger.error('Admin location channel error', { error });
        },
        onLocationUpdate: (payload) => {
          handleLocationUpdate(payload);
        },
      });

      channelRef.current = channel;
    } catch (error) {
      realtimeLogger.error('Admin failed to initialize location channel', { error });
      setConnectionMode('sse');
      setRealtimeError((error as Error).message);
      onRealtimeError?.(error as Error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRealtimeEnabled, onRealtimeConnect, onRealtimeDisconnect, onRealtimeError]);

  /**
   * Cleanup Realtime channel
   */
  const cleanupRealtime = useCallback(async () => {
    if (channelRef.current) {
      try {
        await channelRef.current.unsubscribe();
      } catch (error) {
        realtimeLogger.error('Admin error unsubscribing from channel', { error });
      }
      channelRef.current = null;
      setIsRealtimeConnected(false);
      setConnectionMode('sse');
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
      if (processedLocationsRef.current.size > 1000) {
        const entriesToDelete = Array.from(processedLocationsRef.current).slice(0, 100);
        entriesToDelete.forEach(key => processedLocationsRef.current.delete(key));
      }

      // Convert Realtime payload to LocationData format
      const locationData: LocationData = {
        driverId: payload.driverId,
        location: {
          type: 'Point',
          coordinates: [payload.lng, payload.lat],
        },
        accuracy: payload.accuracy,
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

        const updatedDriver: TrackedDriver = {
          id: payload.driverId,
          userId: existing?.userId,
          employeeId: existing?.employeeId ?? payload.driverName ?? 'Unknown',
          vehicleNumber: payload.vehicleNumber ?? existing?.vehicleNumber,
          phoneNumber: existing?.phoneNumber ?? '',
          isActive: true,
          isOnDuty: true, // Assume on duty if sending updates
          lastKnownLocation: {
            coordinates: [payload.lng, payload.lat],
          },
          lastLocationUpdate: new Date(payload.timestamp),
          currentShiftId: existing?.currentShiftId,
          shiftStartTime: existing?.shiftStartTime,
          deliveryCount: existing?.deliveryCount,
          totalDistanceKm: existing?.totalDistanceKm ?? 0,
          activeDeliveries: existing?.activeDeliveries ?? 0,
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
          channelRef.current.unsubscribe().catch(console.error);
          channelRef.current = null;
        }
      });
    }

    return () => {
      isActive = false;
      cleanupRealtime();
    };
  }, [isRealtimeEnabled, useRealtime, initializeRealtime, cleanupRealtime]);

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
          channelRef.current.unsubscribe().catch(console.error);
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
    isRealtimeConnected,
    isRealtimeEnabled,
    connectionMode,
    error,
    reconnect,
    toggleMode,
  };
}
