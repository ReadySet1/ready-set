// src/utils/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
// import { NextApiRequest, NextApiResponse } from 'next' // Not used if Pages Router client is removed/unused
// import { parseCookies, setCookie } from 'nookies' // Not used if Pages Router client is removed/unused
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

// Definimos los tipos que necesitamos localmente para evitar dependencias rotas
type CookieOption = {
  name: string
  value: string
  maxAge?: number
  domain?: string
  path?: string
  sameSite?: 'lax' | 'strict' | 'none'
  secure?: boolean
  httpOnly?: boolean
}

type Cookie = {
  name: string
  value: string
  options?: CookieOption
}

// For App Router usage - this uses next/headers which only works in the App Router
export function createClient() {
  const cookieStore = cookies()
  
  return createServerClient<Database>({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set({ name, value, ...options })
          )
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  })
}

// For admin operations that require elevated privileges - App Router only
export function createAdminClient() {
  const cookieStore = cookies()
  
  return createServerClient<Database>({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set({ name, value, ...options })
          )
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  })
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