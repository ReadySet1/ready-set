/**
 * Ready Set — Switch (v2)
 * components/ui/switch.tsx
 *
 * Drop-in replacement. On-state moves to brand-400 (was Shadcn primary
 * slate-900) so toggles read as "branded on", consistent with the
 * button system. New `sm` size for dense settings rows. Thumb gains a
 * real shadow for tactile depth.
 *
 * Peer deps: react, @radix-ui/react-switch, class-variance-authority,
 *            clsx, tailwind-merge.
 */
"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const switchRootVariants = cva(
  [
    "peer inline-flex shrink-0 cursor-pointer items-center",
    "rounded-full border-2 border-transparent",
    "transition-colors duration-150 ease-out",
    "focus-visible:outline-none",
    "focus-visible:ring-2 focus-visible:ring-brand-500",
    "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:cursor-not-allowed disabled:opacity-50",
    "data-[state=checked]:bg-brand-400",
    "data-[state=unchecked]:bg-neutral-300 dark:data-[state=unchecked]:bg-neutral-600",
  ].join(" "),
  {
    variants: {
      size: {
        sm: "h-5 w-9",
        default: "h-6 w-11",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

const switchThumbVariants = cva(
  [
    "pointer-events-none block rounded-full bg-white shadow-sm",
    "ring-0 transition-transform duration-150 ease-out",
  ].join(" "),
  {
    variants: {
      size: {
        sm: "size-4 data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0",
        default:
          "size-5 data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

export interface SwitchProps
  extends React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>,
    VariantProps<typeof switchRootVariants> {}

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  SwitchProps
>(({ className, size = "default", ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(switchRootVariants({ size }), className)}
    {...props}
  >
    <SwitchPrimitive.Thumb className={cn(switchThumbVariants({ size }))} />
  </SwitchPrimitive.Root>
));
Switch.displayName = SwitchPrimitive.Root?.displayName ?? "Switch";

export { Switch, switchRootVariants };
