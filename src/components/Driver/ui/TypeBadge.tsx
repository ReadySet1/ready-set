"use client";

import { Package, Utensils } from "lucide-react";
import { cn } from "@/lib/utils";

export type DeliveryKind = "catering" | "on_demand";

interface TypeBadgeProps {
  type: DeliveryKind | string | null | undefined;
  className?: string;
}

/** Order-type badge: Catering (amber, utensils) / On-Demand (neutral, package). */
export function TypeBadge({ type, className }: TypeBadgeProps) {
  const catering = type === "catering" || type === "Catering";
  const Icon = catering ? Utensils : Package;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-extrabold uppercase tracking-[0.04em]",
        catering
          ? "border-driver-brand/40 bg-driver-brand/15 text-driver-on-brand"
          : "border-driver-border bg-driver-surface-alt text-driver-muted",
        className,
      )}
    >
      <Icon className="h-3 w-3" strokeWidth={2.4} />
      {catering ? "Catering" : "On-Demand"}
    </span>
  );
}
