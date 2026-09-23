import { prisma } from '@/utils/prismaDB';
import { realtimeLogger } from '@/lib/logging/realtime-logger';
import { calculateShiftMileage } from '@/services/tracking/mileage';

interface MileageRecalculationConfig {
  /**
   * Maximum number of shifts to process in a single run.
   */
  batchSize?: number;
  /**
   * Only consider shifts that ended within the last N hours.
   * Defaults to 24 hours to keep the job bounded.
   */
  lookbackHours?: number;
}

const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_LOOKBACK_HOURS = 24;

interface MileageRecalculationResult {
  success: boolean;
  processed: number;
  errors: Array<{ shiftId: string; message: string }>;
}

/**
 * Periodic job to recalculate mileage for recently completed shifts.
 *
 * This acts as a safety net to:
 * - Backfill mileage for shifts where live calculation may have failed.
 * - Recompute mileage after GPS data corrections.
 */
export async function runDriverMileageRecalculation(
  config: MileageRecalculationConfig = {}
): Promise<MileageRecalculationResult> {
  const batchSize = config.batchSize ?? DEFAULT_BATCH_SIZE;
  const lookbackHours = config.lookbackHours ?? DEFAULT_LOOKBACK_HOURS;

  const result: MileageRecalculationResult = {
    success: false,
    processed: 0,
    errors: [],
  };

  try {
    const lookbackStart = new Date();
    lookbackStart.setHours(lookbackStart.getHours() - lookbackHours);

    // Columns follow the shipped `driver_shifts` schema (prisma `DriverShift`):
    // `shift_end` (not end_time) and `total_distance` (legacy km).
    // Only GPS-sourced (or never-computed) shifts are recalculated:
    // calculateShiftMileage writes mileage_source = 'gps', which would clobber
    // odometer / manual / hybrid mileage recorded at end of shift.
    const candidateShifts = await prisma.$queryRawUnsafe<{
      id: string;
      driver_id: string;
      shift_end: Date | null;
      total_distance: number | null;
    }[]>(`
      SELECT
        id,
        driver_id,
        shift_end,
        total_distance
      FROM driver_shifts
      WHERE
        status = 'completed'
        AND deleted_at IS NULL
        AND (mileage_source IS NULL OR mileage_source = 'gps')
        AND shift_end IS NOT NULL
        AND shift_end >= $1::timestamptz
      ORDER BY shift_end DESC
      LIMIT $2::int
    `, lookbackStart, batchSize);

    if (candidateShifts.length === 0) {
      result.success = true;
      return result;
    }

    for (const shift of candidateShifts) {
      try {
        await calculateShiftMileage(shift.id);
        result.processed += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown mileage recalculation error';
        result.errors.push({ shiftId: shift.id, message });
        realtimeLogger.error('Failed to recalculate shift mileage', {
          driverId: shift.driver_id,
          error,
          metadata: {
            shiftId: shift.id,
          },
        });
      }
    }

    result.success = result.errors.length === 0;

    realtimeLogger.info('Driver mileage recalculation job completed', {
      metadata: {
        processed: result.processed,
        errorCount: result.errors.length,
        lookbackHours,
      },
    });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown mileage recalculation failure';
    result.errors.push({ shiftId: 'N/A', message });

    realtimeLogger.error('Driver mileage recalculation job failed', {
      error,
      metadata: {
        batchSize,
        lookbackHours,
      },
    });

    return result;
  }
}


