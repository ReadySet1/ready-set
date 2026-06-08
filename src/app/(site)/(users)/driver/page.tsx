"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  Clock,
  History,
  Navigation,
  Package,
} from "lucide-react";
import { useDriverTracking } from "@/contexts/DriverTrackingContext";
import { useUser } from "@/contexts/UserContext";
import { clearAuthCookies } from "@/utils/auth/cookies";
import { createClient } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";
import {
  DriverCard,
  DriverScreen,
  formatDurationShort,
} from "@/components/Driver/ui";
import { DriverProfileSheet } from "@/components/Driver/ui/DriverProfileSheet";
import { DriverStatsPanel } from "@/components/Driver/DriverStatsPanel";
import { DriverDeliveryList } from "@/components/Driver/DriverDeliveryList";

export default function DriverHomePage() {
  const { logout } = useUser();
  const supabase = createClient();
  const { isShiftActive, currentShift, activeDeliveries } = useDriverTracking();

  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(new Date());
  const [driverName, setDriverName] = useState("Driver");
  const [driverId, setDriverId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const profileRes = await fetch("/api/profile");
        if (!profileRes.ok) return;
        const profile = await profileRes.json();
        setDriverName(profile.name || profile.firstName || "Driver");

        const driverRes = await fetch("/api/tracking/drivers?limit=1");
        if (driverRes.ok) {
          const driverData = await driverRes.json();
          if (driverData.success && driverData.data?.length > 0) {
            setDriverId(driverData.data[0].id);
          }
        }
      } catch (err) {
        console.error("Error fetching driver info:", err);
      }
    })();
  }, []);

  const greeting = useMemo(() => {
    const h = now.getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  }, [now]);

  const dateLabel = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const timeLabel = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const shiftSeconds = currentShift?.startTime
    ? Math.floor((now.getTime() - new Date(currentShift.startTime).getTime()) / 1000)
    : 0;
  const activeCount = activeDeliveries?.length ?? 0;

  const handleSignOut = async () => {
    try {
      clearAuthCookies();
      await supabase.auth.signOut();
      await logout?.();
    } catch (err) {
      console.error("Error signing out:", err);
    } finally {
      window.location.href = "/sign-in";
    }
  };

  const header = (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-bold text-driver-muted" suppressHydrationWarning>
          {mounted ? `${dateLabel} · ${timeLabel}` : ""}
        </div>
        <h1 className="mt-0.5 text-driver-node font-extrabold leading-tight text-driver-text">
          {greeting},{" "}
          <span className="text-driver-on-brand">{driverName}</span>
        </h1>
        <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-driver-surface-alt px-2.5 py-1">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              isShiftActive
                ? "animate-driver-pulse bg-driver-success"
                : "bg-driver-subtle",
            )}
          />
          <span className="text-[11.5px] font-extrabold text-driver-muted">
            {isShiftActive ? "On shift" : "Off shift"}
          </span>
        </div>
      </div>
      <DriverProfileSheet driverName={driverName} onSignOut={handleSignOut} />
    </div>
  );

  return (
    <DriverScreen header={header}>
      <div className="space-y-6">
        {/* Entry cards */}
        <div className="space-y-3">
          <Link href="/driver/tracking" className="block">
            <DriverCard
              interactive
              className={cn(
                "flex items-center gap-3.5",
                isShiftActive && "bg-gradient-to-br from-driver-brand/15 to-transparent",
              )}
            >
              <span className="flex h-driver-control w-driver-control shrink-0 items-center justify-center rounded-2xl bg-driver-brand text-driver-brand-ink">
                <Navigation className="h-6 w-6" strokeWidth={2.2} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[15.5px] font-extrabold text-driver-text">
                  {isShiftActive ? "Active shift" : "Start shift"}
                </div>
                <div className="text-[12.5px] font-semibold text-driver-muted">
                  {isShiftActive
                    ? "Track location & manage deliveries"
                    : "Begin tracking your shift & location"}
                </div>
                {isShiftActive && currentShift?.startTime ? (
                  <div className="mt-1 inline-flex items-center gap-1 text-[11.5px] font-bold text-driver-on-brand">
                    <Clock className="h-3.5 w-3.5" />
                    Active for {formatDurationShort(shiftSeconds)}
                  </div>
                ) : null}
              </div>
              <ChevronRight className="h-5 w-5 text-driver-subtle" strokeWidth={2.4} />
            </DriverCard>
          </Link>

          <div className="grid grid-cols-2 gap-3">
            <Link href="/driver/tracking" className="block">
              <DriverCard interactive className="flex h-full flex-col gap-2">
                <Package className="h-6 w-6 text-driver-on-brand" strokeWidth={2.2} />
                <div className="text-[13.5px] font-extrabold text-driver-text">
                  My deliveries
                </div>
                <div className="mt-auto text-[11.5px] font-semibold text-driver-muted">
                  {activeCount} active
                </div>
              </DriverCard>
            </Link>

            <Link href="/driver/history" className="block">
              <DriverCard interactive className="flex h-full flex-col gap-2">
                <History className="h-6 w-6 text-driver-on-brand" strokeWidth={2.2} />
                <div className="text-[13.5px] font-extrabold text-driver-text">
                  View history
                </div>
                <div className="mt-auto text-[11.5px] font-semibold text-driver-muted">
                  Past 12 weeks
                </div>
              </DriverCard>
            </Link>
          </div>
        </div>

        {driverId ? <DriverStatsPanel driverId={driverId} /> : null}

        <DriverDeliveryList />
      </div>
    </DriverScreen>
  );
}
