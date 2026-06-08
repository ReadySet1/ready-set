"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useDriverTracking } from "@/contexts/DriverTrackingContext";
import { formatDuration } from "./format";

/** Floating "on shift" pill shown above the bottom nav whenever a shift is
 *  active and the driver isn't already on Live Tracking or a Delivery Detail.
 *  Replaces the legacy DriverTrackingIndicator. Taps through to Live Tracking. */
export function ShiftPill() {
  const pathname = usePathname() ?? "";
  const { isShiftActive, currentShift, activeDeliveries } = useDriverTracking();
  const [elapsed, setElapsed] = useState(0);

  const startedAt = currentShift?.startTime
    ? new Date(currentShift.startTime).getTime()
    : null;

  useEffect(() => {
    if (!isShiftActive || !startedAt) return;
    const tick = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isShiftActive, startedAt]);

  const hideOnRoute =
    pathname.startsWith("/driver/tracking") ||
    pathname.startsWith("/driver/deliveries/");

  if (!isShiftActive || hideOnRoute) return null;

  const activeCount = activeDeliveries?.length ?? 0;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4"
      style={{ bottom: "calc(74px + env(safe-area-inset-bottom))" }}
    >
      <Link
        href="/driver/tracking"
        className="pointer-events-auto flex w-full max-w-md items-center gap-2.5 rounded-full bg-driver-brand px-4 py-2.5 text-driver-brand-ink shadow-driver"
      >
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-driver-ping rounded-full bg-driver-success opacity-70" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-driver-success" />
        </span>
        <span className="text-[13px] font-extrabold">On shift</span>
        {startedAt ? (
          <span className="font-mono text-[13px] font-bold tabular-nums">
            {formatDuration(elapsed)}
          </span>
        ) : null}
        <div className="flex-1" />
        {activeCount > 0 ? (
          <span className="text-[12.5px] font-bold opacity-80">
            {activeCount} active
          </span>
        ) : null}
        <ChevronRight className="h-4 w-4" strokeWidth={2.6} />
      </Link>
    </div>
  );
}
