"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { DriverStatus } from "@/types/user";
import {
  DRIVER_STAGE_CONFIG,
  getStatusIndex,
  STATUS_ORDER,
} from "./status-config";

interface StatusTimelineProps {
  status: DriverStatus | string | null | undefined;
  /** Optional ISO/display timestamps keyed by DriverStatus for completed steps. */
  timestamps?: Partial<Record<DriverStatus, string>>;
  compact?: boolean;
  className?: string;
}

/** Vertical 7-step lifecycle timeline. Completed = green check (+ timestamp),
 *  current = amber dot with ring + "In progress now", upcoming = hollow. */
export function StatusTimeline({
  status,
  timestamps,
  compact,
  className,
}: StatusTimelineProps) {
  const cur = getStatusIndex(status);

  return (
    <div className={cn("flex flex-col", className)}>
      {STATUS_ORDER.map((stage, i) => {
        const done = i < cur;
        const active = i === cur;
        const cfg = DRIVER_STAGE_CONFIG[stage];
        const ts = timestamps?.[stage];
        const isLast = i === STATUS_ORDER.length - 1;

        return (
          <div
            key={stage}
            className={cn("flex gap-3", compact ? "min-h-driver-glyph" : "min-h-driver-glyph-lg")}
          >
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-driver-node w-driver-node shrink-0 items-center justify-center rounded-full border-2",
                  done && "border-driver-success bg-driver-success",
                  active && "border-driver-brand bg-driver-brand ring-4 ring-driver-brand/20",
                  !done && !active && "border-driver-border bg-driver-surface",
                )}
              >
                {done ? (
                  <Check className="h-3 w-3 text-white" strokeWidth={3.5} />
                ) : active ? (
                  <span className="h-driver-dot w-driver-dot rounded-full bg-driver-brand-ink" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-driver-subtle" />
                )}
              </div>
              {!isLast ? (
                <div
                  className={cn(
                    "w-0.5 flex-1",
                    compact ? "min-h-driver-rail-sm" : "min-h-driver-rail",
                    i < cur ? "bg-driver-success" : "bg-driver-border",
                  )}
                />
              ) : null}
            </div>

            <div className={cn(compact ? "pb-2" : "pb-3", "pt-px")}>
              <div
                className={cn(
                  "text-[13.5px]",
                  active
                    ? "font-extrabold text-driver-text"
                    : done
                      ? "font-bold text-driver-text"
                      : "font-semibold text-driver-subtle",
                )}
              >
                {cfg.label}
              </div>
              {active ? (
                <div className="text-[11.5px] font-semibold text-driver-on-brand">
                  In progress now
                </div>
              ) : done && ts ? (
                <div className="text-[11.5px] font-semibold text-driver-muted">
                  {ts}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
