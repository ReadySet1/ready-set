/**
 * Ready Set — Card (v2)
 * components/ui/card.tsx
 *
 * Drop-in replacement. Adds variant (default / elevated / outline / ghost)
 * and `interactive` for click-to-detail cards (keyboard + focus ring for free).
 * CardTitle reverts to <h3> (was a div in stock Shadcn) and uses sans-bold
 * — dashboard subtitles should read as data, not headline. Add
 * `className="font-display"` on hero widgets if you want Kabel back.
 *
 * Peer deps: react, class-variance-authority, clsx, tailwind-merge.
 */
"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// ── Card root ─────────────────────────────────────────────────────
const cardVariants = cva(
  [
    "rounded-xl text-card-foreground",
    "transition-shadow transition-colors duration-150 ease-out",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-card border border-border shadow-sm",
        elevated: "bg-card border border-border shadow-md",
        outline: "bg-transparent border border-border",
        ghost: "bg-transparent",
      },
      interactive: {
        true: [
          "cursor-pointer",
          "hover:border-neutral-300 dark:hover:border-neutral-600",
          "hover:shadow-md",
          "focus-visible:outline-none focus-visible:ring-2",
          "focus-visible:ring-brand-500 focus-visible:ring-offset-2",
          "focus-visible:ring-offset-background",
        ].join(" "),
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      interactive: false,
    },
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  /**
   * When the card itself acts as a button (e.g. click-to-detail).
   * Adds keyboard focus, ARIA hint, and pointer/hover affordances.
   */
  interactive?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, interactive, role, tabIndex, onKeyDown, ...props }, ref) => {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      // For interactive cards, mirror button activation semantics
      if (interactive && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        (e.currentTarget as HTMLElement).click();
      }
      onKeyDown?.(e);
    };

    return (
      <div
        ref={ref}
        role={role ?? (interactive ? "button" : undefined)}
        tabIndex={interactive ? tabIndex ?? 0 : tabIndex}
        onKeyDown={interactive ? handleKeyDown : onKeyDown}
        className={cn(cardVariants({ variant, interactive, className }))}
        {...props}
      />
    );
  }
);
Card.displayName = "Card";

// ── CardHeader ────────────────────────────────────────────────────
const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col gap-1.5 p-5", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

// ── CardTitle ─────────────────────────────────────────────────────
/**
 * Renders as `<h3>` by default. Use `as` to override
 * (`<CardTitle as="h2">` etc.) when nested under another heading.
 */
export interface CardTitleProps
  extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
}

const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, as: Tag = "h3", ...props }, ref) => (
    <Tag
      ref={ref}
      className={cn(
        "text-lg font-bold leading-snug tracking-tight",
        className
      )}
      {...props}
    />
  )
);
CardTitle.displayName = "CardTitle";

// ── CardDescription ───────────────────────────────────────────────
const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn(
      "text-xs leading-relaxed text-muted-foreground",
      className
    )}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

// ── CardContent ───────────────────────────────────────────────────
const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-5 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

// ── CardFooter ────────────────────────────────────────────────────
/**
 * Two layout modes:
 *   default — `flex items-center justify-between` for a primary action +
 *             meta pair. Single-child usage still left-aligns cleanly.
 *   start   — `flex items-center gap-3` left-anchored cluster.
 */
export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: "default" | "start" | "end";
}

const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, align = "default", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center gap-3 p-5 pt-0",
        align === "default" && "justify-between",
        align === "start" && "justify-start",
        align === "end" && "justify-end",
        className
      )}
      {...props}
    />
  )
);
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  cardVariants,
};
