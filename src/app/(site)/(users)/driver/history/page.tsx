/**
 * Driver History Page (REA-313)
 *
 * Server component wrapper for the driver history view.
 * Authenticates the driver and fetches their driver ID.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/utils/prismaDB";
import HistoryClient from "./HistoryClient";

export default async function DriverHistoryPage() {
  // Check authentication
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Find driver record for this user
  const driver = await prisma.driver.findFirst({
    where: {
      profile: {
        id: user.id,
      },
      deletedAt: null,
    },
    select: {
      id: true,
      profile: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!driver) {
    // User is not a driver, redirect to home
    redirect("/");
  }

  return (
    <HistoryClient
      driverId={driver.id}
      driverName={driver.profile?.name || "Driver"}
    />
  );
}
