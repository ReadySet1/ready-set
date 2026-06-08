"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatTileProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sub?: string;
  /** Trend delta, e.g. "+12%" (green) or "-3%" (red). */
  delta?: string;
  /** Solid amber icon chip instead of the tinted default. */
  accent?: boolean;
  className?: string;
}

/** Compact performance metric tile: amber icon chip + value + label + optional
 *  trend delta / sub-label. */
export function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  delta,
  accent,
  className,
}: StatTileProps) {
  const down = delta?.startsWith("-");
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-0.5 rounded-2xl border border-driver-border bg-driver-surface p-3.5 shadow-driver-sm",
        className,
      )}
    >
      <div className="mb-1.5 flex items-center justify-between">
        <span
          className={cn(
            "flex h-driver-glyph w-driver-glyph items-center justify-center rounded-[9px]",
            accent
              ? "bg-driver-brand text-driver-brand-ink"
              : "bg-driver-brand/15 text-driver-on-brand",
          )}
        >
          <Icon className="h-4 w-4" strokeWidth={2.2} />
        </span>
        {delta ? (
          <span
            className={cn(
              "text-[11px] font-extrabold",
              down ? "text-driver-error" : "text-driver-success",
            )}
          >
            {delta}
          </span>
        ) : null}
      </div>
      <div className="text-[20px] font-extrabold leading-[1.05] tracking-[-0.02em] text-driver-text">
        {value}
      </div>
      <div className="text-[11px] font-bold leading-tight text-driver-muted">
        {label}
      </div>
      {sub ? (
        <div className="text-[10.5px] font-semibold text-driver-subtle">{sub}</div>
      ) : null}
    </div>
  );
}
