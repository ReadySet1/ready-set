import { prisma } from '@/utils/prismaDB';
import { calculateShiftMileage, calculateShiftMileageWithValidation } from './mileage';

interface ClosedShiftRow {
  id: string;
  mileage_source: string | null;
  reported_distance_miles: number | string | null;
}

export interface LatePointRecomputeResult {
  /** The closed shift whose window holds the point, if any. */
  shiftId: string | null;
  /** True when that shift's stored mileage was recomputed. */
  recomputed: boolean;
}

/**
 * Shift miles are computed once, at End shift. A GPS point replayed from the
 * offline queue after that moment is stored (and filed under the right shift
 * by `recorded_at`), but the stored miles would never include it. Re-run the
 * same End-shift computation for the closed shift whose window holds the
 * point. Idempotent: it recomputes from the full trail and overwrites.
 *
 * Open shifts are skipped (End shift will count the point), and so is mileage
 * entered by hand. An odometer/hybrid shift keeps the driver's reading and
 * only refreshes the GPS audit value.
 */
export async function recomputeClosedShiftMileageForPoint(
  driverId: string,
  recordedAt: string,
): Promise<LatePointRecomputeResult> {
  const rows = await prisma.$queryRawUnsafe<ClosedShiftRow[]>(
    `
    SELECT id, mileage_source, reported_distance_miles
    FROM driver_shifts
    WHERE driver_id = $1::uuid
      AND deleted_at IS NULL
      AND shift_end IS NOT NULL
      AND shift_start <= $2::timestamptz
      AND shift_end >= $2::timestamptz
    ORDER BY shift_end DESC
    LIMIT 1
    `,
    driverId,
    recordedAt,
  );

  const shift = rows[0];
  if (!shift) return { shiftId: null, recomputed: false };

  const source = shift.mileage_source;
  if (source === null || source === 'gps') {
    await calculateShiftMileage(shift.id);
    return { shiftId: shift.id, recomputed: true };
  }

  const reported =
    shift.reported_distance_miles === null ? null : Number(shift.reported_distance_miles);
  if ((source === 'odometer' || source === 'hybrid') && reported !== null && Number.isFinite(reported)) {
    await calculateShiftMileageWithValidation(shift.id, reported);
    return { shiftId: shift.id, recomputed: true };
  }

  return { shiftId: shift.id, recomputed: false };
}
