/**
 * Ready Set — Separator (v2)
 * components/ui/separator.tsx
 *
 * Drop-in replacement. Wraps Radix Separator with v2 tokens and adds an
 * optional `label` prop for the "section divider with inline text"
 * pattern (uppercase mono caps in muted-foreground, matching the v2
 * scannability vocabulary).
 *
 * Peer deps: react, @radix-ui/react-separator, class-variance-authority,
 *            clsx, tailwind-merge.
 */
"use client";

import * as React from "react";
import * as SeparatorPrimitive from "@radix-ui/react-separator";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const separatorVariants = cva("shrink-0 bg-border", {
  variants: {
    orientation: {
      horizontal: "h-px w-full",
      vertical: "w-px h-full self-stretch",
    },
    tone: {
      default: "bg-border",
      strong: "bg-neutral-300 dark:bg-neutral-600",
      subtle: "bg-border/60",
    },
  },
  defaultVariants: {
    orientation: "horizontal",
    tone: "default",
  },
});

export interface SeparatorProps
  extends Omit<
      React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>,
      "orientation"
    >,
    VariantProps<typeof separatorVariants> {
  /**
   * When set, renders a labeled separator: line · uppercase caption · line.
   * Horizontal orientation only. Implies `decorative` (visual divider, the
   * label carries the semantic intent).
   */
  label?: React.ReactNode;
}

const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  SeparatorProps
>(
  (
    {
      className,
      orientation = "horizontal",
      tone = "default",
      decorative = true,
      label,
      ...props
    },
    ref
  ) => {
    // ── Labeled (horizontal only) ─────────────────────────────────
    if (label && orientation === "horizontal") {
      return (
        <div
          ref={ref as unknown as React.Ref<HTMLDivElement>}
          role={decorative ? "presentation" : "separator"}
          className={cn(
            "flex items-center gap-3 w-full text-muted-foreground",
            className
          )}
        >
          <span
            aria-hidden="true"
            className={cn("flex-1", separatorVariants({ orientation, tone }))}
          />
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] whitespace-nowrap">
            {label}
          </span>
          <span
            aria-hidden="true"
            className={cn("flex-1", separatorVariants({ orientation, tone }))}
          />
        </div>
      );
    }

    // ── Plain Radix separator ─────────────────────────────────────
    return (
      <SeparatorPrimitive.Root
        ref={ref}
        decorative={decorative}
        orientation={orientation ?? "horizontal"}
        className={cn(separatorVariants({ orientation, tone }), className)}
        {...props}
      />
    );
  }
);
Separator.displayName = SeparatorPrimitive.Root?.displayName ?? "Separator";

export { Separator, separatorVariants };
