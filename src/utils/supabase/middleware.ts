// utils/supabase/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Cookie options optimized for mobile Safari compatibility (ITP).
//
// ⚠️ DO NOT add `httpOnly: true` here. These options are applied to every
// cookie @supabase/ssr writes during the middleware session refresh, including
// the `sb-<ref>-auth-token` chunks. The browser supabase-js client
// (src/utils/supabase/client.ts) reads the session via `document.cookie`, which
// by spec cannot see HttpOnly cookies — so an HttpOnly auth cookie makes
// `getSession()` return null in the browser, breaks all Supabase Realtime
// flows, and surfaces as REFRESH_FAILED (Sentry READY-SET-NEXTJS-1S).
// Regression history: REA-DRT-07 (httpOnly was wrongly added in f49f6ec5).
// The XSS tradeoff is accepted and mitigated by CSP + short-lived JWTs +
// refresh-token rotation.
export const getCookieOptions = (options?: Record<string, unknown>) => ({
  path: '/',
  sameSite: 'lax' as const, // 'lax' is more compatible with mobile Safari than 'strict'
  secure: process.env.NODE_ENV === 'production',
  ...options,
})

export async function updateSession(request: NextRequest) {
  // Create a response object to modify its cookies
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  try {
    // Create the Supabase client with explicit cookie options for mobile Safari
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name) {
            return request.cookies.get(name)?.value
          },
          set(name, value, options) {
            // Set cookies with explicit options for mobile Safari compatibility
            const cookieOptions = getCookieOptions(options)

            // Update request cookies for downstream middleware/routes
            request.cookies.set({
              name,
              value,
              ...cookieOptions,
            })

            // Update response cookies to send back to browser
            response.cookies.set({
              name,
              value,
              ...cookieOptions,
            })
          },
          remove(name, options) {
            const cookieOptions = getCookieOptions({ ...options, maxAge: 0 })

            request.cookies.set({
              name,
              value: '',
              ...cookieOptions,
            })

            response.cookies.set({
              name,
              value: '',
              ...cookieOptions,
            })
          },
        },
      }
    )

    // Refresh the session - this validates existing tokens and refreshes if needed
    // The getUser() call is essential for token refresh on each request
    await supabase.auth.getUser()

    return response
  } catch (error) {
    console.error('Error in updateSession middleware:', error)
    throw error
  }
}