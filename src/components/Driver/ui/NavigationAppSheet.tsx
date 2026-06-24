"use client";

import { Check } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { NAV_APPS, type NavApp } from "@/lib/driver-navigation";
import { useDriverTheme } from "./DriverThemeProvider";

interface NavigationAppSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Currently-remembered app, highlighted in the list. */
  current: NavApp;
  /** Fired when the driver taps an app — persist + open should happen in the parent. */
  onSelect: (app: NavApp) => void;
}

/** Bottom-sheet chooser for the driver's navigation app (Google / Apple / Waze).
 *  Mirrors the DriverPodSheet pattern (driver-theme scoped bottom sheet). */
export function NavigationAppSheet({
  open,
  onOpenChange,
  current,
  onSelect,
}: NavigationAppSheetProps) {
  const { resolved } = useDriverTheme();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          "driver-theme rounded-t-3xl border-driver-border bg-driver-surface",
          resolved === "dark" && "dark",
        )}
      >
        <div className="mx-auto w-full max-w-md">
          <SheetHeader className="items-start">
            <SheetTitle className="text-[18px] font-extrabold text-driver-text">
              Navigate with
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 flex flex-col gap-2 pb-2">
            {NAV_APPS.map((app) => {
              const active = app.id === current;
              return (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => onSelect(app.id)}
                  aria-pressed={active}
                  className={cn(
                    "flex min-h-driver-control items-center justify-between rounded-2xl border-[1.5px] px-4 text-[15px] font-extrabold text-driver-text transition-all active:translate-y-px",
                    active
                      ? "border-driver-brand bg-driver-surface-alt"
                      : "border-driver-border bg-driver-surface-alt",
                  )}
                >
                  {app.label}
                  {active ? (
                    <Check className="h-4 w-4 text-driver-success" strokeWidth={3} />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
