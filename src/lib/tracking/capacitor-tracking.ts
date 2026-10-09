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
 *
 * Location readiness (card android-location-prompt-every-run): on Android we
 * pre-check the permission before arming, start silently when it is granted,
 * and otherwise publish a NativeLocationIssue that the /driver layout explains
 * (NativeLocationPrompt) before any OS dialog or Settings page appears. We never
 * open Settings without that explanation.
 */

import {
  Capacitor,
  registerPlugin,
  type PermissionState,
} from '@capacitor/core';
import type {
  BackgroundGeolocationPlugin,
  Location,
  CallbackError,
} from '@capacitor-community/background-geolocation';
import {
  createMotionState,
  nextMotionState,
  type MotionState,
} from './motion-state';
import { readBatteryLevel } from './battery';
import {
  getNativeLocationIssue,
  setNativeLocationIssue,
  type NativeLocationIssue,
} from './native-location-issue';

/**
 * Capacitor's Android `Plugin` base class exports `checkPermissions()` and
 * `requestPermissions()` for every plugin that declares permission aliases — this one declares `location`
 * (COARSE + FINE; it only reads `granted` when BOTH are granted, so an
 * "Approximate" grant still counts as not granted). The v1.x typings omit it,
 * and iOS does not expose it (not in the plugin's method list), so it is only
 * called on Android.
 */
type BackgroundGeolocationBridge = BackgroundGeolocationPlugin & {
  checkPermissions(): Promise<{ location?: PermissionState }>;
  requestPermissions(): Promise<{ location?: PermissionState }>;
};

// v1.x exposes only the plugin TYPE; the runtime object is obtained via
// Capacitor's registerPlugin, which binds to the native implementation inside
// the Capacitor shell (and is a harmless proxy on web — we never call it there).
const BackgroundGeolocation =
  registerPlugin<BackgroundGeolocationBridge>('BackgroundGeolocation');

/** Set once location has worked, so a later 'prompt' state reads as an expired one-time grant. */
const GRANTED_BEFORE_KEY = 'rs.driver.nativeLocationGrantedBefore';

export interface NativeTrackingSession {
  /**
   * Resolves the driver id. Called lazily on each fix until it succeeds (then
   * cached), so a failed lookup at shift start — e.g. an expired server session
   * returning 401 — heals on its own once auth recovers, instead of silently
   * disabling background tracking for the whole shift.
   */
  getDriverId: () => Promise<string | null>;
  /** Returns a fresh Supabase access token (refresh-aware); null if signed out. */
  getAccessToken: () => Promise<string | null>;
}

/**
 * Post throttle, kept in step with the admin-configured GPS update interval
 * (tracking settings) via setNativePostThrottleMs. The 5s default matches the
 * historical server rate limit and applies until the setting is pushed in.
 */
let postThrottleMs = 5000;

/** Ignores invalid values — keeps the previous throttle. */
export function setNativePostThrottleMs(throttleMs: number): void {
  if (Number.isFinite(throttleMs) && throttleMs > 0) {
    postThrottleMs = throttleMs;
  }
}

let watcherId: string | null = null;
let lastPostAt = 0;
let cachedDriverId: string | null = null;
// The session of the current shift, kept so the explanation's button can arm
// the watcher after the driver has read why we need location.
let lastSession: NativeTrackingSession | null = null;
let startInFlight = false;
let grantRemembered = false;
// Per-session moving/stopped hysteresis (src/lib/tracking/motion-state.ts).
let motionState: MotionState = createMotionState();

/** True only inside the Capacitor native shell — false in any web browser. */
export function isNativeTrackingAvailable(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function isAndroid(): boolean {
  try {
    return Capacitor.getPlatform() === 'android';
  } catch {
    return false;
  }
}

/** The `location` permission state, or null when it cannot be read. */
async function readLocationPermission(): Promise<PermissionState | null> {
  try {
    const result = await BackgroundGeolocation.checkPermissions();
    return result?.location ?? null;
  } catch {
    return null;
  }
}

function rememberGrant(): void {
  if (grantRemembered) return;
  grantRemembered = true;
  try {
    window.localStorage.setItem(GRANTED_BEFORE_KEY, '1');
  } catch {
    /* storage unavailable — we just lose the "expired" wording */
  }
}

function hadGrantBefore(): boolean {
  try {
    return window.localStorage.getItem(GRANTED_BEFORE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Which explanation fits a not-granted permission state. */
function issueForPermission(permission: PermissionState): NativeLocationIssue {
  if (permission === 'denied') return 'permission-blocked';
  // A plain 'prompt' after location already worked here means the one-time
  // ("Only this time") grant expired. After an explicit denial Android reports
  // 'prompt-with-rationale' instead.
  if (permission === 'prompt' && hadGrantBefore()) return 'permission-expired';
  return 'permission-needed';
}

/**
 * The plugin reports both "permission missing" and "Location toggle off" as
 * NOT_AUTHORIZED; tell them apart so the explanation points the right way.
 */
async function diagnoseNotAuthorized(
  error: CallbackError,
): Promise<NativeLocationIssue> {
  if (/location services disabled/i.test(error.message ?? '')) {
    return 'location-off';
  }
  // iOS can't re-show its dialog after a denial: Settings is the only way.
  if (!isAndroid()) return 'permission-blocked';
  const permission = await readLocationPermission();
  // Android only rejects a granted permission when Location is off.
  if (permission === 'granted') return 'location-off';
  if (permission === null) return 'permission-blocked';
  return issueForPermission(permission);
}

function isPermissionIssue(issue: NativeLocationIssue | null): boolean {
  return (
    issue === 'permission-needed' ||
    issue === 'permission-expired' ||
    issue === 'permission-blocked'
  );
}

/**
 * The native location permission, for the foreground web tracker
 * (useLocationTracking). The Android WebView's Permissions API reports 'prompt'
 * on every run even when the OS permission is granted, so on native this is the
 * source of truth. With `explain`, a missing grant publishes the in-app
 * explanation (the only path to the OS dialog). Never prompts by itself.
 *
 * Returns null when there is no native answer (web, iOS, or unreadable) — the
 * caller then keeps its web flow.
 */
export async function refreshNativeLocationPermission({
  explain,
}: {
  explain: boolean;
}): Promise<'granted' | 'not-granted' | null> {
  if (!isNativeTrackingAvailable() || !isAndroid()) return null;
  const permission = await readLocationPermission();
  if (permission === null) return null;
  if (permission === 'granted') {
    rememberGrant();
    if (isPermissionIssue(getNativeLocationIssue())) setNativeLocationIssue(null);
    return 'granted';
  }
  if (explain) setNativeLocationIssue(issueForPermission(permission));
  return 'not-granted';
}

/**
 * Show the OS permission dialog (the driver has read the explanation), then
 * re-read the state: granted → clear the explanation and arm the shift's
 * watcher if a shift is waiting; otherwise switch to the fitting explanation.
 */
async function requestPermissionAfterExplanation(): Promise<void> {
  try {
    await BackgroundGeolocation.requestPermissions();
  } catch {
    /* fall through — the re-read below decides */
  }
  const permission = await readLocationPermission();
  if (permission === null) {
    // Can't drive the dialog directly — let the plugin ask while arming.
    if (lastSession && !watcherId) await armWatcher(lastSession, true);
    return;
  }
  if (permission !== 'granted') {
    setNativeLocationIssue(issueForPermission(permission));
    return;
  }
  rememberGrant();
  setNativeLocationIssue(null);
  if (lastSession && !watcherId) await armWatcher(lastSession, false);
}

async function removeWatcherQuietly(id: string): Promise<void> {
  try {
    await BackgroundGeolocation.removeWatcher({ id });
  } catch {
    /* already gone */
  }
}

/**
 * Arm the plugin watcher. `requestPermissions: true` lets the plugin show the
 * OS dialog — only used where the old behavior must be kept (iOS, or when the
 * permission state is unreadable) or after the driver tapped the explanation.
 */
async function armWatcher(
  session: NativeTrackingSession,
  requestPermissions: boolean,
): Promise<void> {
  setNativeLocationIssue(null);
  let armedId: string | null = null;
  let failed = false;

  const id = await BackgroundGeolocation.addWatcher(
    {
      backgroundTitle: 'Delivery in progress',
      backgroundMessage: 'Ready Set is tracking your delivery location.',
      requestPermissions,
      // Keep firing in the background (don't drop stale-but-recent fixes).
      stale: false,
      // Metres of movement between callbacks — caps battery + post volume.
      distanceFilter: 10,
    },
    async (location?: Location, error?: CallbackError) => {
      if (error) {
        if (error.code !== 'NOT_AUTHORIZED') return;
        // Tear the rejected watcher down so a retry can arm a fresh one, then
        // explain — never jump to Settings unannounced.
        failed = true;
        const toRemove = armedId;
        armedId = null;
        if (toRemove) {
          if (watcherId === toRemove) watcherId = null;
          void removeWatcherQuietly(toRemove);
        }
        setNativeLocationIssue(await diagnoseNotAuthorized(error));
        return;
      }
      if (!location) return;
      rememberGrant();

      const now = Date.now();
      if (now - lastPostAt < postThrottleMs) return;
      lastPostAt = now;

      const token = await session.getAccessToken();
      if (!token) return; // signed out / token unavailable — skip this fix

      if (!cachedDriverId) {
        cachedDriverId = await session.getDriverId();
        if (!cachedDriverId) return; // auth not healed yet — next fix retries
      }
      await postLocation(location, cachedDriverId, token);
    },
  );

  if (failed) {
    // Rejected before addWatcher resolved — don't keep a dead watcher id.
    void removeWatcherQuietly(id);
    return;
  }
  armedId = id;
  watcherId = id;
}

/**
 * Start native background location tracking for the active shift. Idempotent:
 * a second call while already running (or starting) is a no-op.
 *
 * Android: granted → arm silently (no prompt); anything else → publish a
 * NativeLocationIssue for the in-app explanation and wait for its button
 * (resolveLocationIssue). iOS keeps the original flow (the plugin requests
 * permission itself); only its denial handling now goes through the
 * explanation instead of a silent openSettings().
 */
export async function startNativeShiftTracking(
  session: NativeTrackingSession,
): Promise<void> {
  if (!isNativeTrackingAvailable() || watcherId || startInFlight) return;
  lastSession = session;
  startInFlight = true;
  try {
    if (!isAndroid()) {
      await armWatcher(session, true);
      return;
    }
    const permission = await readLocationPermission();
    if (permission === null) {
      // Can't read the state — fall back to letting the plugin ask.
      await armWatcher(session, true);
      return;
    }
    if (permission === 'granted') {
      rememberGrant();
      await armWatcher(session, false);
      return;
    }
    setNativeLocationIssue(issueForPermission(permission));
  } finally {
    startInFlight = false;
  }
}

/**
 * The explanation's single button. Does exactly one thing per issue:
 * - permission-needed / -expired → show the OS permission dialog (works before
 *   a shift too — the Track screen's request button routes here on native)
 * - permission-blocked → open this app's Settings page
 * - location-off → re-check and re-arm (no plugin API opens the Location page)
 */
export async function resolveLocationIssue(): Promise<void> {
  const issue = getNativeLocationIssue();
  if (!issue || !isNativeTrackingAvailable()) return;

  if (issue === 'permission-blocked') {
    try {
      await BackgroundGeolocation.openSettings();
    } catch {
      /* no settings page — the explanation stays up */
    }
    return;
  }

  if (startInFlight) return;

  if (issue === 'location-off') {
    if (lastSession && !watcherId) await startNativeShiftTracking(lastSession);
    return;
  }

  startInFlight = true;
  try {
    await requestPermissionAfterExplanation();
  } finally {
    startInFlight = false;
  }
}

/** Stop native tracking (call on shift end). Idempotent. */
export async function stopNativeShiftTracking(): Promise<void> {
  setNativeLocationIssue(null);
  lastSession = null;
  if (!watcherId) return;
  try {
    await BackgroundGeolocation.removeWatcher({ id: watcherId });
  } finally {
    watcherId = null;
    lastPostAt = 0;
    cachedDriverId = null;
    motionState = createMotionState();
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
  motionState = nextMotionState(motionState, location.speed);
  // null on iOS (WKWebView has no Battery API); a real value on Android.
  const batteryLevel = await readBatteryLevel();
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
        battery_level: batteryLevel,
        is_moving: motionState.isMoving,
        // No fix time is sent (server stamps NOW()), but the send time still
        // lets the server log a skewed device clock.
        client_sent_at: Date.now(),
      }),
    });
  } catch {
    /* background network blip — next fix retries */
  }
}
