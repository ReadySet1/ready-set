import * as Sentry from '@sentry/nextjs';
import { prisma } from '@/utils/prismaDB';
import { calculateShiftMileage, calculateShiftMileageWithValidation } from './mileage';

interface ClosedShiftRow {
  id: string;
  mileage_source: string | null;
  reported_distance_miles: number | string | null;
}

interface ClosedShiftWindowRow extends ClosedShiftRow {
  shift_start: Date | string;
  shift_end: Date | string;
}

export interface LatePointRecomputeResult {
  /** The closed shift whose window holds the point, if any. */
  shiftId: string | null;
  /** True when that shift's stored mileage was recomputed. */
  recomputed: boolean;
  /** True when recomputing that shift threw (already reported to Sentry). */
  failed?: true;
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
  return recomputeClosedShift(shift);
}

/**
 * Batch variant: recompute every closed shift that holds at least one of the
 * late points of an offline backlog. Candidates are the closed shifts
 * overlapping [oldest, newest] late point (one query), so a shift lying wholly
 * inside the backlog is found even though it holds neither end. A candidate
 * that received none of the points is left alone: recomputing it would apply
 * today's tracking settings to an old shift and silently rewrite its miles.
 *
 * One shift failing does not stop the others; it is reported with its shiftId.
 */
export async function recomputeClosedShiftsMileageForPoints(
  driverId: string,
  recordedAts: string[],
): Promise<LatePointRecomputeResult[]> {
  const pointTimes = recordedAts.map((at) => Date.parse(at)).filter(Number.isFinite);
  if (pointTimes.length === 0) return [];
  const from = new Date(Math.min(...pointTimes)).toISOString();
  const to = new Date(Math.max(...pointTimes)).toISOString();

  const rows = await prisma.$queryRawUnsafe<ClosedShiftWindowRow[]>(
    `
    SELECT id, shift_start, shift_end, mileage_source, reported_distance_miles
    FROM driver_shifts
    WHERE driver_id = $1::uuid
      AND deleted_at IS NULL
      AND shift_end IS NOT NULL
      AND shift_start <= $3::timestamptz
      AND shift_end >= $2::timestamptz
    ORDER BY shift_start ASC
    `,
    driverId,
    from,
    to,
  );

  const results: LatePointRecomputeResult[] = [];
  for (const shift of rows) {
    const start = new Date(shift.shift_start).getTime();
    const end = new Date(shift.shift_end).getTime();
    if (!pointTimes.some((t) => t >= start && t <= end)) continue;
    try {
      results.push(await recomputeClosedShift(shift));
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: 'late-gps-point-mileage' },
        extra: { driverId, shiftId: shift.id, from, to, source: 'batch' },
      });
      results.push({ shiftId: shift.id, recomputed: false, failed: true });
    }
  }
  return results;
}

/**
 * Re-run the End-shift computation for one closed shift. Manual mileage is
 * never overwritten; an odometer/hybrid shift keeps the driver's reading and
 * only refreshes the GPS audit value.
 */
async function recomputeClosedShift(shift: ClosedShiftRow): Promise<LatePointRecomputeResult> {
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
