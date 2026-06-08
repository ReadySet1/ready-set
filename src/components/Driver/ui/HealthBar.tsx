"use client";

import { BatteryFull, BatteryLow, BatteryMedium, Satellite } from "lucide-react";
import { cn } from "@/lib/utils";

interface HealthBarProps {
  online?: boolean;
  /** true = real-time channel connected; false = REST/standard fallback. */
  realtime?: boolean;
  /** GPS accuracy in meters (null when unknown). */
  gps?: number | null;
  /** Battery level 0–100 (null when unsupported). */
  battery?: number | null;
  /** Pending offline updates. */
  queued?: number;
  className?: string;
}

type Tone = "good" | "warn" | "bad" | "off";

const TONE_COLOR: Record<Tone, string> = {
  good: "text-driver-success",
  warn: "text-driver-warning",
  bad: "text-driver-error",
  off: "text-driver-subtle",
};

function gpsTone(gps: number | null | undefined): Tone {
  if (gps == null) return "off";
  if (gps < 50) return "good";
  if (gps <= 100) return "warn";
  return "bad";
}

function batteryTone(b: number | null | undefined): Tone {
  if (b == null) return "off";
  if (b > 40) return "good";
  if (b > 15) return "warn";
  return "bad";
}

/** Connection / device health bar — online state, channel mode, GPS accuracy,
 *  and battery. The driver must always trust this row, so colors are loud. */
export function HealthBar({
  online = true,
  realtime = true,
  gps,
  battery,
  queued = 0,
  className,
}: HealthBarProps) {
  const gTone = gpsTone(gps);
  const bTone = batteryTone(battery);
  const BatteryIcon =
    battery == null
      ? BatteryMedium
      : battery > 40
        ? BatteryFull
        : battery > 15
          ? BatteryMedium
          : BatteryLow;

  return (
    <div
      className={cn(
        "rounded-2xl border border-driver-border bg-driver-surface px-3.5 py-2.5 shadow-driver-sm",
        className,
      )}
    >
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "h-2.5 w-2.5 rounded-full ring-4",
              online
                ? "bg-driver-success ring-driver-success-bg"
                : "bg-driver-error ring-driver-error-bg",
            )}
          />
          <span className="text-[13px] font-extrabold text-driver-text">
            {online ? "Online" : "Offline"}
          </span>
        </div>

        <span className="rounded-full border border-driver-border bg-driver-surface-alt px-2 py-driver-hair text-[11px] font-bold text-driver-muted">
          {online ? (realtime ? "Real-time" : "Standard") : `${queued} queued`}
        </span>

        <div className="flex-1" />

        <div className="flex items-center gap-1.5">
          <Satellite className={cn("h-driver-pip w-driver-pip", TONE_COLOR[gTone])} strokeWidth={2.2} />
          <span className="text-[12.5px] font-extrabold text-driver-text">
            {gps == null ? "—" : `${Math.round(gps)}m`}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <BatteryIcon className={cn("h-driver-pip w-driver-pip", TONE_COLOR[bTone])} strokeWidth={2.2} />
          <span className="text-[12.5px] font-extrabold text-driver-text">
            {battery == null ? "—" : `${Math.round(battery)}%`}
          </span>
        </div>
      </div>
    </div>
  );
}
