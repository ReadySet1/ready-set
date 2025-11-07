/**
 * Realtime Location Tracking Hook
 *
 * Extends useLocationTracking to broadcast location updates via Supabase Realtime.
 * Falls back to REST API if Realtime is unavailable or disabled.
 *
 * Usage:
 * ```tsx
 * const {
 *   currentLocation,
 *   isTracking,
 *   isRealtimeConnected,
 *   connectionMode,
 *   startTracking,
 *   stopTracking,
 * } = useRealtimeLocationTracking({
 *   enableRealtimeBroadcast: true,
 *   onRealtimeConnect: () => {
 *     // Handle connection
 *   },
 * });
 * ```
 */

'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useLocationTracking } from './useLocationTracking';
import { createClient } from '@/utils/supabase/client';
import {
  createDriverLocationChannel,
  type DriverLocationChannel,
} from '@/lib/realtime';
import type { LocationUpdate } from '@/types/tracking';
import {
  FEATURE_FLAGS,
  isFeatureEnabled,
  type FeatureFlagContext,
} from '@/lib/feature-flags';
import { realtimeLogger } from '@/lib/logging/realtime-logger';

interface UseRealtimeLocationTrackingOptions {
  /**
   * Feature flag context for determining if Realtime is enabled
   */
  featureFlagContext?: FeatureFlagContext;

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
   * Whether to broadcast location updates via Realtime
   * If false, only uses REST API (useful for testing)
   */
  enableRealtimeBroadcast?: boolean;

  /**
   * Driver ID for channel identification
   * If not provided, will attempt to get from session
   */
  driverId?: string;
}

interface UseRealtimeLocationTrackingReturn
  extends ReturnType<typeof useLocationTracking> {
  /**
   * Whether Realtime is connected and active
   */
  isRealtimeConnected: boolean;

  /**
   * Whether Realtime feature is enabled
   */
  isRealtimeEnabled: boolean;

  /**
   * Connection mode: 'realtime', 'rest', or 'hybrid'
   */
  connectionMode: 'realtime' | 'rest' | 'hybrid';
}

export function useRealtimeLocationTracking(
  options: UseRealtimeLocationTrackingOptions = {},
): UseRealtimeLocationTrackingReturn {
  const {
    featureFlagContext,
    onRealtimeConnect,
    onRealtimeDisconnect,
    onRealtimeError,
    enableRealtimeBroadcast = true,
    driverId,
  } = options;

  // Use the existing location tracking hook (handles REST API sync)
  const locationTracking = useLocationTracking();
  const { currentLocation, isTracking } = locationTracking;

  // Realtime state
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [connectionMode, setConnectionMode] = useState<'realtime' | 'rest' | 'hybrid'>(
    'rest',
  );

  // Check if Realtime is enabled via feature flags
  const isRealtimeEnabled =
    enableRealtimeBroadcast &&
    isFeatureEnabled(FEATURE_FLAGS.USE_REALTIME_LOCATION_UPDATES, featureFlagContext);

  // Realtime channel reference
  const channelRef = useRef<DriverLocationChannel | null>(null);
  const lastBroadcastRef = useRef<string | null>(null);

  /**
   * Initialize Realtime channel
   */
  const initializeRealtime = useCallback(async () => {
    if (!isRealtimeEnabled || channelRef.current) {
      return;
    }

    try {
      // Create channel
      const channel = createDriverLocationChannel();

      // Subscribe with callbacks
      await channel.subscribe({
        onConnect: () => {
          setIsRealtimeConnected(true);
          setConnectionMode('realtime');
          onRealtimeConnect?.();
          realtimeLogger.connection('connected', 'driver-locations');
        },
        onDisconnect: () => {
          setIsRealtimeConnected(false);
          setConnectionMode('rest');
          onRealtimeDisconnect?.();
          realtimeLogger.connection('disconnected', 'driver-locations');
        },
        onError: (error: Error) => {
          realtimeLogger.error('Channel error in location tracking', { error });
          onRealtimeError?.(error);
          // Don't change connection status on errors - let reconnection logic handle it
        },
      });

      channelRef.current = channel;
      realtimeLogger.connection('initialized', 'driver-locations');
    } catch (error) {
      realtimeLogger.error('Failed to initialize location channel', { error });
      setConnectionMode('rest');
      setIsRealtimeConnected(false);
      onRealtimeError?.(error as Error);
    }
  }, [
    isRealtimeEnabled,
    onRealtimeConnect,
    onRealtimeDisconnect,
    onRealtimeError,
  ]);

  /**
   * Cleanup Realtime channel
   */
  const cleanupRealtime = useCallback(async () => {
    if (channelRef.current) {
      try {
        await channelRef.current.unsubscribe();
      } catch (error) {
        realtimeLogger.error('Error disconnecting from channel', { error });
      }
      channelRef.current = null;
      setIsRealtimeConnected(false);
      setConnectionMode('rest');
    }
  }, []);

  /**
   * Broadcast location update via Realtime
   */
  const broadcastLocation = useCallback(
    async (location: LocationUpdate) => {
      if (!channelRef.current || !isRealtimeConnected) {
        return false;
      }

      try {
        // Validate driver ID before broadcast
        if (!location.driverId) {
          realtimeLogger.warn('Missing driver ID in location update', {
            metadata: {
              coordinates: `${location.coordinates.lat},${location.coordinates.lng}`,
            },
          });
          return false;
        }

        // Prevent duplicate broadcasts
        const locationKey = `${location.coordinates.lat},${location.coordinates.lng},${location.timestamp.getTime()}`;
        if (lastBroadcastRef.current === locationKey) {
          return true;
        }

        // Broadcast via Realtime channel
        await channelRef.current.broadcastLocationUpdate({
          driverId: location.driverId,
          lat: location.coordinates.lat,
          lng: location.coordinates.lng,
          accuracy: location.accuracy || 0,
          speed: location.speed,
          heading: location.heading,
          altitude: location.altitude,
          batteryLevel: location.batteryLevel,
          isMoving: location.isMoving,
          activityType: location.activityType as 'walking' | 'driving' | 'stationary' | null,
          timestamp: location.timestamp.toISOString(),
        });
        lastBroadcastRef.current = locationKey;

        realtimeLogger.broadcast('location-update', 'driver-locations', {
          driverId: location.driverId,
          timestamp: location.timestamp.toISOString()
        });
        return true;
      } catch (error) {
        realtimeLogger.error('Failed to broadcast location', {
          driverId: location.driverId,
          error
        });
        onRealtimeError?.(error as Error);
        return false;
      }
    },
    [isRealtimeConnected, onRealtimeError],
  );

  /**
   * Initialize Realtime on mount if enabled and tracking
   * Uses cancellation pattern to prevent race conditions when dependencies change
   */
  useEffect(() => {
    let isActive = true;

    if (isRealtimeEnabled && isTracking && !channelRef.current) {
      // Call initialization function and handle race condition
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

    // Cleanup on unmount or when dependencies change
    return () => {
      isActive = false;
      cleanupRealtime();
    };
    // initializeRealtime and cleanupRealtime are stable refs created with useCallback
    // Including them in deps would cause infinite re-renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRealtimeEnabled, isTracking]);

  /**
   * Broadcast location updates when they change
   * This runs AFTER the REST API sync (handled by useLocationTracking)
   */
  useEffect(() => {
    if (!currentLocation || !isTracking || !isRealtimeEnabled || !isRealtimeConnected) {
      return;
    }

    // Attempt to broadcast via Realtime (non-blocking)
    // REST fallback is already handled by useLocationTracking
    broadcastLocation(currentLocation).catch((error) => {
      realtimeLogger.error('Failed to broadcast location update', { error });
    });
  }, [currentLocation, isTracking, isRealtimeEnabled, isRealtimeConnected, broadcastLocation]);

  /**
   * Handle Realtime feature flag changes
   * Disconnect if disabled, connect if enabled
   * Uses cancellation pattern to prevent race conditions
   */
  useEffect(() => {
    let isActive = true;

    if (!isRealtimeEnabled && channelRef.current) {
      // Feature disabled - cleanup
      cleanupRealtime();
    } else if (isRealtimeEnabled && !channelRef.current && isTracking) {
      // Feature enabled and tracking active - initialize
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
  }, [isRealtimeEnabled, isTracking, initializeRealtime, cleanupRealtime]);

  /**
   * Update connection mode based on Realtime status
   */
  useEffect(() => {
    if (isRealtimeEnabled && isRealtimeConnected) {
      setConnectionMode('realtime');
    } else if (isRealtimeEnabled && !isRealtimeConnected && isTracking) {
      setConnectionMode('hybrid'); // Attempting Realtime, falling back to REST
    } else {
      setConnectionMode('rest');
    }
  }, [isRealtimeEnabled, isRealtimeConnected, isTracking]);

  /**
   * Handle page visibility to optimize battery/bandwidth
   * Uses cancellation pattern to prevent race conditions
   */
  useEffect(() => {
    let isActive = true;

    const handleVisibilityChange = () => {
      if (document.hidden && channelRef.current && isRealtimeConnected) {
        // Optionally reduce broadcast frequency when in background
        // For now, keep channel open but rely on watchPosition's reduced frequency
        realtimeLogger.debug('Page hidden, maintaining connection');
      } else if (!document.hidden && isRealtimeEnabled && !channelRef.current && isTracking) {
        // Page visible again - reconnect if needed
        realtimeLogger.debug('Page visible, checking connection');
        initializeRealtime().then(() => {
          // If listener was removed during init, cleanup
          if (!isActive && channelRef.current) {
            channelRef.current.unsubscribe().catch((error) => {
            realtimeLogger.error('Failed to unsubscribe from channel', { error });
          });
            channelRef.current = null;
          }
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      isActive = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isRealtimeEnabled, isRealtimeConnected, isTracking, initializeRealtime]);

  return {
    ...locationTracking,
    isRealtimeConnected,
    isRealtimeEnabled,
    connectionMode,
  };
}
