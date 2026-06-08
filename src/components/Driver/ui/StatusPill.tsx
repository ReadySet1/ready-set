"use client";

import { cn } from "@/lib/utils";
import { DriverStatus } from "@/types/user";
import { resolveDriverStatus } from "./status-config";

interface StatusPillProps {
  status: DriverStatus | string | null | undefined;
  size?: "sm" | "md";
  className?: string;
}

/** Semantic status pill: tinted bg + ink text + solid accent dot. The color is
 *  derived from the status "kind" (motion=blue / action=amber / done=green). */
export function StatusPill({ status, size = "md", className }: StatusPillProps) {
  const { label, classes } = resolveDriverStatus(status);
  const sm = size === "sm";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-extrabold",
        sm ? "px-2.5 py-0.5 text-[11.5px]" : "px-3 py-1 text-[12.5px]",
        classes.bg,
        classes.ink,
        className,
      )}
    >
      <span
        className={cn(
          "shrink-0 rounded-full",
          sm ? "h-1.5 w-1.5" : "h-driver-dot w-driver-dot",
          classes.dot,
        )}
      />
      {label}
    </span>
  );
}
