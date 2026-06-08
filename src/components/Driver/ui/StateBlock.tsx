"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface StateBlockProps {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: React.ReactNode;
  className?: string;
}

/** Centered empty / error state: icon chip + title + body + optional action. */
export function StateBlock({
  icon: Icon,
  title,
  body,
  action,
  className,
}: StateBlockProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1.5 px-7 py-12 text-center",
        className,
      )}
    >
      <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-[20px] border border-driver-border bg-driver-surface-alt text-driver-subtle">
        <Icon className="h-driver-glyph w-driver-glyph" strokeWidth={1.8} />
      </div>
      <div className="text-[16.5px] font-extrabold text-driver-text">{title}</div>
      {body ? (
        <div className="max-w-driver-prose text-[13.5px] font-medium leading-relaxed text-driver-muted">
          {body}
        </div>
      ) : null}
      {action ? <div className="mt-2.5">{action}</div> : null}
    </div>
  );
}

interface SpinnerProps {
  size?: number;
  className?: string;
}

/** Small brand-tinted spinner. */
export function Spinner({ size = 22, className }: SpinnerProps) {
  return (
    <Loader2
      className={cn("animate-spin text-driver-brand", className)}
      style={{ width: size, height: size }}
      strokeWidth={2.5}
    />
  );
}
