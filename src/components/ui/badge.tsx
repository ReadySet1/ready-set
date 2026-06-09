/**
 * Ready Set — Badge (v2)
 * components/ui/badge.tsx
 *
 * Drop-in replacement. Adds semantic variants (success / warning / error /
 * info), a `dot` indicator for the scanning pattern (Linear / Vercel /
 * GitHub style), a `solid` variant for emphasis, and three sizes
 * (sm 18 / default 22 / lg 28).
 *
 * `variant="destructive"` is aliased to `"error"` for one release so
 * stock Shadcn call sites keep compiling — rename when convenient.
 *
 * Peer deps: react, @radix-ui/react-slot, class-variance-authority,
 *            clsx, tailwind-merge.
 */
"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  [
    "inline-flex items-center gap-1.5",
    "font-semibold whitespace-nowrap select-none",
    "transition-colors duration-150 ease-out",
    "focus-visible:outline-none",
    "focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-brand-100 text-brand-800 dark:bg-brand-900 dark:text-brand-100",
        solid: "bg-brand-400 text-neutral-900",
        outline:
          "border border-border text-foreground bg-transparent",
        secondary: "bg-muted text-muted-foreground",
        success:
          "bg-success-100 text-success-700 dark:bg-success-700/20 dark:text-success-500",
        warning:
          "bg-warning-100 text-warning-700 dark:bg-warning-700/20 dark:text-warning-500",
        error:
          "bg-error-100 text-error-700 dark:bg-error-700/20 dark:text-error-500",
        info:
          "bg-info-100 text-info-700 dark:bg-info-700/20 dark:text-info-500",
      },
      size: {
        sm: "h-[18px] px-1.5 text-[10px] uppercase tracking-[0.06em] rounded-[3px]",
        default:
          "h-[22px] px-2 text-[11px] uppercase tracking-[0.06em] rounded",
        lg: "h-7 px-2.5 text-xs rounded",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

// Public type for variants (alias `destructive` → `error` for backwards compat)
type BadgeVariant =
  | NonNullable<VariantProps<typeof badgeVariants>["variant"]>
  | "destructive";

const dotColors: Record<
  Exclude<BadgeVariant, "destructive">,
  string
> = {
  default: "bg-brand-500",
  solid: "bg-neutral-900",
  outline: "bg-foreground",
  secondary: "bg-muted-foreground",
  success: "bg-success-600",
  warning: "bg-warning-600",
  error: "bg-error-600",
  info: "bg-info-600",
};

const dotSizeClass: Record<
  NonNullable<VariantProps<typeof badgeVariants>["size"]>,
  string
> = {
  sm: "size-1",
  default: "size-1.5",
  lg: "size-1.5",
};

export interface BadgeProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "color">,
    Omit<VariantProps<typeof badgeVariants>, "variant"> {
  variant?: BadgeVariant;
  /** Renders a leading status dot in the variant's accent color. */
  dot?: boolean;
  /** Use Radix Slot — render as the child element (e.g. an <a>). */
  asChild?: boolean;
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  (
    { className, variant = "default", size, dot, asChild = false, children, ...props },
    ref
  ) => {
    // Alias destructive → error
    const resolvedVariant: Exclude<BadgeVariant, "destructive"> =
      variant === "destructive" ? "error" : variant;

    const Comp = asChild ? Slot : "span";
    const dotCls = cn(
      "rounded-full shrink-0",
      dotSizeClass[size ?? "default"],
      dotColors[resolvedVariant]
    );

    return (
      <Comp
        ref={ref as React.Ref<HTMLSpanElement>}
        className={cn(
          badgeVariants({ variant: resolvedVariant, size, className })
        )}
        {...props}
      >
        {dot ? <span aria-hidden="true" className={dotCls} /> : null}
        {children}
      </Comp>
    );
  }
);
Badge.displayName = "Badge";

export { Badge, badgeVariants };
