import { prisma } from '@/utils/prismaDB';
import { createClient } from '@/utils/supabase/server';
import { getUserRole } from '@/lib/auth';

/**
 * Driver ↔ auth-user linkage.
 *
 * The `drivers` table carries two columns that can point at the authenticated
 * user, in one id space (`profiles.id` === `auth.users.id` === auth uid):
 *
 *  - `profile_id` — the canonical link: unique, FK to `profiles.id`.
 *  - `user_id`    — a legacy duplicate (FK to `auth.users.id`, which the
 *                   Prisma schema does not model); NULL on most rows.
 *
 * Ownership checks MUST accept either column until `user_id` is backfilled
 * and dropped. Checking `user_id` alone denies every driver whose row only
 * has `profile_id` set (most of them) — drivers resolve their own record via
 * `profile_id` (see /api/auth/session) and then get 403s on every write.
 *
 * All driver-ownership decisions belong in this module. Do not inline
 * `user_id = $n` (or `profile_id = $n`) checks in routes.
 */

/**
 * SQL fragment matching a drivers row linked to the auth user via either
 * column. For routes that must embed the condition in a larger query (e.g.
 * inside a pg transaction). `paramIndex` is the 1-based placeholder position
 * of the auth user id; it may be referenced by other parts of the query too.
 */
export function driverOwnershipCondition(paramIndex: number, alias = ''): string {
  const p = alias ? `${alias}.` : '';
  return `(${p}profile_id = $${paramIndex}::uuid OR ${p}user_id = $${paramIndex}::uuid)`;
}

export interface ActionCaller {
  userId: string;
  isPrivileged: boolean;
}

/**
 * Resolve the authenticated caller of a server action. Server actions are
 * plain POST endpoints — every action that reads or mutates driver data must
 * authenticate the caller itself; nothing upstream does it for them.
 * Returns null when unauthenticated.
 */
export async function getActionCaller(): Promise<ActionCaller | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const role = (await getUserRole(user.id))?.toUpperCase();
  return {
    userId: user.id,
    isPrivileged: role === 'ADMIN' || role === 'SUPER_ADMIN',
  };
}

/**
 * Owner-or-admin gate for server actions acting on a driver's data:
 * admins may act on any driver; everyone else only on their own driver row.
 */
export async function callerMayActOnDriver(
  driverId: string | null | undefined
): Promise<boolean> {
  const caller = await getActionCaller();
  if (!caller) return false;
  if (caller.isPrivileged) return true;
  return userOwnsDriver(driverId, caller.userId);
}

export interface DriverIdentity {
  id: string;
  isActive: boolean;
  currentShiftId: string | null;
}

/** Resolve the (non-deleted) driver row belonging to an authenticated user. */
export async function getDriverForUser(
  authUserId: string
): Promise<DriverIdentity | null> {
  const rows = await prisma.$queryRawUnsafe<
    { id: string; is_active: boolean; current_shift_id: string | null }[]
  >(
    `
    SELECT id, is_active, current_shift_id
    FROM drivers
    WHERE ${driverOwnershipCondition(1)}
    AND deleted_at IS NULL
    LIMIT 1
  `,
    authUserId
  );

  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    isActive: row.is_active,
    currentShiftId: row.current_shift_id,
  };
}

/**
 * True when the given drivers row belongs to the authenticated user.
 * `driverId` may be null/undefined (e.g. an unassigned delivery) — that is
 * never owned.
 */
export async function userOwnsDriver(
  driverId: string | null | undefined,
  authUserId: string,
  opts: { requireActive?: boolean } = {}
): Promise<boolean> {
  if (!driverId) return false;

  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `
    SELECT id
    FROM drivers
    WHERE id = $1::uuid
    AND ${driverOwnershipCondition(2)}
    AND deleted_at IS NULL
    ${opts.requireActive ? 'AND is_active = true' : ''}
    LIMIT 1
  `,
    driverId,
    authUserId
  );

  return rows.length > 0;
}
