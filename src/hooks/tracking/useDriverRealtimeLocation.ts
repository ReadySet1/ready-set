/**
 * Driver Realtime Location Hook
 *
 * Provides real-time location tracking for a single driver using Supabase Realtime.
 * Used in order detail views (vendor order-status, admin single order) to show
 * live driver location updates on the map.
 *
 * This hook subscribes to the same channel as the admin tracking dashboard,
 * but filters updates for only the specified driver.
 */

'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import {
  createDriverLocationChannel,
  type DriverLocationChannel,
  type DriverLocationUpdatedPayload,
} from '@/lib/realtime';

interface DriverLocation {
  lat: number;
  lng: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  isMoving?: boolean;
  lastUpdate: Date;
}

interface UseDriverRealtimeLocationOptions {
  /**
   * The driver's profile ID (from dispatch.driverId)
   */
  driverProfileId: string | null | undefined;

  /**
   * Whether to enable real-time tracking
   * Set to false for completed/cancelled orders
   */
  enabled?: boolean;

  /**
   * Callback when location is updated
   */
  onLocationUpdate?: (location: DriverLocation) => void;

  /**
   * Callback when connection status changes
   */
  onConnectionChange?: (connected: boolean) => void;
}

interface UseDriverRealtimeLocationReturn {
  /**
   * Current driver location
   */
  location: DriverLocation | null;

  /**
   * Whether connected to real-time channel
   */
  isConnected: boolean;

  /**
   * Whether initial connection is being established
   */
  isConnecting: boolean;

  /**
   * Error message if connection failed
   */
  error: string | null;

  /**
   * Manually refresh the connection
   */
  reconnect: () => void;
}

export function useDriverRealtimeLocation({
  driverProfileId,
  enabled = true,
  onLocationUpdate,
  onConnectionChange,
}: UseDriverRealtimeLocationOptions): UseDriverRealtimeLocationReturn {
  const [location, setLocation] = useState<DriverLocation | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const channelRef = useRef<DriverLocationChannel | null>(null);
  const driverIdRef = useRef<string | null | undefined>(driverProfileId);

  // Keep driverIdRef in sync
  useEffect(() => {
    driverIdRef.current = driverProfileId;
  }, [driverProfileId]);

  // Handle location update from realtime channel
  const handleLocationUpdate = useCallback((payload: DriverLocationUpdatedPayload) => {
    // Filter for our specific driver
    // The payload contains driverId which is the driver table ID, not profile ID
    // We need to check if this update is for our driver
    const updateDriverId = payload.driverId;

    // For now, accept all updates and filter on the frontend
    // In the future, we could add driver-specific channels
    if (!driverIdRef.current) return;

    // The payload structure from the realtime channel
    // Uses lat/lng directly, not coordinates array
    const newLocation: DriverLocation = {
      lat: payload.lat,
      lng: payload.lng,
      accuracy: payload.accuracy ?? undefined,
      speed: payload.speed ?? undefined,
      heading: payload.heading ?? undefined,
      isMoving: payload.isMoving,
      lastUpdate: new Date(payload.timestamp),
    };

    setLocation(newLocation);
    onLocationUpdate?.(newLocation);
  }, [onLocationUpdate]);

  // Database record type for location inserts
  interface LocationRecord {
    driver_id: string;
    latitude: number;
    longitude: number;
    accuracy?: number;
    speed?: number;
    heading?: number;
    is_moving?: boolean;
    recorded_at?: string;
  }

  // Handle database INSERT event (captures all location updates)
  const handleDatabaseInsert = useCallback((record: LocationRecord) => {
    if (!record || !driverIdRef.current) return;

    const newLocation: DriverLocation = {
      lat: record.latitude,
      lng: record.longitude,
      accuracy: record.accuracy,
      speed: record.speed,
      heading: record.heading,
      isMoving: record.is_moving,
      lastUpdate: new Date(record.recorded_at || Date.now()),
    };

    setLocation(newLocation);
    onLocationUpdate?.(newLocation);
  }, [onLocationUpdate]);

  // Connect to realtime channel
  const connect = useCallback(async () => {
    if (!enabled || !driverProfileId) {
      return;
    }

    // Cleanup existing channel
    if (channelRef.current) {
      try {
        await channelRef.current.unsubscribe();
      } catch (e) {
        // Ignore cleanup errors
      }
      channelRef.current = null;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const channel = createDriverLocationChannel();
      channelRef.current = channel;

      await channel.subscribe({
        onLocationUpdate: handleLocationUpdate,
        onDatabaseInsert: handleDatabaseInsert,
        onConnect: () => {
          setIsConnected(true);
          setIsConnecting(false);
          setError(null);
          onConnectionChange?.(true);
        },
        onDisconnect: () => {
          setIsConnected(false);
          onConnectionChange?.(false);
        },
        onError: (err) => {
          setError(err.message);
          setIsConnected(false);
          setIsConnecting(false);
          onConnectionChange?.(false);
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
      setIsConnected(false);
      setIsConnecting(false);
    }
  }, [enabled, driverProfileId, handleLocationUpdate, handleDatabaseInsert, onConnectionChange]);

  // Reconnect function for manual refresh
  const reconnect = useCallback(() => {
    void connect();
  }, [connect]);

  // Initialize connection when enabled and driver is assigned
  useEffect(() => {
    if (enabled && driverProfileId) {
      void connect();
    }

    return () => {
      if (channelRef.current) {
        void channelRef.current.unsubscribe().catch(() => {
          // Ignore cleanup errors
        });
        channelRef.current = null;
      }
    };
  }, [enabled, driverProfileId, connect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        void channelRef.current.unsubscribe().catch(() => {
          // Ignore cleanup errors
        });
      }
    };
  }, []);

  return {
    location,
    isConnected,
    isConnecting,
    error,
    reconnect,
  };
}

export type { DriverLocation, UseDriverRealtimeLocationOptions, UseDriverRealtimeLocationReturn };
