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
    const supabase = createClient();
    const { startNativeShiftTracking } = await import('./capacitor-tracking');
    // The watcher always arms; the driver id resolves lazily per fix (and is
    // then cached by the bridge). A 401 from /api/auth/session at shift start
    // must not permanently disable background tracking — it retries on the
    // next fix once the session heals.
    await startNativeShiftTracking({
      getDriverId: resolveDriverId,
      getAccessToken: async () =>
        (await supabase.auth.getSession()).data.session?.access_token ?? null,
    });
  } catch {
    /* native bridge unavailable — foreground web tracking still runs */
  }
}

/**
 * The native OS location permission for the foreground web tracker, or null
 * when there is no native answer (plain browser, iOS wrapper, bridge failure)
 * so the caller keeps its web flow. See refreshNativeLocationPermission.
 */
export async function checkNativeLocationPermission(options: {
  explain: boolean;
}): Promise<'granted' | 'not-granted' | null> {
  if (!isCapacitorNative()) return null;
  try {
    const { refreshNativeLocationPermission } = await import('./capacitor-tracking');
    return await refreshNativeLocationPermission(options);
  } catch {
    return null;
  }
}

/**
 * Run the action behind the location explanation's button (NativeLocationPrompt):
 * show the OS dialog, open the app's Settings, or re-check. No-op on web.
 */
export async function resolveNativeLocationIssue(): Promise<void> {
  if (!isCapacitorNative()) return;
  try {
    const { resolveLocationIssue } = await import('./capacitor-tracking');
    await resolveLocationIssue();
  } catch {
    /* native bridge unavailable — foreground web tracking still runs */
  }
}

/**
 * Re-check location readiness and arm the watcher if it is now fine (e.g. the
 * driver returned from Settings). Never shows an OS dialog on its own. No-op on
 * web; idempotent while the watcher runs.
 */
export function retryNativeShiftTracking(): Promise<void> {
  return startNativeShiftTrackingForDriver();
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
