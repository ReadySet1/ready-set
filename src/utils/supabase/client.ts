// src/utils/supabase/client.ts
'use client'

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { type CookieOptions } from '@supabase/ssr'
import type { Database } from '@/types/supabase'

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Create a singleton instance
let supabaseInstance: SupabaseClient | null = null;

const getStorageCookie = (name: string) => {
  try {
    // Simple cookie getter that doesn't attempt to parse
    const cookie = document.cookie
      .split('; ')
      .find(row => row.startsWith(`${name}=`))
    
    if (!cookie) return null
    
    // Return the raw value - don't try to decode or parse
    const rawValue = cookie.split('=')[1]
    console.log(`Got client cookie ${name} (${rawValue ? rawValue.length : 0} chars)`)
    return rawValue
  } catch (e) {
    console.error('Error getting cookie:', e);
    return null
  }
}

const setStorageCookie = (name: string, value: string, options: CookieOptions = {}) => {
  try {
    // Add security and compatibility improvements
    const isProd = process.env.NODE_ENV === 'production';
    const domain = isProd ? 'development.readysetllc.com' : undefined;
    
    let cookieString = `${name}=${value}; path=${options.path || '/'}`
    if (options.maxAge) cookieString += `; max-age=${options.maxAge}`
    if (domain) cookieString += `; domain=${domain}`
    if (isProd) cookieString += '; secure'
    
    // Use SameSite=None for cross-site cookies in production
    // This helps with redirects between domains
    const sameSite = isProd ? 'none' : 'lax';
    cookieString += `; samesite=${sameSite}`
    
    // IMPORTANT: Browser cookies cannot be httpOnly when set from JavaScript
    // This property can only be set by the server
    // Remove httpOnly from client-side cookies
    // cookieString += '; httponly'
    
    document.cookie = cookieString
    console.log(`Client cookie set: ${name} (${value ? value.length : 0} chars)`);
  } catch (e) {
    console.error('Error setting cookie:', e)
  }
}

const removeStorageCookie = (name: string, options: CookieOptions = {}) => {
  try {
    setStorageCookie(name, '', { ...options, maxAge: -1 })
    console.log(`Client cookie removed: ${name}`);
  } catch (e) {
    console.error('Error removing cookie:', e)
  }
}

/**
 * Creates a Supabase client for browser environments
 */
export function createClient() {
  return createBrowserClient({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  })
}

/**
 * Clears all Supabase-related cookies for auth recovery
 */
export const clearSupabaseCookies = () => {
  try {
    // Clear all potential Supabase cookies
    const cookieOptions = {
      path: '/',
      domain: window.location.hostname,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    };

    const cookieNames = [
      'supabase-auth-token',
      'sb-access-token',
      'sb-refresh-token', 
      'sb-provider-token',
      'sb-auth-token',
      'pkce-verifier',
      'sb-token',
      'sb-refresh-token'
    ];
    
    cookieNames.forEach(name => {
      document.cookie = `${name}=; path=${cookieOptions.path}; max-age=-1; domain=${cookieOptions.domain}; ${cookieOptions.secure ? 'secure;' : ''} samesite=${cookieOptions.sameSite}`;
    });
    
    // Also clear local storage items
    try {
      localStorage.clear();
    } catch (e) {
      console.error('Failed to clear localStorage:', e);
    }

    console.log('Cleared Supabase cookies and storage for auth recovery');
  } catch (error) {
    console.error('Error clearing cookies:', error);
  }
};

/**
 * Attempts to recover from auth errors by clearing cookies and refreshing the session
 */
export const retryAuth = async () => {
  try {
    clearSupabaseCookies();
    const supabase = createClient();
    const { data, error } = await supabase.auth.refreshSession();
    
    if (error) {
      console.error('Session refresh error during retry:', error);
      return { success: false, error };
    }
    
    return { success: !!data.session, session: data.session };
  } catch (error) {
    console.error('Retry auth error:', error);
    return { success: false, error };
  }
};