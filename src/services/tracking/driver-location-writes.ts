import type { Prisma } from '@prisma/client';
import { existingDriverOwnershipCondition } from '@/lib/auth/driver-ownership';
import { DbHttpError } from '@/lib/db/raw';

/**
 * Shared driver_locations write steps for the single-point route
 * (POST /api/tracking/locations) and the offline-replay batch route
 * (POST /api/tracking/locations/batch). Every function runs inside the caller's
 * withRawTx transaction, in this order:
 *
 *   assertCanWriteDriverLocations → lockDriverLocations → readLatestRecordedAt
 *   → insertDriverLocationIfNew (per point) → updateLastKnownLocation
 *
 * Both routes take the same lock key, so a live POST and a batch replay of the
 * same fix serialize instead of both passing the existence check.
 */

type Tx = Prisma.TransactionClient;

export interface DriverLocationPoint {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  altitude: number | null;
  batteryLevel: number | null;
  isMoving: boolean | null;
  /** Fix time; null lets the database stamp NOW() (no dedupe possible). */
  recordedAt: string | null;
}

export interface InsertedDriverLocationRow {
  id: string;
  location_geojson: string;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  altitude: number | null;
  battery_level: number | null;
  is_moving: boolean | null;
  recorded_at: Date | string;
  created_at: Date | string;
}

/**
 * A DRIVER may only write their OWN locations (drivers row linked to the auth
 * user via profile_id or legacy user_id); admins may write for any active
 * driver. Soft-deleted drivers are excluded on both branches. Throws
 * DbHttpError 403 / 404 so the route can answer after rollback.
 */
export async function assertCanWriteDriverLocations(
  tx: Tx,
  driverId: string,
  user: { id: string; type: string },
): Promise<void> {
  const isDriver = user.type === 'DRIVER';
  const rows = isDriver
    ? await tx.$queryRawUnsafe<{ id: string }[]>(
        `SELECT id FROM drivers WHERE id = $1::uuid AND ${existingDriverOwnershipCondition(2)} AND is_active = true`,
        driverId,
        user.id,
      )
    : await tx.$queryRawUnsafe<{ id: string }[]>(
        'SELECT id FROM drivers WHERE id = $1::uuid AND deleted_at IS NULL AND is_active = true',
        driverId,
      );
  if (rows.length === 0) {
    throw new DbHttpError(isDriver ? 403 : 404, {
      success: false,
      error: isDriver ? 'Access denied' : 'Driver not found or inactive',
    });
  }
}

/**
 * Serialize every driver_locations write for one driver. There is no unique key
 * on (driver_id, recorded_at), so two requests carrying the same fix (a
 * timed-out request still running while the client retries, a live POST racing
 * a batch replay, two tabs flushing) could both pass the NOT EXISTS guard and
 * double-save. This lock makes the second wait for the first to commit.
 * Transaction-scoped on purpose: it releases at commit/rollback and is safe
 * under pgbouncer transaction pooling (a session-level lock is not). The wait
 * is bounded by withRawTx's statement_timeout. $executeRaw because Prisma
 * cannot deserialize the void column $queryRaw would return.
 */
export async function lockDriverLocations(tx: Tx, driverId: string): Promise<void> {
  await tx.$executeRawUnsafe(
    `SELECT pg_advisory_xact_lock(hashtext('driver_locations:' || $1))`,
    driverId,
  );
}

/** Newest live point already stored (index-backed on driver_id, recorded_at). */
export async function readLatestRecordedAt(tx: Tx, driverId: string): Promise<Date | null> {
  const rows = await tx.$queryRawUnsafe<{ latest_recorded_at: Date | null }[]>(
    `SELECT MAX(recorded_at) AS latest_recorded_at FROM driver_locations WHERE driver_id = $1::uuid AND deleted_at IS NULL`,
    driverId,
  );
  return rows[0]?.latest_recorded_at ?? null;
}

/**
 * Insert one point unless a live row already holds the same
 * (driver_id, recorded_at). Returns the stored row, or null for a duplicate.
 * A null recordedAt is stamped NOW() and never matches the guard.
 */
export async function insertDriverLocationIfNew(
  tx: Tx,
  driverId: string,
  point: DriverLocationPoint,
): Promise<InsertedDriverLocationRow | null> {
  const rows = await tx.$queryRawUnsafe<InsertedDriverLocationRow[]>(
    `
    INSERT INTO driver_locations (
      driver_id, location, latitude, longitude, accuracy, speed, heading,
      altitude, battery_level, is_moving, recorded_at
    )
    SELECT $1::uuid, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, $3, $2, $4, $5, $6, $7, $8, $9, COALESCE($10::timestamptz, NOW())
    WHERE NOT EXISTS (
      SELECT 1 FROM driver_locations
      WHERE driver_id = $1::uuid AND recorded_at = $10::timestamptz AND deleted_at IS NULL
    )
    RETURNING
      id,
      ST_AsGeoJSON(location) AS location_geojson,
      accuracy,
      speed,
      heading,
      altitude,
      battery_level,
      is_moving,
      recorded_at,
      created_at
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
  return rows[0] ?? null;
}

/** Move the driver's live marker (denormalized on drivers). */
export async function updateLastKnownLocation(
  tx: Tx,
  driverId: string,
  point: { latitude: number; longitude: number },
): Promise<void> {
  await tx.$executeRawUnsafe(
    `
    UPDATE drivers
    SET
      last_known_location = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
      last_location_update = NOW(),
      updated_at = NOW()
    WHERE id = $3::uuid
    `,
    point.longitude,
    point.latitude,
    driverId,
  );
}
