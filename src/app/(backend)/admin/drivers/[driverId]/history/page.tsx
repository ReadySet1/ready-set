/**
 * Admin Driver History Page (REA-313)
 *
 * Server component wrapper for admin viewing a driver's history.
 * Authenticates the admin and validates the driver exists.
 */

import { redirect, notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/utils/prismaDB";
import AdminHistoryClient from "./AdminHistoryClient";

interface AppMetadata {
  role?: string;
}

interface PageProps {
  params: Promise<{ driverId: string }>;
}

export default async function AdminDriverHistoryPage({ params }: PageProps) {
  const { driverId } = await params;

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

  // Find the driver
  const driver = await prisma.driver.findUnique({
    where: {
      id: driverId,
    },
    select: {
      id: true,
      employeeId: true,
      profile: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  if (!driver) {
    notFound();
  }

  return (
    <AdminHistoryClient
      driverId={driver.id}
      driverName={driver.profile?.name || "Unknown Driver"}
      driverEmail={driver.profile?.email || undefined}
      employeeId={driver.employeeId || undefined}
    />
  );
}
