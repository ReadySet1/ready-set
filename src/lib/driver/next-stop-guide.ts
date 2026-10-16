/**
 * Next-stop guide for the driver live map (2026-10-06 field report: a driver
 * read the breadcrumb trail as a route to follow and stopped at the vendor
 * thinking a further step was pending — "no guide like Google Maps/Waze").
 *
 * Pure helpers only — the map component owns rendering and fetching:
 * - which stop the driver should head to next,
 * - when to refetch the Directions route (throttled to limit API usage),
 * - the imperial distance / ETA label (product rule: feet/miles only).
 */

import { distanceToTargetM, isValidTarget, type LngLatTuple } from '@/lib/driver/geofence';
import { FEET_PER_MILE, METERS_TO_FEET } from '@/lib/units';

/** Refetch the route only after the driver moved this far (meters). */
export const ROUTE_REFETCH_DISTANCE_M = 100;

export type NextStopKind = 'pickup' | 'dropoff';

export interface NextStop {
  deliveryId: string;
  kind: NextStopKind;
  coordinates: LngLatTuple;
}

/** The subset of DeliveryTracking the guide needs (keeps tests light). */
export interface GuideDelivery {
  id: string;
  status: string;
  pendingReturn?: boolean;
  scheduledPickupAt?: Date | string;
  pickupLocation?: { coordinates?: unknown } | null;
  deliveryLocation?: { coordinates?: unknown } | null;
}

/** Progress rank per status: higher = further along. Pickup phase < 10. */
const STATUS_RANK: Record<string, number> = {
  ASSIGNED: 0,
  EN_ROUTE_TO_VENDOR: 1,
  ARRIVED_AT_VENDOR: 2,
  PICKED_UP: 10,
  EN_ROUTE_TO_CLIENT: 11,
  ARRIVED_TO_CLIENT: 12,
};
const DROPOFF_PHASE_MIN_RANK = 10;
const TERMINAL_STATUSES = new Set(['COMPLETED', 'CANCELLED', 'DELIVERED']);

const scheduledMs = (value: Date | string | undefined): number => {
  if (!value) return Number.POSITIVE_INFINITY;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
};

/**
 * Pick the one stop the driver should head to now: the pickup until the food
 * is on board, then the drop-off. With several open orders, the one furthest
 * along wins (food already on board beats a fresh pickup), then the earliest
 * scheduled pickup. Terminal orders, orders handed back to dispatch, and
 * ungeocoded targets are skipped.
 */
export function selectNextStop(deliveries: readonly GuideDelivery[]): NextStop | null {
  const candidates = deliveries
    .map((d, index) => {
      const status = String(d.status ?? '').toUpperCase();
      if (TERMINAL_STATUSES.has(status) || d.pendingReturn) return null;
      const rank = STATUS_RANK[status] ?? 0;
      const kind: NextStopKind = rank >= DROPOFF_PHASE_MIN_RANK ? 'dropoff' : 'pickup';
      const coordinates =
        kind === 'pickup' ? d.pickupLocation?.coordinates : d.deliveryLocation?.coordinates;
      if (!isValidTarget(coordinates)) return null;
      return { deliveryId: d.id, kind, coordinates, rank, scheduled: scheduledMs(d.scheduledPickupAt), index };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .sort((a, b) => b.rank - a.rank || a.scheduled - b.scheduled || a.index - b.index);

  const best = candidates[0];
  return best ? { deliveryId: best.deliveryId, kind: best.kind, coordinates: best.coordinates } : null;
}

export interface RouteRequestKey {
  origin: { lat: number; lng: number };
  /** Identifies the target stop, e.g. `${deliveryId}:${kind}:${lng},${lat}`. */
  targetKey: string;
}

/**
 * Throttle for Directions requests: fetch on the first fix, whenever the next
 * stop changes, or once the driver has moved past `thresholdM` from where the
 * last route was requested. GPS jitter alone never triggers a refetch.
 */
export function shouldRefetchRoute(
  last: RouteRequestKey | null,
  next: RouteRequestKey,
  thresholdM: number = ROUTE_REFETCH_DISTANCE_M,
): boolean {
  if (!last) return true;
  if (last.targetKey !== next.targetKey) return true;
  const moved = distanceToTargetM(next.origin, [last.origin.lng, last.origin.lat]);
  // Unknown distance (bad coords) → refetch rather than freeze a stale route.
  return moved === null || moved > thresholdM;
}

/** Imperial distance: feet (rounded to 10) under 1000 ft, else miles (1 dp). */
export function formatGuideDistance(meters: number): string {
  const feet = meters * METERS_TO_FEET;
  return feet >= 1000
    ? `${(feet / FEET_PER_MILE).toFixed(1)} mi`
    : `${Math.round(feet / 10) * 10} ft`;
}

export function formatGuideDuration(seconds: number): string {
  if (seconds < 60) return '<1 min';
  const totalMin = Math.round(seconds / 60);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

const STOP_LABEL: Record<NextStopKind, string> = {
  pickup: 'Pickup',
  dropoff: 'Drop-off',
};

export interface NextStopMetrics {
  distanceM: number | null;
  durationS?: number | null;
  /** Straight-line fallback (Directions unavailable) — prefixed with "~", no ETA. */
  approximate?: boolean;
}

/** e.g. "Next: Pickup · 1.2 mi · 6 min" or "Next: Drop-off · ~0.4 mi". */
export function formatNextStopLabel(kind: NextStopKind, metrics: NextStopMetrics | null): string {
  const parts = [`Next: ${STOP_LABEL[kind]}`];
  if (metrics && metrics.distanceM !== null && Number.isFinite(metrics.distanceM)) {
    const distance = formatGuideDistance(metrics.distanceM);
    parts.push(metrics.approximate ? `~${distance}` : distance);
    if (!metrics.approximate && metrics.durationS != null && Number.isFinite(metrics.durationS)) {
      parts.push(formatGuideDuration(metrics.durationS));
    }
  }
  return parts.join(' · ');
}

/**
 * Same Mapbox Directions request shape the admin LiveDriverMap uses (public
 * NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN, client-side, no proxy).
 */
export function buildDirectionsUrl(
  origin: { lat: number; lng: number },
  target: LngLatTuple,
  token: string,
): string {
  const coords = `${origin.lng},${origin.lat};${target[0]},${target[1]}`;
  return `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=geojson&overview=full&access_token=${encodeURIComponent(token)}`;
}

export interface ParsedRoute {
  coordinates: [number, number][];
  distanceM: number | null;
  durationS: number | null;
}

/** Defensive parse of a Directions response; null when there is no usable line. */
export function parseDirectionsRoute(body: unknown): ParsedRoute | null {
  const route = (body as { routes?: unknown[] } | null)?.routes?.[0] as
    | { geometry?: { type?: string; coordinates?: unknown }; distance?: unknown; duration?: unknown }
    | undefined;
  const geometry = route?.geometry;
  if (
    !geometry ||
    geometry.type !== 'LineString' ||
    !Array.isArray(geometry.coordinates) ||
    geometry.coordinates.length < 2
  ) {
    return null;
  }
  const num = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : null;
  return {
    coordinates: geometry.coordinates as [number, number][],
    distanceM: num(route?.distance),
    durationS: num(route?.duration),
  };
}
