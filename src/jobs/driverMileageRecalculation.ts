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

    const candidateShifts = await prisma.$queryRawUnsafe<{
      id: string;
      driver_id: string;
      end_time: Date | null;
      total_distance_km: number | null;
    }[]>(`
      SELECT
        id,
        driver_id,
        end_time,
        total_distance_km
      FROM driver_shifts
      WHERE
        status = 'completed'
        AND end_time IS NOT NULL
        AND end_time >= $1::timestamptz
      ORDER BY end_time DESC
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
      processed: result.processed,
      errorCount: result.errors.length,
      lookbackHours,
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


