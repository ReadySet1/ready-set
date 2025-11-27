import { z } from 'zod';
import * as Sentry from '@sentry/nextjs';
import { prisma } from '@/utils/prismaDB';
import {
  MILEAGE_CONFIG,
  METERS_TO_MILES,
  milesToMeters,
} from '@/config/mileage-config';

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
  totalMiles: number;
  gpsDistanceMiles: number;
  mileageSource: 'gps' | 'odometer' | 'manual' | 'hybrid';
  warnings: string[];
}

export interface DeliveryMileageBreakdown {
  deliveryId: string;
  distanceMiles: number;
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
 * Core helper to calculate distance (in miles) for a driver within a specific
 * time window based on the GPS trail stored in driver_locations.
 *
 * This uses PostGIS ST_Distance over consecutive points ordered by recorded_at,
 * with several quality and safety filters:
 * - Filters out low-accuracy points (accuracy > configured threshold)
 * - Filters out stationary points (speed < configured minimum)
 * - Caps effective segment speed to filter GPS glitches
 * - Drops outlier segments (unrealistic jumps over short time deltas)
 */
async function calculateWindowDistanceMiles(
  driverId: string,
  startTime: Date,
  endTime: Date
): Promise<{ miles: number; warnings: string[] }> {
  assertUuid(driverId, 'driverId');
  const warnings: string[] = [];

  // Run diagnostic query to check GPS data quality
  const diagnosticRows = await prisma.$queryRawUnsafe<{
    total_points: number;
    filtered_points: number;
  }[]>(`
    SELECT
      COUNT(*) AS total_points,
      COUNT(*) FILTER (WHERE accuracy IS NOT NULL AND accuracy > $4) AS filtered_points
    FROM driver_locations
    WHERE driver_id = $1::uuid
      AND recorded_at BETWEEN $2::timestamptz AND $3::timestamptz
      AND deleted_at IS NULL
  `, driverId, startTime, endTime, MILEAGE_CONFIG.GPS_ACCURACY_THRESHOLD_M);

  const totalPoints = Number(diagnosticRows[0]?.total_points ?? 0);
  const filteredPoints = Number(diagnosticRows[0]?.filtered_points ?? 0);

  // Warn if high percentage of points were filtered due to poor accuracy
  if (totalPoints > 0 && filteredPoints / totalPoints > MILEAGE_CONFIG.HIGH_FILTER_RATE_THRESHOLD) {
    const warningMsg = `High GPS filter rate: ${filteredPoints}/${totalPoints} points filtered (${((filteredPoints / totalPoints) * 100).toFixed(1)}%)`;
    warnings.push(warningMsg);
    Sentry.captureMessage('High GPS filter rate for driver', {
      level: 'warning',
      extra: {
        driverId,
        filteredPoints,
        totalPoints,
        filterRate: filteredPoints / totalPoints,
      },
    });
  }

  // Warn if no GPS data available
  if (totalPoints === 0) {
    const warningMsg = 'No GPS data available for time window';
    warnings.push(warningMsg);
    Sentry.captureMessage('No GPS data for driver in time window', {
      level: 'warning',
      extra: {
        driverId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      },
    });
  }

  // Convert config values for SQL query
  const maxSpeedMsForQuery = MILEAGE_CONFIG.MAX_SPEED_MPH / 2.23694; // mph to m/s
  const maxSegmentMeters = milesToMeters(MILEAGE_CONFIG.MAX_SEGMENT_DISTANCE_MILES);

  const rows = await prisma.$queryRawUnsafe<{ total_miles: number | null }[]>(`
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
        AND (accuracy IS NULL OR accuracy <= $4)
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
      COALESCE(SUM(segment_distance_m), 0) * $8::float AS total_miles
    FROM segments
    WHERE
      segment_distance_m IS NOT NULL
      -- Filter out stationary points: require speed >= minimum when available
      AND (speed IS NULL OR speed >= $5)
      -- Ensure positive time delta when available
      AND (dt_seconds IS NULL OR dt_seconds > 0)
      -- Drop obvious outliers: large jumps within short time
      AND (
        dt_seconds IS NULL
        OR segment_distance_m <= $6
        OR dt_seconds >= $7
      )
      -- Cap effective speed to filter GPS glitches
      AND (
        dt_seconds IS NULL
        OR (segment_distance_m / GREATEST(dt_seconds, 1)) <= $9::float
      );
  `,
    driverId,
    startTime,
    endTime,
    MILEAGE_CONFIG.GPS_ACCURACY_THRESHOLD_M,
    MILEAGE_CONFIG.MIN_MOVING_SPEED_MS,
    maxSegmentMeters,
    MILEAGE_CONFIG.OUTLIER_MIN_TIME_DELTA_SECONDS,
    METERS_TO_MILES,
    maxSpeedMsForQuery
  );

  const totalMiles = rows[0]?.total_miles ?? 0;
  // Guard against NaN or negative values from unexpected database behavior
  if (!Number.isFinite(totalMiles) || totalMiles < 0) {
    return { miles: 0, warnings };
  }

  return { miles: totalMiles, warnings };
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
      shift_start as start_time,
      shift_end as end_time
    FROM driver_shifts
    WHERE id = $1::uuid
  `, shiftId);

  if (rows.length === 0) {
    return null;
  }

  return rows[0] ?? null;
}

/**
 * Calculate total mileage for a given shift based on the driver's GPS trail,
 * and persist it back to driver_shifts.total_distance_miles.
 *
 * This function is safe to call multiple times; it will simply overwrite the
 * stored total_distance_miles value for the given shift.
 */
export async function calculateShiftMileage(shiftId: string): Promise<ShiftMileageResult> {
  const shift = await getShiftWindow(shiftId);
  if (!shift) {
    throw new Error('Shift not found for mileage calculation');
  }

  const startTime = shift.start_time;
  const endTime = shift.end_time ?? new Date();

  const { miles: totalMiles, warnings } = await calculateWindowDistanceMiles(
    shift.driver_id,
    startTime,
    endTime
  );

  // Warn if mileage seems unrealistically high
  if (totalMiles > MILEAGE_CONFIG.MAX_REASONABLE_SHIFT_MILES) {
    const warningMsg = `Unusually high mileage: ${totalMiles.toFixed(2)} miles exceeds ${MILEAGE_CONFIG.MAX_REASONABLE_SHIFT_MILES} mile threshold`;
    warnings.push(warningMsg);
    Sentry.captureMessage('Unusually high mileage for shift', {
      level: 'warning',
      extra: {
        shiftId,
        totalMiles: totalMiles.toFixed(2),
        threshold: MILEAGE_CONFIG.MAX_REASONABLE_SHIFT_MILES,
      },
    });
  }

  await prisma.$executeRawUnsafe(
    `
    UPDATE driver_shifts
    SET
      total_distance_miles = $2::float,
      gps_distance_miles = $2::float,
      mileage_source = 'gps',
      updated_at = NOW()
    WHERE id = $1::uuid
  `,
    shift.id,
    totalMiles
  );

  return {
    totalMiles,
    gpsDistanceMiles: totalMiles,
    mileageSource: 'gps',
    warnings
  };
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

  const [totalResult, deliveries] = await Promise.all([
    calculateWindowDistanceMiles(shift.driver_id, startTime, endTime),
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

  const { miles: totalMiles, warnings } = totalResult;
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
        distanceMiles: 0,
      });
      continue;
    }

    const { miles: distanceMiles } = await calculateWindowDistanceMiles(
      shift.driver_id,
      windowStart,
      windowEnd
    );

    breakdown.push({
      deliveryId: delivery.id,
      distanceMiles,
    });
  }

  // Validate breakdown consistency: sum of per-delivery distances vs total
  if (breakdown.length > 0 && totalMiles > 0) {
    const breakdownSum = breakdown.reduce((acc, d) => acc + d.distanceMiles, 0);
    const deviation = Math.abs(breakdownSum - totalMiles) / totalMiles;
    if (deviation > MILEAGE_CONFIG.BREAKDOWN_DEVIATION_THRESHOLD) {
      const warningMsg = `Mileage breakdown inconsistency: sum ${breakdownSum.toFixed(2)} vs total ${totalMiles.toFixed(2)} (${(deviation * 100).toFixed(1)}% deviation)`;
      warnings.push(warningMsg);
      Sentry.captureMessage('Mileage breakdown inconsistency for shift', {
        level: 'warning',
        extra: {
          shiftId,
          breakdownSum: breakdownSum.toFixed(2),
          totalMiles: totalMiles.toFixed(2),
          deviationPercent: (deviation * 100).toFixed(1),
        },
      });
    }
  }

  // Persist the total distance (miles) for the shift in a single write
  await prisma.$executeRawUnsafe(
    `
    UPDATE driver_shifts
    SET
      total_distance_miles = $2::float,
      gps_distance_miles = $2::float,
      mileage_source = 'gps',
      updated_at = NOW()
    WHERE id = $1::uuid
  `,
    shift.id,
    totalMiles
  );

  return {
    totalMiles,
    gpsDistanceMiles: totalMiles,
    mileageSource: 'gps',
    warnings,
    deliveries: breakdown,
  };
}

/**
 * Calculate shift mileage with client-reported value validation.
 * Used when the driver provides an odometer reading at shift end.
 *
 * @param shiftId - The shift to calculate mileage for
 * @param reportedMiles - Client-reported mileage (e.g., from odometer reading)
 * @returns The final mileage result with audit information
 */
export async function calculateShiftMileageWithValidation(
  shiftId: string,
  reportedMiles: number
): Promise<ShiftMileageResult & { discrepancyPercent: number | null }> {
  const shift = await getShiftWindow(shiftId);
  if (!shift) {
    throw new Error('Shift not found for mileage calculation');
  }

  const startTime = shift.start_time;
  const endTime = shift.end_time ?? new Date();

  const { miles: gpsMiles, warnings } = await calculateWindowDistanceMiles(
    shift.driver_id,
    startTime,
    endTime
  );

  // Calculate discrepancy between GPS and reported values
  let discrepancyPercent: number | null = null;
  let mileageSource: 'gps' | 'odometer' | 'manual' | 'hybrid' = 'odometer';
  let finalMiles = reportedMiles;

  if (gpsMiles > 0) {
    discrepancyPercent = Math.abs(reportedMiles - gpsMiles) / gpsMiles;

    if (discrepancyPercent > MILEAGE_CONFIG.CLIENT_DISCREPANCY_WARN_THRESHOLD) {
      const warningMsg = `Client-reported mileage differs significantly from GPS: reported ${reportedMiles.toFixed(2)} vs GPS ${gpsMiles.toFixed(2)} (${(discrepancyPercent * 100).toFixed(1)}% difference)`;
      warnings.push(warningMsg);
      Sentry.captureMessage('Client mileage discrepancy detected', {
        level: 'warning',
        extra: {
          shiftId,
          reportedMiles: reportedMiles.toFixed(2),
          gpsMiles: gpsMiles.toFixed(2),
          discrepancyPercent: (discrepancyPercent * 100).toFixed(1),
        },
      });
      mileageSource = 'hybrid';
    }
  } else {
    // No GPS data available, trust the reported value
    warnings.push('No GPS data available, using client-reported mileage');
  }

  // Persist both values for audit trail
  await prisma.$executeRawUnsafe(
    `
    UPDATE driver_shifts
    SET
      total_distance_miles = $2::float,
      gps_distance_miles = $3::float,
      reported_distance_miles = $4::float,
      mileage_source = $5,
      updated_at = NOW()
    WHERE id = $1::uuid
  `,
    shift.id,
    finalMiles,
    gpsMiles > 0 ? gpsMiles : null,
    reportedMiles,
    mileageSource
  );

  return {
    totalMiles: finalMiles,
    gpsDistanceMiles: gpsMiles,
    mileageSource,
    warnings,
    discrepancyPercent,
  };
}
