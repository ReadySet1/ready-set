/**
 * Data Archiving Service (REA-313)
 *
 * Automated archiving of historical data to maintain system performance:
 * - Driver locations: Archive records older than 30 days (move to archive table)
 * - Driver shifts: Archive records older than 5 weeks (move to archive table)
 * - Orders: Soft-archive records older than 30 days (mark with archived_at)
 *
 * Data remains retrievable via archive tables and can be queried for historical reports.
 */

import { prisma } from '@/utils/prismaDB';
import { prismaLogger } from '@/utils/logger';
import * as Sentry from '@sentry/nextjs';

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_LOCATIONS_RETENTION_DAYS = 30;
const DEFAULT_ORDERS_RETENTION_DAYS = 30;
const DEFAULT_SHIFTS_RETENTION_WEEKS = 5;
const DEFAULT_BATCH_SIZE = 1000;
const MINIMUM_ACCESSIBLE_DAYS = 14; // Always keep at least 2 weeks accessible

export interface ArchivingConfig {
  /** Days to retain driver location data before archiving. Default: 30 */
  driverLocationsRetentionDays?: number;
  /** Days to retain order data before soft-archiving. Default: 30 */
  orderRetentionDays?: number;
  /** Weeks to retain driver shift data before archiving. Default: 5 */
  shiftRetentionWeeks?: number;
  /** Number of records to process per batch. Default: 1000 */
  batchSize?: number;
  /** If true, only log what would be archived without making changes. Default: false */
  dryRun?: boolean;
  /** Specific archive types to run. Default: all types */
  archiveTypes?: Array<'driver_locations' | 'driver_shifts' | 'orders'>;
}

export interface ArchiveResult {
  success: boolean;
  archiveType: string;
  batchId: string | null;
  recordsProcessed: number;
  recordsArchived: number;
  recordsFailed: number;
  dateRangeStart: Date | null;
  dateRangeEnd: Date | null;
  errors: string[];
  durationMs: number;
}

export interface ArchivingResult {
  success: boolean;
  timestamp: string;
  durationMs: number;
  dryRun: boolean;
  results: ArchiveResult[];
  totalRecordsArchived: number;
  totalErrors: number;
}

export interface ArchiveMetrics {
  driverLocations: {
    totalEligible: number;
    oldestRecordDate: Date | null;
    retentionDays: number;
  };
  driverShifts: {
    totalEligible: number;
    oldestRecordDate: Date | null;
    retentionWeeks: number;
  };
  orders: {
    cateringEligible: number;
    onDemandEligible: number;
    oldestOrderDate: Date | null;
    retentionDays: number;
  };
  recentBatches: {
    id: string;
    archiveType: string;
    status: string;
    recordsArchived: number;
    startedAt: Date;
  }[];
}

// ============================================================================
// Data Archiving Service
// ============================================================================

export class DataArchivingService {
  private config: Required<Omit<ArchivingConfig, 'archiveTypes'>> & {
    archiveTypes: Array<'driver_locations' | 'driver_shifts' | 'orders'>;
  };

  constructor(config: ArchivingConfig = {}) {
    // Enforce minimum retention to ensure 2 weeks always accessible
    const locationsRetention = Math.max(
      config.driverLocationsRetentionDays ?? DEFAULT_LOCATIONS_RETENTION_DAYS,
      MINIMUM_ACCESSIBLE_DAYS
    );
    const ordersRetention = Math.max(
      config.orderRetentionDays ?? DEFAULT_ORDERS_RETENTION_DAYS,
      MINIMUM_ACCESSIBLE_DAYS
    );

    this.config = {
      driverLocationsRetentionDays: locationsRetention,
      orderRetentionDays: ordersRetention,
      shiftRetentionWeeks: config.shiftRetentionWeeks ?? DEFAULT_SHIFTS_RETENTION_WEEKS,
      batchSize: config.batchSize ?? DEFAULT_BATCH_SIZE,
      dryRun: config.dryRun ?? false,
      archiveTypes: config.archiveTypes ?? ['driver_locations', 'driver_shifts', 'orders'],
    };
  }

  /**
   * Get metrics about data eligible for archiving
   */
  async getArchiveMetrics(): Promise<ArchiveMetrics> {
    const locationsCutoff = this.getLocationsCutoffDate();
    const shiftsCutoff = this.getShiftsCutoffDate();
    const ordersCutoff = this.getOrdersCutoffDate();

    try {
      const [
        locationsCount,
        oldestLocation,
        shiftsCount,
        oldestShift,
        cateringCount,
        onDemandCount,
        oldestOrder,
        recentBatches,
      ] = await Promise.all([
        // Driver locations eligible
        prisma.driverLocation.count({
          where: {
            recordedAt: { lt: locationsCutoff },
            deletedAt: null,
          },
        }),
        // Oldest driver location
        prisma.driverLocation.findFirst({
          where: { deletedAt: null },
          orderBy: { recordedAt: 'asc' },
          select: { recordedAt: true },
        }),
        // Driver shifts eligible
        prisma.driverShift.count({
          where: {
            shiftEnd: { not: null, lt: shiftsCutoff },
            deletedAt: null,
          },
        }),
        // Oldest driver shift
        prisma.driverShift.findFirst({
          where: { deletedAt: null, shiftEnd: { not: null } },
          orderBy: { shiftEnd: 'asc' },
          select: { shiftEnd: true },
        }),
        // Catering orders eligible (completed/cancelled and old)
        prisma.cateringRequest.count({
          where: {
            status: { in: ['COMPLETED', 'CANCELLED', 'DELIVERED'] },
            completeDateTime: { lt: ordersCutoff },
            archivedAt: null,
            deletedAt: null,
          },
        }),
        // OnDemand orders eligible
        prisma.onDemand.count({
          where: {
            status: { in: ['COMPLETED', 'CANCELLED', 'DELIVERED'] },
            completeDateTime: { lt: ordersCutoff },
            archivedAt: null,
            deletedAt: null,
          },
        }),
        // Oldest order
        prisma.cateringRequest.findFirst({
          where: {
            status: { in: ['COMPLETED', 'CANCELLED', 'DELIVERED'] },
            archivedAt: null,
            deletedAt: null,
          },
          orderBy: { completeDateTime: 'asc' },
          select: { completeDateTime: true },
        }),
        // Recent archive batches
        prisma.archiveBatch.findMany({
          orderBy: { startedAt: 'desc' },
          take: 10,
          select: {
            id: true,
            archiveType: true,
            status: true,
            recordsArchived: true,
            startedAt: true,
          },
        }),
      ]);

      return {
        driverLocations: {
          totalEligible: locationsCount,
          oldestRecordDate: oldestLocation?.recordedAt ?? null,
          retentionDays: this.config.driverLocationsRetentionDays,
        },
        driverShifts: {
          totalEligible: shiftsCount,
          oldestRecordDate: oldestShift?.shiftEnd ?? null,
          retentionWeeks: this.config.shiftRetentionWeeks,
        },
        orders: {
          cateringEligible: cateringCount,
          onDemandEligible: onDemandCount,
          oldestOrderDate: oldestOrder?.completeDateTime ?? null,
          retentionDays: this.config.orderRetentionDays,
        },
        recentBatches,
      };
    } catch (error) {
      prismaLogger.error('Failed to get archive metrics', { error });
      throw error;
    }
  }

  /**
   * Run the complete archiving process
   */
  async runArchiving(): Promise<ArchivingResult> {
    const startTime = Date.now();
    const results: ArchiveResult[] = [];

    prismaLogger.info('Starting data archiving job', {
      config: this.config,
      dryRun: this.config.dryRun,
    });

    // Archive driver locations
    if (this.config.archiveTypes.includes('driver_locations')) {
      const locationResult = await this.archiveDriverLocations();
      results.push(locationResult);
    }

    // Archive driver shifts
    if (this.config.archiveTypes.includes('driver_shifts')) {
      const shiftResult = await this.archiveDriverShifts();
      results.push(shiftResult);
    }

    // Archive orders (soft archive)
    if (this.config.archiveTypes.includes('orders')) {
      const orderResult = await this.archiveOrders();
      results.push(orderResult);
    }

    const totalRecordsArchived = results.reduce((sum, r) => sum + r.recordsArchived, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

    const result: ArchivingResult = {
      success: totalErrors === 0,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      dryRun: this.config.dryRun,
      results,
      totalRecordsArchived,
      totalErrors,
    };

    prismaLogger.info('Data archiving job completed', { result });

    return result;
  }

  /**
   * Archive driver location records older than retention period.
   * Moves records from driver_locations to driver_locations_archive.
   */
  async archiveDriverLocations(): Promise<ArchiveResult> {
    const startTime = Date.now();
    const cutoffDate = this.getLocationsCutoffDate();
    const result: ArchiveResult = {
      success: false,
      archiveType: 'driver_locations',
      batchId: null,
      recordsProcessed: 0,
      recordsArchived: 0,
      recordsFailed: 0,
      dateRangeStart: null,
      dateRangeEnd: null,
      errors: [],
      durationMs: 0,
    };

    try {
      // Create archive batch record
      let batchId: string | null = null;
      if (!this.config.dryRun) {
        const batch = await prisma.archiveBatch.create({
          data: {
            archiveType: 'driver_locations',
            status: 'in_progress',
            retentionDays: this.config.driverLocationsRetentionDays,
            dryRun: this.config.dryRun,
          },
        });
        batchId = batch.id;
        result.batchId = batchId;
      }

      // Get eligible records
      const eligibleCount = await prisma.driverLocation.count({
        where: {
          recordedAt: { lt: cutoffDate },
          deletedAt: null,
        },
      });

      if (eligibleCount === 0) {
        prismaLogger.info('No driver locations to archive', { cutoffDate });
        if (batchId) {
          await this.completeBatch(batchId, 0, 0, 0);
        }
        result.success = true;
        result.durationMs = Date.now() - startTime;
        return result;
      }

      prismaLogger.info('Archiving driver locations', {
        eligibleCount,
        cutoffDate,
        batchSize: this.config.batchSize,
        dryRun: this.config.dryRun,
      });

      // Process in batches
      let processed = 0;
      let archived = 0;
      let failed = 0;
      let minDate: Date | null = null;
      let maxDate: Date | null = null;

      while (processed < eligibleCount) {
        try {
          const batchResult = await this.archiveLocationsBatch(
            cutoffDate,
            batchId
          );

          processed += batchResult.processed;
          archived += batchResult.archived;
          failed += batchResult.failed;

          if (batchResult.minDate) {
            minDate = minDate
              ? (batchResult.minDate.getTime() < minDate.getTime() ? batchResult.minDate : minDate)
              : batchResult.minDate;
          }
          if (batchResult.maxDate) {
            maxDate = maxDate
              ? (batchResult.maxDate.getTime() > maxDate.getTime() ? batchResult.maxDate : maxDate)
              : batchResult.maxDate;
          }

          if (batchResult.processed === 0) break; // No more records

          // Small delay between batches
          if (processed < eligibleCount) {
            await this.delay(100);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          result.errors.push(`Batch error: ${errorMessage}`);
          prismaLogger.error('Error processing location archive batch', { error, processed });
          break;
        }
      }

      result.recordsProcessed = processed;
      result.recordsArchived = archived;
      result.recordsFailed = failed;
      result.dateRangeStart = minDate;
      result.dateRangeEnd = maxDate;

      // Update batch record
      if (batchId) {
        await this.completeBatch(batchId, processed, archived, failed, minDate, maxDate);
      }

      result.success = result.errors.length === 0;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`Archive failed: ${errorMessage}`);
      prismaLogger.error('Driver locations archiving failed', { error });
      Sentry.captureException(error, { tags: { operation: 'archive-driver-locations' } });
    }

    result.durationMs = Date.now() - startTime;
    return result;
  }

  /**
   * Archive a batch of driver location records
   */
  private async archiveLocationsBatch(
    cutoffDate: Date,
    batchId: string | null
  ): Promise<{
    processed: number;
    archived: number;
    failed: number;
    minDate: Date | null;
    maxDate: Date | null;
  }> {
    if (this.config.dryRun) {
      // In dry run, just count and log
      const records = await prisma.driverLocation.findMany({
        where: {
          recordedAt: { lt: cutoffDate },
          deletedAt: null,
        },
        take: this.config.batchSize,
        orderBy: { recordedAt: 'asc' },
        select: { id: true, recordedAt: true },
      });

      const minDate = records.length > 0 ? records[0]?.recordedAt ?? null : null;
      const maxDate = records.length > 0 ? records[records.length - 1]?.recordedAt ?? null : null;

      prismaLogger.info('DRY RUN: Would archive driver locations', {
        count: records.length,
        minDate,
        maxDate,
      });

      return {
        processed: records.length,
        archived: records.length,
        failed: 0,
        minDate,
        maxDate,
      };
    }

    // Use raw SQL for efficient batch insert + delete
    const archiveResult = await prisma.$executeRaw`
      WITH archived AS (
        INSERT INTO driver_locations_archive (
          id, driver_id, location, latitude, longitude, accuracy,
          speed, heading, altitude, recorded_at, created_at, source,
          battery_level, is_moving, archived_at, archive_batch_id, original_deleted_at
        )
        SELECT
          id, driver_id, location, latitude, longitude, accuracy,
          speed, heading, altitude, recorded_at, created_at, source,
          battery_level, is_moving, NOW(), ${batchId}::uuid, deleted_at
        FROM driver_locations
        WHERE recorded_at < ${cutoffDate}
          AND deleted_at IS NULL
        ORDER BY recorded_at ASC
        LIMIT ${this.config.batchSize}
        RETURNING id, recorded_at
      ),
      deleted AS (
        DELETE FROM driver_locations
        WHERE id IN (SELECT id FROM archived)
        RETURNING id
      )
      SELECT COUNT(*) as count FROM deleted
    `;

    // Get date range from archived records
    const dateRange = await prisma.$queryRaw<{ min_date: Date | null; max_date: Date | null }[]>`
      SELECT
        MIN(recorded_at) as min_date,
        MAX(recorded_at) as max_date
      FROM driver_locations_archive
      WHERE archive_batch_id = ${batchId}::uuid
    `;

    return {
      processed: Number(archiveResult),
      archived: Number(archiveResult),
      failed: 0,
      minDate: dateRange[0]?.min_date ?? null,
      maxDate: dateRange[0]?.max_date ?? null,
    };
  }

  /**
   * Archive driver shift records older than retention period.
   * Moves records from driver_shifts to driver_shifts_archive.
   */
  async archiveDriverShifts(): Promise<ArchiveResult> {
    const startTime = Date.now();
    const cutoffDate = this.getShiftsCutoffDate();
    const result: ArchiveResult = {
      success: false,
      archiveType: 'driver_shifts',
      batchId: null,
      recordsProcessed: 0,
      recordsArchived: 0,
      recordsFailed: 0,
      dateRangeStart: null,
      dateRangeEnd: null,
      errors: [],
      durationMs: 0,
    };

    try {
      // Create archive batch record
      let batchId: string | null = null;
      if (!this.config.dryRun) {
        const batch = await prisma.archiveBatch.create({
          data: {
            archiveType: 'driver_shifts',
            status: 'in_progress',
            retentionDays: this.config.shiftRetentionWeeks * 7,
            dryRun: this.config.dryRun,
          },
        });
        batchId = batch.id;
        result.batchId = batchId;
      }

      // Get eligible records (completed shifts only)
      const eligibleCount = await prisma.driverShift.count({
        where: {
          status: 'completed',
          shiftEnd: { not: null, lt: cutoffDate },
          deletedAt: null,
        },
      });

      if (eligibleCount === 0) {
        prismaLogger.info('No driver shifts to archive', { cutoffDate });
        if (batchId) {
          await this.completeBatch(batchId, 0, 0, 0);
        }
        result.success = true;
        result.durationMs = Date.now() - startTime;
        return result;
      }

      prismaLogger.info('Archiving driver shifts', {
        eligibleCount,
        cutoffDate,
        batchSize: this.config.batchSize,
        dryRun: this.config.dryRun,
      });

      // Process in batches
      let processed = 0;
      let archived = 0;
      let failed = 0;
      let minDate: Date | null = null;
      let maxDate: Date | null = null;

      while (processed < eligibleCount) {
        try {
          const batchResult = await this.archiveShiftsBatch(cutoffDate, batchId);

          processed += batchResult.processed;
          archived += batchResult.archived;
          failed += batchResult.failed;

          if (batchResult.minDate) {
            minDate = minDate
              ? (batchResult.minDate.getTime() < minDate.getTime() ? batchResult.minDate : minDate)
              : batchResult.minDate;
          }
          if (batchResult.maxDate) {
            maxDate = maxDate
              ? (batchResult.maxDate.getTime() > maxDate.getTime() ? batchResult.maxDate : maxDate)
              : batchResult.maxDate;
          }

          if (batchResult.processed === 0) break;

          if (processed < eligibleCount) {
            await this.delay(100);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          result.errors.push(`Batch error: ${errorMessage}`);
          prismaLogger.error('Error processing shift archive batch', { error, processed });
          break;
        }
      }

      result.recordsProcessed = processed;
      result.recordsArchived = archived;
      result.recordsFailed = failed;
      result.dateRangeStart = minDate;
      result.dateRangeEnd = maxDate;

      if (batchId) {
        await this.completeBatch(batchId, processed, archived, failed, minDate, maxDate);
      }

      result.success = result.errors.length === 0;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`Archive failed: ${errorMessage}`);
      prismaLogger.error('Driver shifts archiving failed', { error });
      Sentry.captureException(error, { tags: { operation: 'archive-driver-shifts' } });
    }

    result.durationMs = Date.now() - startTime;
    return result;
  }

  /**
   * Archive a batch of driver shift records
   */
  private async archiveShiftsBatch(
    cutoffDate: Date,
    batchId: string | null
  ): Promise<{
    processed: number;
    archived: number;
    failed: number;
    minDate: Date | null;
    maxDate: Date | null;
  }> {
    if (this.config.dryRun) {
      const records = await prisma.driverShift.findMany({
        where: {
          status: 'completed',
          shiftEnd: { not: null, lt: cutoffDate },
          deletedAt: null,
        },
        take: this.config.batchSize,
        orderBy: { shiftEnd: 'asc' },
        select: { id: true, shiftEnd: true },
      });

      const minDate = records.length > 0 ? records[0]?.shiftEnd ?? null : null;
      const maxDate = records.length > 0 ? records[records.length - 1]?.shiftEnd ?? null : null;

      prismaLogger.info('DRY RUN: Would archive driver shifts', {
        count: records.length,
        minDate,
        maxDate,
      });

      return {
        processed: records.length,
        archived: records.length,
        failed: 0,
        minDate,
        maxDate,
      };
    }

    // Use raw SQL for efficient batch insert + delete with JSONB snapshot
    const archiveResult = await prisma.$executeRaw`
      WITH to_archive AS (
        SELECT *
        FROM driver_shifts
        WHERE status = 'completed'
          AND shift_end IS NOT NULL
          AND shift_end < ${cutoffDate}
          AND deleted_at IS NULL
        ORDER BY shift_end ASC
        LIMIT ${this.config.batchSize}
      ),
      archived AS (
        INSERT INTO driver_shifts_archive (
          id, driver_id, shift_start, shift_end, planned_shift_duration,
          actual_shift_duration, status, start_location, end_location,
          start_odometer, end_odometer, total_distance, total_distance_miles,
          gps_distance_miles, reported_distance_miles, mileage_source,
          delivery_count, break_start, break_end, total_break_duration,
          notes, created_at, updated_at, archived_at, archive_batch_id,
          original_deleted_at, original_data
        )
        SELECT
          id, driver_id, shift_start, shift_end, planned_shift_duration,
          actual_shift_duration, status, start_location, end_location,
          start_odometer, end_odometer, total_distance, total_distance_miles,
          gps_distance_miles, reported_distance_miles, mileage_source,
          delivery_count, break_start, break_end, total_break_duration,
          notes, created_at, updated_at, NOW(), ${batchId}::uuid,
          deleted_at, to_jsonb(to_archive)
        FROM to_archive
        RETURNING id, shift_end
      ),
      deleted AS (
        DELETE FROM driver_shifts
        WHERE id IN (SELECT id FROM archived)
        RETURNING id
      )
      SELECT COUNT(*) as count FROM deleted
    `;

    const dateRange = await prisma.$queryRaw<{ min_date: Date | null; max_date: Date | null }[]>`
      SELECT
        MIN(shift_end) as min_date,
        MAX(shift_end) as max_date
      FROM driver_shifts_archive
      WHERE archive_batch_id = ${batchId}::uuid
    `;

    return {
      processed: Number(archiveResult),
      archived: Number(archiveResult),
      failed: 0,
      minDate: dateRange[0]?.min_date ?? null,
      maxDate: dateRange[0]?.max_date ?? null,
    };
  }

  /**
   * Soft-archive order records older than retention period.
   * Sets archived_at timestamp without moving data (for easier queries).
   */
  async archiveOrders(): Promise<ArchiveResult> {
    const startTime = Date.now();
    const cutoffDate = this.getOrdersCutoffDate();
    const result: ArchiveResult = {
      success: false,
      archiveType: 'orders',
      batchId: null,
      recordsProcessed: 0,
      recordsArchived: 0,
      recordsFailed: 0,
      dateRangeStart: null,
      dateRangeEnd: null,
      errors: [],
      durationMs: 0,
    };

    try {
      // Create archive batch record
      let batchId: string | null = null;
      if (!this.config.dryRun) {
        const batch = await prisma.archiveBatch.create({
          data: {
            archiveType: 'orders',
            status: 'in_progress',
            retentionDays: this.config.orderRetentionDays,
            dryRun: this.config.dryRun,
          },
        });
        batchId = batch.id;
        result.batchId = batchId;
      }

      // Archive catering requests
      const cateringResult = await this.archiveOrdersBatch(
        'catering',
        cutoffDate,
        batchId
      );

      // Archive on-demand requests
      const onDemandResult = await this.archiveOrdersBatch(
        'ondemand',
        cutoffDate,
        batchId
      );

      result.recordsProcessed = cateringResult.processed + onDemandResult.processed;
      result.recordsArchived = cateringResult.archived + onDemandResult.archived;
      result.recordsFailed = cateringResult.failed + onDemandResult.failed;

      // Combine date ranges
      const allDates = [
        cateringResult.minDate,
        cateringResult.maxDate,
        onDemandResult.minDate,
        onDemandResult.maxDate,
      ].filter((d): d is Date => d !== null);

      if (allDates.length > 0) {
        result.dateRangeStart = new Date(Math.min(...allDates.map(d => d.getTime())));
        result.dateRangeEnd = new Date(Math.max(...allDates.map(d => d.getTime())));
      }

      if (batchId) {
        await this.completeBatch(
          batchId,
          result.recordsProcessed,
          result.recordsArchived,
          result.recordsFailed,
          result.dateRangeStart,
          result.dateRangeEnd
        );
      }

      result.success = true;

      prismaLogger.info('Orders soft-archive completed', {
        catering: cateringResult,
        onDemand: onDemandResult,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`Archive failed: ${errorMessage}`);
      prismaLogger.error('Orders archiving failed', { error });
      Sentry.captureException(error, { tags: { operation: 'archive-orders' } });
    }

    result.durationMs = Date.now() - startTime;
    return result;
  }

  /**
   * Soft-archive a batch of order records
   */
  private async archiveOrdersBatch(
    orderType: 'catering' | 'ondemand',
    cutoffDate: Date,
    batchId: string | null
  ): Promise<{
    processed: number;
    archived: number;
    failed: number;
    minDate: Date | null;
    maxDate: Date | null;
  }> {
    const completedStatuses = ['COMPLETED', 'CANCELLED', 'DELIVERED'];

    if (this.config.dryRun) {
      const count = orderType === 'catering'
        ? await prisma.cateringRequest.count({
            where: {
              status: { in: completedStatuses as any },
              completeDateTime: { lt: cutoffDate },
              archivedAt: null,
              deletedAt: null,
            },
          })
        : await prisma.onDemand.count({
            where: {
              status: { in: completedStatuses as any },
              completeDateTime: { lt: cutoffDate },
              archivedAt: null,
              deletedAt: null,
            },
          });

      prismaLogger.info(`DRY RUN: Would soft-archive ${orderType} orders`, { count });

      return {
        processed: count,
        archived: count,
        failed: 0,
        minDate: null,
        maxDate: null,
      };
    }

    // Soft-archive by setting archived_at
    if (orderType === 'catering') {
      const result = await prisma.cateringRequest.updateMany({
        where: {
          status: { in: completedStatuses as any },
          completeDateTime: { lt: cutoffDate },
          archivedAt: null,
          deletedAt: null,
        },
        data: {
          archivedAt: new Date(),
          archiveBatchId: batchId,
        },
      });

      // Get date range
      const dateRange = await prisma.cateringRequest.aggregate({
        where: { archiveBatchId: batchId },
        _min: { completeDateTime: true },
        _max: { completeDateTime: true },
      });

      return {
        processed: result.count,
        archived: result.count,
        failed: 0,
        minDate: dateRange._min?.completeDateTime ?? null,
        maxDate: dateRange._max?.completeDateTime ?? null,
      };
    } else {
      const result = await prisma.onDemand.updateMany({
        where: {
          status: { in: completedStatuses as any },
          completeDateTime: { lt: cutoffDate },
          archivedAt: null,
          deletedAt: null,
        },
        data: {
          archivedAt: new Date(),
          archiveBatchId: batchId,
        },
      });

      const dateRange = await prisma.onDemand.aggregate({
        where: { archiveBatchId: batchId },
        _min: { completeDateTime: true },
        _max: { completeDateTime: true },
      });

      return {
        processed: result.count,
        archived: result.count,
        failed: 0,
        minDate: dateRange._min?.completeDateTime ?? null,
        maxDate: dateRange._max?.completeDateTime ?? null,
      };
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private getLocationsCutoffDate(): Date {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.config.driverLocationsRetentionDays);
    return cutoff;
  }

  private getShiftsCutoffDate(): Date {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.config.shiftRetentionWeeks * 7);
    return cutoff;
  }

  private getOrdersCutoffDate(): Date {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.config.orderRetentionDays);
    return cutoff;
  }

  private async completeBatch(
    batchId: string,
    processed: number,
    archived: number,
    failed: number,
    minDate?: Date | null,
    maxDate?: Date | null
  ): Promise<void> {
    await prisma.archiveBatch.update({
      where: { id: batchId },
      data: {
        status: failed > 0 ? 'failed' : 'completed',
        completedAt: new Date(),
        recordsProcessed: processed,
        recordsArchived: archived,
        recordsFailed: failed,
        dateRangeStart: minDate,
        dateRangeEnd: maxDate,
      },
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Run data archiving with environment-based configuration
 */
export async function runDataArchiving(config?: ArchivingConfig): Promise<ArchivingResult> {
  const service = new DataArchivingService({
    dryRun: process.env.ARCHIVE_DRY_RUN === 'true',
    driverLocationsRetentionDays: parseInt(
      process.env.ARCHIVE_LOCATIONS_RETENTION_DAYS || String(DEFAULT_LOCATIONS_RETENTION_DAYS)
    ),
    orderRetentionDays: parseInt(
      process.env.ARCHIVE_ORDERS_RETENTION_DAYS || String(DEFAULT_ORDERS_RETENTION_DAYS)
    ),
    shiftRetentionWeeks: parseInt(
      process.env.ARCHIVE_SHIFTS_RETENTION_WEEKS || String(DEFAULT_SHIFTS_RETENTION_WEEKS)
    ),
    batchSize: parseInt(
      process.env.ARCHIVE_BATCH_SIZE || String(DEFAULT_BATCH_SIZE)
    ),
    ...config,
  });

  return service.runArchiving();
}

/**
 * Get archive metrics with environment-based configuration
 */
export async function getArchiveMetrics(config?: ArchivingConfig): Promise<ArchiveMetrics> {
  const service = new DataArchivingService({
    driverLocationsRetentionDays: parseInt(
      process.env.ARCHIVE_LOCATIONS_RETENTION_DAYS || String(DEFAULT_LOCATIONS_RETENTION_DAYS)
    ),
    orderRetentionDays: parseInt(
      process.env.ARCHIVE_ORDERS_RETENTION_DAYS || String(DEFAULT_ORDERS_RETENTION_DAYS)
    ),
    shiftRetentionWeeks: parseInt(
      process.env.ARCHIVE_SHIFTS_RETENTION_WEEKS || String(DEFAULT_SHIFTS_RETENTION_WEEKS)
    ),
    ...config,
  });

  return service.getArchiveMetrics();
}
