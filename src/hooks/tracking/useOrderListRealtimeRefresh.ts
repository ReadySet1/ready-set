/**
 * Order List Realtime Refresh Hook
 *
 * Lets an admin orders list refresh itself when a delivery status changes,
 * e.g. the ASSIGNED event POST /api/orders/assignDriver broadcasts (REA-344).
 * It reuses useDeliveryStatusRealtime (the `driver-status` channel, no order
 * filter) and calls `onRefresh` once per burst of events for `orderType`.
 */

'use client';

import { useEffect, useRef } from 'react';
import { useIsomorphicLayoutEffect } from '@/hooks/useIsomorphicLayoutEffect';
import { useDeliveryStatusRealtime } from '@/hooks/tracking/useDeliveryStatusRealtime';
import type { DeliveryStatusUpdatedPayload } from '@/lib/realtime/schemas';

const DEFAULT_DEBOUNCE_MS = 1000;

interface UseOrderListRealtimeRefreshOptions {
  /** Only events for this order type trigger a refresh. */
  orderType: DeliveryStatusUpdatedPayload['orderType'];
  /** Reloads the list. Called at most once per `debounceMs` burst. */
  onRefresh: () => void;
  /** Whether to subscribe at all. Default: true. */
  enabled?: boolean;
  /** Quiet period that coalesces bursts of events. Default: 1000ms. */
  debounceMs?: number;
}

export function useOrderListRealtimeRefresh({
  orderType,
  onRefresh,
  enabled = true,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: UseOrderListRealtimeRefreshOptions): void {
  const onRefreshRef = useRef(onRefresh);
  useIsomorphicLayoutEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  useDeliveryStatusRealtime({
    enabled,
    // A list sees every order's events; toasting each one would be noise.
    showNotifications: false,
    onStatusUpdate: (payload) => {
      if (payload.orderType !== orderType) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        onRefreshRef.current();
      }, debounceMs);
    },
  });
}

export type { UseOrderListRealtimeRefreshOptions };
