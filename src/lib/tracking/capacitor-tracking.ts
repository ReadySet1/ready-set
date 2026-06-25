/**
 * Capacitor background-GPS bridge — the native-shell side of driver tracking.
 *
 * When the /driver web app runs inside the native shell (native/driver-app),
 * Capacitor injects its runtime + the background-geolocation plugin into this
 * page. This module drives that plugin so location keeps posting to the existing
 * `POST /api/tracking/locations` route even when the screen is locked or the
 * driver opens Waze — the gap web-only tracking can't close (web JS is suspended
 * in the background).
 *
 * This module is **only ever loaded via a dynamic import from
 * native-shift-tracking.ts, gated on `window.Capacitor`**, so the @capacitor
 * plugin code never lands in the web build / SSR. On a plain browser the dynamic
 * import never runs.
 *
 * No backend change: `withAuth` already accepts `Authorization: Bearer`
 * (src/lib/auth-middleware.ts), and the POST body matches the web client
 * (src/hooks/tracking/useLocationTracking.ts).
 */

import { Capacitor, registerPlugin } from '@capacitor/core';
import type {
  BackgroundGeolocationPlugin,
  Location,
  CallbackError,
} from '@capacitor-community/background-geolocation';

// v1.x exposes only the plugin TYPE; the runtime object is obtained via
// Capacitor's registerPlugin, which binds to the native implementation inside
// the Capacitor shell (and is a harmless proxy on web — we never call it there).
const BackgroundGeolocation =
  registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

export interface NativeTrackingSession {
  driverId: string;
  /** Returns a fresh Supabase access token (refresh-aware); null if signed out. */
  getAccessToken: () => Promise<string | null>;
}

/** Match the server rate limit (~12/min) and the web client's throttle. */
const POST_THROTTLE_MS = 5000;

let watcherId: string | null = null;
let lastPostAt = 0;

/** True only inside the Capacitor native shell — false in any web browser. */
export function isNativeTrackingAvailable(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * Start native background location tracking for the active shift. Idempotent:
 * a second call while already running is a no-op.
 */
export async function startNativeShiftTracking(
  session: NativeTrackingSession,
): Promise<void> {
  if (!isNativeTrackingAvailable() || watcherId) return;

  watcherId = await BackgroundGeolocation.addWatcher(
    {
      backgroundTitle: 'Delivery in progress',
      backgroundMessage: 'Ready Set is tracking your delivery location.',
      requestPermissions: true,
      // Keep firing in the background (don't drop stale-but-recent fixes).
      stale: false,
      // Metres of movement between callbacks — caps battery + post volume.
      distanceFilter: 10,
    },
    async (location?: Location, error?: CallbackError) => {
      if (error) {
        // The OS denied "Always" permission — bounce the driver to Settings.
        if (error.code === 'NOT_AUTHORIZED') {
          void BackgroundGeolocation.openSettings();
        }
        return;
      }
      if (!location) return;

      const now = Date.now();
      if (now - lastPostAt < POST_THROTTLE_MS) return;
      lastPostAt = now;

      const token = await session.getAccessToken();
      if (!token) return; // signed out / token unavailable — skip this fix
      await postLocation(location, session.driverId, token);
    },
  );
}

/** Stop native tracking (call on shift end). Idempotent. */
export async function stopNativeShiftTracking(): Promise<void> {
  if (!watcherId) return;
  try {
    await BackgroundGeolocation.removeWatcher({ id: watcherId });
  } finally {
    watcherId = null;
    lastPostAt = 0;
  }
}

/**
 * POST one fix to the existing ingest route. The relative URL resolves against
 * the loaded origin (the deployed site), so no base URL is needed. Failures are
 * swallowed — the next fix retries; durable buffering is a Phase-1 item.
 */
async function postLocation(
  location: Location,
  driverId: string,
  token: string,
): Promise<void> {
  try {
    await fetch('/api/tracking/locations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        driver_id: driverId,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy ?? undefined,
        speed: location.speed ?? undefined,
        heading: location.bearing ?? undefined,
        altitude: location.altitude ?? undefined,
        is_moving: (location.speed ?? 0) > 1,
      }),
    });
  } catch {
    /* background network blip — next fix retries */
  }
}
