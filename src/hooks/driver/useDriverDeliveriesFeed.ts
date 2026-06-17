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

export function useDriverDeliveriesFeed(): DriverDeliveriesFeed {
  const [deliveries, setDeliveries] = useState<ApiDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    try {
      const res = await fetch("/api/driver-deliveries?page=1&limit=999");
      if (!res.ok) throw new Error("Failed to fetch deliveries");
      const data = await res.json();
      setDeliveries(parseDeliveries(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : "An error occurred");
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }, []);

  // Initial load.
  useEffect(() => {
    void load();
  }, [load]);

  // Poll every 60s.
  useEffect(() => {
    const id = setInterval(() => void load(), 60_000);
    return () => clearInterval(id);
  }, [load]);

  // Refresh when the tab regains focus (a driver coming back to the app).
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
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
