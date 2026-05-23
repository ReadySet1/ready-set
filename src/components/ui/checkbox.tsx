/**
 * Ready Set — Checkbox (v2)
 * components/ui/checkbox.tsx
 *
 * Drop-in replacement. Adds a `size` variant (sm 14 / default 16 / lg 18),
 * brand-tinted checked state, and a Minus icon for the indeterminate
 * state (clearer "some selected" signal than the old square fill).
 *
 * Peer deps: react, @radix-ui/react-checkbox, lucide-react,
 *            class-variance-authority, clsx, tailwind-merge.
 */
"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const checkboxVariants = cva(
  [
    "peer shrink-0 rounded border bg-card",
    "border-input",
    "transition-colors duration-150 ease-out",
    "focus-visible:outline-none",
    "focus-visible:border-brand-500",
    "focus-visible:ring-[3px] focus-visible:ring-brand-100 dark:focus-visible:ring-brand-900",
    // Checked + indeterminate share visual treatment
    "data-[state=checked]:bg-brand-400 data-[state=checked]:border-brand-500",
    "data-[state=indeterminate]:bg-brand-400 data-[state=indeterminate]:border-brand-500",
    "disabled:cursor-not-allowed disabled:opacity-50",
  ].join(" "),
  {
    variants: {
      size: {
        sm: "size-3.5",
        default: "size-4",
        lg: "size-[18px]",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

const indicatorIconSize: Record<"sm" | "default" | "lg", string> = {
  sm: "size-2.5",
  default: "size-3",
  lg: "size-3.5",
};

export interface CheckboxProps
  extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>,
    VariantProps<typeof checkboxVariants> {}

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, size = "default", checked, ...props }, ref) => {
  const iconCls = cn(
    indicatorIconSize[size ?? "default"],
    "text-neutral-900",
    "stroke-[3]"
  );
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      checked={checked}
      className={cn(checkboxVariants({ size }), className)}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className={cn("flex items-center justify-center text-current")}
      >
        {checked === "indeterminate" ? (
          <Minus className={iconCls} />
        ) : (
          <Check className={iconCls} />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});
Checkbox.displayName = CheckboxPrimitive.Root?.displayName ?? "Checkbox";

export { Checkbox, checkboxVariants };
