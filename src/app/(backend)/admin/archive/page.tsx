/**
 * Admin Archive Dashboard Page (REA-313)
 *
 * Server component wrapper for the archive management dashboard.
 * Provides authentication check and renders the client component.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { hasAdminRole } from "@/lib/auth/admin-role";
import ArchiveClient from "./ArchiveClient";

export default async function ArchivePage() {
  // Check authentication and authorization
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  if (!(await hasAdminRole(user.id))) {
    redirect("/admin");
  }

  return <ArchiveClient />;
}
