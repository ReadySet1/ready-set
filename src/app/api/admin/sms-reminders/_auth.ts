import { createClient } from "@/utils/supabase/server";
import type { User } from "@supabase/supabase-js";

export type AdminAuthResult =
  | { authorized: true; user: User; userType: string }
  | { authorized: false; status: 401 | 403 };

/**
 * Authorize an SMS-reminder admin request using the project's canonical
 * `profiles.type` field. The rest of the codebase (middleware, admin pages)
 * uses this same pattern; relying on `app_metadata.role` would silently lock
 * out real admins whose Supabase metadata isn't populated.
 *
 * `requireWriteRole`: if true (send route), only admin/super_admin pass;
 * helpdesk is read-only.
 */
export async function authorizeSmsAdmin(
  requireWriteRole = false,
): Promise<AdminAuthResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { authorized: false, status: 401 };

  const { data: profile } = await supabase
    .from("profiles")
    .select("type")
    .eq("id", user.id)
    .maybeSingle();

  const userType = (profile?.type ?? "").toLowerCase();
  const allowed = requireWriteRole
    ? ["admin", "super_admin"]
    : ["admin", "super_admin", "helpdesk"];

  if (!allowed.includes(userType)) {
    return { authorized: false, status: 403 };
  }

  return { authorized: true, user, userType };
}
