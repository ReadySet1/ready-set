// utils/supabase/auth-helpers.ts

import { siteUrl } from '@/lib/site-url';

/**
 * Gets the appropriate redirect URL based on the current environment
 * Works in both client and server contexts
 *
 * The app no longer runs on Vercel, so the former `VERCEL_URL` branch has been
 * removed — it could only ever resolve to a host that is now dead.
 */
export function getRedirectUrl(): string {
  // Make sure we always include the /auth/callback path
  const callbackPath = '/auth/callback';

  // For client-side, the live origin is always the most accurate answer
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${callbackPath}`;
  }

  // For server-side, fall back to the configured site origin
  return siteUrl(callbackPath);
}

/**
 * Function to handle OAuth sign-in with dynamic redirect
 */
export async function signInWithOAuth(
  supabase: any, 
  provider: 'google' | 'github' | 'facebook' | 'azure' | 'twitter',
  options: any = {}
) {
  return supabase.auth.signInWithOAuth({
    provider,
    options: {
      ...options,
      redirectTo: getRedirectUrl()
    }
  });
}