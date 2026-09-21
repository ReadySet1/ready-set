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
import { useIsomorphicLayoutEffect } from '@/hooks/useIsomorphicLayoutEffect';
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

  // Consumers (e.g. SingleOrder) pass inline arrow callbacks whose identity
  // changes on every render. Read them through refs so `connect` stays stable
  // and a parent re-render does not tear the channel down and resubscribe.
  // Synced in the layout phase so a WebSocket message that lands between
  // commit and passive-effect flush already sees the latest callback.
  const onLocationUpdateRef = useRef(onLocationUpdate);
  const onConnectionChangeRef = useRef(onConnectionChange);
  useIsomorphicLayoutEffect(() => {
    onLocationUpdateRef.current = onLocationUpdate;
    onConnectionChangeRef.current = onConnectionChange;
  }, [onLocationUpdate, onConnectionChange]);

  // connect() awaits (unsubscribe, subscribe). Each call and each effect
  // cleanup bumps this generation; a call that resumes stale must not create
  // a channel or touch state, or it leaks a subscription behind the newer call.
  const connectGenRef = useRef(0);
  const invalidatePendingConnects = useCallback(() => {
    connectGenRef.current++;
  }, []);

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
    onLocationUpdateRef.current?.(newLocation);
  }, []);

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
    onLocationUpdateRef.current?.(newLocation);
  }, []);

  // Connect to realtime channel
  const connect = useCallback(async () => {
    if (!enabled || !driverProfileId) {
      return;
    }

    const gen = ++connectGenRef.current;
    const isStale = () => gen !== connectGenRef.current;

    // Cleanup existing channel
    if (channelRef.current) {
      const previous = channelRef.current;
      channelRef.current = null;
      try {
        await previous.unsubscribe();
      } catch (e) {
        // Ignore cleanup errors
      }
      if (isStale()) return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const channel = createDriverLocationChannel();
      channelRef.current = channel;

      // Events from a superseded connect() are ignored: the realtime client
      // keys channels by name, so a stale CLOSED/error must not clobber the
      // state of the channel a newer connect() now owns.
      await channel.subscribe({
        onLocationUpdate: handleLocationUpdate,
        onDatabaseInsert: handleDatabaseInsert,
        onConnect: () => {
          if (isStale()) return;
          setIsConnected(true);
          setIsConnecting(false);
          setError(null);
          onConnectionChangeRef.current?.(true);
        },
        onDisconnect: () => {
          if (isStale()) return;
          setIsConnected(false);
          onConnectionChangeRef.current?.(false);
        },
        onError: (err) => {
          if (isStale()) return;
          setError(err.message);
          setIsConnected(false);
          setIsConnecting(false);
          onConnectionChangeRef.current?.(false);
        },
      });
    } catch (err) {
      if (isStale()) return;
      setError(err instanceof Error ? err.message : 'Failed to connect');
      setIsConnected(false);
      setIsConnecting(false);
    }
  }, [enabled, driverProfileId, handleLocationUpdate, handleDatabaseInsert]);

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
      // Invalidate any connect() still parked on an await.
      invalidatePendingConnects();
      if (channelRef.current) {
        void channelRef.current.unsubscribe().catch(() => {
          // Ignore cleanup errors
        });
        channelRef.current = null;
      }
    };
  }, [enabled, driverProfileId, connect, invalidatePendingConnects]);

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
