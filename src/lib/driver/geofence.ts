/**
 * Arrival geofence for the driver app (2026-07-09 drive-test feedback):
 * the "Arrived at vendor / client" advance buttons should be disabled while
 * the driver is demonstrably far from the target location.
 *
 * Design: FAIL-OPEN. GPS can be missing (no shift, permission denied, cold
 * fix) and addresses can be ungeocoded ([0, 0] fallback) — in every unknown
 * case the advance stays enabled. The gate only engages when we have BOTH a
 * live position and valid target coordinates and the distance clearly exceeds
 * the radius. Never strand a driver on bad GPS.
 */

import { calculateDistance } from '@/utils/distance';

/** How close (meters) the driver must be for the "Arrived" advance to enable. */
export const ARRIVAL_GEOFENCE_RADIUS_M = 150;

/** [lng, lat] tuple as carried by DeliveryTracking pickup/delivery locations. */
export type LngLatTuple = [number, number];

/** Ungeocoded addresses come through as the [0, 0] fallback — treat as unknown. */
export function isValidTarget(coords: unknown): coords is LngLatTuple {
  return (
    Array.isArray(coords) &&
    coords.length === 2 &&
    Number.isFinite(coords[0]) &&
    Number.isFinite(coords[1]) &&
    !(coords[0] === 0 && coords[1] === 0)
  );
}

/**
 * Distance in meters from the driver's current position to a target
 * [lng, lat] tuple, or null when either side is unknown (fail-open signal).
 */
export function distanceToTargetM(
  current: { lat: number; lng: number } | null | undefined,
  target: unknown,
): number | null {
  if (
    !current ||
    !Number.isFinite(current.lat) ||
    !Number.isFinite(current.lng) ||
    !isValidTarget(target)
  ) {
    return null;
  }
  const km = calculateDistance(
    { latitude: current.lat, longitude: current.lng },
    { latitude: target[1], longitude: target[0] },
  );
  return km * 1000;
}

export interface GeofenceCheck {
  /** False only when we positively know the driver is out of range. */
  allowed: boolean;
  /** Rounded distance in meters, when known. */
  distanceM: number | null;
}

/**
 * Fail-open geofence check: blocks only when the distance is known AND
 * exceeds the radius.
 */
export function checkArrivalGeofence(
  current: { lat: number; lng: number } | null | undefined,
  target: unknown,
  radiusM: number = ARRIVAL_GEOFENCE_RADIUS_M,
): GeofenceCheck {
  const distance = distanceToTargetM(current, target);
  if (distance === null) {
    return { allowed: true, distanceM: null };
  }
  const rounded = Math.round(distance);
  return { allowed: distance <= radiusM, distanceM: rounded };
}

const METERS_TO_FEET = 3.28084;
const FEET_PER_MILE = 5280;

/**
 * Human hint for a blocked advance, e.g. "~490 ft away — move closer to
 * enable". Distances are computed in meters internally but always shown in
 * imperial units — drivers are US-based and think in feet/miles.
 */
export function geofenceHint(distanceM: number): string {
  const feet = distanceM * METERS_TO_FEET;
  const shown =
    feet >= 1000
      ? `${(feet / FEET_PER_MILE).toFixed(1)} mi`
      : `${Math.round(feet / 10) * 10} ft`;
  return `~${shown} away — move closer to enable`;
}
