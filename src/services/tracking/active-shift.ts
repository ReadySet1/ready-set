/**
 * Open-shift resolution for the driver movement gate and the deliveries mirror.
 *
 * The orders status PATCH (a) refuses to move a DRIVER into a movement status
 * without an open shift — no shift, no GPS trail — and (b) mirrors driver
 * progress into the standalone `deliveries` table, stamping `shift_id` there
 * so the `update_shift_delivery_count()` trigger can attribute a completed
 * delivery to the shift. Without it, `driver_shifts.delivery_count` never moves.
 *
 * "Open" is `status IN ('active', 'paused') AND deleted_at IS NULL` — the one
 * definition shared with the client (`useDriverShift.isShiftActive`), the
 * `getActiveShift` action, and the one-open-shift-per-driver partial unique
 * index. A paused shift (driver on break) keeps the web and native GPS
 * watchers running and `POST /api/tracking/locations` keeps accepting pings,
 * so it must satisfy the gate too; and because at most one open shift exists
 * per driver, stamping the paused one on the mirror is unambiguous.
 *
 * IMPORTANT id linkage: dispatches carry the driver's PROFILE id, while both
 * `deliveries.driver_id` and `driver_shifts.driver_id` reference the
 * `drivers.id` row (see src/lib/auth/driver-ownership.ts for the
 * profile_id/user_id linkage). Callers must pass the resolved `drivers.id`.
 */

import { prisma } from '@/utils/prismaDB';
import { getDriverForUser } from '@/lib/auth/driver-ownership';

/** Shift statuses that count as "open" — mirrors `useDriverShift.isShiftActive`. */
export const OPEN_SHIFT_STATUSES = ['active', 'paused'] as const;

/**
 * Resolve the most recent OPEN (active or paused) shift for a driver
 * (`drivers.id`). Fails open to null on a lookup error so the deliveries
 * mirror simply stays unattributed. NOTE: for the driver movement gate
 * (`resolveOpenShiftIdForUser`) null is a *block* — a shift-lookup error
 * therefore surfaces as SHIFT_REQUIRED rather than a 500, which is the safer
 * failure for GPS coverage.
 */
export async function resolveOpenShiftIdForDriver(
  driverId: string | null | undefined,
): Promise<string | null> {
  if (!driverId) return null;
  try {
    const shift = await prisma.driverShift.findFirst({
      where: { driverId, status: { in: [...OPEN_SHIFT_STATUSES] }, deletedAt: null },
      orderBy: { shiftStart: 'desc' },
      select: { id: true },
    });
    return shift?.id ?? null;
  } catch (error) {
    console.error('Failed to resolve open shift for driver:', error);
    return null;
  }
}

/**
 * Resolve the open shift for an authenticated user — the caller of a driver
 * status PATCH. Goes through driver-ownership so both link columns
 * (`profile_id` / legacy `user_id`) resolve to the `drivers` row. Null means
 * "no drivers row or no open shift"; the orders PATCH turns that into
 * 422 SHIFT_REQUIRED when a DRIVER tries to enter a movement status.
 */
export async function resolveOpenShiftIdForUser(
  authUserId: string,
): Promise<string | null> {
  const driver = await getDriverForUser(authUserId);
  return resolveOpenShiftIdForDriver(driver?.id ?? null);
}
