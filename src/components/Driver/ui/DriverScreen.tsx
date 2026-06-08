"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface DriverScreenProps {
  /** Title rendered in the default glass header. */
  title?: string;
  subtitle?: string;
  /** Left slot (e.g. a back button). */
  left?: React.ReactNode;
  /** Right slot (e.g. actions / avatar). */
  right?: React.ReactNode;
  /** Replace the entire default header with custom content (e.g. Home greeting). */
  header?: React.ReactNode;
  /** Render no header at all. */
  noHeader?: boolean;
  /** Remove the bottom padding that clears the bottom nav (for detail views). */
  flush?: boolean;
  className?: string;
  children: React.ReactNode;
}

/** Per-screen scaffold: a sticky blurred glass header + a scrolling body padded
 *  to clear the bottom nav + floating shift pill. Mobile-first; the inner
 *  content is centered and width-capped on larger screens. */
export function DriverScreen({
  title,
  subtitle,
  left,
  right,
  header,
  noHeader,
  flush,
  className,
  children,
}: DriverScreenProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      {!noHeader ? (
        <header
          className="sticky top-0 z-30 border-b border-driver-border bg-driver-glass backdrop-blur-xl backdrop-saturate-150"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="mx-auto w-full max-w-2xl px-4 py-3 lg:max-w-5xl">
            {header ?? (
              <div className="flex items-center gap-3">
                {left}
                <div className="min-w-0 flex-1">
                  {title ? (
                    <h1 className="truncate text-[21px] font-extrabold leading-tight text-driver-text">
                      {title}
                    </h1>
                  ) : null}
                  {subtitle ? (
                    <p className="truncate text-[12.5px] font-semibold text-driver-muted">
                      {subtitle}
                    </p>
                  ) : null}
                </div>
                {right}
              </div>
            )}
          </div>
        </header>
      ) : null}

      <main
        className={cn(
          "mx-auto w-full max-w-2xl flex-1 px-4 lg:max-w-5xl",
          flush ? "pt-4" : "pb-28 pt-4",
          className,
        )}
      >
        {children}
      </main>
    </div>
  );
}
