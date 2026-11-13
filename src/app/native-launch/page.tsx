'use client';

/**
 * Native wrapper entry point.
 *
 * This route is the iOS/Android Capacitor (WKWebView) shell's entry URL and
 * MUST never issue a server-side redirect: iOS WKWebView fails the provisional
 * navigation when the entry load is redirected (307), which leaves a blank
 * screen and bounces the user out to Safari. Entering at /driver 307s to
 * /sign-in when signed out, and /sign-in server-redirects to /driver when
 * signed in — so this page always renders 200 and routes on the CLIENT after
 * resolving the Supabase session.
 *
 * A signed-in user goes to `?next=` when it is a same-origin path (set by the
 * sign-in form inside the shell, e.g. /force-password-change), else /driver.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { isSafeInternalPath } from '@/lib/auth/post-sign-in';

const SIGNED_OUT_DESTINATION = '/sign-in?returnTo=%2Fdriver';
const SIGNED_IN_DESTINATION = '/driver';

/** Read from window, not useSearchParams, so the page needs no Suspense boundary. */
function signedInDestination(): string {
  const next = new URLSearchParams(window.location.search).get('next');
  return isSafeInternalPath(next) ? next : SIGNED_IN_DESTINATION;
}

export default function NativeLaunchPage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const route = async () => {
      let destination = SIGNED_OUT_DESTINATION;
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          destination = signedInDestination();
        }
      } catch {
        // Session lookup failed — fall back to sign-in rather than leaving
        // the user stuck on the launcher.
      }
      if (!cancelled) {
        router.replace(destination);
      }
    };

    void route();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white">
      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      <p className="text-sm font-medium text-slate-500">Loading Ready Set…</p>
    </div>
  );
}
