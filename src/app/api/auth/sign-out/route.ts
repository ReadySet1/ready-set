import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient, getDefaultCookieOptions } from '@/utils/supabase/server';

/**
 * POST /api/auth/sign-out — the server half of sign-out.
 *
 * The browser supabase client clears its session cookies through
 * `document.cookie`. Inside the iOS WKWebView shell those writes are not
 * reliably visible to the next top-level navigation, so the server kept seeing
 * a session: /sign-in then 307-redirected back to /driver, WKWebView failed
 * that provisional navigation and bounced the driver out to Safari, still
 * signed in. Clearing the cookies with Set-Cookie headers here goes through the
 * network layer, which is the store every later request reads from.
 *
 * POST only (never GET), so a cross-site link or <img> can't log a user out;
 * the auth cookies are SameSite=Lax, so a cross-site form POST carries no
 * session to act on. No auth guard: signing out with no session is a no-op.
 */

/** Supabase auth cookies (incl. `.0`/`.1` chunks and the PKCE code verifier). */
const SUPABASE_AUTH_COOKIE = /^sb-.+-auth-token/;
/** App-level cookie mirroring the session for fast hydration. */
const APP_SESSION_COOKIES = new Set(['user-session-data']);

export async function POST() {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('[sign-out] supabase signOut returned an error:', error);
    }
  } catch (error) {
    console.error('[sign-out] supabase signOut failed:', error);
  }

  // Expire every auth cookie the request carried, even when signOut failed
  // (supabase-js keeps the session on some GoTrue errors) — the user asked to
  // leave, so the cookies go regardless.
  try {
    const cookieStore = await cookies();
    for (const { name } of cookieStore.getAll()) {
      if (SUPABASE_AUTH_COOKIE.test(name) || APP_SESSION_COOKIES.has(name)) {
        cookieStore.set(name, '', getDefaultCookieOptions({ maxAge: 0 }));
      }
    }
  } catch (error) {
    console.error('[sign-out] clearing auth cookies failed:', error);
  }

  return NextResponse.json(
    { success: true },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
