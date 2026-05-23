/**
 * Ready Set — Input (v2)
 * components/ui/input.tsx
 *
 * Drop-in replacement. Adds a CVA `size` variant matched to Button
 * (xs / sm / default / lg) and a built-in `error` prop that wires
 * `aria-invalid` + visual error treatment.
 *
 * Breaking change: the native HTML `size` attribute is omitted in
 * favor of the CVA variant prop. Numeric `size={N}` no longer compiles.
 *
 * Peer deps: react, class-variance-authority, clsx, tailwind-merge.
 */
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const inputVariants = cva(
  [
    "flex w-full rounded-lg border bg-card text-foreground",
    "border-input",
    "transition-colors duration-150 ease-out",
    "placeholder:text-neutral-400 dark:placeholder:text-neutral-500",
    // File input slot
    "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
    // Focus
    "focus-visible:outline-none",
    "focus-visible:border-brand-500",
    "focus-visible:ring-[3px] focus-visible:ring-brand-100 dark:focus-visible:ring-brand-900",
    // Disabled
    "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted",
    // aria-invalid → error visuals
    "aria-[invalid=true]:border-error-500",
    "aria-[invalid=true]:focus-visible:border-error-500",
    "aria-[invalid=true]:focus-visible:ring-error-100 dark:aria-[invalid=true]:focus-visible:ring-error-700/40",
  ].join(" "),
  {
    variants: {
      size: {
        xs: "h-8 px-2.5 text-xs",
        sm: "h-9 px-3 text-sm",
        default: "h-10 px-3 text-sm",
        lg: "h-11 px-3.5 text-base",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {
  /**
   * When true, sets `aria-invalid` and applies the error border + halo.
   * Replaces ad-hoc `aria-invalid` + manual className overrides.
   */
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", size, error, "aria-invalid": ariaInvalid, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        aria-invalid={error || ariaInvalid || undefined}
        className={cn(inputVariants({ size }), className)}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input, inputVariants };
