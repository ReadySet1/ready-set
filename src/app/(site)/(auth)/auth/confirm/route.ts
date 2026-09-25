// app/auth/confirm/route.ts
import { type EmailOtpType } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
// The client you created from the Server-Side Auth instructions
import { createClient } from '@/utils/supabase/server'
import { setSentryUser } from '@/lib/monitoring/sentry'
import { safeRedirectPath, siteUrl } from '@/lib/site-url'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  // Built on the configured origin: behind the proxy `request.nextUrl` points
  // at the container's bind address (0.0.0.0:3000).
  const next = safeRedirectPath(searchParams.get('next'))

  if (token_hash && type) {
    const supabase = await createClient()

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })
    if (!error) {
      // Get user session to set Sentry context
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // Fetch user profile for role information
        const { data: profile } = await supabase
          .from('profiles')
          .select('type')
          .eq('id', user.id)
          .maybeSingle()

        // Set Sentry user context for error tracking
        setSentryUser({
          id: user.id,
          email: user.email || undefined,
          role: profile?.type
        })
      }

      return NextResponse.redirect(siteUrl(next))
    }
  }

  // return the user to an error page with some instructions
  return NextResponse.redirect(siteUrl('/auth/auth-code-error'))
}