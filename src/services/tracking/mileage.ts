import { z } from 'zod';
import { prisma } from '@/utils/prismaDB';

/**
 * Internal type representing the minimal shift window needed for mileage calculation.
 * This intentionally does not rely on Prisma's generated types because the underlying
 * table has evolved via raw SQL migrations and manual changes.
 */
interface ShiftWindow {
  id: string;
  driver_id: string;
  start_time: Date;
  end_time: Date | null;
}

interface ShiftMileageResult {
  totalKm: number;
}

export interface DeliveryMileageBreakdown {
  deliveryId: string;
  distanceKm: number;
}

export interface ShiftMileageWithBreakdown extends ShiftMileageResult {
  deliveries: DeliveryMileageBreakdown[];
}

/**
 * Validate a UUID string to avoid malformed IDs causing database errors (e.g. 22P02).
 */
function assertUuid(id: string, field: 'shiftId' | 'driverId'): void {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) {
    throw new Error(`Invalid ${field} provided for mileage calculation`);
  }
}

/**
 * Core helper to calculate distance (in kilometers) for a driver within a specific
 * time window based on the GPS trail stored in driver_locations.
 *
 * This uses PostGIS ST_Distance over consecutive points ordered by recorded_at,
 * with several quality and safety filters:
 * - Filters out low-accuracy points (accuracy > 100m)
 * - Filters out stationary points (speed < 0.5 m/s)
 * - Caps effective segment speed at 150 km/h to drop GPS glitches
 * - Drops outlier segments (> 5km over short time deltas)
 */
async function calculateWindowDistanceKm(
  driverId: string,
  startTime: Date,
  endTime: Date
): Promise<number> {
  assertUuid(driverId, 'driverId');

  const rows = await prisma.$queryRawUnsafe<{ total_km: number | null }[]>(`
    WITH ordered_points AS (
      SELECT
        location,
        accuracy,
        speed,
        recorded_at,
        LAG(location) OVER (ORDER BY recorded_at) AS prev_location,
        LAG(recorded_at) OVER (ORDER BY recorded_at) AS prev_recorded_at
      FROM driver_locations
      WHERE driver_id = $1::uuid
        AND recorded_at BETWEEN $2::timestamptz AND $3::timestamptz
        AND deleted_at IS NULL
        -- Accuracy filter: keep only reasonably accurate points
        AND (accuracy IS NULL OR accuracy <= 100)
    ),
    segments AS (
      SELECT
        ST_Distance(
          location::geography,
          prev_location::geography
        ) AS segment_distance_m,
        EXTRACT(EPOCH FROM (recorded_at - prev_recorded_at)) AS dt_seconds,
        speed
      FROM ordered_points
      WHERE prev_location IS NOT NULL
    )
    SELECT
      COALESCE(SUM(segment_distance_m), 0) / 1000.0 AS total_km
    FROM segments
    WHERE
      segment_distance_m IS NOT NULL
      -- Filter out stationary points: require speed >= 0.5 m/s when available
      AND (speed IS NULL OR speed >= 0.5)
      -- Ensure positive time delta when available
      AND (dt_seconds IS NULL OR dt_seconds > 0)
      -- Drop obvious outliers: > 5km jump within ~30 seconds
      AND (
        dt_seconds IS NULL
        OR segment_distance_m <= 5000
        OR dt_seconds >= 30
      )
      -- Cap effective speed at 150 km/h (≈ 41.67 m/s) to filter GPS glitches
      AND (
        dt_seconds IS NULL
        OR (segment_distance_m / GREATEST(dt_seconds, 1)) <= (150000.0 / 3600.0)
      );
  `, driverId, startTime, endTime);

  const totalKm = rows[0]?.total_km ?? 0;
  // Guard against NaN or negative values from unexpected database behavior
  if (!Number.isFinite(totalKm) || totalKm < 0) {
    return 0;
  }

  return totalKm;
}

/**
 * Fetch the core shift window (driver_id, start_time, end_time) used to bound
 * mileage calculations. Uses raw SQL to align with existing tracking endpoints.
 */
async function getShiftWindow(shiftId: string): Promise<ShiftWindow | null> {
  assertUuid(shiftId, 'shiftId');

  const rows = await prisma.$queryRawUnsafe<ShiftWindow[]>(`
    SELECT
      id,
      driver_id,
      start_time,
      end_time
    FROM driver_shifts
    WHERE id = $1::uuid
  `, shiftId);

  if (rows.length === 0) {
    return null;
  }

  return rows[0];
}

/**
 * Calculate total mileage for a given shift based on the driver's GPS trail,
 * and persist it back to driver_shifts.total_distance_km.
 *
 * This function is safe to call multiple times; it will simply overwrite the
 * stored total_distance_km value for the given shift.
 */
export async function calculateShiftMileage(shiftId: string): Promise<ShiftMileageResult> {
  const shift = await getShiftWindow(shiftId);
  if (!shift) {
    throw new Error('Shift not found for mileage calculation');
  }

  const startTime = shift.start_time;
  const endTime = shift.end_time ?? new Date();

  const totalKm = await calculateWindowDistanceKm(
    shift.driver_id,
    startTime,
    endTime
  );

  await prisma.$executeRawUnsafe(
    `
    UPDATE driver_shifts
    SET
      total_distance_km = $2::float,
      updated_at = NOW()
    WHERE id = $1::uuid
  `,
    shift.id,
    totalKm
  );

  return { totalKm };
}

/**
 * Calculate per-delivery mileage breakdown for a shift by running windowed
 * distance calculations for each delivery assigned to the shift.
 *
 * NOTE: This uses a query-per-delivery pattern. Typical shift delivery counts
 * are expected to be modest, and all queries are index-backed on
 * (driver_id, recorded_at), so this should remain performant under normal load.
 */
export async function calculateShiftMileageWithBreakdown(
  shiftId: string
): Promise<ShiftMileageWithBreakdown> {
  const shift = await getShiftWindow(shiftId);
  if (!shift) {
    throw new Error('Shift not found for mileage calculation');
  }

  const startTime = shift.start_time;
  const endTime = shift.end_time ?? new Date();

  const [totalKm, deliveries] = await Promise.all([
    calculateWindowDistanceKm(shift.driver_id, startTime, endTime),
    prisma.$queryRawUnsafe<{
      id: string;
      driver_id: string;
      shift_id: string | null;
      assigned_at: Date | null;
      picked_up_at: Date | null;
      delivered_at: Date | null;
      estimated_delivery_time: Date | null;
    }[]>(`
      SELECT
        id,
        driver_id,
        shift_id,
        assigned_at,
        picked_up_at,
        delivered_at,
        estimated_delivery_time
      FROM deliveries
      WHERE
        shift_id = $1::uuid
        AND deleted_at IS NULL
    `, shiftId),
  ]);

  const breakdown: DeliveryMileageBreakdown[] = [];

  for (const delivery of deliveries) {
    // Derive a reasonable window for the delivery based on available timestamps.
    const windowStart =
      delivery.picked_up_at ??
      delivery.assigned_at ??
      startTime;

    const windowEnd =
      delivery.delivered_at ??
      delivery.estimated_delivery_time ??
      endTime;

    // Skip clearly invalid windows
    if (!windowStart || !windowEnd || windowEnd <= windowStart) {
      breakdown.push({
        deliveryId: delivery.id,
        distanceKm: 0,
      });
      continue;
    }

    const distanceKm = await calculateWindowDistanceKm(
      shift.driver_id,
      windowStart,
      windowEnd
    );

    breakdown.push({
      deliveryId: delivery.id,
      distanceKm,
    });
  }

  // Persist the total distance (km) for the shift in a single write
  await prisma.$executeRawUnsafe(
    `
    UPDATE driver_shifts
    SET
      total_distance_km = $2::float,
      updated_at = NOW()
    WHERE id = $1::uuid
  `,
    shift.id,
    totalKm
  );

  return {
    totalKm,
    deliveries: breakdown,
  };
}


