/**
 * Driver navigation helpers — build deep links to the driver's chosen maps app
 * (Google Maps / Apple Maps / Waze) and remember the preference.
 *
 * Universal `https://` links are used on purpose (not custom schemes like
 * `comgooglemaps://` or `waze://`): an https maps link opens the native app when
 * it's installed and falls back to the web otherwise, and it sidesteps the iOS
 * custom-scheme allowlist (`LSApplicationQueriesSchemes`) that would otherwise
 * silently fail for an app the user doesn't have.
 */

export type NavApp = "google" | "apple" | "waze";

export interface NavAppMeta {
  id: NavApp;
  label: string;
}

/** Ordered list for the chooser UI. Google first = the historical default. */
export const NAV_APPS: readonly NavAppMeta[] = [
  { id: "google", label: "Google Maps" },
  { id: "apple", label: "Apple Maps" },
  { id: "waze", label: "Waze" },
] as const;

/** A navigation destination — either a geocoded coordinate or a free-text address. */
export type NavTarget = { lat: number; lng: number } | { address: string };

const STORAGE_KEY = "rs:driverNavApp";
export const DEFAULT_NAV_APP: NavApp = "google";

export function isNavApp(value: unknown): value is NavApp {
  return value === "google" || value === "apple" || value === "waze";
}

/** Read the driver's remembered maps app (defaults to Google). SSR-safe. */
export function getPreferredNavApp(): NavApp {
  if (typeof window === "undefined") return DEFAULT_NAV_APP;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isNavApp(stored) ? stored : DEFAULT_NAV_APP;
  } catch {
    return DEFAULT_NAV_APP;
  }
}

/** Persist the driver's maps-app choice. No-op on the server / on storage errors. */
export function setPreferredNavApp(app: NavApp): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, app);
  } catch {
    /* private mode / disabled storage — ignore */
  }
}

function hasCoords(t: NavTarget): t is { lat: number; lng: number } {
  return (
    typeof (t as { lat?: unknown }).lat === "number" &&
    typeof (t as { lng?: unknown }).lng === "number"
  );
}

/**
 * Build a turn-by-turn navigation URL for the chosen app. Origin is the device's
 * current location; destination is `target`. Returns `null` when the target is
 * empty (no coords / blank address) so callers can hide the button.
 */
export function buildNavigationUrl(app: NavApp, target: NavTarget): string | null {
  if (hasCoords(target)) {
    const { lat, lng } = target;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const ll = `${lat},${lng}`;
    switch (app) {
      case "waze":
        return `https://waze.com/ul?ll=${encodeURIComponent(ll)}&navigate=yes`;
      case "apple":
        return `https://maps.apple.com/?daddr=${encodeURIComponent(ll)}&dirflg=d`;
      case "google":
      default:
        return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(ll)}`;
    }
  }

  const query = target.address.trim();
  if (!query) return null;
  switch (app) {
    case "waze":
      return `https://waze.com/ul?q=${encodeURIComponent(query)}&navigate=yes`;
    case "apple":
      return `https://maps.apple.com/?daddr=${encodeURIComponent(query)}&dirflg=d`;
    case "google":
    default:
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
  }
}
