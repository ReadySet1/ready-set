import { getUserRole } from '@/lib/auth';

/**
 * The admin rule: ADMIN or SUPER_ADMIN, compared case-insensitively.
 *
 * Roles come from `profiles.type` (resolved by `getUserRole`). Never authorize
 * on Supabase `app_metadata.role` — nothing in the app sets it, so checks
 * against it lock out every real staff account.
 */
export function isAdminRole(role: string | null | undefined): boolean {
  const upper = role?.toUpperCase();
  return upper === 'ADMIN' || upper === 'SUPER_ADMIN';
}

/** True when the user's profile role is ADMIN or SUPER_ADMIN. */
export async function hasAdminRole(userId: string): Promise<boolean> {
  return isAdminRole(await getUserRole(userId));
}
