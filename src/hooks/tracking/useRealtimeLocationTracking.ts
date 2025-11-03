/**
 * Realtime Location Tracking Hook
 *
 * Extends useLocationTracking to broadcast location updates via Supabase Realtime.
 * Falls back to REST API if Realtime is unavailable or disabled.
 */

'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useLocationTracking } from './useLocationTracking';
import {
  createDriverLocationChannel,
  type DriverLocationChannel,
  type DriverLocationPayload,
} from '@/lib/realtime';
import {
  FEATURE_FLAGS,
  isFeatureEnabled,
  type FeatureFlagContext,
} from '@/lib/feature-flags';

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
  } = options;

  // Use the existing location tracking hook
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
    if (!isRealtimeEnabled) {
      return;
    }

    try {
      const channel = createDriverLocationChannel();

      await channel.subscribe({
        onConnect: () => {
          setIsRealtimeConnected(true);
          setConnectionMode('realtime');
          onRealtimeConnect?.();
          console.log('[Realtime] Location channel connected');
        },
        onDisconnect: () => {
          setIsRealtimeConnected(false);
          setConnectionMode('rest');
          onRealtimeDisconnect?.();
          console.log('[Realtime] Location channel disconnected');
        },
        onError: (error) => {
          setIsRealtimeConnected(false);
          setConnectionMode('rest');
          onRealtimeError?.(error);
          console.error('[Realtime] Location channel error:', error);
        },
      });

      channelRef.current = channel;
    } catch (error) {
      console.error('[Realtime] Failed to initialize location channel:', error);
      setConnectionMode('rest');
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
        console.error('[Realtime] Error unsubscribing from channel:', error);
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
    async (location: NonNullable<typeof currentLocation>) => {
      if (!channelRef.current || !isRealtimeConnected) {
        return false;
      }

      try {
        // Prevent duplicate broadcasts
        const locationKey = `${location.coordinates.lat},${location.coordinates.lng},${location.timestamp.getTime()}`;
        if (lastBroadcastRef.current === locationKey) {
          return true;
        }

        const payload: DriverLocationPayload = {
          lat: location.coordinates.lat,
          lng: location.coordinates.lng,
          accuracy: location.accuracy,
          speed: location.speed || null,
          heading: location.heading || null,
          altitude: location.altitude || null,
          batteryLevel: location.batteryLevel || null,
          isMoving: location.isMoving,
          activityType: location.activityType || null,
          timestamp: location.timestamp.toISOString(),
        };

        await channelRef.current.sendLocationUpdate(payload);
        lastBroadcastRef.current = locationKey;
        return true;
      } catch (error) {
        console.error('[Realtime] Failed to broadcast location:', error);
        return false;
      }
    },
    [isRealtimeConnected],
  );

  /**
   * Initialize Realtime on mount if enabled
   */
  useEffect(() => {
    if (isRealtimeEnabled && isTracking) {
      initializeRealtime();
    }

    return () => {
      cleanupRealtime();
    };
  }, [isRealtimeEnabled, isTracking, initializeRealtime, cleanupRealtime]);

  /**
   * Broadcast location updates when they change
   */
  useEffect(() => {
    if (!currentLocation || !isTracking || !isRealtimeEnabled) {
      return;
    }

    // Attempt to broadcast via Realtime
    broadcastLocation(currentLocation).catch((error) => {
      console.error('[Realtime] Failed to broadcast location update:', error);
      // REST fallback is handled by the base useLocationTracking hook
    });
  }, [currentLocation, isTracking, isRealtimeEnabled, broadcastLocation]);

  /**
   * Handle Realtime feature flag changes
   */
  useEffect(() => {
    if (!isRealtimeEnabled && channelRef.current) {
      cleanupRealtime();
    } else if (isRealtimeEnabled && !channelRef.current && isTracking) {
      initializeRealtime();
    }
  }, [isRealtimeEnabled, isTracking, initializeRealtime, cleanupRealtime]);

  /**
   * Update connection mode based on Realtime status
   */
  useEffect(() => {
    if (isRealtimeEnabled && isRealtimeConnected) {
      setConnectionMode('realtime');
    } else if (isRealtimeEnabled && !isRealtimeConnected) {
      setConnectionMode('hybrid'); // Attempting Realtime, falling back to REST
    } else {
      setConnectionMode('rest');
    }
  }, [isRealtimeEnabled, isRealtimeConnected]);

  return {
    ...locationTracking,
    isRealtimeConnected,
    isRealtimeEnabled,
    connectionMode,
  };
}
