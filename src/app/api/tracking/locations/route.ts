import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { existingDriverOwnershipCondition } from '@/lib/auth/driver-ownership';
import { rawQuery, withRawTx, DbHttpError } from '@/lib/db/raw';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { locationRateLimiter } from '@/lib/rate-limiting/location-rate-limiter';
import { getTrackingSettings } from '@/services/tracking/tracking-settings';
import { BatteryLevelSchema } from '@/lib/tracking/battery';
import { resolveRecordedAt } from '@/lib/tracking/recorded-at';
import { shouldCheckClosedShift, shouldUpdateLastKnownLocation } from '@/lib/tracking/late-point';
import { recomputeClosedShiftMileageForPoint } from '@/services/tracking/late-point-mileage';
import { runAfterResponse } from '@/lib/api/after-response';
import {
  assertCanWriteDriverLocations,
  insertDriverLocationIfNew,
  lockDriverLocations,
  readLatestRecordedAt,
  updateLastKnownLocation,
} from '@/services/tracking/driver-location-writes';
import * as Sentry from '@sentry/nextjs';

interface LocationUpdate {
  driver_id: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  altitude?: number;
  battery_level?: number | null;
  is_moving?: boolean;
  /** GPS fix time (ISO string) — offline-replayed points carry the original
   *  capture time instead of the replay time. */
  timestamp?: string;
  /** Device clock (epoch ms) at send time — lets the server measure and
   *  correct a skewed phone clock. Absent on older clients. */
  client_sent_at?: number;
}

// POST - Record driver location
export async function POST(request: NextRequest) {
  // AuthZ: only authenticated drivers/admins may write locations.
  const auth = await withAuth(request, {
    allowedRoles: ['DRIVER', 'ADMIN', 'SUPER_ADMIN'],
    requireAuth: true,
  });
  if (!auth.success) return auth.response;

  // Abuse protection: cap location writes per authenticated user (keyed by the
  // auth id, not the body driver_id, so it can't be bypassed). Multi-instance
  // safe via Upstash; falls open if the limiter backend is unavailable. The
  // client throttles itself to the admin-configured interval — this cap is the
  // outer abuse bound.
  const limited = await enforceRateLimit(auth.context.user.id, 'tracking-location-write');
  if (limited) return limited;

  // Per-interval enforcement of the admin-configured GPS cadence (this route
  // is the production write path for web and native drivers). Keyed by auth
  // id; fail-open settings read. 429 lets the client back off silently.
  // 80% grace: clients post at exactly the interval, so network jitter must
  // not reject a legitimate cadence.
  const settings = await getTrackingSettings();
  locationRateLimiter.configure(settings.locationUpdateIntervalSeconds * 800);
  const intervalLimit = locationRateLimiter.checkAndRecordLimit(auth.context.user.id);
  if (!intervalLimit.allowed) {
    return NextResponse.json(
      { success: false, error: intervalLimit.message },
      { status: 429 },
    );
  }

  try {
    const body = await request.json();
    const {
      driver_id,
      latitude,
      longitude,
      accuracy,
      speed,
      heading,
      altitude,
      battery_level,
      is_moving,
      timestamp,
      client_sent_at,
    }: LocationUpdate = body;

    const serverNowMs = Date.now();
    const { recordedAt, clockOffsetMs, clockCorrected } = resolveRecordedAt({
      timestamp,
      clientSentAt: client_sent_at,
      serverNowMs,
    });
    if (clockCorrected) {
      // One structured line per skewed request so wrong phone clocks are
      // visible in the logs (grep the event name).
      console.warn(
        JSON.stringify({
          event: 'tracking.device_clock_skew',
          driverId: driver_id,
          authUserId: auth.context.user.id,
          offsetMs: clockOffsetMs,
          hasFixTime: timestamp != null,
        }),
      );
    }
    // 0-100 integer or null; invalid values degrade to null, never a 400.
    const batteryLevel = BatteryLevelSchema.parse(battery_level);

    // Validate required fields
    if (!driver_id || typeof latitude !== 'number' || typeof longitude !== 'number') {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: driver_id, latitude, longitude'
        },
        { status: 400 }
      );
    }

    // Validate coordinate ranges
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return NextResponse.json(
        { success: false, error: 'Invalid coordinates' },
        { status: 400 }
      );
    }

    // One transaction: ownership/existence check + per-driver lock + guarded
    // insert + denormalized update. A DRIVER may only write their OWN location;
    // admins may write for any driver. Coordinates are bound as numeric params
    // via ST_MakePoint (never string-interpolated). The lock is shared with the
    // batch replay route, so a retried POST or a live POST racing a replay of
    // the same fix cannot store it twice (see driver-location-writes.ts).
    const locationRow = await withRawTx(async (tx) => {
      await assertCanWriteDriverLocations(tx, driver_id, auth.context.user);
      await lockDriverLocations(tx, driver_id);

      // Read BEFORE the insert so the new point is compared against history.
      const latestStoredAt = await readLatestRecordedAt(tx, driver_id);

      const inserted = await insertDriverLocationIfNew(tx, driver_id, {
        latitude,
        longitude,
        accuracy: accuracy ?? null,
        speed: speed ?? null,
        heading: heading ?? null,
        altitude: altitude ?? null,
        batteryLevel,
        isMoving: is_moving ?? null,
        recordedAt,
      });
      // Already stored: it was applied (marker, recompute) when first saved.
      if (!inserted) return null;

      // A late / out-of-order point (offline-queue replay) is history: it is
      // stored above for mileage and trails, but must not move the driver's
      // current position on the live maps.
      if (!shouldUpdateLastKnownLocation({ recordedAt, latestStoredAt, serverNowMs })) {
        console.warn(
          JSON.stringify({
            event: 'tracking.late_point',
            driverId: driver_id,
            recordedAt,
            latestStoredAt,
          }),
        );
        return inserted;
      }

      await updateLastKnownLocation(tx, driver_id, { latitude, longitude });
      return inserted;
    });

    // Idempotent retry: success so the client clears it, nothing re-applied.
    // Same counters as the batch route's response.
    if (!locationRow) {
      return NextResponse.json(
        { success: true, duplicate: true, inserted: 0, duplicates: 1, data: null },
        { status: 200 },
      );
    }

    const locationData = {
      ...locationRow,
      location: JSON.parse(locationRow.location_geojson)
    };

    // A late point may land inside a shift that was already closed, whose
    // miles were computed at End shift without it. Recompute after the
    // response so the driver's request never waits on (or fails from) it.
    if (recordedAt && shouldCheckClosedShift({ recordedAt, serverNowMs })) {
      const lateRecordedAt = recordedAt;
      runAfterResponse('late GPS point mileage recompute failed', async () => {
        try {
          const result = await recomputeClosedShiftMileageForPoint(driver_id, lateRecordedAt);
          if (result.recomputed) {
            console.info(
              JSON.stringify({
                event: 'tracking.late_point_mileage_recomputed',
                driverId: driver_id,
                shiftId: result.shiftId,
                recordedAt: lateRecordedAt,
              }),
            );
          }
        } catch (error) {
          Sentry.captureException(error, {
            tags: { component: 'late-gps-point-mileage' },
            extra: { driverId: driver_id, recordedAt: lateRecordedAt },
          });
          throw error;
        }
      });
    }

    return NextResponse.json({
      success: true,
      duplicate: false,
      inserted: 1,
      duplicates: 0,
      data: locationData
    }, { status: 201 });

  } catch (error) {
    if (error instanceof DbHttpError) {
      return NextResponse.json(error.body, { status: error.status });
    }
    console.error('Error recording location:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to record location',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET - Get location history for a driver
export async function GET(request: NextRequest) {
  // AuthZ: drivers/admins only.
  const auth = await withAuth(request, {
    allowedRoles: ['DRIVER', 'ADMIN', 'SUPER_ADMIN'],
    requireAuth: true,
  });
  if (!auth.success) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const driver_id = searchParams.get('driver_id');
    // Clamp to sane bounds (also keeps the interpolated INTERVAL numeric).
    const hours = Math.min(Math.max(parseInt(searchParams.get('hours') || '24', 10) || 24, 1), 168);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100', 10) || 100, 1), 1000);

    if (!driver_id) {
      return NextResponse.json(
        { success: false, error: 'Missing driver_id parameter' },
        { status: 400 }
      );
    }

    // A DRIVER may only read their own location history.
    if (auth.context.user.type === 'DRIVER') {
      const owns = await rawQuery<{ id: string }>(
        `SELECT id FROM drivers WHERE id = $1::uuid AND ${existingDriverOwnershipCondition(2)}`,
        [driver_id, auth.context.user.id],
      );
      if (owns.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        );
      }
    }

    const rows = await rawQuery<any>(
      `
      SELECT
        id,
        ST_AsGeoJSON(location) as location_geojson,
        accuracy,
        speed,
        heading,
        altitude,
        battery_level,
        is_moving,
        recorded_at,
        created_at
      FROM driver_locations
      WHERE
        driver_id = $1::uuid
        AND recorded_at >= NOW() - INTERVAL '${hours} hours'
      ORDER BY recorded_at DESC
      LIMIT $2
      `,
      [driver_id, limit],
    );

    const locations = rows.map((row: any) => ({
      ...row,
      location: JSON.parse(row.location_geojson)
    }));

    return NextResponse.json({
      success: true,
      data: locations,
      metadata: {
        driver_id,
        hours_requested: hours,
        total_points: locations.length
      }
    });

  } catch (error) {
    console.error('Error fetching location history:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch location history',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
