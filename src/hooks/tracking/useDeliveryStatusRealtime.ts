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
    if (showNotifications) {
      const statusInfo = STATUS_DISPLAY[statusPayload.status];
      const orderLabel = statusPayload.orderNumber || `Order ${statusPayload.orderId.slice(0, 8)}`;

      if (statusPayload.status === 'COMPLETED') {
        toast.success(`${statusInfo.emoji} ${statusInfo.label} - ${orderLabel}`, {
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
    onStatusUpdate?.(statusPayload);
  }, [showNotifications, onStatusUpdate]);

  // Connect to realtime channel
  const connect = useCallback(async () => {
    if (!enabled) {
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
      // Pre-connection auth check: without an active browser session the
      // Realtime WebSocket never opens and the channel hangs in "connecting"
      // forever (REA-DRT-07). Resolve to a non-connecting state instead of
      // leaving the UI stuck on "Connecting…".
      const { createClient } = await import('@/utils/supabase/client');
      const supabase = createClient();
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError || !session) {
        setIsConnecting(false);
        setIsConnected(false);
        setError('Live updates unavailable — no active session');
        onConnectionChange?.(false);
        return;
      }

      // Safety net: if the channel neither connects nor errors within the
      // window, stop showing "Connecting…".
      if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = setTimeout(() => {
        connectTimeoutRef.current = null;
        setIsConnecting(false);
        setError((prev) => prev ?? 'Live updates timed out');
        onConnectionChange?.(false);
      }, CONNECT_TIMEOUT_MS);

      const channel = createDriverStatusChannel();
      channelRef.current = channel;

      await channel.subscribe({
        onStatusUpdate: undefined, // We handle driver shift status separately
        onConnect: () => {
          if (connectTimeoutRef.current) {
            clearTimeout(connectTimeoutRef.current);
            connectTimeoutRef.current = null;
          }
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
          if (connectTimeoutRef.current) {
            clearTimeout(connectTimeoutRef.current);
            connectTimeoutRef.current = null;
          }
          setError(err.message);
          setIsConnected(false);
          setIsConnecting(false);
          onConnectionChange?.(false);
        },
      });

      // Listen specifically for delivery status updates
      channel.on(REALTIME_EVENTS.DELIVERY_STATUS_UPDATED, handleStatusUpdate);
    } catch (err) {
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current);
        connectTimeoutRef.current = null;
      }
      setError(err instanceof Error ? err.message : 'Failed to connect');
      setIsConnected(false);
      setIsConnecting(false);
    }
  }, [enabled, handleStatusUpdate, onConnectionChange]);

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
      if (channelRef.current) {
        void channelRef.current.unsubscribe().catch(() => {
          // Ignore cleanup errors
        });
        channelRef.current = null;
      }
    };
  }, [enabled, connect]);

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
