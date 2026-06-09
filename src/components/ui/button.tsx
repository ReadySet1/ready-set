/**
 * Ready Set — Button (v2)
 * components/ui/button.tsx
 *
 * Drop-in replacement. Wires Shadcn's Button to the v2 design tokens
 * (brand-* + neutral-* + semantic aliases). Radix Slot still handles
 * the `asChild` pattern.
 *
 * Peer deps: react, @radix-ui/react-slot, class-variance-authority,
 *            clsx, tailwind-merge.
 */
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // ── Base — applied to every variant + size combination
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "font-semibold tracking-tight",
    "transition-colors duration-150 ease-out",
    "focus-visible:outline-none",
    "focus-visible:ring-2 focus-visible:ring-brand-500",
    "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50",
    // Inline icons sized + non-shrinking by default
    "[&_svg]:size-4 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-brand-400 text-neutral-900 shadow-xs hover:bg-brand-500 active:bg-brand-600",
        outline:
          "border border-input bg-card text-foreground shadow-xs hover:bg-muted",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-neutral-200 dark:hover:bg-neutral-700",
        ghost:
          "text-foreground hover:bg-muted hover:text-foreground",
        destructive:
          "bg-destructive text-destructive-foreground shadow-xs hover:bg-error-700",
        link:
          "text-brand-700 dark:text-brand-400 underline-offset-4 hover:underline",
      },
      size: {
        xs: "h-8 px-2.5 text-xs rounded-md",
        sm: "h-9 px-3.5 text-sm rounded-lg",
        default: "h-10 px-4 text-sm rounded-lg",
        lg: "h-11 px-6 text-base rounded-lg",
        "icon-xs": "size-8 rounded-md",
        "icon-sm": "size-9 rounded-md",
        icon: "size-10 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
