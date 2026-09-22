/**
 * Delivery Status Realtime Hook
 *
 * Provides real-time delivery status updates for orders using Supabase Realtime.
 * Used by helpdesk, vendor, and client users to see driver status changes
 * (arrived at vendor, picked up, en route, arrived, completed) without page refresh.
 *
 * This hook subscribes to the driver-status channel and filters updates
 * for the specified order(s).
 */

'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useIsomorphicLayoutEffect } from '@/hooks/useIsomorphicLayoutEffect';
import {
  createDriverStatusChannel,
  type DriverStatusChannel,
  REALTIME_EVENTS,
} from '@/lib/realtime';
import type { DeliveryStatusUpdatedPayload, DeliveryTrackingStatus } from '@/lib/realtime/schemas';

// Status display configuration
const STATUS_DISPLAY: Record<DeliveryTrackingStatus, { emoji: string; label: string }> = {
  ASSIGNED: { emoji: '📋', label: 'Driver Assigned' },
  EN_ROUTE_TO_VENDOR: { emoji: '🚗', label: 'Driver En Route to Restaurant' },
  ARRIVED_AT_VENDOR: { emoji: '🏪', label: 'Driver Arrived at Pickup' },
  PICKED_UP: { emoji: '📦', label: 'Order Picked Up' },
  EN_ROUTE_TO_CLIENT: { emoji: '🚚', label: 'Driver En Route' },
  ARRIVED_TO_CLIENT: { emoji: '📍', label: 'Driver Arrived' },
  COMPLETED: { emoji: '✅', label: 'Delivery Completed' },
  CANCELLED: { emoji: '🚫', label: 'Order Cancelled' },
};

// If the channel neither connects nor errors within this window, stop showing
// "Connecting…" and surface a resolved (error/fallback) state.
const CONNECT_TIMEOUT_MS = 12_000;

interface UseDeliveryStatusRealtimeOptions {
  /**
   * Single order ID to track (for single order view)
   */
  orderId?: string | null;

  /**
   * Multiple order IDs to track (for order list view)
   */
  orderIds?: string[];

  /**
   * Whether to enable real-time tracking
   * Set to false for completed/cancelled orders
   */
  enabled?: boolean;

  /**
   * Whether to show toast notifications on status changes
   * Default: true
   */
  showNotifications?: boolean;

  /**
   * Callback when status is updated
   */
  onStatusUpdate?: (payload: DeliveryStatusUpdatedPayload) => void;

  /**
   * Callback when connection status changes
   */
  onConnectionChange?: (connected: boolean) => void;
}

interface UseDeliveryStatusRealtimeReturn {
  /**
   * Latest status update received
   */
  latestStatus: DeliveryStatusUpdatedPayload | null;

  /**
   * Map of order IDs to their current delivery status
   */
  statusByOrder: Map<string, DeliveryTrackingStatus>;

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

export function useDeliveryStatusRealtime({
  orderId,
  orderIds,
  enabled = true,
  showNotifications = true,
  onStatusUpdate,
  onConnectionChange,
}: UseDeliveryStatusRealtimeOptions): UseDeliveryStatusRealtimeReturn {
  const [latestStatus, setLatestStatus] = useState<DeliveryStatusUpdatedPayload | null>(null);
  const [statusByOrder, setStatusByOrder] = useState<Map<string, DeliveryTrackingStatus>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const channelRef = useRef<DriverStatusChannel | null>(null);
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // connect() awaits (dynamic import, getSession, subscribe). Each call and
  // each effect cleanup bumps this generation; a call that resumes after an
  // await and finds itself stale must not create a channel, arm a timer, or
  // touch state — otherwise it leaks a subscription behind the newer call and
  // can clear the newer call's safety timer.
  const connectGenRef = useRef(0);
  const invalidatePendingConnects = useCallback(() => {
    connectGenRef.current++;
  }, []);

  // Consumers (e.g. SingleOrder) pass inline arrow callbacks, so their identity
  // changes on every render. Read them through refs so `connect` stays stable;
  // otherwise every parent render tears the channel down, reconnects, and
  // re-arms the CONNECT_TIMEOUT_MS safety net, leaving the UI on "Connecting…".
  // Synced in the layout phase so a WebSocket message that lands between
  // commit and passive-effect flush already sees the latest callback.
  const onStatusUpdateRef = useRef(onStatusUpdate);
  const onConnectionChangeRef = useRef(onConnectionChange);
  const showNotificationsRef = useRef(showNotifications);
  useIsomorphicLayoutEffect(() => {
    onStatusUpdateRef.current = onStatusUpdate;
    onConnectionChangeRef.current = onConnectionChange;
    showNotificationsRef.current = showNotifications;
  }, [onStatusUpdate, onConnectionChange, showNotifications]);

  // Combine orderId and orderIds into a single set for filtering
  const orderIdsToTrack = useRef<Set<string>>(new Set());

  // Update the set of order IDs to track
  useEffect(() => {
    const newSet = new Set<string>();
    if (orderId) {
      newSet.add(orderId);
    }
    if (orderIds) {
      orderIds.forEach(id => newSet.add(id));
    }
    orderIdsToTrack.current = newSet;
  }, [orderId, orderIds]);

  // Handle delivery status update from realtime channel
  const handleStatusUpdate = useCallback((payload: unknown) => {
    // The payload comes wrapped in a { payload: ... } structure from the channel
    const actualPayload = (payload as { payload?: DeliveryStatusUpdatedPayload })?.payload || payload;
    const statusPayload = actualPayload as DeliveryStatusUpdatedPayload;

    // Filter for our specific orders
    if (orderIdsToTrack.current.size > 0 && !orderIdsToTrack.current.has(statusPayload.orderId)) {
      return;
    }

    // Update latest status
    setLatestStatus(statusPayload);

    // Update status map
    setStatusByOrder(prev => {
      const newMap = new Map(prev);
      newMap.set(statusPayload.orderId, statusPayload.status);
      return newMap;
    });

    // Show toast notification if enabled
    if (showNotificationsRef.current) {
      const statusInfo = STATUS_DISPLAY[statusPayload.status];
      const orderLabel = statusPayload.orderNumber || `Order ${statusPayload.orderId.slice(0, 8)}`;

      if (statusPayload.status === 'COMPLETED') {
        toast.success(`${statusInfo.emoji} ${statusInfo.label} - ${orderLabel}`, {
          duration: 5000,
        });
      } else if (statusPayload.status === 'CANCELLED') {
        toast.error(`${statusInfo.emoji} ${statusInfo.label} - ${orderLabel}`, {
          duration: 5000,
        });
      } else {
        toast(`${statusInfo.emoji} ${statusInfo.label} - ${orderLabel}`, {
          duration: 4000,
          icon: statusInfo.emoji,
        });
      }
    }

    // Call user callback
    onStatusUpdateRef.current?.(statusPayload);
  }, []);

  // Connect to realtime channel
  const connect = useCallback(async () => {
    if (!enabled) {
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
      // Pre-connection auth check: without an active browser session the
      // Realtime WebSocket never opens and the channel hangs in "connecting"
      // forever (REA-DRT-07). Resolve to a non-connecting state instead of
      // leaving the UI stuck on "Connecting…".
      const { createClient } = await import('@/utils/supabase/client');
      const supabase = createClient();
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (isStale()) return;
      if (authError || !session) {
        setIsConnecting(false);
        setIsConnected(false);
        setError('Live updates unavailable — no active session');
        onConnectionChangeRef.current?.(false);
        return;
      }

      // Safety net: if the channel neither connects nor errors within the
      // window, stop showing "Connecting…".
      if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = setTimeout(() => {
        connectTimeoutRef.current = null;
        if (isStale()) return;
        setIsConnecting(false);
        setError((prev) => prev ?? 'Live updates timed out');
        onConnectionChangeRef.current?.(false);
      }, CONNECT_TIMEOUT_MS);

      const channel = createDriverStatusChannel();
      channelRef.current = channel;

      // Channel events from a superseded connect() are ignored: the realtime
      // client keys channels by name, so a stale CLOSED/error must not clobber
      // the state of the channel a newer connect() now owns.
      await channel.subscribe({
        onStatusUpdate: undefined, // We handle driver shift status separately
        onConnect: () => {
          if (isStale()) return;
          if (connectTimeoutRef.current) {
            clearTimeout(connectTimeoutRef.current);
            connectTimeoutRef.current = null;
          }
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
          if (connectTimeoutRef.current) {
            clearTimeout(connectTimeoutRef.current);
            connectTimeoutRef.current = null;
          }
          setError(err.message);
          setIsConnected(false);
          setIsConnecting(false);
          onConnectionChangeRef.current?.(false);
        },
      });
      // Whoever superseded us already tore this channel down; do not
      // unsubscribe by name here or we would remove the newer channel.
      if (isStale()) return;

      // Listen specifically for delivery status updates
      channel.on(REALTIME_EVENTS.DELIVERY_STATUS_UPDATED, handleStatusUpdate);
    } catch (err) {
      if (isStale()) return;
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current);
        connectTimeoutRef.current = null;
      }
      setError(err instanceof Error ? err.message : 'Failed to connect');
      setIsConnected(false);
      setIsConnecting(false);
    }
  }, [enabled, handleStatusUpdate]);

  // Reconnect function for manual refresh
  const reconnect = useCallback(() => {
    void connect();
  }, [connect]);

  // Initialize connection when enabled
  useEffect(() => {
    if (enabled) {
      void connect();
    }

    return () => {
      // Invalidate any connect() still parked on an await.
      invalidatePendingConnects();
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current);
        connectTimeoutRef.current = null;
      }
      if (channelRef.current) {
        void channelRef.current.unsubscribe().catch(() => {
          // Ignore cleanup errors
        });
        channelRef.current = null;
      }
    };
  }, [enabled, connect, invalidatePendingConnects]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current);
        connectTimeoutRef.current = null;
      }
      if (channelRef.current) {
        void channelRef.current.unsubscribe().catch(() => {
          // Ignore cleanup errors
        });
      }
    };
  }, []);

  return {
    latestStatus,
    statusByOrder,
    isConnected,
    isConnecting,
    error,
    reconnect,
  };
}

export type {
  UseDeliveryStatusRealtimeOptions,
  UseDeliveryStatusRealtimeReturn,
  DeliveryStatusUpdatedPayload,
  DeliveryTrackingStatus,
};
