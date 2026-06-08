"use client";

import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[] | readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  small?: boolean;
  className?: string;
  "aria-label"?: string;
}

/** Segmented control used for tabs (Today/Upcoming/Completed) and the period
 *  selector. Track = surface-alt; active pill = surface + small shadow. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  small,
  className,
  "aria-label": ariaLabel,
}: SegmentedProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "flex gap-0.5 rounded-xl border border-driver-border bg-driver-surface-alt p-driver-hair",
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex-1 whitespace-nowrap rounded-[9px] font-bold transition-all",
              small ? "min-h-driver-seg px-1.5 text-[12.5px]" : "min-h-driver-glyph-lg px-2 text-[13.5px]",
              active
                ? "bg-driver-surface text-driver-text shadow-driver-sm"
                : "bg-transparent text-driver-muted",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
