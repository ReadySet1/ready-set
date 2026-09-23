import { headers } from 'next/headers';
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
 *
 * `alias` is interpolated raw into SQL — it must ALWAYS be a hardcoded
 * literal at the call site, never request-derived data.
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
 * Authenticate the caller of a server action / route: Bearer token first,
 * then cookies. One Supabase Auth round trip in the common case. Returns the
 * auth user id, or null when unauthenticated.
 */
async function getActionCallerId(): Promise<string | null> {
  const supabase = await createClient();

  let user: { id: string } | null = null;

  // Prefer the Bearer token when the caller sent one. 2026-08 field failure
  // (iOS Safari): the auth cookies went stale mid-shift while the client's
  // in-memory session stayed valid — cookie-only getUser() 401'd every driver
  // action. headers() reads the request the action/route is serving.
  try {
    const authHeader = (await headers()).get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice('Bearer '.length);
      const { data } = await supabase.auth.getUser(token);
      user = data.user;
    }
  } catch {
    // headers() throws outside a request scope — fall back to cookies.
  }

  if (!user) {
    const {
      data: { user: cookieUser },
    } = await supabase.auth.getUser();
    user = cookieUser;
  }
  return user?.id ?? null;
}

function isPrivilegedRole(role: string | null | undefined): boolean {
  const upper = role?.toUpperCase();
  return upper === 'ADMIN' || upper === 'SUPER_ADMIN';
}

/**
 * Resolve the authenticated caller of a server action. Server actions are
 * plain POST endpoints — every action that reads or mutates driver data must
 * authenticate the caller itself; nothing upstream does it for them.
 * Returns null when unauthenticated.
 */
export async function getActionCaller(): Promise<ActionCaller | null> {
  const userId = await getActionCallerId();
  if (!userId) return null;

  const role = await getUserRole(userId);
  return { userId, isPrivileged: isPrivilegedRole(role) };
}

export interface DriverActionAuthorization {
  /** Owner-or-admin decision for the target driver. */
  allowed: boolean;
  /** The resolved caller, for reuse within the same action. Null when unauthenticated. */
  caller: ActionCaller | null;
}

/**
 * Owner-or-admin gate for server actions acting on a driver's data, returning
 * the resolved caller as well so the action never re-authenticates.
 *
 * Latency: the database sits ~150 ms from the app server, so this runs the
 * Supabase Auth lookup concurrently with however the caller is still
 * resolving `driverId` (pass a promise, e.g. derived from the shift row), and
 * the role and ownership lookups concurrently with each other. The decision
 * is identical to checking them one after the other: privileged callers are
 * allowed regardless of ownership (an ownership-lookup failure never blocks
 * them), everyone else must own the driver row.
 */
export async function authorizeDriverAction(
  driverId: string | null | undefined | Promise<string | null | undefined>
): Promise<DriverActionAuthorization> {
  const [userId, targetDriverId] = await Promise.all([
    getActionCallerId(),
    driverId,
  ]);
  if (!userId) return { allowed: false, caller: null };

  const ownership = userOwnsDriver(targetDriverId, userId).then(
    (owns) => ({ ok: true as const, owns }),
    (error: unknown) => ({ ok: false as const, error })
  );
  const [role, owned] = await Promise.all([getUserRole(userId), ownership]);

  const caller: ActionCaller = { userId, isPrivileged: isPrivilegedRole(role) };
  if (caller.isPrivileged) return { allowed: true, caller };
  if (!owned.ok) throw owned.error;
  return { allowed: owned.owns, caller };
}

/**
 * Owner-or-admin gate for server actions acting on a driver's data:
 * admins may act on any driver; everyone else only on their own driver row.
 */
export async function callerMayActOnDriver(
  driverId: string | null | undefined
): Promise<boolean> {
  return (await authorizeDriverAction(driverId)).allowed;
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
