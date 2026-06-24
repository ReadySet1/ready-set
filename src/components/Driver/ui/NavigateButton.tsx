"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Navigation } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  buildNavigationUrl,
  getPreferredNavApp,
  setPreferredNavApp,
  type NavApp,
  type NavTarget,
} from "@/lib/driver-navigation";
import { DriverButton } from "./DriverButton";
import { NavigationAppSheet } from "./NavigationAppSheet";

interface NavigateButtonProps {
  target: NavTarget;
  /** Button label, e.g. "Directions to pickup". Defaults to "Navigate". */
  label?: string;
  className?: string;
}

/**
 * Prominent, brand-colored "Navigate" button for the driver app.
 *
 * Replaces the old low-contrast `<a>` links (a tester couldn't find them). The
 * primary tap opens the driver's remembered maps app; the adjacent chevron opens
 * a chooser (Google / Apple / Waze), persisting the choice for next time.
 */
export function NavigateButton({ target, label = "Navigate", className }: NavigateButtonProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  // Default to the SSR-safe value, then hydrate from localStorage on the client
  // (avoids a hydration mismatch on the remembered preference).
  const [pref, setPref] = useState<NavApp>("google");

  useEffect(() => {
    setPref(getPreferredNavApp());
  }, []);

  const openWith = useCallback(
    (app: NavApp) => {
      const url = buildNavigationUrl(app, target);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    },
    [target],
  );

  const handleSelect = useCallback(
    (app: NavApp) => {
      setPreferredNavApp(app);
      setPref(app);
      setSheetOpen(false);
      openWith(app);
    },
    [openWith],
  );

  return (
    <div className={cn("flex items-stretch gap-1.5", className)}>
      <DriverButton
        variant="brand"
        onClick={() => openWith(pref)}
        aria-label={label}
        className="flex-1"
      >
        <Navigation className="h-4 w-4" strokeWidth={2.6} />
        {label}
      </DriverButton>
      <DriverButton
        variant="outline"
        onClick={() => setSheetOpen(true)}
        aria-label="Choose navigation app"
        className="px-3"
      >
        <ChevronDown className="h-4 w-4" strokeWidth={2.6} />
      </DriverButton>
      <NavigationAppSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        current={pref}
        onSelect={handleSelect}
      />
    </div>
  );
}
