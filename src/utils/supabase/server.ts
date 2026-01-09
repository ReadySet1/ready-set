// src/utils/supabase/server.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextApiRequest, NextApiResponse } from 'next'
import { parseCookies, setCookie } from 'nookies'
import { cookies } from 'next/headers'
import { type Database } from '@/types/supabase'

// Cookie options optimized for mobile Safari compatibility (ITP)
const getDefaultCookieOptions = (options?: CookieOptions): CookieOptions => ({
  path: '/',
  sameSite: 'lax', // 'lax' is more compatible with mobile Safari than 'strict'
  secure: process.env.NODE_ENV === 'production',
  httpOnly: true,
  ...options,
})

// For App Router usage - this uses next/headers which only works in the App Router
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            // Apply default cookie options for mobile Safari compatibility
            const cookieOptions = getDefaultCookieOptions(options)
            cookieStore.set(name, value, cookieOptions)
          } catch (error) {
            // Log errors during cookie setting for debugging
            console.error(`Failed to set cookie "${name}":`, error)
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions. However, during login this IS critical.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            const cookieOptions = getDefaultCookieOptions({ ...options, maxAge: 0 })
            cookieStore.set(name, '', cookieOptions)
          } catch {
            // The `remove` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        }
      },
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true
      }
    }
  )
}

/**
 * Creates a Supabase admin client with service role privileges.
 *
 * This client bypasses Row Level Security (RLS) and should only be used
 * after proper authentication has been verified via the regular client.
 *
 * ⚠️ **SECURITY WARNING**: This client has elevated privileges and bypasses ALL RLS policies.
 * Only use this client for operations that genuinely require admin access, and ALWAYS
 * verify user authentication via the regular client first.
 *
 * @throws {Error} If SUPABASE_SERVICE_ROLE_KEY environment variable is not configured
 * @returns {Promise<SupabaseClient<Database>>} Admin client instance with service role privileges
 *
 * @example
 * ```typescript
 * // ✅ CORRECT: Verify authentication first, then use admin client
 * const supabase = await createClient();
 * const { data: { user } } = await supabase.auth.getUser();
 * if (!user) {
 *   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 * }
 *
 * // Now safe to use admin client for storage operations
 * const adminSupabase = await createAdminClient();
 * await adminSupabase.storage.from('bucket').upload(path, file);
 * ```
 *
 * @example
 * ```typescript
 * // ❌ INCORRECT: Never use admin client without authentication check
 * const adminSupabase = await createAdminClient();
 * await adminSupabase.storage.from('bucket').upload(path, file); // Security vulnerability!
 * ```
 *
 * @remarks
 * - Uses `SUPABASE_SERVICE_ROLE_KEY` for elevated privileges
 * - Does not maintain session state (`persistSession: false`)
 * - Does not auto-refresh tokens (`autoRefreshToken: false`)
 * - Bypasses all RLS policies - use with extreme caution
 */
export async function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

// For Pages Router API routes
export function createServerSupabaseClient(context: { req: NextApiRequest; res: NextApiResponse }) {
  const { req, res } = context

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return parseCookies({ req })[name]
        },
        set(name: string, value: string, options: CookieOptions) {
          // Apply default cookie options for mobile Safari compatibility
          const cookieOptions = getDefaultCookieOptions(options)
          setCookie({ res }, name, value, cookieOptions)
        },
        remove(name: string, options: CookieOptions) {
          const cookieOptions = getDefaultCookieOptions({ ...options, maxAge: 0 })
          setCookie({ res }, name, '', cookieOptions)
        }
      },
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true
      }
    }
  )
}