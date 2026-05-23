/**
 * Ready Set — Label (v2)
 * components/ui/label.tsx
 *
 * Drop-in replacement. Extends Radix Label with two new props:
 *   - `required` renders a red asterisk after the label text.
 *   - `tone` switches color to error or muted for paired error/disabled states.
 *
 * Peer deps: react, @radix-ui/react-label, class-variance-authority,
 *            clsx, tailwind-merge.
 */
"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const labelVariants = cva(
  [
    "inline-flex items-center gap-1",
    "text-sm font-semibold tracking-tight leading-none",
    // Cascade disabled state through Radix peer relationship
    "peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
  ].join(" "),
  {
    variants: {
      tone: {
        default: "text-foreground",
        error: "text-error-600 dark:text-error-500",
        muted: "text-muted-foreground",
      },
    },
    defaultVariants: {
      tone: "default",
    },
  }
);

export interface LabelProps
  extends React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>,
    VariantProps<typeof labelVariants> {
  /** Renders a red asterisk after the label text. */
  required?: boolean;
}

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  LabelProps
>(({ className, tone, required, children, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(labelVariants({ tone }), className)}
    {...props}
  >
    {children}
    {required ? (
      <span
        aria-hidden="true"
        className="text-error-500 font-bold leading-none"
      >
        *
      </span>
    ) : null}
  </LabelPrimitive.Root>
));
Label.displayName = LabelPrimitive.Root?.displayName ?? "Label";

export { Label, labelVariants };
