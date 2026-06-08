"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Adds hover elevation + pointer affordance (use with onClick). */
  interactive?: boolean;
}

/** Base driver surface card: rounded-2xl, hairline border, soft shadow. */
export const DriverCard = React.forwardRef<HTMLDivElement, CardProps>(
  function DriverCard({ className, interactive, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-2xl border border-driver-border bg-driver-surface p-4 shadow-driver-sm",
          interactive &&
            "cursor-pointer transition-all hover:-translate-y-px hover:shadow-driver",
          className,
        )}
        {...props}
      />
    );
  },
);
