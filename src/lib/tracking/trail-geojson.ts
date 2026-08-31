/**
 * Pure helpers for the travelled-trail line drawn on the admin live map.
 *
 * A trail is a GeoJSON LineString Feature built from `driver_locations` rows.
 * Points are ordered by `recordedAt`, identical consecutive coordinates are
 * collapsed (a stationary driver emits many duplicate pings), and non-finite
 * coordinates are dropped so Mapbox never receives an invalid geometry.
 */

import { FEET_PER_MILE, METERS_TO_FEET } from '@/lib/units';

export type LngLat = [number, number];

export interface TrailPoint {
  longitude: number;
  latitude: number;
  /** ISO string or Date; only used for ordering. */
  recordedAt: string | Date;
}

export interface TrailFeature {
  type: 'Feature';
  geometry: { type: 'LineString'; coordinates: LngLat[] };
  properties: { pointCount: number };
}

const EARTH_RADIUS_M = 6_371_000;

const sameCoordinate = (a: LngLat | undefined, b: LngLat): boolean =>
  a !== undefined && a[0] === b[0] && a[1] === b[1];

const toTime = (value: string | Date): number =>
  value instanceof Date ? value.getTime() : Date.parse(value);

const makeFeature = (coordinates: LngLat[]): TrailFeature => ({
  type: 'Feature',
  geometry: { type: 'LineString', coordinates },
  properties: { pointCount: coordinates.length },
});

/** Build a trail Feature from unordered location rows. */
export function buildTrailLineString(points: readonly TrailPoint[]): TrailFeature {
  const ordered = [...points].sort((a, b) => toTime(a.recordedAt) - toTime(b.recordedAt));
  const coordinates: LngLat[] = [];
  for (const point of ordered) {
    if (!Number.isFinite(point.longitude) || !Number.isFinite(point.latitude)) continue;
    const next: LngLat = [point.longitude, point.latitude];
    if (sameCoordinate(coordinates[coordinates.length - 1], next)) continue;
    coordinates.push(next);
  }
  return makeFeature(coordinates);
}

/**
 * Append a realtime ping to an existing trail. Returns the same object when
 * the ping repeats the last coordinate so callers can skip a redundant
 * `setData` on the Mapbox source.
 */
export function appendTrailPoint(trail: TrailFeature, coordinate: LngLat): TrailFeature {
  if (!Number.isFinite(coordinate[0]) || !Number.isFinite(coordinate[1])) return trail;
  const last = trail.geometry.coordinates[trail.geometry.coordinates.length - 1];
  if (sameCoordinate(last, coordinate)) return trail;
  return makeFeature([...trail.geometry.coordinates, coordinate]);
}

const haversineMeters = ([lng1, lat1]: LngLat, [lng2, lat2]: LngLat): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
};

/** Total trail length in miles (user-facing distances are always imperial). */
export function trailLengthMiles(trail: TrailFeature): number {
  const coords = trail.geometry.coordinates;
  let meters = 0;
  for (let i = 1; i < coords.length; i += 1) {
    meters += haversineMeters(coords[i - 1]!, coords[i]!);
  }
  return (meters * METERS_TO_FEET) / FEET_PER_MILE;
}
