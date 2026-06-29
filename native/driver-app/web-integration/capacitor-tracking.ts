/**
 * Capacitor background-GPS bridge (POC) — drop into the Next app's src/lib/tracking/.
 *
 * When the /driver web app runs inside the native shell (native/driver-app),
 * Capacitor injects its runtime + the background-geolocation plugin into this
 * page. This module drives that plugin so location keeps posting to the existing
 * `POST /api/tracking/locations` route even when the screen is locked or the
 * driver opens Waze — the gap web-only tracking can't close.
 *
 * On a plain web browser every export is a safe no-op (feature-detected via
 * `Capacitor.isNativePlatform()`), so it can be imported unconditionally.
 *
 * ── To enable (gated; see ../README.md) ──────────────────────────────────────
 *   1. Add deps to the Next app:
 *        pnpm add @capacitor/core @capacitor-community/background-geolocation
 *   2. Copy this file to `src/lib/tracking/capacitor-tracking.ts`.
 *   3. Wire it into DriverTrackingContext (see ./README.md):
 *        - on shift start → startNativeShiftTracking({ driverId, getAccessToken })
 *        - on shift end   → stopNativeShiftTracking()
 *      where getAccessToken returns a fresh Supabase access token
 *      (e.g. () => supabase.auth.getSession().then(r => r.data.session?.access_token ?? null)).
 *
 * No backend change: `withAuth` already accepts `Authorization: Bearer`
 * (src/lib/auth-middleware.ts), and the POST body matches the web client.
 */

import { Capacitor } from '@capacitor/core';
import {
  BackgroundGeolocation,
  type Location,
  type CallbackError,
} from '@capacitor-community/background-geolocation';

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
