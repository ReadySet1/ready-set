"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Minimal shape consumed from /api/driver-deliveries. Kept permissive to
 *  tolerate API drift. */
export interface ApiDelivery {
  id: string;
  orderNumber: string;
  delivery_type: "catering" | "on_demand";
  status: string;
  driverStatus?: string | null;
  pickupDateTime: string;
  completeDateTime?: string | null;
  order_total: string | number;
  client_attention?: string | null;
  address?: { street1?: string | null; city?: string | null } | null;
  delivery_address?: { street1?: string | null; city?: string | null } | null;
  headcount?: number | null;
  itemDelivered?: string | null;
  user?: { name?: string | null; email?: string | null } | null;
}

export interface DriverDeliveriesFeed {
  deliveries: ApiDelivery[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  /** Deliveries the driver still has to do (not completed). This is the count
   *  the Home "N active" card shows — derived from the SAME list data, so the
   *  count and the list can never disagree. */
  activeCount: number;
}

function parseDeliveries(data: unknown): ApiDelivery[] {
  if (data && typeof data === "object" && "deliveries" in data) {
    const d = (data as { deliveries: unknown }).deliveries;
    return Array.isArray(d) ? (d as ApiDelivery[]) : [];
  }
  return Array.isArray(data) ? (data as ApiDelivery[]) : [];
}

/**
 * Single source of truth for the driver's delivery list on Home.
 *
 * Both the "My deliveries — N active" card and the DriverDeliveryList read from
 * this one fetch, so the count and the rendered list are always consistent. It
 * also polls (60s) and refreshes on tab focus, fixing the prior bug where the
 * list fetched once on mount and went stale (showing an empty list while the
 * count, from a different polling source, claimed deliveries existed).
 */
/** Terminal driver/order statuses that should never count as an active delivery. */
const TERMINAL_STATUSES = new Set(["COMPLETED", "CANCELLED", "DELIVERED"]);

const FEED_URL = "/api/driver-deliveries?page=1&limit=999";
const POLL_INTERVAL_MS = 60_000;

export function useDriverDeliveriesFeed(): DriverDeliveriesFeed {
  const [deliveries, setDeliveries] = useState<ApiDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  /** True once any load has succeeded; later failures keep that data on screen. */
  const hasData = useRef(false);
  /** Controller of the request currently in flight, aborted on unmount. */
  const controllerRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const res = await fetch(FEED_URL, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!res.ok) throw new Error("Failed to fetch deliveries");
      const data = await res.json();
      if (controller.signal.aborted) return;
      setDeliveries(parseDeliveries(data));
      hasData.current = true;
      setError(null);
    } catch (e) {
      if (controller.signal.aborted) return;
      // A failed background poll keeps the last good list on screen instead of
      // replacing it with an error; the next poll / focus refetch retries. The
      // error only surfaces when there is nothing good to show yet.
      if (!hasData.current) {
        setError(e instanceof Error ? e.message : "An error occurred");
      }
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        inFlight.current = false;
      }
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  // Initial load, 60s poll, and refresh when the tab regains focus (a driver
  // coming back to the app). Unmount stops all three and aborts the request in
  // flight so a late response never touches state.
  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), POLL_INTERVAL_MS);
    const onVisible = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      controllerRef.current?.abort();
      controllerRef.current = null;
      inFlight.current = false;
    };
  }, [load]);

  // "Active" = still to be done. Guard on terminal status as well as
  // completeDateTime, so a completed order whose completion timestamp is missing
  // (historical-data bug) can't resurrect itself as active. The orders PATCH
  // route now stamps completeDateTime on completion; this is belt-and-suspenders.
  const activeCount = deliveries.filter(
    (d) =>
      !d.completeDateTime &&
      !TERMINAL_STATUSES.has((d.status ?? "").toUpperCase()) &&
      !TERMINAL_STATUSES.has((d.driverStatus ?? "").toUpperCase()),
  ).length;

  return { deliveries, loading, error, refresh: load, activeCount };
}
