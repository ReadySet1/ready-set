/**
 * Ready Set — Tooltip (v2)
 * components/ui/tooltip.tsx
 *
 * Drop-in replacement. Wraps Radix Tooltip with v2 tokens, two tones
 * (`default` light tooltip on dark popover; `inverse` dark-on-light for
 * use inside dark surfaces), two sizes (sm / default), and an optional
 * arrow.
 *
 * Includes a re-exported `TooltipProvider` — every Tooltip needs one
 * somewhere up the tree. Wrap your app root once.
 *
 * Peer deps: react, @radix-ui/react-tooltip, class-variance-authority,
 *            clsx, tailwind-merge.
 */
"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const tooltipContentVariants = cva(
  [
    "z-50 overflow-hidden",
    "rounded-md font-medium",
    "shadow-md",
    // Entry / exit
    "animate-in fade-in-0 zoom-in-95",
    "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
    "data-[side=bottom]:slide-in-from-top-1",
    "data-[side=left]:slide-in-from-right-1",
    "data-[side=right]:slide-in-from-left-1",
    "data-[side=top]:slide-in-from-bottom-1",
  ].join(" "),
  {
    variants: {
      tone: {
        /**
         * Default — high contrast, dark on light surfaces.
         * Background = neutral-900, fg = neutral-50. Works in both modes.
         */
        default: "bg-neutral-900 text-neutral-50",
        /**
         * Inverse — light tooltip for use inside already-dark surfaces.
         */
        inverse: "bg-neutral-50 text-neutral-900 border border-border",
        /**
         * Brand — yellow accent. Use sparingly for promotional/onboarding hints.
         */
        brand: "bg-brand-400 text-neutral-900",
      },
      size: {
        sm: "px-2 py-1 text-[11px] leading-snug",
        default: "px-2.5 py-1.5 text-xs leading-snug",
      },
    },
    defaultVariants: {
      tone: "default",
      size: "default",
    },
  }
);

const arrowToneClass: Record<
  NonNullable<VariantProps<typeof tooltipContentVariants>["tone"]>,
  string
> = {
  default: "fill-neutral-900",
  inverse: "fill-neutral-50",
  brand: "fill-brand-400",
};

// ── Provider / Root / Trigger / Portal (re-exports) ────────────────
const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;
const TooltipPortal = TooltipPrimitive.Portal;

// ── Content ────────────────────────────────────────────────────────
export interface TooltipContentProps
  extends React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>,
    VariantProps<typeof tooltipContentVariants> {
  /** Render a small arrow pointing at the trigger. Default true. */
  arrow?: boolean;
}

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  TooltipContentProps
>(
  (
    {
      className,
      tone = "default",
      size = "default",
      sideOffset = 6,
      arrow = true,
      children,
      ...props
    },
    ref
  ) => (
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(tooltipContentVariants({ tone, size }), className)}
      {...props}
    >
      {children}
      {arrow ? (
        <TooltipPrimitive.Arrow
          width={10}
          height={5}
          className={arrowToneClass[tone ?? "default"]}
        />
      ) : null}
    </TooltipPrimitive.Content>
  )
);
TooltipContent.displayName = TooltipPrimitive.Content?.displayName ?? "TooltipContent";

export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  TooltipPortal,
  tooltipContentVariants,
};
