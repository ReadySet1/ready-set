import { z } from 'zod';
import * as Sentry from '@sentry/nextjs';
import { prisma } from '@/utils/prismaDB';

// =============================================================================
// Types
// =============================================================================

export type StatsPeriod = 'today' | 'week' | 'month' | 'all';

export interface DeliveryStats {
  total: number;
  completed: number;
  cancelled: number;
  inProgress: number;
  averagePerDay: number;
}

export interface DistanceStats {
  totalMiles: number;
  gpsVerifiedMiles: number;
  averageMilesPerDelivery: number;
  averageMilesPerDay: number;
}

export interface ShiftStats {
  totalShifts: number;
  totalHoursWorked: number;
  averageShiftDuration: number;
}

export interface CurrentShiftInfo {
  id: string;
  startTime: string;
  currentDeliveries: number;
  currentMiles: number;
  isOnBreak: boolean;
}

export interface TrendInfo {
  deliveryChange: number;
  distanceChange: number;
  efficiencyRating: number;
}

export interface AggregatedDriverStats {
  driverId: string;
  driverName: string | null;
  period: StatsPeriod;
  periodStart: string;
  periodEnd: string;
  deliveryStats: DeliveryStats;
  distanceStats: DistanceStats;
  shiftStats: ShiftStats;
  currentShift?: CurrentShiftInfo;
  trends?: TrendInfo;
}

export interface DriverStatsSummary {
  period: StatsPeriod;
  totalActiveDrivers: number;
  aggregates: {
    totalDeliveries: number;
    totalMiles: number;
    averageDeliveriesPerDriver: number;
    averageMilesPerDriver: number;
  };
  topPerformers: Array<{
    driverId: string;
    driverName: string | null;
    deliveryCount: number;
    totalMiles: number;
  }>;
  driversOnDuty: number;
}

export interface DriverStatsQuery {
  driverId: string;
  period: StatsPeriod;
  startDate?: Date;
  endDate?: Date;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Validate a UUID string to avoid malformed IDs causing database errors
 */
function assertUuid(id: string, field: string): void {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) {
    throw new Error(`Invalid ${field} provided for driver stats`);
  }
}

/**
 * Calculate date range for a given period
 */
export function getDateRangeForPeriod(period: StatsPeriod): { startDate: Date; endDate: Date } {
  const now = new Date();
  const endDate = new Date(now);
  let startDate: Date;

  switch (period) {
    case 'today':
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'week':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'month':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'all':
      // Use a date far in the past for "all time"
      startDate = new Date('2020-01-01T00:00:00Z');
      break;
    default:
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
  }

  return { startDate, endDate };
}

/**
 * Calculate number of days in a period for averaging
 */
function getDaysInPeriod(period: StatsPeriod, startDate: Date, endDate: Date): number {
  switch (period) {
    case 'today':
      return 1;
    case 'week':
      return 7;
    case 'month':
      return 30;
    case 'all':
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    default:
      return 1;
  }
}

// =============================================================================
// Core Service Functions
// =============================================================================

/**
 * Get delivery stats for a driver within a date range
 * Combines both new Delivery system and legacy Dispatch orders
 */
export async function getDriverDeliveryStats(
  driverId: string,
  startDate: Date,
  endDate: Date
): Promise<DeliveryStats> {
  assertUuid(driverId, 'driverId');

  try {
    // Query new Delivery system
    const deliveryResult = await prisma.$queryRawUnsafe<{
      total: bigint;
      completed: bigint;
      cancelled: bigint;
      in_progress: bigint;
    }[]>(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'delivered') as completed,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
        COUNT(*) FILTER (WHERE status IN ('pending', 'assigned', 'picked_up')) as in_progress
      FROM deliveries
      WHERE driver_id = $1::uuid
        AND created_at >= $2::timestamptz
        AND created_at <= $3::timestamptz
        AND deleted_at IS NULL
    `, driverId, startDate, endDate);

    // Query legacy Dispatch system (via Profile.id matching Driver)
    // First get the profile ID for this driver
    const driverProfile = await prisma.$queryRawUnsafe<{ profile_id: string | null }[]>(`
      SELECT profile_id FROM drivers WHERE id = $1::uuid AND deleted_at IS NULL
    `, driverId);

    let legacyTotal = 0;
    let legacyCompleted = 0;

    if (driverProfile[0]?.profile_id) {
      const dispatchResult = await prisma.$queryRawUnsafe<{
        total: bigint;
        completed: bigint;
      }[]>(`
        SELECT
          COUNT(DISTINCT d.id) as total,
          COUNT(DISTINCT d.id) FILTER (
            WHERE (cr.status IN ('completed', 'delivered') OR od.status IN ('completed', 'delivered'))
          ) as completed
        FROM dispatches d
        LEFT JOIN catering_requests cr ON d."cateringRequestId" = cr.id
        LEFT JOIN on_demand_requests od ON d."onDemandId" = od.id
        WHERE d."driverId" = $1::uuid
          AND d."createdAt" >= $2::timestamptz
          AND d."createdAt" <= $3::timestamptz
      `, driverProfile[0].profile_id, startDate, endDate);

      legacyTotal = Number(dispatchResult[0]?.total ?? 0);
      legacyCompleted = Number(dispatchResult[0]?.completed ?? 0);
    }

    // Combine results
    const newTotal = Number(deliveryResult[0]?.total ?? 0);
    const newCompleted = Number(deliveryResult[0]?.completed ?? 0);
    const newCancelled = Number(deliveryResult[0]?.cancelled ?? 0);
    const newInProgress = Number(deliveryResult[0]?.in_progress ?? 0);

    const total = newTotal + legacyTotal;
    const completed = newCompleted + legacyCompleted;
    const cancelled = newCancelled;
    const inProgress = newInProgress;

    // Calculate days for average
    const days = getDaysInPeriod('all', startDate, endDate);

    return {
      total,
      completed,
      cancelled,
      inProgress,
      averagePerDay: days > 0 ? Math.round((total / days) * 10) / 10 : 0,
    };
  } catch (error) {
    Sentry.captureException(error, {
      extra: { driverId, startDate, endDate },
    });
    throw error;
  }
}

/**
 * Get distance/mileage stats from driver shifts
 */
export async function getDriverDistanceStats(
  driverId: string,
  startDate: Date,
  endDate: Date
): Promise<DistanceStats> {
  assertUuid(driverId, 'driverId');

  try {
    const result = await prisma.$queryRawUnsafe<{
      total_miles: number | null;
      gps_miles: number | null;
      delivery_count: bigint;
    }[]>(`
      SELECT
        COALESCE(SUM(total_distance_miles), 0) as total_miles,
        COALESCE(SUM(gps_distance_miles), 0) as gps_miles,
        COALESCE(SUM(delivery_count), 0) as delivery_count
      FROM driver_shifts
      WHERE driver_id = $1::uuid
        AND shift_start >= $2::timestamptz
        AND shift_start <= $3::timestamptz
        AND deleted_at IS NULL
    `, driverId, startDate, endDate);

    const totalMiles = Number(result[0]?.total_miles ?? 0);
    const gpsVerifiedMiles = Number(result[0]?.gps_miles ?? 0);
    const deliveryCount = Number(result[0]?.delivery_count ?? 0);
    const days = getDaysInPeriod('all', startDate, endDate);

    return {
      totalMiles: Math.round(totalMiles * 10) / 10,
      gpsVerifiedMiles: Math.round(gpsVerifiedMiles * 10) / 10,
      averageMilesPerDelivery: deliveryCount > 0
        ? Math.round((totalMiles / deliveryCount) * 10) / 10
        : 0,
      averageMilesPerDay: days > 0
        ? Math.round((totalMiles / days) * 10) / 10
        : 0,
    };
  } catch (error) {
    Sentry.captureException(error, {
      extra: { driverId, startDate, endDate },
    });
    throw error;
  }
}

/**
 * Get shift stats for a driver
 */
export async function getDriverShiftStats(
  driverId: string,
  startDate: Date,
  endDate: Date
): Promise<ShiftStats> {
  assertUuid(driverId, 'driverId');

  try {
    const result = await prisma.$queryRawUnsafe<{
      total_shifts: bigint;
      total_hours: number | null;
    }[]>(`
      SELECT
        COUNT(*) as total_shifts,
        COALESCE(
          SUM(
            EXTRACT(EPOCH FROM (
              COALESCE(shift_end, NOW()) - shift_start
            )) / 3600
          ),
          0
        ) as total_hours
      FROM driver_shifts
      WHERE driver_id = $1::uuid
        AND shift_start >= $2::timestamptz
        AND shift_start <= $3::timestamptz
        AND deleted_at IS NULL
    `, driverId, startDate, endDate);

    const totalShifts = Number(result[0]?.total_shifts ?? 0);
    const totalHoursWorked = Number(result[0]?.total_hours ?? 0);

    return {
      totalShifts,
      totalHoursWorked: Math.round(totalHoursWorked * 10) / 10,
      averageShiftDuration: totalShifts > 0
        ? Math.round((totalHoursWorked / totalShifts) * 10) / 10
        : 0,
    };
  } catch (error) {
    Sentry.captureException(error, {
      extra: { driverId, startDate, endDate },
    });
    throw error;
  }
}

/**
 * Get current shift info for a driver (if on duty)
 */
export async function getCurrentShiftInfo(
  driverId: string
): Promise<CurrentShiftInfo | undefined> {
  assertUuid(driverId, 'driverId');

  try {
    const result = await prisma.$queryRawUnsafe<{
      id: string;
      shift_start: Date;
      delivery_count: number | null;
      total_distance_miles: number | null;
      break_start: Date | null;
      break_end: Date | null;
    }[]>(`
      SELECT
        id,
        shift_start,
        delivery_count,
        total_distance_miles,
        break_start,
        break_end
      FROM driver_shifts
      WHERE driver_id = $1::uuid
        AND status = 'active'
        AND deleted_at IS NULL
      ORDER BY shift_start DESC
      LIMIT 1
    `, driverId);

    const shift = result[0];
    if (!shift) {
      return undefined;
    }

    const isOnBreak = shift.break_start !== null && shift.break_end === null;

    return {
      id: shift.id,
      startTime: shift.shift_start.toISOString(),
      currentDeliveries: shift.delivery_count ?? 0,
      currentMiles: shift.total_distance_miles ?? 0,
      isOnBreak,
    };
  } catch (error) {
    Sentry.captureException(error, {
      extra: { driverId },
    });
    return undefined;
  }
}

/**
 * Calculate trend information comparing current period to previous period
 */
export async function getTrendInfo(
  driverId: string,
  period: StatsPeriod,
  currentDeliveryCount: number,
  currentMiles: number,
  currentHoursWorked: number
): Promise<TrendInfo | undefined> {
  // Only calculate trends for week and month periods
  if (period === 'today' || period === 'all') {
    return undefined;
  }

  try {
    const { startDate: currentStart, endDate: currentEnd } = getDateRangeForPeriod(period);

    // Calculate previous period dates
    const periodDays = period === 'week' ? 7 : 30;
    const previousEnd = new Date(currentStart);
    previousEnd.setSeconds(previousEnd.getSeconds() - 1);
    const previousStart = new Date(previousEnd);
    previousStart.setDate(previousEnd.getDate() - periodDays);

    // Get previous period stats
    const prevDeliveryStats = await getDriverDeliveryStats(driverId, previousStart, previousEnd);
    const prevDistanceStats = await getDriverDistanceStats(driverId, previousStart, previousEnd);

    // Calculate percentage changes
    const deliveryChange = prevDeliveryStats.total > 0
      ? Math.round(((currentDeliveryCount - prevDeliveryStats.total) / prevDeliveryStats.total) * 100)
      : currentDeliveryCount > 0 ? 100 : 0;

    const distanceChange = prevDistanceStats.totalMiles > 0
      ? Math.round(((currentMiles - prevDistanceStats.totalMiles) / prevDistanceStats.totalMiles) * 100)
      : currentMiles > 0 ? 100 : 0;

    // Calculate efficiency (deliveries per hour)
    const efficiencyRating = currentHoursWorked > 0
      ? Math.round((currentDeliveryCount / currentHoursWorked) * 10) / 10
      : 0;

    return {
      deliveryChange,
      distanceChange,
      efficiencyRating,
    };
  } catch (error) {
    Sentry.captureException(error, {
      extra: { driverId, period },
    });
    return undefined;
  }
}

/**
 * Get driver name from profile
 */
async function getDriverName(driverId: string): Promise<string | null> {
  try {
    const result = await prisma.$queryRawUnsafe<{
      first_name: string | null;
      last_name: string | null;
    }[]>(`
      SELECT p.first_name, p.last_name
      FROM drivers d
      LEFT JOIN profiles p ON d.profile_id = p.id
      WHERE d.id = $1::uuid AND d.deleted_at IS NULL
    `, driverId);

    const row = result[0];
    if (!row) {
      return null;
    }

    const { first_name, last_name } = row;
    if (first_name && last_name) {
      return `${first_name} ${last_name}`;
    }
    return first_name || last_name || null;
  } catch {
    return null;
  }
}

/**
 * Main function: Get aggregated stats for a single driver
 */
export async function getDriverStats(query: DriverStatsQuery): Promise<AggregatedDriverStats> {
  assertUuid(query.driverId, 'driverId');

  const { startDate, endDate } = query.startDate && query.endDate
    ? { startDate: query.startDate, endDate: query.endDate }
    : getDateRangeForPeriod(query.period);

  // Run all stat queries in parallel
  const [driverName, deliveryStats, distanceStats, shiftStats, currentShift] = await Promise.all([
    getDriverName(query.driverId),
    getDriverDeliveryStats(query.driverId, startDate, endDate),
    getDriverDistanceStats(query.driverId, startDate, endDate),
    getDriverShiftStats(query.driverId, startDate, endDate),
    getCurrentShiftInfo(query.driverId),
  ]);

  // Calculate trends for week/month periods
  const trends = await getTrendInfo(
    query.driverId,
    query.period,
    deliveryStats.total,
    distanceStats.totalMiles,
    shiftStats.totalHoursWorked
  );

  return {
    driverId: query.driverId,
    driverName,
    period: query.period,
    periodStart: startDate.toISOString(),
    periodEnd: endDate.toISOString(),
    deliveryStats,
    distanceStats,
    shiftStats,
    currentShift,
    trends,
  };
}

/**
 * Get summary stats for all drivers (admin dashboard)
 */
export async function getAllDriversStatsSummary(
  period: StatsPeriod,
  includeInactive: boolean = false
): Promise<DriverStatsSummary> {
  const { startDate, endDate } = getDateRangeForPeriod(period);

  try {
    // Get count of active drivers and those on duty
    const driverCountResult = await prisma.$queryRawUnsafe<{
      total_active: bigint;
      on_duty: bigint;
    }[]>(`
      SELECT
        COUNT(*) FILTER (WHERE is_active = true OR $1) as total_active,
        COUNT(*) FILTER (WHERE is_on_duty = true) as on_duty
      FROM drivers
      WHERE deleted_at IS NULL
    `, includeInactive);

    const totalActiveDrivers = Number(driverCountResult[0]?.total_active ?? 0);
    const driversOnDuty = Number(driverCountResult[0]?.on_duty ?? 0);

    // Get aggregate delivery and distance stats
    const aggregateResult = await prisma.$queryRawUnsafe<{
      total_deliveries: bigint;
      total_miles: number | null;
    }[]>(`
      SELECT
        COALESCE(SUM(ds.delivery_count), 0) as total_deliveries,
        COALESCE(SUM(ds.total_distance_miles), 0) as total_miles
      FROM driver_shifts ds
      INNER JOIN drivers d ON ds.driver_id = d.id
      WHERE ds.shift_start >= $1::timestamptz
        AND ds.shift_start <= $2::timestamptz
        AND ds.deleted_at IS NULL
        AND d.deleted_at IS NULL
        AND (d.is_active = true OR $3)
    `, startDate, endDate, includeInactive);

    const totalDeliveries = Number(aggregateResult[0]?.total_deliveries ?? 0);
    const totalMiles = Number(aggregateResult[0]?.total_miles ?? 0);

    // Get top performers
    const topPerformersResult = await prisma.$queryRawUnsafe<{
      driver_id: string;
      first_name: string | null;
      last_name: string | null;
      delivery_count: bigint;
      total_miles: number | null;
    }[]>(`
      SELECT
        d.id as driver_id,
        p.first_name,
        p.last_name,
        COALESCE(SUM(ds.delivery_count), 0) as delivery_count,
        COALESCE(SUM(ds.total_distance_miles), 0) as total_miles
      FROM drivers d
      LEFT JOIN profiles p ON d.profile_id = p.id
      LEFT JOIN driver_shifts ds ON ds.driver_id = d.id
        AND ds.shift_start >= $1::timestamptz
        AND ds.shift_start <= $2::timestamptz
        AND ds.deleted_at IS NULL
      WHERE d.deleted_at IS NULL
        AND d.is_active = true
      GROUP BY d.id, p.first_name, p.last_name
      HAVING COALESCE(SUM(ds.delivery_count), 0) > 0
      ORDER BY delivery_count DESC
      LIMIT 5
    `, startDate, endDate);

    const topPerformers = topPerformersResult.map((row) => ({
      driverId: row.driver_id,
      driverName: row.first_name && row.last_name
        ? `${row.first_name} ${row.last_name}`
        : row.first_name || row.last_name || null,
      deliveryCount: Number(row.delivery_count),
      totalMiles: Math.round(Number(row.total_miles ?? 0) * 10) / 10,
    }));

    return {
      period,
      totalActiveDrivers,
      aggregates: {
        totalDeliveries,
        totalMiles: Math.round(totalMiles * 10) / 10,
        averageDeliveriesPerDriver: totalActiveDrivers > 0
          ? Math.round((totalDeliveries / totalActiveDrivers) * 10) / 10
          : 0,
        averageMilesPerDriver: totalActiveDrivers > 0
          ? Math.round((totalMiles / totalActiveDrivers) * 10) / 10
          : 0,
      },
      topPerformers,
      driversOnDuty,
    };
  } catch (error) {
    Sentry.captureException(error, {
      extra: { period, includeInactive },
    });
    throw error;
  }
}
