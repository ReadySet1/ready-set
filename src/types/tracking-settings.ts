/**
 * Admin-configurable driver-tracking settings (2026-07-10 field-test feedback).
 *
 * Canonical storage units are metric where the consuming code is metric
 * (geofence radius, GPS accuracy) — the admin UI converts to imperial at the
 * form boundary, per the product rule that every user-facing distance is
 * shown in feet/miles.
 *
 * Client-safe: no Prisma imports. Shared by the API route, the server
 * resolver, the admin form, and the driver-side hook.
 */

import { z } from 'zod';

export const TrackingSettingsSchema = z.object({
  /** How close (meters) a driver must be for the "Arrived" advance to enable. ~50 ft – 1 mi. */
  arrivalGeofenceRadiusM: z.number().int().min(15).max(1609),
  /** Last GPS fix older than this (seconds) marks the driver offline on the admin dashboard. */
  staleGpsThresholdSeconds: z.number().int().min(60).max(3600),
  /** ASSIGNED pickup within this window (minutes) blocks ending the shift. 0 disables the imminent-pickup guard. */
  endShiftPickupGuardMinutes: z.number().int().min(0).max(1440),
  /** Minimum seconds between driver GPS posts (client throttle + server rate limit). */
  locationUpdateIntervalSeconds: z.number().int().min(2).max(60),
  /** GPS points with worse accuracy (meters) are dropped from mileage calculation. */
  mileageGpsAccuracyThresholdM: z.number().int().min(10).max(500),
  /** Segments faster than this (mph) are dropped as GPS glitches. */
  mileageMaxSpeedMph: z.number().int().min(30).max(150),
  /** Shift distances above this (miles) trigger a validation warning. */
  maxReasonableShiftMiles: z.number().int().min(50).max(2000),
});

export type TrackingSettings = z.infer<typeof TrackingSettingsSchema>;

/**
 * Mirrors the historical hardcoded values — the universal fail-open fallback.
 * A driver must never be stranded because settings couldn't be fetched.
 */
export const TRACKING_SETTINGS_DEFAULTS: TrackingSettings = {
  arrivalGeofenceRadiusM: 150,
  staleGpsThresholdSeconds: 300,
  endShiftPickupGuardMinutes: 120,
  locationUpdateIntervalSeconds: 5,
  mileageGpsAccuracyThresholdM: 100,
  mileageMaxSpeedMph: 95,
  maxReasonableShiftMiles: 310,
};
