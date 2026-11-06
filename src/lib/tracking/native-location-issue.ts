/**
 * Why native background location could not start, plus the copy that explains
 * it to the driver. Web-safe (no Capacitor import): the bridge in
 * capacitor-tracking.ts writes the current issue here, and the
 * NativeLocationPrompt component in the /driver layout reads it.
 *
 * Exists because the plugin used to reject with NOT_AUTHORIZED and we silently
 * opened the app's Settings page — on every shift when the phone's Location was
 * off or the driver had picked "Only this time" (card
 * android-location-prompt-every-run).
 */

export type NativeLocationIssue =
  /** The OS permission dialog can be shown (first run, or after a denial). */
  | 'permission-needed'
  /** A previous one-time ("Only this time") grant expired — Android asks again. */
  | 'permission-expired'
  /** Permanently denied — only the app's Settings page can fix it. */
  | 'permission-blocked'
  /** Permission is fine but the phone's Location toggle is off. */
  | 'location-off';

export interface NativeLocationIssueCopy {
  title: string;
  body: string;
  actionLabel: string;
}

const PICK_THE_RIGHT_OPTION =
  'On the next screen choose "While using the app" and keep "Precise" on. ' +
  'Don\'t pick "Only this time" or "Approximate" — those make the app ask again every shift.';

const COPY: Record<NativeLocationIssue, NativeLocationIssueCopy> = {
  'permission-needed': {
    title: 'Allow location for your shift',
    body:
      'Ready Set uses your location during your shift so dispatch and customers can ' +
      'follow your deliveries, even when your screen is off or you are in Waze. ' +
      PICK_THE_RIGHT_OPTION,
    actionLabel: 'Continue',
  },
  'permission-expired': {
    title: 'Location permission expired',
    body:
      'Location was allowed "Only this time" on a previous shift, so your phone is ' +
      'asking again. ' +
      PICK_THE_RIGHT_OPTION,
    actionLabel: 'Continue',
  },
  'permission-blocked': {
    title: 'Location access is turned off',
    body:
      'Ready Set can\'t track your deliveries until location access is allowed. Tap ' +
      'Open Settings, go to Permissions → Location, choose "Allow all the time" (or ' +
      '"Allow only while using the app") and turn on "Use precise location". Then ' +
      'come back to Ready Set.',
    actionLabel: 'Open Settings',
  },
  'location-off': {
    title: "Turn on your phone's Location",
    body:
      "Your phone's Location is off, so Ready Set can't track your deliveries. Swipe " +
      'down from the top of the screen and tap Location to turn it on, then tap Try again.',
    actionLabel: 'Try again',
  },
};

export function getNativeLocationIssueCopy(
  issue: NativeLocationIssue,
): NativeLocationIssueCopy {
  return COPY[issue];
}

// ── Tiny external store (read via useSyncExternalStore) ─────────────────────

let currentIssue: NativeLocationIssue | null = null;
const listeners = new Set<() => void>();

export function getNativeLocationIssue(): NativeLocationIssue | null {
  return currentIssue;
}

export function setNativeLocationIssue(issue: NativeLocationIssue | null): void {
  if (issue === currentIssue) return;
  currentIssue = issue;
  listeners.forEach((listener) => listener());
}

export function subscribeNativeLocationIssue(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
