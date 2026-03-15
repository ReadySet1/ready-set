/**
 * Route Utilities
 *
 * Polyline decoding, haversine distance, and formatting helpers
 * used by the Route Optimizer UI and API routes.
 */

import type { LatLng } from '@/types/routing';

// ─── Polyline Decoding ──────────────────────────────────────────────────────

/**
 * Decode a Google-encoded polyline string into an array of LatLng points.
 * @see https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}

// ─── Haversine Distance ─────────────────────────────────────────────────────

const EARTH_RADIUS_MILES = 3958.8;

/**
 * Calculate the great-circle distance between two points in miles.
 */
export function haversineDistanceMiles(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(h));
}

// ─── Formatting ─────────────────────────────────────────────────────────────

/**
 * Format miles for display (e.g. "12.4 mi").
 */
export function formatMiles(miles: number): string {
  if (miles < 0.1) return '< 0.1 mi';
  return `${miles.toFixed(1)} mi`;
}

/**
 * Format duration for display (e.g. "1h 23m" or "45 min").
 */
export function formatDuration(minutes: number): string {
  if (minutes < 1) return '< 1 min';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Convert a polyline to GeoJSON LineString for Mapbox rendering.
 */
export function polylineToGeoJSON(
  encoded: string,
): GeoJSON.Feature<GeoJSON.LineString> {
  const coords = decodePolyline(encoded);
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: coords.map((p) => [p.lng, p.lat]),
    },
  };
}
