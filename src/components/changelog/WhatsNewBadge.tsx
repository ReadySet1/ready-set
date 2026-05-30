"use client";

import { cn } from "@/lib/utils";
import { useWhatsNew } from "@/hooks/useWhatsNew";

/**
 * Small notification dot shown next to a "What's New" entry point when the
 * newest changelog version hasn't been seen yet. Renders nothing otherwise.
 */
export function WhatsNewBadge({ className }: { className?: string }) {
  const { hasUnseen } = useWhatsNew();

  if (!hasUnseen) return null;

  return (
    <span
      aria-label="New updates available"
      className={cn(
        "inline-block h-2 w-2 rounded-full bg-rose-500",
        className,
      )}
    />
  );
}

export default WhatsNewBadge;
