/**
 * Active-shift resolution for the deliveries mirror.
 *
 * The orders status PATCH mirrors driver progress into the standalone
 * `deliveries` table; stamping `shift_id` there is what lets the
 * `update_shift_delivery_count()` trigger attribute a completed delivery to
 * the driver's shift. Without it, `driver_shifts.delivery_count` never moves.
 *
 * IMPORTANT id linkage: dispatches carry the driver's PROFILE id, while both
 * `deliveries.driver_id` and `driver_shifts.driver_id` reference the
 * `drivers.id` row (see src/lib/auth/driver-ownership.ts for the
 * profile_id/user_id linkage). Callers must pass the resolved `drivers.id`.
 */

import { prisma } from '@/utils/prismaDB';

/**
 * Resolve the most recent ACTIVE shift for a driver (`drivers.id`).
 * Fails open to null — a shift-lookup hiccup must never block a status
 * update; the mirror row simply stays unattributed like before the fix.
 */
export async function resolveActiveShiftIdForDriver(
  driverId: string | null | undefined,
): Promise<string | null> {
  if (!driverId) return null;
  try {
    const shift = await prisma.driverShift.findFirst({
      where: { driverId, status: 'active', deletedAt: null },
      orderBy: { shiftStart: 'desc' },
      select: { id: true },
    });
    return shift?.id ?? null;
  } catch (error) {
    console.error('Failed to resolve active shift for driver:', error);
    return null;
  }
}
