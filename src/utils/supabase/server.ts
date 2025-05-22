// src/utils/supabase/server.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr'
// import { NextApiRequest, NextApiResponse } from 'next' // Not used if Pages Router client is removed/unused
// import { parseCookies, setCookie } from 'nookies' // Not used if Pages Router client is removed/unused
import { cookies } from 'next/headers'
import { type Database } from '@/types/supabase'

// For App Router usage - this uses next/headers which only works in the App Router
export function createClient(cookieStore = cookies()) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value
        },
        set(name, value, options) {
          try {
            cookieStore.set(name, value, options)
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name, options) {
          try {
            cookieStore.delete(name, options)
          } catch (error) {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
      // Using default auth options from @supabase/ssr unless overrides are specifically needed.
      // auth: {
      //   flowType: 'pkce', // Default for JS library
      //   detectSessionInUrl: true, // Default for server client
      //   persistSession: true, // Default
      //   autoRefreshToken: true // Default
      // }
    }
  )
}

// For admin operations that require elevated privileges - App Router only
export async function createAdminClient() { // Reverted to async
  const cookieStore = await cookies() // Added await
  
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // Using service role key
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
            // console.log(`Set admin cookie ${name} successfully (${value.slice(0, 10)}...)`);
          } catch (error) {
            console.error(`Error setting admin cookie ${name}:`, error)
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
            // console.log(`Removed admin cookie ${name} successfully`);
          } catch (error) {
            console.error(`Error removing admin cookie ${name}:`, error)
          }
        }
      },
      // auth: { // Service role client typically doesn't manage user sessions in the same way
      //   autoRefreshToken: false,
      //   persistSession: false,
      //   detectSessionInUrl: false, // Usually not relevant for service role
      // }
    }
  )
}

// Commenting out Pages Router client if not used, to reduce complexity.
// If you still use Pages Router API routes, you can uncomment this.
/*
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
          setCookie({ res }, name, value, {
            ...options,
            path: '/'
          })
        },
        remove(name: string, options: CookieOptions) {
          setCookie({ res }, name, '', {
            ...options,
            path: '/',
            maxAge: 0
          })
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
*/