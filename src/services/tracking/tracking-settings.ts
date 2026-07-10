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
  type TrackingSettings,
} from '@/types/tracking-settings';

const CACHE_TTL_MS = 60 * 1000;

let cached: { value: TrackingSettings; fetchedAt: number } | null = null;

export async function getTrackingSettings(): Promise<TrackingSettings> {
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.value;
  }

  let value = TRACKING_SETTINGS_DEFAULTS;
  try {
    const row = await prisma.trackingSettings.findUnique({ where: { id: 1 } });
    if (row) {
      value = {
        arrivalGeofenceRadiusM: row.arrivalGeofenceRadiusM,
        staleGpsThresholdSeconds: row.staleGpsThresholdSeconds,
        endShiftPickupGuardMinutes: row.endShiftPickupGuardMinutes,
        locationUpdateIntervalSeconds: row.locationUpdateIntervalSeconds,
        mileageGpsAccuracyThresholdM: row.mileageGpsAccuracyThresholdM,
        mileageMaxSpeedMph: row.mileageMaxSpeedMph,
        maxReasonableShiftMiles: row.maxReasonableShiftMiles,
      };
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

export function invalidateTrackingSettingsCache(): void {
  cached = null;
}
