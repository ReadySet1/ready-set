import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { driverOwnershipCondition } from '@/lib/auth/driver-ownership';
import { withRawTx, DbHttpError } from '@/lib/db/raw';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { BatteryLevelSchema } from '@/lib/tracking/battery';
import { resolveRecordedAt } from '@/lib/tracking/recorded-at';
import { shouldCheckClosedShift, shouldUpdateLastKnownLocation } from '@/lib/tracking/late-point';
import { recomputeClosedShiftMileageForPoint } from '@/services/tracking/late-point-mileage';
import { runAfterResponse } from '@/lib/api/after-response';
import * as Sentry from '@sentry/nextjs';

/**
 * POST /api/tracking/locations/batch — replay of GPS fixes the driver's phone
 * captured while it had no connection (board card
 * gps-points-lost-during-data-outage).
 *
 * The single-point route enforces the live cadence (one point per tracking
 * interval per user). A backlog replayed through it drains one point per
 * interval and steals the slot from live posts, so a 5-minute outage never
 * caught up before End shift. This route takes the backlog in one request:
 * - not subject to the live cadence limiter (it carries history, not the live
 *   position); bounded instead by MAX_BATCH_POINTS and its own abuse bucket;
 * - every point is filed by its own fix time (clock-skew corrected), so mileage
 *   and trails place it in the right shift;
 * - only the newest point may move the live marker, and only when it is newer
 *   than the stored trail and recent (same rule as the single-point route);
 * - late points that fall inside an already-closed shift trigger the same
 *   mileage recompute as the single-point route.
 */

/** Upper bound per request — the client sends backlogs in chunks of this size or less. */
export const MAX_BATCH_POINTS = 100;

interface BatchPointInput {
  latitude?: unknown;
  longitude?: unknown;
  accuracy?: unknown;
  speed?: unknown;
  heading?: unknown;
  altitude?: unknown;
  battery_level?: unknown;
  is_moving?: unknown;
  /** GPS fix time (ISO string or epoch ms) from the device clock. Required. */
  timestamp?: unknown;
}

interface ResolvedPoint {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  altitude: number | null;
  batteryLevel: number | null;
  isMoving: boolean | null;
  recordedAt: string;
}

const finiteOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

function resolvePoint(
  point: BatchPointInput,
  clientSentAt: unknown,
  serverNowMs: number,
): ResolvedPoint | null {
  if (!point || typeof point !== 'object') return null;
  const { latitude, longitude } = point;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  // A replayed point without a fix time cannot be filed: NOW() would store it
  // as current and in the wrong shift. Same for one older than the 24 h window.
  if (point.timestamp === undefined || point.timestamp === null) return null;
  const { recordedAt } = resolveRecordedAt({
    timestamp: point.timestamp,
    clientSentAt,
    serverNowMs,
  });
  if (!recordedAt) return null;
  return {
    latitude,
    longitude,
    accuracy: finiteOrNull(point.accuracy),
    speed: finiteOrNull(point.speed),
    heading: finiteOrNull(point.heading),
    altitude: finiteOrNull(point.altitude),
    batteryLevel: BatteryLevelSchema.parse(point.battery_level),
    isMoving: typeof point.is_moving === 'boolean' ? point.is_moving : null,
    recordedAt,
  };
}

export async function POST(request: NextRequest) {
  const auth = await withAuth(request, {
    allowedRoles: ['DRIVER', 'ADMIN', 'SUPER_ADMIN'],
    requireAuth: true,
  });
  if (!auth.success) return auth.response;

  const limited = await enforceRateLimit(auth.context.user.id, 'tracking-location-batch');
  if (limited) return limited;

  try {
    const body = await request.json();
    const driverId: unknown = body?.driver_id;
    const points: unknown = body?.points;

    if (typeof driverId !== 'string' || !driverId || !Array.isArray(points)) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: driver_id, points' },
        { status: 400 },
      );
    }
    if (points.length === 0 || points.length > MAX_BATCH_POINTS) {
      return NextResponse.json(
        { success: false, error: `points must hold 1-${MAX_BATCH_POINTS} items` },
        { status: 400 },
      );
    }

    const serverNowMs = Date.now();
    const resolved = points
      .map((p) => resolvePoint(p as BatchPointInput, body?.client_sent_at, serverNowMs))
      .filter((p): p is ResolvedPoint => p !== null)
      .sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt));
    const dropped = points.length - resolved.length;

    if (resolved.length === 0) {
      return NextResponse.json({ success: true, accepted: 0, dropped }, { status: 200 });
    }

    const isDriver = auth.context.user.type === 'DRIVER';

    await withRawTx(async (tx) => {
      const driverCheck = isDriver
        ? await tx.$queryRawUnsafe<{ id: string }[]>(
            `SELECT id FROM drivers WHERE id = $1::uuid AND ${driverOwnershipCondition(2)} AND is_active = true`,
            driverId,
            auth.context.user.id,
          )
        : await tx.$queryRawUnsafe<{ id: string }[]>(
            'SELECT id FROM drivers WHERE id = $1::uuid AND is_active = true',
            driverId,
          );
      if (driverCheck.length === 0) {
        throw new DbHttpError(isDriver ? 403 : 404, {
          success: false,
          error: isDriver ? 'Access denied' : 'Driver not found or inactive',
        });
      }

      const latestRows = await tx.$queryRawUnsafe<{ latest_recorded_at: Date | null }[]>(
        `SELECT MAX(recorded_at) AS latest_recorded_at FROM driver_locations WHERE driver_id = $1::uuid AND deleted_at IS NULL`,
        driverId,
      );
      const latestStoredAt = latestRows[0]?.latest_recorded_at ?? null;

      for (const point of resolved) {
        await tx.$executeRawUnsafe(
          `
          INSERT INTO driver_locations (
            driver_id, location, latitude, longitude, accuracy, speed, heading,
            altitude, battery_level, is_moving, recorded_at
          )
          VALUES ($1::uuid, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, $3, $2, $4, $5, $6, $7, $8, $9, $10::timestamptz)
          `,
          driverId,
          point.longitude,
          point.latitude,
          point.accuracy,
          point.speed,
          point.heading,
          point.altitude,
          point.batteryLevel,
          point.isMoving,
          point.recordedAt,
        );
      }

      const newest = resolved[resolved.length - 1]!;
      if (
        shouldUpdateLastKnownLocation({
          recordedAt: newest.recordedAt,
          latestStoredAt,
          serverNowMs,
        })
      ) {
        await tx.$executeRawUnsafe(
          `
          UPDATE drivers
          SET
            last_known_location = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
            last_location_update = NOW(),
            updated_at = NOW()
          WHERE id = $3::uuid
          `,
          newest.longitude,
          newest.latitude,
          driverId,
        );
      }
    });

    // Late points may land in a shift whose miles were computed at End shift.
    // A backlog spans minutes, so its oldest and newest late points bound every
    // shift it can touch; the recompute is idempotent.
    const late = resolved.filter((p) => shouldCheckClosedShift({ recordedAt: p.recordedAt, serverNowMs }));
    if (late.length > 0) {
      const ends = [...new Set([late[0]!.recordedAt, late[late.length - 1]!.recordedAt])];
      runAfterResponse('late GPS batch mileage recompute failed', async () => {
        for (const recordedAt of ends) {
          try {
            const result = await recomputeClosedShiftMileageForPoint(driverId, recordedAt);
            if (result.recomputed) {
              console.info(
                JSON.stringify({
                  event: 'tracking.late_point_mileage_recomputed',
                  driverId,
                  shiftId: result.shiftId,
                  recordedAt,
                  source: 'batch',
                }),
              );
            }
          } catch (error) {
            Sentry.captureException(error, {
              tags: { component: 'late-gps-point-mileage' },
              extra: { driverId, recordedAt, source: 'batch' },
            });
            throw error;
          }
        }
      });
    }

    console.info(
      JSON.stringify({
        event: 'tracking.location_batch',
        driverId,
        accepted: resolved.length,
        dropped,
        oldest: resolved[0]!.recordedAt,
        newest: resolved[resolved.length - 1]!.recordedAt,
      }),
    );

    return NextResponse.json({ success: true, accepted: resolved.length, dropped }, { status: 201 });
  } catch (error) {
    if (error instanceof DbHttpError) {
      return NextResponse.json(error.body, { status: error.status });
    }
    console.error('Error recording location batch:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to record location batch' },
      { status: 500 },
    );
  }
}
