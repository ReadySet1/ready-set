'use client';

/**
 * App-side adapter that drives the native background-GPS bridge for the active
 * shift. It is imported by DriverTrackingContext and called from the shift
 * start/end flow, but **every export no-ops in a normal browser**: the heavy
 * `@capacitor-community/background-geolocation` plugin is only reached through a
 * dynamic `import('./capacitor-tracking')` that runs solely when the page is
 * inside the Capacitor native shell (native/driver-app). So the web build and
 * SSR never bundle the plugin into the main chunk, and a plain browser never
 * loads it.
 *
 * Why this exists: web JS is suspended when the screen locks or the driver
 * switches to Waze, so the foreground web tracker (useLocationTracking) loses
 * the trail. Inside the native shell the OS keeps a background-location service
 * alive; this adapter feeds those fixes to the existing
 * `POST /api/tracking/locations` with a Bearer token (withAuth already accepts
 * Bearer — no backend change). It SUPPLEMENTS the foreground tracker, it does
 * not replace it.
 */

import { createClient } from '@/utils/supabase/client';

/** True only inside the Capacitor native shell — false in every web browser. */
export function isCapacitorNative(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } })
    .Capacitor;
  try {
    return Boolean(cap?.isNativePlatform?.());
  } catch {
    return false;
  }
}

/** Resolve the driver id the same way the web tracking hooks do. */
async function resolveDriverId(): Promise<string | null> {
  try {
    const res = await fetch('/api/auth/session');
    if (!res.ok) return null;
    const session = await res.json();
    return session?.user?.driverId ?? null;
  } catch {
    return null;
  }
}

/**
 * Start native background GPS for the active shift. No-op on web; safe to call
 * unconditionally from the shift-start flow.
 */
export async function startNativeShiftTrackingForDriver(): Promise<void> {
  if (!isCapacitorNative()) return;
  try {
    const driverId = await resolveDriverId();
    if (!driverId) return;
    const supabase = createClient();
    const { startNativeShiftTracking } = await import('./capacitor-tracking');
    await startNativeShiftTracking({
      driverId,
      getAccessToken: async () =>
        (await supabase.auth.getSession()).data.session?.access_token ?? null,
    });
  } catch {
    /* native bridge unavailable — foreground web tracking still runs */
  }
}

/** Stop native background GPS (call on shift end). No-op on web. */
export async function stopNativeShiftTrackingForDriver(): Promise<void> {
  if (!isCapacitorNative()) return;
  try {
    const { stopNativeShiftTracking } = await import('./capacitor-tracking');
    await stopNativeShiftTracking();
  } catch {
    /* ignore */
  }
}
