"use client";

import * as React from "react";
import Link from "next/link";
import { CircleUser, LogOut, MoonStar, Sun, SunMoon } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Segmented } from "./Segmented";
import { DriverButton } from "./DriverButton";
import { useDriverTheme, type DriverThemeMode } from "./DriverThemeProvider";

interface DriverProfileSheetProps {
  driverName: string;
  initials?: string;
  onSignOut: () => void;
}

const THEME_OPTIONS: { value: DriverThemeMode; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "auto", label: "Auto" },
];

/** Profile avatar button → bottom sheet with profile link, theme toggle, sign out. */
export function DriverProfileSheet({
  driverName,
  initials,
  onSignOut,
}: DriverProfileSheetProps) {
  const { mode, setMode, resolved } = useDriverTheme();
  const fallbackInitials =
    initials ??
    driverName
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Open profile menu"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-driver-brand text-[15px] font-extrabold text-driver-brand-ink"
        >
          {fallbackInitials || <CircleUser className="h-6 w-6" />}
        </button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className={cn(
          "driver-theme rounded-t-3xl border-driver-border bg-driver-surface p-0",
          resolved === "dark" && "dark",
        )}
      >
        <div className="mx-auto w-full max-w-2xl px-5 pb-8 pt-2">
          <SheetHeader className="items-start">
            <SheetTitle className="text-[18px] font-extrabold text-driver-text">
              {driverName}
            </SheetTitle>
          </SheetHeader>

          <div className="mt-5 space-y-5">
            <div>
              <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.06em] text-driver-subtle">
                Appearance
              </div>
              <Segmented
                aria-label="Theme"
                options={THEME_OPTIONS}
                value={mode}
                onChange={setMode}
              />
              <div className="mt-1.5 flex items-center gap-1.5 text-[11.5px] font-semibold text-driver-subtle">
                {mode === "light" ? (
                  <Sun className="h-3.5 w-3.5" />
                ) : mode === "dark" ? (
                  <MoonStar className="h-3.5 w-3.5" />
                ) : (
                  <SunMoon className="h-3.5 w-3.5" />
                )}
                {mode === "auto"
                  ? "Dark from 7pm to 6am, light otherwise"
                  : `Always ${mode}`}
              </div>
            </div>

            <Link href="/driver/profile" className="block">
              <DriverButton variant="outline" full size="md">
                <CircleUser className="h-4 w-4" />
                My profile
              </DriverButton>
            </Link>

            <DriverButton variant="danger" full size="md" onClick={onSignOut}>
              <LogOut className="h-4 w-4" />
              Sign out
            </DriverButton>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
