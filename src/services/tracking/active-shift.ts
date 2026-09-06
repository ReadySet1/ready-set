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
import { getDriverForUser } from '@/lib/auth/driver-ownership';

/**
 * Resolve the most recent ACTIVE shift for a driver (`drivers.id`).
 * Fails open to null on a lookup error so the deliveries mirror simply stays
 * unattributed. NOTE: for the driver movement gate (`resolveActiveShiftIdForUser`)
 * null is a *block* — a shift-lookup error therefore surfaces as
 * SHIFT_REQUIRED rather than a 500, which is the safer failure for GPS coverage.
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

/**
 * Resolve the active shift for an authenticated user — the caller of a driver
 * status PATCH. Goes through driver-ownership so both link columns
 * (`profile_id` / legacy `user_id`) resolve to the `drivers` row. Null means
 * "no drivers row or no active shift"; the orders PATCH turns that into
 * 422 SHIFT_REQUIRED when a DRIVER tries to enter a movement status.
 */
export async function resolveActiveShiftIdForUser(
  authUserId: string,
): Promise<string | null> {
  const driver = await getDriverForUser(authUserId);
  return resolveActiveShiftIdForDriver(driver?.id ?? null);
}
