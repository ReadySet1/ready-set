"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "brand" | "dark" | "outline" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg";

interface DriverButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  full?: boolean;
  loading?: boolean;
}

const VARIANT: Record<Variant, string> = {
  brand:
    "bg-driver-brand text-driver-brand-ink font-extrabold hover:bg-driver-brand-hover shadow-driver-sm",
  dark: "bg-slate-900 text-white font-bold hover:bg-slate-800 dark:bg-driver-surface-alt dark:hover:bg-driver-border",
  outline:
    "border-[1.5px] border-driver-border bg-transparent text-driver-text font-bold hover:bg-driver-surface-alt",
  ghost: "bg-transparent text-driver-muted font-bold hover:bg-driver-surface-alt",
  danger:
    "border-[1.5px] border-driver-error bg-driver-error-bg text-driver-error-ink font-bold hover:bg-driver-error hover:text-white",
  success:
    "border-[1.5px] border-driver-success bg-driver-success-bg text-driver-success-ink font-bold hover:bg-driver-success hover:text-white",
};

const SIZE: Record<Size, string> = {
  sm: "h-10 px-3.5 text-[13.5px] rounded-[11px]",
  md: "h-driver-control px-5 text-driver-pip rounded-[13px]",
  lg: "h-driver-action-lg px-6 text-[16.5px] rounded-driver-pip",
};

/** Driver-themed button. Mirrors the handoff's Btn variants/sizes (≥48px for
 *  md/lg primary controls). */
export const DriverButton = React.forwardRef<
  HTMLButtonElement,
  DriverButtonProps
>(function DriverButton(
  {
    variant = "dark",
    size = "md",
    full,
    loading,
    disabled,
    className,
    children,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 border border-transparent transition-all active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50",
        SIZE[size],
        VARIANT[variant],
        full && "w-full",
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} /> : null}
      {children}
    </button>
  );
});
