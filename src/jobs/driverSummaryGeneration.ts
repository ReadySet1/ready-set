/**
 * Driver Weekly Summary Generation Job (REA-313)
 *
 * Generates pre-computed weekly aggregates for fast PDF generation and reporting.
 * Runs weekly to compute summaries for the previous week and backfill any missing weeks.
 *
 * Summaries include:
 * - Shift metrics (total, completed, cancelled, hours, break time)
 * - Delivery metrics (total, completed, cancelled)
 * - Distance metrics (GPS miles, reported miles)
 * - Location data density (point count)
 */

import { prisma } from '@/utils/prismaDB';
import { prismaLogger } from '@/utils/logger';
import * as Sentry from '@sentry/nextjs';
import { Decimal } from 'decimal.js';
import {
  startOfWeek,
  endOfWeek,
  subWeeks,
  format,
  getISOWeek,
  getISOWeekYear,
  differenceInHours,
  parseISO,
} from 'date-fns';

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_WEEKS_TO_BACKFILL = 12; // Backfill up to 12 weeks if missing
const DEFAULT_BATCH_SIZE = 50; // Process 50 drivers per batch

export interface SummaryGenerationConfig {
  /** Number of weeks to backfill if missing summaries. Default: 12 */
  weeksToBackfill?: number;
  /** Number of drivers to process per batch. Default: 50 */
  batchSize?: number;
  /** If true, only log what would be generated without making changes. Default: false */
  dryRun?: boolean;
  /** Specific driver IDs to generate summaries for. Default: all active drivers */
  driverIds?: string[];
  /** Specific week to regenerate (ISO date string for Monday). Default: previous week */
  weekStart?: string;
  /** Force regeneration even if summary exists. Default: false */
  forceRegenerate?: boolean;
}

export interface SummaryGenerationResult {
  success: boolean;
  timestamp: string;
  durationMs: number;
  dryRun: boolean;
  driversProcessed: number;
  summariesGenerated: number;
  summariesUpdated: number;
  errors: Array<{ driverId?: string; week?: string; message: string }>;
}

export interface WeeklySummaryData {
  driverId: string;
  weekStart: Date;
  weekEnd: Date;
  year: number;
  weekNumber: number;
  totalShifts: number;
  completedShifts: number;
  cancelledShifts: number;
  totalShiftHours: Decimal;
  totalBreakHours: Decimal;
  totalDeliveries: number;
  completedDeliveries: number;
  cancelledDeliveries: number;
  totalMiles: Decimal;
  gpsMiles: Decimal;
  reportedMiles: Decimal;
  locationPointsCount: number;
  dataSources: {
    active: boolean;
    archive: boolean;
  };
}

// ============================================================================
// Driver Summary Generation Service
// ============================================================================

export class DriverSummaryGenerationService {
  private config: Required<Omit<SummaryGenerationConfig, 'driverIds' | 'weekStart'>> & {
    driverIds?: string[];
    weekStart?: string;
  };

  constructor(config: SummaryGenerationConfig = {}) {
    this.config = {
      weeksToBackfill: config.weeksToBackfill ?? DEFAULT_WEEKS_TO_BACKFILL,
      batchSize: config.batchSize ?? DEFAULT_BATCH_SIZE,
      dryRun: config.dryRun ?? false,
      forceRegenerate: config.forceRegenerate ?? false,
      driverIds: config.driverIds,
      weekStart: config.weekStart,
    };
  }

  /**
   * Run the summary generation process
   */
  async runGeneration(): Promise<SummaryGenerationResult> {
    const startTime = Date.now();
    const result: SummaryGenerationResult = {
      success: false,
      timestamp: new Date().toISOString(),
      durationMs: 0,
      dryRun: this.config.dryRun,
      driversProcessed: 0,
      summariesGenerated: 0,
      summariesUpdated: 0,
      errors: [],
    };

    try {
      prismaLogger.info('Starting driver summary generation', {
        config: this.config,
      });

      // Get drivers to process
      const drivers = await this.getDriversToProcess();

      if (drivers.length === 0) {
        prismaLogger.info('No drivers to process');
        result.success = true;
        result.durationMs = Date.now() - startTime;
        return result;
      }

      // Determine weeks to generate
      const weeksToGenerate = this.getWeeksToGenerate();

      prismaLogger.info('Processing driver summaries', {
        driverCount: drivers.length,
        weeks: weeksToGenerate.map(w => format(w, 'yyyy-MM-dd')),
      });

      // Process in batches
      for (let i = 0; i < drivers.length; i += this.config.batchSize) {
        const batch = drivers.slice(i, i + this.config.batchSize);

        for (const driver of batch) {
          try {
            for (const weekStart of weeksToGenerate) {
              const summaryResult = await this.generateWeeklySummary(
                driver.id,
                weekStart
              );

              if (summaryResult.created) {
                result.summariesGenerated++;
              } else if (summaryResult.updated) {
                result.summariesUpdated++;
              }
            }

            result.driversProcessed++;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            result.errors.push({
              driverId: driver.id,
              message: errorMessage,
            });
            prismaLogger.error('Error generating summary for driver', {
              driverId: driver.id,
              error,
            });
          }
        }

        // Small delay between batches
        if (i + this.config.batchSize < drivers.length) {
          await this.delay(100);
        }
      }

      result.success = result.errors.length === 0;

      prismaLogger.info('Driver summary generation completed', { result });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push({ message: `Generation failed: ${errorMessage}` });
      prismaLogger.error('Driver summary generation failed', { error });
      Sentry.captureException(error, { tags: { operation: 'driver-summary-generation' } });
    }

    result.durationMs = Date.now() - startTime;
    return result;
  }

  /**
   * Generate weekly summary for a specific driver and week
   */
  async generateWeeklySummary(
    driverId: string,
    weekStart: Date
  ): Promise<{ created: boolean; updated: boolean }> {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 }); // Monday start
    const year = getISOWeekYear(weekStart);
    const weekNumber = getISOWeek(weekStart);

    // Check if summary already exists
    const existingSummary = await prisma.driverWeeklySummary.findUnique({
      where: {
        driverId_weekStart: {
          driverId,
          weekStart,
        },
      },
    });

    if (existingSummary && !this.config.forceRegenerate) {
      return { created: false, updated: false };
    }

    // Compute summary data
    const summaryData = await this.computeWeeklySummary(driverId, weekStart, weekEnd);

    if (this.config.dryRun) {
      prismaLogger.info('DRY RUN: Would generate summary', {
        driverId,
        weekStart: format(weekStart, 'yyyy-MM-dd'),
        summaryData,
      });
      return { created: !existingSummary, updated: !!existingSummary };
    }

    // Upsert summary
    await prisma.driverWeeklySummary.upsert({
      where: {
        driverId_weekStart: {
          driverId,
          weekStart,
        },
      },
      create: {
        driverId,
        weekStart,
        weekEnd,
        year,
        weekNumber,
        totalShifts: summaryData.totalShifts,
        completedShifts: summaryData.completedShifts,
        cancelledShifts: summaryData.cancelledShifts,
        totalShiftHours: summaryData.totalShiftHours,
        totalBreakHours: summaryData.totalBreakHours,
        totalDeliveries: summaryData.totalDeliveries,
        completedDeliveries: summaryData.completedDeliveries,
        cancelledDeliveries: summaryData.cancelledDeliveries,
        totalMiles: summaryData.totalMiles,
        gpsMiles: summaryData.gpsMiles,
        reportedMiles: summaryData.reportedMiles,
        locationPointsCount: summaryData.locationPointsCount,
        dataSources: summaryData.dataSources,
      },
      update: {
        totalShifts: summaryData.totalShifts,
        completedShifts: summaryData.completedShifts,
        cancelledShifts: summaryData.cancelledShifts,
        totalShiftHours: summaryData.totalShiftHours,
        totalBreakHours: summaryData.totalBreakHours,
        totalDeliveries: summaryData.totalDeliveries,
        completedDeliveries: summaryData.completedDeliveries,
        cancelledDeliveries: summaryData.cancelledDeliveries,
        totalMiles: summaryData.totalMiles,
        gpsMiles: summaryData.gpsMiles,
        reportedMiles: summaryData.reportedMiles,
        locationPointsCount: summaryData.locationPointsCount,
        dataSources: summaryData.dataSources,
        updatedAt: new Date(),
      },
    });

    return { created: !existingSummary, updated: !!existingSummary };
  }

  /**
   * Compute weekly summary data from shifts, deliveries, and locations
   */
  private async computeWeeklySummary(
    driverId: string,
    weekStart: Date,
    weekEnd: Date
  ): Promise<WeeklySummaryData> {
    // Query shifts for this driver in the week
    const shifts = await prisma.driverShift.findMany({
      where: {
        driverId,
        shiftStart: {
          gte: weekStart,
          lte: weekEnd,
        },
        deletedAt: null,
      },
      select: {
        id: true,
        status: true,
        shiftStart: true,
        shiftEnd: true,
        totalDistanceMiles: true,
        gpsDistanceMiles: true,
        reportedDistanceMiles: true,
        totalBreakDuration: true,
      },
    });

    // Query deliveries for shifts in this week
    const deliveries = await prisma.delivery.findMany({
      where: {
        driverId,
        assignedAt: {
          gte: weekStart,
          lte: weekEnd,
        },
        deletedAt: null,
      },
      select: {
        id: true,
        status: true,
      },
    });

    // Query location points count
    const locationCount = await prisma.driverLocation.count({
      where: {
        driverId,
        recordedAt: {
          gte: weekStart,
          lte: weekEnd,
        },
        deletedAt: null,
      },
    });

    // Check if there's archived location data for this period
    const archivedLocationCount = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM driver_locations_archive
      WHERE driver_id = ${driverId}::uuid
        AND recorded_at >= ${weekStart}
        AND recorded_at <= ${weekEnd}
    `;

    // Compute metrics
    const totalShifts = shifts.length;
    const completedShifts = shifts.filter(s => s.status === 'completed').length;
    const cancelledShifts = shifts.filter(s => s.status === 'cancelled').length;

    // Calculate total shift hours
    let totalShiftHours = new Decimal(0);
    let totalBreakHours = new Decimal(0);

    for (const shift of shifts) {
      if (shift.shiftStart && shift.shiftEnd) {
        const hours = differenceInHours(shift.shiftEnd, shift.shiftStart);
        totalShiftHours = totalShiftHours.plus(hours);
      }

      // Parse break duration if available (stored as interval string)
      if (shift.totalBreakDuration) {
        const breakHours = this.parseIntervalToHours(shift.totalBreakDuration);
        totalBreakHours = totalBreakHours.plus(breakHours);
      }
    }

    // Calculate delivery metrics
    const totalDeliveries = deliveries.length;
    const completedDeliveries = deliveries.filter(d => d.status === 'delivered').length;
    const cancelledDeliveries = deliveries.filter(d => d.status === 'cancelled').length;

    // Calculate distance metrics
    let totalMiles = new Decimal(0);
    let gpsMiles = new Decimal(0);
    let reportedMiles = new Decimal(0);

    for (const shift of shifts) {
      if (shift.totalDistanceMiles) {
        totalMiles = totalMiles.plus(shift.totalDistanceMiles);
      }
      if (shift.gpsDistanceMiles) {
        gpsMiles = gpsMiles.plus(shift.gpsDistanceMiles);
      }
      if (shift.reportedDistanceMiles) {
        reportedMiles = reportedMiles.plus(shift.reportedDistanceMiles);
      }
    }

    const hasArchivedData = Number(archivedLocationCount[0]?.count ?? 0) > 0;

    return {
      driverId,
      weekStart,
      weekEnd,
      year: getISOWeekYear(weekStart),
      weekNumber: getISOWeek(weekStart),
      totalShifts,
      completedShifts,
      cancelledShifts,
      totalShiftHours,
      totalBreakHours,
      totalDeliveries,
      completedDeliveries,
      cancelledDeliveries,
      totalMiles,
      gpsMiles,
      reportedMiles,
      locationPointsCount: locationCount + Number(archivedLocationCount[0]?.count ?? 0),
      dataSources: {
        active: locationCount > 0,
        archive: hasArchivedData,
      },
    };
  }

  /**
   * Get list of drivers to process
   */
  private async getDriversToProcess(): Promise<{ id: string }[]> {
    if (this.config.driverIds && this.config.driverIds.length > 0) {
      return this.config.driverIds.map(id => ({ id }));
    }

    // Get all active drivers
    return prisma.driver.findMany({
      where: {
        deletedAt: null,
      },
      select: { id: true },
    });
  }

  /**
   * Get list of week start dates to generate summaries for
   */
  private getWeeksToGenerate(): Date[] {
    if (this.config.weekStart) {
      return [startOfWeek(parseISO(this.config.weekStart), { weekStartsOn: 1 })];
    }

    // Generate for previous week and backfill missing weeks
    const weeks: Date[] = [];
    const now = new Date();

    for (let i = 1; i <= this.config.weeksToBackfill; i++) {
      const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
      weeks.push(weekStart);
    }

    return weeks;
  }

  /**
   * Parse PostgreSQL interval string to hours
   */
  private parseIntervalToHours(interval: string): number {
    // Handle formats like "02:30:00", "2 hours 30 minutes", etc.
    const hoursMatch = interval.match(/(\d+):(\d+):(\d+)/);
    if (hoursMatch) {
      const hours = parseInt(hoursMatch[1] || '0', 10);
      const minutes = parseInt(hoursMatch[2] || '0', 10);
      const seconds = parseInt(hoursMatch[3] || '0', 10);
      return hours + minutes / 60 + seconds / 3600;
    }

    // Fallback for "X hours Y minutes" format
    const hourMatch = interval.match(/(\d+)\s*hour/i);
    const minuteMatch = interval.match(/(\d+)\s*minute/i);

    let hours = 0;
    if (hourMatch) hours += parseInt(hourMatch[1] || '0', 10);
    if (minuteMatch) hours += parseInt(minuteMatch[1] || '0', 10) / 60;

    return hours;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Run driver summary generation with environment-based configuration
 */
export async function runDriverSummaryGeneration(
  config?: SummaryGenerationConfig
): Promise<SummaryGenerationResult> {
  const service = new DriverSummaryGenerationService({
    dryRun: process.env.ARCHIVE_DRY_RUN === 'true',
    ...config,
  });

  return service.runGeneration();
}

/**
 * Generate summary for a specific driver and week (for on-demand regeneration)
 */
export async function generateDriverWeeklySummary(
  driverId: string,
  weekStart: Date,
  force = false
): Promise<{ created: boolean; updated: boolean }> {
  const service = new DriverSummaryGenerationService({
    driverIds: [driverId],
    weekStart: format(weekStart, 'yyyy-MM-dd'),
    forceRegenerate: force,
  });

  // This creates the summary via the service
  return service.generateWeeklySummary(driverId, weekStart);
}

/**
 * Get existing weekly summaries for a driver
 */
export async function getDriverWeeklySummaries(
  driverId: string,
  startDate?: Date,
  endDate?: Date
): Promise<{
  id: string;
  weekStart: Date;
  weekEnd: Date;
  year: number;
  weekNumber: number;
  totalShifts: number;
  completedShifts: number;
  totalShiftHours: Decimal;
  totalDeliveries: number;
  completedDeliveries: number;
  totalMiles: Decimal;
  gpsMiles: Decimal;
}[]> {
  const where: {
    driverId: string;
    weekStart?: { gte?: Date; lte?: Date };
  } = { driverId };

  if (startDate || endDate) {
    where.weekStart = {};
    if (startDate) where.weekStart.gte = startDate;
    if (endDate) where.weekStart.lte = endDate;
  }

  return prisma.driverWeeklySummary.findMany({
    where,
    orderBy: { weekStart: 'desc' },
    select: {
      id: true,
      weekStart: true,
      weekEnd: true,
      year: true,
      weekNumber: true,
      totalShifts: true,
      completedShifts: true,
      totalShiftHours: true,
      totalDeliveries: true,
      completedDeliveries: true,
      totalMiles: true,
      gpsMiles: true,
    },
  });
}
