import { getUserRole } from '@/lib/auth';
import { getActionCaller, type ActionCaller } from '@/lib/auth/driver-ownership';

/**
 * Resolve the caller of an admin-dashboard server action, or null when the
 * caller is not signed in or is not staff (ADMIN / SUPER_ADMIN / HELPDESK —
 * the audience route protection lets into /admin/*).
 *
 * Server actions are plain POST endpoints: the /admin/* middleware does not
 * protect them, so every admin action must call this itself.
 */
export async function getStaffCaller(): Promise<ActionCaller | null> {
  const caller = await getActionCaller();
  if (!caller) return null;
  if (caller.isPrivileged) return caller;

  const role = (await getUserRole(caller.userId))?.toUpperCase();
  return role === 'HELPDESK' ? caller : null;
}
