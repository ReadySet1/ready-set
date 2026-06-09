/**
 * Driver History Page (REA-313)
 *
 * Server component wrapper for the driver history view.
 * Authenticates the driver and fetches their driver ID.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { prisma, withDatabaseRetry } from "@/utils/prismaDB";
import HistoryClient from "./HistoryClient";
import HistoryUnavailable from "./HistoryUnavailable";

export default async function DriverHistoryPage() {
  // Check authentication
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Find driver record for this user. This server-side DB call is what made the
  // page 500 under connection-pool pressure — retry transient failures, then
  // degrade gracefully (a retryable fallback) instead of throwing a hard 500.
  let driver: { id: string; profile: { name: string | null } | null } | null;
  try {
    driver = await withDatabaseRetry(
      () =>
        prisma.driver.findFirst({
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
        }),
      2,
      "driver-history-lookup",
    );
  } catch (error) {
    console.error("Driver history lookup failed:", error);
    return <HistoryUnavailable />;
  }

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
