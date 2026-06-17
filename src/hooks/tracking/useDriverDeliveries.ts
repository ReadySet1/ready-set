'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DeliveryTracking, LocationUpdate } from '@/types/tracking';
import { DriverStatus } from '@/types/user';
import { OrderStatus } from '@/types/order';
import { createClient } from '@/utils/supabase/client';
import { captureException, addSentryBreadcrumb } from '@/lib/monitoring/sentry';

interface UseDriverDeliveriesReturn {
  activeDeliveries: DeliveryTracking[];
  loading: boolean;
  error: string | null;
  refreshDeliveries: () => Promise<void>;
  updateDeliveryStatus: (
    orderNumber: string,
    status: DriverStatus,
    location?: LocationUpdate,
    proofOfDelivery?: string,
    notes?: string
  ) => Promise<boolean>;
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
  const supabase = useMemo(() => createClient(), []);

  const getToken = useCallback(async (): Promise<string | null> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, [supabase]);

  const loadActiveDeliveries = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/driver-deliveries?page=1&limit=999', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Failed to load deliveries (${res.status})`);
      const data = await res.json();
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
            driverId: '',
            status: (o.driverStatus as DriverStatus) || DriverStatus.ASSIGNED,
            pickupLocation: { coordinates: toCoords(pickup) },
            deliveryLocation: { coordinates: toCoords(dropoff) },
            estimatedArrival: o.arrivalDateTime ? new Date(o.arrivalDateTime) : undefined,
            route: [],
            proofOfDelivery: pod,
            metadata: {},
            assignedAt: o.createdAt ? new Date(o.createdAt) : new Date(0),
            createdAt: o.createdAt ? new Date(o.createdAt) : new Date(0),
            updatedAt: o.updatedAt ? new Date(o.updatedAt) : new Date(0),
          } as DeliveryTracking;
        });

      setActiveDeliveries(mapped);
    } catch (err) {
      console.error('Error loading active deliveries:', err);
      setError(err instanceof Error ? err.message : 'Failed to load deliveries');
      captureException(err, {
        action: 'load_active_deliveries',
        feature: 'driver_deliveries',
        component: 'useDriverDeliveries',
        handled: true,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Advance an order via the orders API — the single source of truth shared with
  // the Home + Detail screens. `orderNumber` is DeliveryTracking.id from the portal.
  const updateDeliveryStatus = useCallback(
    async (
      orderNumber: string,
      status: DriverStatus,
      _location?: LocationUpdate,
      _proofOfDelivery?: string,
      _notes?: string,
    ): Promise<boolean> => {
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
          try {
            const body = await res.json();
            detail = body.error || body.message || '';
          } catch {
            /* non-JSON error body */
          }
          throw new Error(detail || `Failed to update status (${res.status})`);
        }

        // Mirror the Detail screen: a completed delivery also completes the order.
        if (status === DriverStatus.COMPLETED) {
          await fetch(`/api/orders/${encodeURIComponent(orderNumber)}`, {
            method: 'PATCH',
            credentials: 'include',
            headers,
            body: JSON.stringify({ status: OrderStatus.COMPLETED }),
          }).catch((e) => console.warn('Order status sync failed:', e));
        }

        await loadActiveDeliveries();
        addSentryBreadcrumb('Driver updated delivery status', { orderNumber, status });
        return true;
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
        return false;
      }
    },
    [getToken, loadActiveDeliveries],
  );

  const refreshDeliveries = useCallback(async () => {
    await loadActiveDeliveries();
  }, [loadActiveDeliveries]);

  // Load on mount.
  useEffect(() => {
    loadActiveDeliveries();
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

  return {
    activeDeliveries,
    loading,
    error,
    refreshDeliveries,
    updateDeliveryStatus,
  };
}
