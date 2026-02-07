/**
 * Admin Archive Dashboard Page (REA-313)
 *
 * Server component wrapper for the archive management dashboard.
 * Provides authentication check and renders the client component.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import ArchiveClient from "./ArchiveClient";

interface AppMetadata {
  role?: string;
}

export default async function ArchivePage() {
  // Check authentication and authorization
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const isAdmin = (user.app_metadata as AppMetadata)?.role === "admin";
  const isSuperAdmin = (user.app_metadata as AppMetadata)?.role === "super_admin";

  if (!isAdmin && !isSuperAdmin) {
    redirect("/admin");
  }

  return <ArchiveClient />;
}
