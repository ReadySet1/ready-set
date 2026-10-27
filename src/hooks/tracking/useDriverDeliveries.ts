'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DeliveryTracking, LocationUpdate } from '@/types/tracking';
import { DriverStatus } from '@/types/user';
import { OrderStatus } from '@/types/order';
import { createClient } from '@/utils/supabase/client';
import { captureException, addSentryBreadcrumb } from '@/lib/monitoring/sentry';

/**
 * The raw `/api/driver-deliveries` payload behind `activeDeliveries`, shared so
 * the Home page's `useDriverDeliveriesFeed` can read the SAME poll instead of
 * running a second one (the driver home used to fire every request twice).
 */
export interface DriverDeliveriesFeedSource {
  /** Rows exactly as the API returned them on the last successful load. */
  rows: unknown[];
  /** False until the first load settles (success or failure). */
  settled: boolean;
  /** True once any load succeeded; later failures keep `rows` as they were. */
  hasData: boolean;
  /** Message of the last failed load (cleared when the next load starts). */
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Result of a driver status advance. On failure `code` carries the orders
 * PATCH gate code when the server sent one (e.g. 422 PICKUP_PHOTO_REQUIRED,
 * POD_REQUIRED, RECIPIENT_REQUIRED, PICKUP_CONFIRMATION_REQUIRED,
 * SHIFT_REQUIRED) so the caller can reopen the right capture sheet.
 */
export type StatusAdvanceOutcome =
  | { ok: true }
  | { ok: false; status?: number; code?: string; message?: string };

/** Thrown inside the advance so the catch keeps the server's gate details. */
class StatusAdvanceError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly serverMessage?: string,
  ) {
    super(message);
  }
}

interface UseDriverDeliveriesReturn {
  activeDeliveries: DeliveryTracking[];
  loading: boolean;
  error: string | null;
  feedSource: DriverDeliveriesFeedSource;
  refreshDeliveries: () => Promise<void>;
  updateDeliveryStatus: (
    orderNumber: string,
    status: DriverStatus,
    location?: LocationUpdate,
    proofOfDelivery?: string,
    notes?: string
  ) => Promise<boolean>;
  /** Same advance as `updateDeliveryStatus`, returning the failure details. */
  advanceDeliveryStatus: (
    orderNumber: string,
    status: DriverStatus,
    location?: LocationUpdate,
  ) => Promise<StatusAdvanceOutcome>;
}

const TERMINAL_STATUSES = new Set<string>(['COMPLETED', 'CANCELLED', 'DELIVERED']);

/** Read [lng, lat] from an address row; falls back to [0, 0] when unset. */
function toCoords(addr: any): [number, number] {
  const lng = Number(addr?.longitude);
  const lat = Number(addr?.latitude);
  return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : [0, 0];
}

/**
 * Active deliveries for the driver Live-Tracking tab.
 *
 * Sources from the SAME orders feed (`/api/driver-deliveries`) and advances through
 * the SAME endpoint (`PATCH /api/orders/[orderNumber]`) as the Home + Detail screens,
 * so every driver surface agrees on one delivery. Previously this read the standalone
 * `deliveries` table, which has no link back to the order — so the Track tab showed
 * "ON-DEMAND #<uuid-suffix>" and its progress drifted from the Detail page (the
 * walk-test "progress reset"); it now reads the orders feed. Going through the orders
 * API (not the `delivery-actions` Server Actions) also makes it deployment-proof.
 *
 * The returned `DeliveryTracking.id` is the ORDER NUMBER (what the portal passes back
 * to `updateDeliveryStatus` and the POD sheet), and `cateringRequestId`/`onDemandId`
 * carry the order number for the catering/on-demand split so the badge renders right.
 */
export function useDriverDeliveries(): UseDriverDeliveriesReturn {
  const [activeDeliveries, setActiveDeliveries] = useState<DeliveryTracking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Unmapped rows + first-load status, shared with the Home page's feed hook.
  const [rawRows, setRawRows] = useState<unknown[]>([]);
  const [settled, setSettled] = useState(false);
  const [hasData, setHasData] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  const getToken = useCallback(async (): Promise<string | null> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, [supabase]);

  /** Controller of the feed request in flight; aborted when superseded or on unmount. */
  const controllerRef = useRef<AbortController | null>(null);

  // Latest request wins. A refresh after a status PATCH must never lose to a
  // slower background poll that started earlier (the list would revert to the
  // pre-PATCH status until the next tick), so a new load supersedes whatever
  // is in flight and a superseded response is dropped without touching state.
  // Skipping while busy — what the Home feed's standalone poller does — would
  // make that post-PATCH refresh a no-op and hand the guards stale data.
  const loadActiveDeliveries = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/driver-deliveries?page=1&limit=999', {
        credentials: 'include',
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (!res.ok) throw new Error(`Failed to load deliveries (${res.status})`);
      const data = await res.json();
      if (controller.signal.aborted) return;
      const list: any[] = Array.isArray(data?.deliveries) ? data.deliveries : [];

      const mapped: DeliveryTracking[] = list
        .filter((o) => {
          const ds = String(o.driverStatus ?? '').toUpperCase();
          const os = String(o.status ?? '').toUpperCase();
          return (
            !o.completeDateTime &&
            !TERMINAL_STATUSES.has(ds) &&
            !TERMINAL_STATUSES.has(os)
          );
        })
        .map((o) => {
          const isCatering = o.delivery_type === 'catering';
          const orderNumber = String(o.orderNumber);
          const pickup = o.address ?? o.pickupAddress;
          const dropoff = o.delivery_address ?? o.deliveryAddress;
          const pod =
            Array.isArray(o.fileUploads) && o.fileUploads.length > 0
              ? o.fileUploads[0]?.fileUrl
              : undefined;

          return {
            id: orderNumber,
            cateringRequestId: isCatering ? orderNumber : undefined,
            onDemandId: isCatering ? undefined : orderNumber,
            pendingReturn: Boolean(o.pendingReturn),
            driverId: '',
            status: (o.driverStatus as DriverStatus) || DriverStatus.ASSIGNED,
            pickupLocation: { coordinates: toCoords(pickup) },
            deliveryLocation: { coordinates: toCoords(dropoff) },
            estimatedArrival: o.arrivalDateTime ? new Date(o.arrivalDateTime) : undefined,
            scheduledPickupAt: o.pickupDateTime ? new Date(o.pickupDateTime) : undefined,
            route: [],
            proofOfDelivery: pod,
            metadata: {},
            assignedAt: o.createdAt ? new Date(o.createdAt) : new Date(0),
            createdAt: o.createdAt ? new Date(o.createdAt) : new Date(0),
            updatedAt: o.updatedAt ? new Date(o.updatedAt) : new Date(0),
          } as DeliveryTracking;
        })
        // Soonest scheduled pickup first so tonight's delivery leads the list.
        .sort(
          (a, b) =>
            (a.scheduledPickupAt ?? a.estimatedArrival ?? a.createdAt).getTime() -
            (b.scheduledPickupAt ?? b.estimatedArrival ?? b.createdAt).getTime(),
        );

      setActiveDeliveries(mapped);
      setRawRows(list);
      setHasData(true);
    } catch (err) {
      // An aborted request was superseded or the hook unmounted: not an error.
      if (controller.signal.aborted) return;
      console.error('Error loading active deliveries:', err);
      setError(err instanceof Error ? err.message : 'Failed to load deliveries');
      captureException(err, {
        action: 'load_active_deliveries',
        feature: 'driver_deliveries',
        component: 'useDriverDeliveries',
        handled: true,
      });
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      // A superseded load leaves `loading`/`settled` to the request that replaced it.
      if (!controller.signal.aborted) {
        setLoading(false);
        setSettled(true);
      }
    }
  }, []);

  // Advance an order via the orders API — the single source of truth shared with
  // the Home + Detail screens. `orderNumber` is DeliveryTracking.id from the portal.
  const advanceDeliveryStatus = useCallback(
    async (
      orderNumber: string,
      status: DriverStatus,
      _location?: LocationUpdate,
    ): Promise<StatusAdvanceOutcome> => {
      try {
        setError(null);
        const token = await getToken();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}`, {
          method: 'PATCH',
          credentials: 'include',
          headers,
          body: JSON.stringify({ driverStatus: status }),
        });
        if (!res.ok) {
          let detail = '';
          let code: string | undefined;
          let serverMessage: string | undefined;
          try {
            const body = await res.json();
            detail = body.error || body.message || '';
            if (typeof body.code === 'string') code = body.code;
            else if (typeof body.error === 'string' && /^[A-Z_]+$/.test(body.error)) code = body.error;
            if (typeof body.message === 'string') serverMessage = body.message;
          } catch {
            /* non-JSON error body */
          }
          throw new StatusAdvanceError(
            detail || `Failed to update status (${res.status})`,
            res.status,
            code,
            serverMessage,
          );
        }

        // Mirror the Detail screen: a completed delivery also completes the order.
        // Not awaited: the server already maps driverStatus=COMPLETED to the
        // order status, and this follow-up is failure-tolerant — the driver
        // should not wait an extra round trip for it.
        if (status === DriverStatus.COMPLETED) {
          void fetch(`/api/orders/${encodeURIComponent(orderNumber)}`, {
            method: 'PATCH',
            // Not awaited: keep it alive through navigation / webview unload.
            keepalive: true,
            credentials: 'include',
            headers,
            body: JSON.stringify({ status: OrderStatus.COMPLETED }),
          }).catch((e) => console.warn('Order status sync failed:', e));
        }

        await loadActiveDeliveries();
        addSentryBreadcrumb('Driver updated delivery status', { orderNumber, status });
        return { ok: true };
      } catch (err) {
        console.error('Error updating delivery status:', err);
        setError(err instanceof Error ? err.message : 'Failed to update delivery');
        captureException(err, {
          action: 'update_delivery_status',
          feature: 'driver_deliveries',
          component: 'useDriverDeliveries',
          handled: true,
          metadata: { orderNumber, status },
        });
        if (err instanceof StatusAdvanceError) {
          return {
            ok: false,
            status: err.status,
            ...(err.code ? { code: err.code } : {}),
            ...(err.serverMessage ? { message: err.serverMessage } : {}),
          };
        }
        return { ok: false, message: err instanceof Error ? err.message : undefined };
      }
    },
    [getToken, loadActiveDeliveries],
  );

  // Boolean form kept for existing callers. The trailing legacy arguments
  // (proof URL, notes) were never sent; the POD/recipient have their own routes.
  const updateDeliveryStatus = useCallback(
    async (
      orderNumber: string,
      status: DriverStatus,
      location?: LocationUpdate,
      _proofOfDelivery?: string,
      _notes?: string,
    ): Promise<boolean> =>
      (await advanceDeliveryStatus(orderNumber, status, location)).ok,
    [advanceDeliveryStatus],
  );

  const refreshDeliveries = useCallback(async () => {
    await loadActiveDeliveries();
  }, [loadActiveDeliveries]);

  // Load on mount; abort the request in flight on unmount so a late response
  // never touches state.
  useEffect(() => {
    loadActiveDeliveries();
    return () => {
      controllerRef.current?.abort();
      controllerRef.current = null;
    };
  }, [loadActiveDeliveries]);

  // Periodic refresh (1 min).
  useEffect(() => {
    const interval = setInterval(() => loadActiveDeliveries(), 60000);
    return () => clearInterval(interval);
  }, [loadActiveDeliveries]);

  // Refresh when the tab regains focus.
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden) loadActiveDeliveries();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [loadActiveDeliveries]);

  const feedSource = useMemo<DriverDeliveriesFeedSource>(
    () => ({ rows: rawRows, settled, hasData, error, refresh: refreshDeliveries }),
    [rawRows, settled, hasData, error, refreshDeliveries],
  );

  return {
    activeDeliveries,
    loading,
    error,
    feedSource,
    refreshDeliveries,
    updateDeliveryStatus,
    advanceDeliveryStatus,
  };
}
