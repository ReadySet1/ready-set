"use client";

/**
 * DriverThemeProvider — scoped light/dark theming for the driver app.
 *
 * Deliberately does NOT use next-themes: next-themes toggles `.dark` on
 * <html>, which would leak into the marketing/public (site) pages that use
 * `dark:` utilities. Instead we render a wrapper element carrying the
 * `.driver-theme` token scope and conditionally a `dark` class ON THAT
 * ELEMENT, so the dark tokens (`.driver-theme.dark` in src/styles/index.css)
 * apply only within the driver subtree.
 *
 * Modes (per the design handoff):
 *   - light / dark — explicit
 *   - auto — time-based: dark from 19:00 to 06:00 local, light otherwise
 */

import * as React from "react";

export type DriverThemeMode = "light" | "dark" | "auto";

const STORAGE_KEY = "rs-driver-theme";

interface DriverThemeContextValue {
  mode: DriverThemeMode;
  /** The currently-applied appearance after resolving "auto". */
  resolved: "light" | "dark";
  setMode: (mode: DriverThemeMode) => void;
}

const DriverThemeContext = React.createContext<DriverThemeContextValue | null>(
  null,
);

function isNightTime(date = new Date()): boolean {
  const h = date.getHours();
  return h >= 19 || h < 6;
}

function resolveMode(mode: DriverThemeMode): "light" | "dark" {
  if (mode === "auto") return isNightTime() ? "dark" : "light";
  return mode;
}

export function DriverThemeProvider({
  children,
  defaultMode = "auto",
}: {
  children: React.ReactNode;
  defaultMode?: DriverThemeMode;
}) {
  const [mode, setModeState] = React.useState<DriverThemeMode>(defaultMode);
  const [resolved, setResolved] = React.useState<"light" | "dark">("light");

  // Hydrate persisted preference (client-only; avoids SSR mismatch).
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as DriverThemeMode | null;
      if (saved === "light" || saved === "dark" || saved === "auto") {
        setModeState(saved);
      }
    } catch {
      /* localStorage unavailable — fall back to default */
    }
  }, []);

  // Recompute the resolved appearance whenever mode changes, and (for "auto")
  // re-check periodically so the theme flips across the 06:00 / 19:00 boundary.
  React.useEffect(() => {
    setResolved(resolveMode(mode));
    if (mode !== "auto") return;
    const id = setInterval(() => setResolved(resolveMode(mode)), 60_000);
    return () => clearInterval(id);
  }, [mode]);

  const setMode = React.useCallback((next: DriverThemeMode) => {
    setModeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore persistence failure */
    }
  }, []);

  const value = React.useMemo(
    () => ({ mode, resolved, setMode }),
    [mode, resolved, setMode],
  );

  return (
    <DriverThemeContext.Provider value={value}>
      <div
        className={`driver-theme min-h-dvh bg-driver-bg text-driver-text ${
          resolved === "dark" ? "dark" : ""
        }`}
      >
        {children}
      </div>
    </DriverThemeContext.Provider>
  );
}

export function useDriverTheme(): DriverThemeContextValue {
  const ctx = React.useContext(DriverThemeContext);
  if (!ctx) {
    throw new Error("useDriverTheme must be used within a DriverThemeProvider");
  }
  return ctx;
}
