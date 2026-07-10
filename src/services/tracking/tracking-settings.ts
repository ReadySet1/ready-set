/**
 * Server-side resolver for admin-editable driver-tracking settings.
 *
 * DB-first with a module-level TTL cache; FAIL-OPEN to the hardcoded
 * defaults on a missing row, missing table, or any DB error — tracking must
 * keep working (geofence, rate limits, mileage) even if this table is
 * unreachable. Never throws.
 *
 * Serverless note: the cache is per-instance. After a save, other instances
 * converge within CACHE_TTL_MS; the PUT handler invalidates its own instance
 * immediately via invalidateTrackingSettingsCache().
 */

import { prisma } from '@/utils/prismaDB';
import * as Sentry from '@sentry/nextjs';
import {
  TRACKING_SETTINGS_DEFAULTS,
  TrackingSettingsSchema,
  type TrackingSettings,
} from '@/types/tracking-settings';

const CACHE_TTL_MS = 60 * 1000;

let cached: { value: TrackingSettings; fetchedAt: number } | null = null;
// Dedupe concurrent cache-miss callers (GPS posts arrive in bursts) so a TTL
// expiry issues one DB query per instance, not one per in-flight request.
let inflight: Promise<TrackingSettings> | null = null;

async function fetchSettings(): Promise<TrackingSettings> {
  let value = TRACKING_SETTINGS_DEFAULTS;
  try {
    const row = await prisma.trackingSettings.findUnique({ where: { id: 1 } });
    if (row) {
      // Re-validate on read: the Zod bounds stay authoritative even for rows
      // written outside the API (direct SQL, console). Out-of-bounds rows
      // fall back to defaults rather than flowing into the rate limiter /
      // geofence / shift guard silently.
      const parsed = TrackingSettingsSchema.safeParse({
        arrivalGeofenceRadiusM: row.arrivalGeofenceRadiusM,
        staleGpsThresholdSeconds: row.staleGpsThresholdSeconds,
        endShiftPickupGuardMinutes: row.endShiftPickupGuardMinutes,
        locationUpdateIntervalSeconds: row.locationUpdateIntervalSeconds,
        mileageGpsAccuracyThresholdM: row.mileageGpsAccuracyThresholdM,
        mileageMaxSpeedMph: row.mileageMaxSpeedMph,
        maxReasonableShiftMiles: row.maxReasonableShiftMiles,
      });
      if (parsed.success) {
        value = parsed.data;
      } else {
        Sentry.captureMessage('tracking_settings row failed schema validation — using defaults', {
          level: 'warning',
          extra: { issues: parsed.error.issues },
        });
      }
    }
  } catch (error) {
    // Cache the defaults for the TTL too — don't hammer a down DB.
    Sentry.captureException(error, {
      tags: { component: 'tracking-settings' },
    });
  }

  cached = { value, fetchedAt: Date.now() };
  return value;
}

export async function getTrackingSettings(): Promise<TrackingSettings> {
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.value;
  }
  if (!inflight) {
    inflight = fetchSettings().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

export function invalidateTrackingSettingsCache(): void {
  cached = null;
}
