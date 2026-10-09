'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { Card } from '@/components/ui/card';
import { AlertTriangleIcon } from 'lucide-react';
import type { DeliveryTracking, LocationUpdate } from '@/types/tracking';
import { cn } from '@/lib/utils';
import { MAP_CONFIG, MARKER_CONFIG } from '@/constants/tracking-config';
import { DELIVERY_MARKER_COLOR, PICKUP_MARKER_COLOR } from '@/constants/tracking-colors';
import { captureException, captureMessage, addSentryBreadcrumb } from '@/lib/monitoring/sentry';
import { distanceToTargetM } from '@/lib/driver/geofence';
import {
  buildDirectionsUrl,
  formatNextStopLabel,
  parseDirectionsRoute,
  selectNextStop,
  shouldRefetchRoute,
  type NextStop,
  type RouteRequestKey,
} from '@/lib/driver/next-stop-guide';

// Ensure Mapbox token is available on the client
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN) {
  mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
}

interface DriverLiveMapProps {
  currentLocation: LocationUpdate | null;
  activeDeliveries: DeliveryTracking[];
  /** When set (together with shiftStartedAt), the trail is seeded from the
   *  server so it shows the full shift route — including stretches recorded
   *  while the page was locked/backgrounded or before a reload — instead of
   *  only the points this browser session happened to observe. */
  driverId?: string | null;
  shiftStartedAt?: string | Date | null;
  className?: string;
}

/** Breadcrumb trail ("Your path"): faded + dashed so it never reads as a
 *  route to follow (2026-10-06 field report). */
const TRAIL_COLOR = '#64748b';
const TRAIL_OPACITY = 0.5;
const TRAIL_DASH: [number, number] = [1.5, 2];
/** Route to the next stop: solid, wide, high-contrast with a white casing. */
const ROUTE_COLOR = '#2563eb';
const ROUTE_SOURCE_ID = 'next-stop-route';
const ROUTE_LINE_LAYER_ID = 'next-stop-route-line';
const ROUTE_CASING_LAYER_ID = 'next-stop-route-casing';

const EMPTY_LINE: GeoJSON.Feature<GeoJSON.LineString> = {
  type: 'Feature',
  properties: {},
  geometry: { type: 'LineString', coordinates: [] },
};

/** Same token resolution as the admin LiveDriverMap — the public client token,
 *  never a server secret. */
function resolveMapboxToken(): string | undefined {
  const token = mapboxgl.accessToken || process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  return token && token !== 'YOUR_MAPBOX_TOKEN_HERE' && token !== 'your_mapbox_access_token'
    ? token
    : undefined;
}

const nextStopKeyOf = (stop: NextStop | null): string | null =>
  stop ? `${stop.deliveryId}:${stop.kind}:${stop.coordinates[0]},${stop.coordinates[1]}` : null;

/** "Next: Pickup" pill that sits above the target stop's pin. */
function createNextStopMarkerElement(stop: NextStop): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'next-stop-marker';
  el.style.pointerEvents = 'none';
  el.style.display = 'flex';
  el.style.flexDirection = 'column';
  el.style.alignItems = 'center';
  const pill = document.createElement('div');
  pill.textContent = stop.kind === 'pickup' ? 'Next: Pickup' : 'Next: Drop-off';
  pill.style.cssText = [
    `background:${ROUTE_COLOR}`,
    'color:white',
    'font-size:11px',
    'font-weight:700',
    'line-height:1',
    'padding:4px 8px',
    'border-radius:9999px',
    'border:2px solid white',
    'box-shadow:0 2px 4px rgba(0,0,0,0.3)',
    'white-space:nowrap',
  ].join(';');
  const pointer = document.createElement('div');
  pointer.style.cssText = `width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid ${ROUTE_COLOR};`;
  el.appendChild(pill);
  el.appendChild(pointer);
  return el;
}

/** Hard cap on trail vertices kept in memory / handed to Mapbox. */
const MAX_TRAIL_POINTS = 1000;

/** One breadcrumb of the on-map trail: coordinate + fix time (ms epoch). The
 *  fix time keeps the line drawable in capture order even when the seed fetch
 *  and live GPS interleave or the server returns out-of-order rows. */
export interface TrailEntry {
  coord: [number, number];
  t: number;
}

/** Ungeocoded addresses come through as the [0, 0] fallback from
 *  useDriverDeliveries.toCoords — never plot those (Gulf of Guinea). */
function isValidCoords(c: unknown): c is [number, number] {
  return (
    Array.isArray(c) &&
    c.length === 2 &&
    Number.isFinite(c[0]) &&
    Number.isFinite(c[1]) &&
    !(c[0] === 0 && c[1] === 0)
  );
}

/** Orange drop-off pin — same visual as the admin LiveDriverMap. */
function createDeliveryMarkerElement(): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'delivery-marker';
  el.style.width = `${MARKER_CONFIG.DELIVERY_MARKER_SIZE}px`;
  el.style.height = `${MARKER_CONFIG.DELIVERY_MARKER_SIZE}px`;
  el.innerHTML = `
    <div style="
      width: ${MARKER_CONFIG.DELIVERY_MARKER_SIZE}px;
      height: ${MARKER_CONFIG.DELIVERY_MARKER_SIZE}px;
      background-color: ${DELIVERY_MARKER_COLOR};
      border-radius: 50%;
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
        <circle cx="12" cy="10" r="3" fill="${DELIVERY_MARKER_COLOR}"/>
      </svg>
    </div>
  `;
  return el;
}

/** Violet pickup (restaurant) marker — same visual as the admin LiveDriverMap. */
function createPickupMarkerElement(): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'pickup-marker';
  el.style.width = `${MARKER_CONFIG.DELIVERY_MARKER_SIZE}px`;
  el.style.height = `${MARKER_CONFIG.DELIVERY_MARKER_SIZE}px`;
  el.innerHTML = `
    <div style="
      width: ${MARKER_CONFIG.DELIVERY_MARKER_SIZE}px;
      height: ${MARKER_CONFIG.DELIVERY_MARKER_SIZE}px;
      background-color: ${PICKUP_MARKER_COLOR};
      border-radius: 6px;
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/>
        <path d="M3 6h18"/>
        <path d="M16 10a4 4 0 0 1-8 0"/>
      </svg>
    </div>
  `;
  return el;
}

/** Cap the trail without ever losing the route start: thin the OLDER half
 *  (drop every other point) instead of shifting points off the head — the old
 *  `length > 200 → shift()` behavior made the beginning of the route visibly
 *  disappear ~20 min into a shift. */
function capTrail(trail: TrailEntry[]): TrailEntry[] {
  if (trail.length <= MAX_TRAIL_POINTS) return trail;
  const half = Math.floor(trail.length / 2);
  const olderThinned = trail.slice(0, half).filter((_, i) => i % 2 === 0);
  return [...olderThinned, ...trail.slice(half)];
}

/** Merge server-seeded history with live-accumulated entries: drop invalid
 *  coordinates and times, order by fix time, collapse consecutive duplicates
 *  (the history/live seam repeats points), and cap to the point budget. */
export function mergeTrailSeed(
  seed: TrailEntry[],
  live: TrailEntry[],
): TrailEntry[] {
  const merged = [...seed, ...live]
    .filter((e) => isValidCoords(e.coord) && Number.isFinite(e.t))
    .sort((a, b) => a.t - b.t);
  const deduped: TrailEntry[] = [];
  for (const entry of merged) {
    const prev = deduped[deduped.length - 1];
    if (prev && prev.coord[0] === entry.coord[0] && prev.coord[1] === entry.coord[1]) {
      continue;
    }
    deduped.push(entry);
  }
  // capTrail is single-pass (sized for one-point-at-a-time growth); a bulk
  // seed can overshoot the budget, so thin until it fits.
  let capped = deduped;
  while (capped.length > MAX_TRAIL_POINTS) {
    capped = capTrail(capped);
  }
  return capped;
}

/**
 * DriverLiveMap
 *
 * Lightweight Mapbox map for the driver dashboard.
 * - Shows the driver's current location in real time.
 * - Optionally shows active delivery destinations.
 * - Maintains a short trail for the current session to visualize movement.
 *
 * This component intentionally reuses the same Mapbox + Sentry patterns as
 * `LiveDriverMap` on the admin dashboard, but is scoped to a single driver.
 */
export default function DriverLiveMap({
  currentLocation,
  activeDeliveries,
  driverId,
  shiftStartedAt,
  className,
}: DriverLiveMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const driverMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // Maintain an in-memory trail of recent coordinates for the session
  const trailRef = useRef<TrailEntry[]>([]);
  // Track last centered position to detect large jumps
  const lastCenteredRef = useRef<{ lng: number; lat: number } | null>(null);
  // Which shift the trail was last seeded from (guards against re-fetching).
  const seededShiftKeyRef = useRef<string | null>(null);
  // Pickup / drop-off markers keyed by delivery id.
  const pickupMarkersRef = useRef<globalThis.Map<string, mapboxgl.Marker>>(new globalThis.Map());
  const dropoffMarkersRef = useRef<globalThis.Map<string, mapboxgl.Marker>>(new globalThis.Map());
  // Signature of the last delivery set we fit the viewport to — fit once per
  // set change, not on every GPS tick (respect the driver's manual pan/zoom).
  const lastBoundsKeyRef = useRef<string | null>(null);
  // Next-stop guide: target marker, last Directions request (throttle), and
  // the in-flight request so a newer one (or unmount) can cancel it.
  const nextStopMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const lastRouteRequestRef = useRef<RouteRequestKey | null>(null);
  const routeAbortRef = useRef<AbortController | null>(null);
  const [routeInfo, setRouteInfo] = useState<{
    targetKey: string;
    distanceM: number | null;
    durationS: number | null;
  } | null>(null);

  const nextStop = useMemo(() => selectNextStop(activeDeliveries), [activeDeliveries]);
  const nextStopKey = nextStopKeyOf(nextStop);

  // Seed the trail from the server once per shift: the DB holds the full
  // recorded route (offline queue + native watcher keep posting while the
  // page is locked), while this component previously only accumulated points
  // it saw live — producing straight-line shortcuts across locked periods
  // and losing everything on reload.
  useEffect(() => {
    if (!mapLoaded || !driverId || !shiftStartedAt) return;
    const shiftKey = `${driverId}:${new Date(shiftStartedAt).getTime()}`;
    if (seededShiftKeyRef.current === shiftKey) return;
    seededShiftKeyRef.current = shiftKey;

    const startMs = new Date(shiftStartedAt).getTime();
    const hours = Math.min(
      Math.max(Math.ceil((Date.now() - startMs) / 3_600_000), 1),
      24,
    );
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(
          `/api/tracking/locations?driver_id=${encodeURIComponent(driverId)}&hours=${hours}&limit=1000`,
          { credentials: 'include', signal: controller.signal },
        );
        if (!res.ok) return; // best-effort: live accumulation still works
        const data = await res.json();
        // mergeTrailSeed sorts by fix time (the API's DESC order and any
        // out-of-order rows both come out right) and validates coordinates.
        const history: TrailEntry[] = (data?.data ?? [])
          .map((l: any) => ({
            coord: l?.location?.coordinates as [number, number],
            t: new Date(l?.recorded_at).getTime(),
          }))
          .filter((e: TrailEntry) => Number.isFinite(e.t) && e.t >= startMs);
        if (history.length === 0) return;
        // Merge with whatever live points arrived while fetching.
        trailRef.current = mergeTrailSeed(history, trailRef.current);
        const source = mapRef.current?.getSource('driver-trail') as
          | mapboxgl.GeoJSONSource
          | undefined;
        source?.setData({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: trailRef.current.map((e) => e.coord),
          },
        });
      } catch (error) {
        if ((error as Error)?.name !== 'AbortError') {
          captureException(error, {
            action: 'trail-seed',
            feature: 'driver-live-map',
            component: 'DriverLiveMap',
          });
        }
      }
    })();
    return () => controller.abort();
  }, [mapLoaded, driverId, shiftStartedAt]);

  // Initialize the map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    if (
      !process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
      process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN === 'YOUR_MAPBOX_TOKEN_HERE' ||
      process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN === 'your_mapbox_access_token'
    ) {
      const errorMessage =
        'Mapbox token not configured. Please add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to your .env.local file.';
      captureMessage(errorMessage, 'error', {
        feature: 'driver-live-map',
        component: 'DriverLiveMap',
      });
      setMapError(errorMessage);
      return;
    }

    try {
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: MAP_CONFIG.DEFAULT_CENTER,
        zoom: MAP_CONFIG.DEFAULT_ZOOM,
        attributionControl: true,
      });

      map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

      map.on('load', () => {
        addSentryBreadcrumb('Driver map loaded', {
          feature: 'driver-live-map',
        });
        setMapLoaded(true);

        // Initialize empty source/layer for the driver trail
        map.addSource('driver-trail', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: [],
            },
          },
        });

        map.addLayer({
          id: 'driver-trail-line',
          type: 'line',
          source: 'driver-trail',
          layout: { 'line-join': 'round' },
          paint: {
            'line-color': TRAIL_COLOR,
            'line-width': 3,
            'line-opacity': TRAIL_OPACITY,
            'line-dasharray': TRAIL_DASH,
          },
        });

        // Route to the next stop, drawn above the trail: white casing + solid
        // blue core so it is unmistakably "the way to go".
        map.addSource(ROUTE_SOURCE_ID, { type: 'geojson', data: EMPTY_LINE });
        map.addLayer({
          id: ROUTE_CASING_LAYER_ID,
          type: 'line',
          source: ROUTE_SOURCE_ID,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#ffffff', 'line-width': 9, 'line-opacity': 0.9 },
        });
        map.addLayer({
          id: ROUTE_LINE_LAYER_ID,
          type: 'line',
          source: ROUTE_SOURCE_ID,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': ROUTE_COLOR, 'line-width': 6, 'line-opacity': 0.95 },
        });
      });

      map.on('error', (event) => {
        captureException(event.error || new Error('Unknown Mapbox error'), {
          action: 'mapbox-error',
          feature: 'driver-live-map',
          component: 'DriverLiveMap',
        });
        setMapError('Failed to load map. Please check your Mapbox token.');
      });

      mapRef.current = map;

      return () => {
        map.remove();
        mapRef.current = null;
        driverMarkerRef.current = null;
        trailRef.current = [];
        pickupMarkersRef.current.clear();
        dropoffMarkersRef.current.clear();
        lastBoundsKeyRef.current = null;
        nextStopMarkerRef.current = null;
        lastRouteRequestRef.current = null;
        routeAbortRef.current?.abort();
        routeAbortRef.current = null;
      };
    } catch (error) {
      captureException(error, {
        action: 'map-initialization',
        feature: 'driver-live-map',
        component: 'DriverLiveMap',
      });
      setMapError('Failed to initialize map. Please check console for details.');
    }
  }, []);

  // Update driver marker and trail when location changes
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !currentLocation) {
      return;
    }

    const { lng, lat } = {
      lng: currentLocation.coordinates.lng,
      lat: currentLocation.coordinates.lat,
    };

    try {
      // Update or create the driver marker
      if (driverMarkerRef.current) {
        driverMarkerRef.current.setLngLat([lng, lat]);
      } else {
        const el = document.createElement('div');
        el.className = 'driver-marker';
        el.style.width = `${MARKER_CONFIG.DRIVER_MARKER_SIZE}px`;
        el.style.height = `${MARKER_CONFIG.DRIVER_MARKER_SIZE}px`;
        el.style.borderRadius = '50%';
        el.style.backgroundColor = '#22c55e'; // green
        el.style.border = '2px solid white';
        el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';

        driverMarkerRef.current = new mapboxgl.Marker({
          element: el,
          anchor: 'center',
        })
          .setLngLat([lng, lat])
          .addTo(mapRef.current);
      }

      // Update the in-memory trail (thinned, never truncated from the head),
      // stamping each entry with the GPS fix time so seed merges stay ordered.
      const fixMs = new Date(currentLocation.timestamp as Date | string).getTime();
      const t = Number.isFinite(fixMs) ? fixMs : Date.now();
      trailRef.current.push({ coord: [lng, lat], t });
      trailRef.current = capTrail(trailRef.current);

      const source = mapRef.current.getSource('driver-trail') as mapboxgl.GeoJSONSource | undefined;
      if (source) {
        source.setData({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: trailRef.current.map((e) => e.coord),
          },
        });
      }

      // Calculate distance from last centered position (for detecting large jumps)
      const shouldRecenter = () => {
        // Always center on first location
        if (!lastCenteredRef.current) return true;

        // Calculate approximate distance in km using Haversine-like formula
        const lastLat = lastCenteredRef.current.lat;
        const lastLng = lastCenteredRef.current.lng;
        const latDiff = Math.abs(lat - lastLat);
        const lngDiff = Math.abs(lng - lastLng);

        // Approximate distance in km (rough calculation)
        // 1 degree latitude ≈ 111km, 1 degree longitude varies by latitude
        const distanceKm = Math.sqrt(
          Math.pow(latDiff * 111, 2) +
          Math.pow(lngDiff * 111 * Math.cos(lat * Math.PI / 180), 2)
        );

        // Re-center if position jumped more than 10km (e.g., mock location simulator)
        return distanceKm > 10;
      };

      // Center/zoom on the driver when first loaded or position jumped significantly
      if (shouldRecenter()) {
        mapRef.current.easeTo({
          center: [lng, lat],
          zoom: MAP_CONFIG.MAX_AUTO_ZOOM,
          duration: MAP_CONFIG.FIT_BOUNDS_DURATION,
        });
        lastCenteredRef.current = { lng, lat };
        // Clear the trail when position jumps significantly (it's not a continuous path)
        if (trailRef.current.length > 1) {
          trailRef.current = [{ coord: [lng, lat], t }];
        }
      }
    } catch (error) {
      captureException(error, {
        action: 'update-driver-location',
        feature: 'driver-live-map',
        component: 'DriverLiveMap',
        metadata: {
          lat,
          lng,
        },
      });
    }
  }, [currentLocation, mapLoaded]);

  // Pickup + drop-off markers for active deliveries (2026-07-09 drive-test
  // feedback: neither location was visible on the driver's map). HTML markers
  // with popups, mirroring the admin LiveDriverMap; the old dropoff-only
  // circle layer is replaced by these.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) {
      return;
    }

    try {
      const seen = new Set<string>();
      const boundsCoords: [number, number][] = [];

      for (const delivery of activeDeliveries) {
        seen.add(delivery.id);

        const pickup = delivery.pickupLocation?.coordinates;
        if (isValidCoords(pickup)) {
          boundsCoords.push(pickup);
          const existing = pickupMarkersRef.current.get(delivery.id);
          if (existing) {
            existing.setLngLat(pickup);
          } else {
            const marker = new mapboxgl.Marker({
              element: createPickupMarkerElement(),
              anchor: 'center',
            })
              .setLngLat(pickup)
              .setPopup(
                new mapboxgl.Popup({ offset: 18 }).setHTML(
                  `<div style="font-size:12px;font-weight:600;">Pickup location</div>`,
                ),
              )
              .addTo(map);
            pickupMarkersRef.current.set(delivery.id, marker);
          }
        }

        const dropoff = delivery.deliveryLocation?.coordinates;
        if (isValidCoords(dropoff)) {
          boundsCoords.push(dropoff);
          const existing = dropoffMarkersRef.current.get(delivery.id);
          if (existing) {
            existing.setLngLat(dropoff);
          } else {
            const marker = new mapboxgl.Marker({
              element: createDeliveryMarkerElement(),
              anchor: 'bottom',
            })
              .setLngLat(dropoff)
              .setPopup(
                new mapboxgl.Popup({ offset: 18 }).setHTML(
                  `<div style="font-size:12px;font-weight:600;">Drop-off location</div>`,
                ),
              )
              .addTo(map);
            dropoffMarkersRef.current.set(delivery.id, marker);
          }
        }
      }

      // Remove markers for deliveries no longer active
      for (const markers of [pickupMarkersRef.current, dropoffMarkersRef.current]) {
        for (const [id, marker] of markers) {
          if (!seen.has(id)) {
            marker.remove();
            markers.delete(id);
          }
        }
      }

      // Fit the viewport to driver + stops once per delivery-set change so the
      // route context is visible without fighting the driver's manual pan.
      if (boundsCoords.length > 0) {
        const boundsKey = activeDeliveries
          .map((d) => `${d.id}:${d.pickupLocation?.coordinates}:${d.deliveryLocation?.coordinates}`)
          .join('|');
        if (lastBoundsKeyRef.current !== boundsKey) {
          lastBoundsKeyRef.current = boundsKey;
          const bounds = new mapboxgl.LngLatBounds();
          for (const c of boundsCoords) bounds.extend(c);
          const driverPos = driverMarkerRef.current?.getLngLat();
          if (driverPos) bounds.extend(driverPos);
          map.fitBounds(bounds, {
            padding: MAP_CONFIG.BOUNDS_PADDING,
            maxZoom: MAP_CONFIG.MAX_AUTO_ZOOM,
            duration: MAP_CONFIG.FIT_BOUNDS_DURATION,
          });
        }
      }
    } catch (error) {
      captureException(error, {
        action: 'update-delivery-markers',
        feature: 'driver-live-map',
        component: 'DriverLiveMap',
      });
    }
  }, [activeDeliveries, mapLoaded]);

  // Route to the next stop via Mapbox Directions (same client-side request as
  // the admin LiveDriverMap). Throttled: refetch only when the next stop
  // changes or the driver moved past ROUTE_REFETCH_DISTANCE_M. Any failure
  // clears the line and the label falls back to straight-line distance — the
  // map itself never breaks. No hand-off to Google Maps/Waze on purpose:
  // backgrounding the wrapper is exactly where Android drops GPS.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const setRouteLine = (coordinates: [number, number][]) => {
      const source = mapRef.current?.getSource(ROUTE_SOURCE_ID) as
        | mapboxgl.GeoJSONSource
        | undefined;
      source?.setData({ ...EMPTY_LINE, geometry: { type: 'LineString', coordinates } });
    };

    if (!nextStop || !nextStopKey) {
      if (lastRouteRequestRef.current) {
        routeAbortRef.current?.abort();
        lastRouteRequestRef.current = null;
        setRouteLine([]);
        setRouteInfo(null);
      }
      return;
    }

    const lat = currentLocation?.coordinates.lat;
    const lng = currentLocation?.coordinates.lng;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const request: RouteRequestKey = { origin: { lat: lat!, lng: lng! }, targetKey: nextStopKey };
    if (!shouldRefetchRoute(lastRouteRequestRef.current, request)) return;
    const targetChanged = lastRouteRequestRef.current?.targetKey !== nextStopKey;
    lastRouteRequestRef.current = request;
    // Never leave a line pointing at a stop that is no longer next.
    if (targetChanged) setRouteLine([]);

    const token = resolveMapboxToken();
    if (!token || typeof fetch !== 'function') return;

    routeAbortRef.current?.abort();
    const controller = new AbortController();
    routeAbortRef.current = controller;
    const url = buildDirectionsUrl(request.origin, nextStop.coordinates, token);

    (async () => {
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response?.ok) {
          throw new Error(`Directions request failed with ${response?.status ?? 'no response'}`);
        }
        const route = parseDirectionsRoute(await response.json());
        if (!route) throw new Error('Directions returned no usable route');
        if (controller.signal.aborted) return;
        setRouteLine(route.coordinates);
        setRouteInfo({ targetKey: nextStopKey, distanceM: route.distanceM, durationS: route.durationS });
      } catch (error) {
        if (controller.signal.aborted || (error as Error)?.name === 'AbortError') return;
        setRouteLine([]);
        setRouteInfo(null);
        // Silent by design (mirrors the admin map): a missing route must never break the map.
        addSentryBreadcrumb('Driver next-stop directions failed', {
          feature: 'driver-live-map',
          deliveryId: nextStop.deliveryId,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    })();
  }, [currentLocation, mapLoaded, nextStop, nextStopKey]);

  // "Next: Pickup / Drop-off" target pill above the stop the driver heads to.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    try {
      nextStopMarkerRef.current?.remove();
      nextStopMarkerRef.current = null;
      if (!nextStop) return;
      nextStopMarkerRef.current = new mapboxgl.Marker({
        element: createNextStopMarkerElement(nextStop),
        anchor: 'bottom',
        // Clear the stop pin: pickup pins are centered on the point, drop-off
        // pins stand on it (anchor 'bottom'), so the pill sits higher there.
        offset: [0, nextStop.kind === 'pickup' ? -16 : -(MARKER_CONFIG.DELIVERY_MARKER_SIZE + 4)],
      })
        .setLngLat(nextStop.coordinates)
        .addTo(map);
    } catch (error) {
      captureException(error, {
        action: 'update-next-stop-marker',
        feature: 'driver-live-map',
        component: 'DriverLiveMap',
      });
    }
    // nextStopKey captures every field of nextStop that the marker renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextStopKey, mapLoaded]);

  // Guide label: road distance/ETA from Directions when we have it for the
  // current target, else an approximate straight-line distance.
  const nextStopLabel = (() => {
    if (!nextStop) return null;
    if (routeInfo && routeInfo.targetKey === nextStopKey && routeInfo.distanceM !== null) {
      return formatNextStopLabel(nextStop.kind, {
        distanceM: routeInfo.distanceM,
        durationS: routeInfo.durationS,
      });
    }
    const straightM = distanceToTargetM(currentLocation?.coordinates, nextStop.coordinates);
    return formatNextStopLabel(
      nextStop.kind,
      straightM === null ? null : { distanceM: straightM, approximate: true },
    );
  })();

  if (mapError) {
    return (
      <Card className={cn('w-full h-full flex items-center justify-center bg-gray-50', className)}>
        <div className="text-center text-red-500 px-4 py-6">
          <AlertTriangleIcon className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm font-medium mb-1">Map Error</p>
          <p className="text-xs text-gray-600 max-w-xs mx-auto">{mapError}</p>
        </div>
      </Card>
    );
  }

  return (
    <div
      className={cn('relative w-full h-full rounded-lg overflow-hidden', className)}
      role="application"
      aria-label="Driver live map"
    >
      <div ref={mapContainerRef} className="absolute inset-0" />
      {/* Top-left keeps clear of the Mapbox logo (bottom-left) and controls
          (bottom-right); pointer-events-none so pan/zoom pass through. */}
      <div className="pointer-events-none absolute left-2 top-2 z-10 flex max-w-[calc(100%-1rem)] flex-col items-start gap-1">
        {nextStopLabel && (
          <div
            className="rounded-full px-3 py-1 text-xs font-bold text-white shadow"
            style={{ backgroundColor: ROUTE_COLOR }}
            aria-live="polite"
          >
            {nextStopLabel}
          </div>
        )}
        <div className="rounded-md bg-white/90 px-2 py-1 text-[11px] font-medium text-gray-700 shadow-sm">
          {nextStop && (
            <div className="flex items-center gap-1.5">
              <svg width="18" height="6" aria-hidden="true">
                <line x1="1" y1="3" x2="17" y2="3" stroke={ROUTE_COLOR} strokeWidth="4" strokeLinecap="round" />
              </svg>
              <span>Route to next stop</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <svg width="18" height="6" aria-hidden="true">
              <line
                x1="1"
                y1="3"
                x2="17"
                y2="3"
                stroke={TRAIL_COLOR}
                strokeOpacity={TRAIL_OPACITY + 0.2}
                strokeWidth="3"
                strokeDasharray="3 3"
              />
            </svg>
            <span>Your path</span>
          </div>
        </div>
      </div>
    </div>
  );
}


