'use client';

import { createClient } from '@/utils/supabase/client';

/**
 * Bearer transport for critical driver calls.
 *
 * 2026-08 field failure (iOS Safari, mid-shift): the Supabase auth COOKIES
 * went stale while the JS in-memory session stayed valid — every
 * cookie-authenticated call failed (POD upload, end-shift, reload → /sign-in)
 * while the one Bearer-token call kept working. Critical driver requests
 * therefore attach the in-memory access token as `Authorization: Bearer`;
 * cookies remain the server-side fallback (`credentials: 'include'` stays on
 * the fetches).
 */
export async function getSessionAccessToken(): Promise<string | null> {
  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch {
    // Signed out / client unavailable — the cookie fallback still applies.
    return null;
  }
}

/** Fetch headers carrying the Bearer token when a session exists. */
export async function withBearerAuth(
  base: Record<string, string> = {},
): Promise<Record<string, string>> {
  const token = await getSessionAccessToken();
  return token ? { ...base, Authorization: `Bearer ${token}` } : { ...base };
}
