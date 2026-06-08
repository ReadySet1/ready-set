"use client";

import { ArrowRight, Hand, Loader2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface NextActionProps {
  /** Primary label, e.g. "On my way to vendor". */
  label: string;
  /** Uppercase sub-label, e.g. "NEXT STEP". */
  sub?: string;
  icon?: LucideIcon;
  onClick?: () => void;
  tone?: "brand" | "success";
  /** Optional hint chip with a bobbing hand, e.g. "Tap to update your status". */
  hint?: string;
  loading?: boolean;
  /** Label shown while loading (default "Updating status…"). */
  loadingLabel?: string;
  disabled?: boolean;
  className?: string;
}

/** The single dominant action on a screen. 56px min, amber (or green at the
 *  delivery step), with an optional hint chip + pulsing ring to signal tappability. */
export function NextAction({
  label,
  sub,
  icon: Icon = ArrowRight,
  onClick,
  tone = "brand",
  hint,
  loading,
  loadingLabel = "Updating status…",
  disabled,
  className,
}: NextActionProps) {
  const brand = tone === "brand";
  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      {hint && !loading ? (
        <div
          className={cn(
            "inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1",
            brand
              ? "border border-driver-brand/45 bg-driver-brand/15 text-driver-on-brand"
              : "bg-driver-success-bg text-driver-success-ink",
          )}
        >
          <Hand
            className="h-3.5 w-3.5 animate-driver-tap"
            strokeWidth={2.4}
          />
          <span className="text-[11.5px] font-extrabold">{hint}</span>
        </div>
      ) : null}

      <button
        type="button"
        onClick={disabled || loading ? undefined : onClick}
        disabled={disabled || loading}
        aria-busy={loading}
        className={cn(
          "flex min-h-driver-action w-full items-center gap-3 rounded-2xl px-4 text-left shadow-driver transition-transform active:translate-y-px disabled:opacity-60",
          brand
            ? "bg-driver-brand text-driver-brand-ink hover:bg-driver-brand-hover"
            : "bg-driver-success text-white",
        )}
      >
        <span className="flex-1">
          {loading ? (
            <span className="block text-driver-rail font-extrabold tracking-[-0.01em]">
              {loadingLabel}
            </span>
          ) : (
            <>
              {sub ? (
                <span className="block text-[10.5px] font-extrabold uppercase tracking-[0.06em] opacity-70">
                  {sub}
                </span>
              ) : null}
              <span className="block text-driver-rail font-extrabold tracking-[-0.01em]">
                {label}
              </span>
            </>
          )}
        </span>

        <span className="relative h-driver-glyph-lg w-driver-glyph-lg shrink-0">
          {!loading ? (
            <span
              className={cn(
                "absolute inset-0 rounded-xl border-2 animate-driver-ping",
                brand ? "border-driver-brand-ink/50" : "border-white/70",
              )}
            />
          ) : null}
          <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/10">
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2.6} />
            ) : (
              <Icon className="h-5 w-5" strokeWidth={2.6} />
            )}
          </span>
        </span>
      </button>
    </div>
  );
}
