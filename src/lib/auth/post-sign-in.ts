'use client';

/**
 * Where a successful password sign-in lands, for the browser and the native
 * (Capacitor) shell.
 *
 * The sign-in form full-loads the destination the login action returned so the
 * fresh Set-Cookie headers are applied. Inside the iOS WKWebView shell the new
 * session cookie is not reliably visible to that very next top-level load: the
 * server sees no session, middleware 307s `/driver` back to
 * `/sign-in?returnTo=/driver`, and a 307 on a top-level WKWebView navigation
 * fails the provisional load and opens Safari (the captured Safari URL was
 * exactly that). The WebView then finishes the sign-in on its own, so the
 * driver ends up signed in with Safari open next to the app.
 *
 * Inside the shell we therefore full-load `/native-launch` instead: it always
 * answers 200 and routes client-side, where a late redirect is followed by the
 * app router inside the WebView rather than by WKWebView. Any destination other
 * than the driver home rides along as `?next=` so it is not lost (e.g.
 * `/force-password-change`). Plain web is unchanged.
 */

import { isCapacitorNative } from '@/lib/tracking/native-shift-tracking';

export const NATIVE_LAUNCH_PATH = '/native-launch';
const NATIVE_HOME = '/driver';

// Placeholder origin: only used to check that a path cannot leave the site.
const PROBE_ORIGIN = 'https://internal.invalid';
// Control characters and whitespace. The URL parser silently strips tab/LF/CR,
// so `/\t/evil.example` would otherwise resolve to `//evil.example`.
const CONTROL_OR_WHITESPACE = /[\u0000-\u001f\u007f\s]/;

/**
 * Same-origin, root-relative path only. Rejects protocol-relative (`//host`),
 * backslash (`/\host`, which browsers normalise to `//host`) and any path with
 * control characters or whitespace, then confirms the path resolves on the
 * same origin the way a browser would parse it.
 */
export function isSafeInternalPath(path: string | null | undefined): path is string {
  if (typeof path !== 'string' || !path.startsWith('/')) return false;
  if (path.startsWith('//') || path.startsWith('/\\')) return false;
  if (CONTROL_OR_WHITESPACE.test(path)) return false;

  try {
    return new URL(path, PROBE_ORIGIN).origin === PROBE_ORIGIN;
  } catch {
    return false;
  }
}

export function signedInDestination(redirectTo: string): string {
  if (!isCapacitorNative()) return redirectTo || '/';

  if (!isSafeInternalPath(redirectTo) || redirectTo === '/' || redirectTo === NATIVE_HOME) {
    return NATIVE_LAUNCH_PATH;
  }
  return `${NATIVE_LAUNCH_PATH}?next=${encodeURIComponent(redirectTo)}`;
}

export function navigateAfterSignIn(
  redirectTo: string,
  navigate: (url: string) => void = (url) => {
    window.location.href = url;
  },
): void {
  navigate(signedInDestination(redirectTo));
}
