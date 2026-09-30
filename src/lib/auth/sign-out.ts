'use client';

/**
 * Single sign-out path for the browser and the native (Capacitor) shell.
 *
 * 1. POST /api/auth/sign-out so the server expires the auth cookies with
 *    Set-Cookie headers. A client-only `supabase.auth.signOut()` clears them
 *    through `document.cookie`, which the iOS WKWebView shell does not reliably
 *    hand to the next navigation — the server kept the session alive.
 * 2. Sign out the browser supabase client and clear legacy cookies.
 * 3. Run the caller's cleanup (e.g. UserContext `logout`).
 * 4. Full-page load to a destination that never server-redirects. Inside the
 *    shell that is /native-launch (always 200, routes client-side): a 307 on a
 *    top-level WKWebView navigation fails the load and bounces the user out to
 *    Safari. Plain web keeps /sign-in.
 *
 * Every step is best-effort; navigation always happens.
 */

import { createClient } from '@/utils/supabase/client';
import { clearAuthCookies } from '@/utils/auth/cookies';
import { isCapacitorNative } from '@/lib/tracking/native-shift-tracking';

export const SERVER_SIGN_OUT_ENDPOINT = '/api/auth/sign-out';
export const NATIVE_SIGNED_OUT_DESTINATION = '/native-launch';
const DEFAULT_WEB_DESTINATION = '/sign-in';
/** Don't strand the user on a hung request; the client sign-out still runs. */
const SERVER_SIGN_OUT_TIMEOUT_MS = 5000;

export interface PerformSignOutOptions {
  /** Extra teardown to run before navigating (e.g. UserContext `logout`). */
  cleanup?: () => unknown;
  /** Where plain-web users land. Ignored inside the native shell. */
  webDestination?: string;
  /** Injected for tests; defaults to a full-page load. */
  navigate?: (url: string) => void;
}

async function step(label: string, fn: () => unknown): Promise<void> {
  try {
    await fn();
  } catch (error) {
    console.error(`[sign-out] ${label} failed:`, error);
  }
}

async function signOutOnServer(): Promise<void> {
  const controller =
    typeof AbortController !== 'undefined' ? new AbortController() : undefined;
  const timer = controller
    ? setTimeout(() => controller.abort(), SERVER_SIGN_OUT_TIMEOUT_MS)
    : undefined;
  try {
    await fetch(SERVER_SIGN_OUT_ENDPOINT, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller?.signal,
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function signedOutDestination(webDestination = DEFAULT_WEB_DESTINATION): string {
  return isCapacitorNative() ? NATIVE_SIGNED_OUT_DESTINATION : webDestination;
}

export async function performSignOut({
  cleanup,
  webDestination,
  navigate = (url) => {
    window.location.href = url;
  },
}: PerformSignOutOptions = {}): Promise<void> {
  await step('server sign-out', signOutOnServer);
  await step('client sign-out', () => createClient().auth.signOut());
  await step('legacy cookie cleanup', clearAuthCookies);
  if (cleanup) await step('cleanup', cleanup);

  navigate(signedOutDestination(webDestination));
}
