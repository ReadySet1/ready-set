import type { User } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';

/** Minimal request shape — NextRequest and the standard Request both fit. */
interface HasHeaders {
  headers: { get(name: string): string | null };
}

/**
 * Resolve the authenticated user of a route-handler request, preferring the
 * `Authorization: Bearer` token and falling back to session cookies.
 *
 * 2026-08 field failure (iOS Safari, mid-shift): the auth cookies went stale
 * while the client's in-memory session stayed valid, so cookie-only
 * `auth.getUser()` 401'd every driver call. Accepting the Bearer token first
 * keeps those flows working; the cookie path is unchanged for callers that
 * don't send a token. Mirrors the transport order in withAuth
 * (src/lib/auth-middleware.ts).
 */
export async function getRequestUser(request: HasHeaders): Promise<User | null> {
  const supabase = await createClient();

  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length);
    const { data } = await supabase.auth.getUser(token);
    if (data.user) return data.user;
  }

  const { data } = await supabase.auth.getUser();
  return data.user;
}
