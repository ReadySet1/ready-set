// src/utils/supabase/client.ts
'use client'

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { type CookieOptions } from '@supabase/ssr'

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
    const cookie = document.cookie
      .split('; ')
      .find(row => row.startsWith(`${name}=`))
    return cookie ? cookie.split('=')[1] : null
  } catch (e) {
    return null
  }
}

const setStorageCookie = (name: string, value: string, options: CookieOptions = {}) => {
  try {
    let cookieString = `${name}=${value}; path=${options.path || '/'}`
    if (options.maxAge) cookieString += `; max-age=${options.maxAge}`
    if (options.domain) cookieString += `; domain=${options.domain}`
    if (options.secure) cookieString += '; secure'
    if (options.sameSite) cookieString += `; samesite=${options.sameSite}`
    document.cookie = cookieString
  } catch (e) {
    console.error('Error setting cookie:', e)
  }
}

const removeStorageCookie = (name: string, options: CookieOptions = {}) => {
  try {
    setStorageCookie(name, '', { ...options, maxAge: -1 })
  } catch (e) {
    console.error('Error removing cookie:', e)
  }
}

/**
 * Creates a Supabase client for browser environments
 */
export const createClient = (): SupabaseClient => {
  if (!supabaseInstance) {
    try {
      supabaseInstance = createBrowserClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          get: (name: string) => getStorageCookie(name),
          set: (name: string, value: string, options: CookieOptions) => 
            setStorageCookie(name, value, options),
          remove: (name: string, options: CookieOptions) => 
            removeStorageCookie(name, options)
        },
        auth: {
          flowType: 'pkce',
          detectSessionInUrl: true,
          autoRefreshToken: true,
          persistSession: true
        }
      });
    } catch (error) {
      console.error('Error creating Supabase client:', error);
      throw error;
    }
  }
  return supabaseInstance;
};

/**
 * Clears all Supabase-related cookies for auth recovery
 */
export const clearSupabaseCookies = () => {
  const cookieOptions: CookieOptions = {
    path: '/',
    domain: window.location.hostname,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  };

  try {
    // Clear all potential Supabase cookies
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
      removeStorageCookie(name, cookieOptions);
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
    supabaseInstance = null;
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

/**
 * Session persistence helpers for immediate auth state access
 */
export const setImmediateSessionData = (sessionData: {
  userId: string;
  email: string;
  userRole: string;
  timestamp: number;
}) => {
  try {
    const cookieString = JSON.stringify(sessionData);
    document.cookie = `user-session-data=${encodeURIComponent(cookieString)}; path=/; max-age=300; samesite=lax${process.env.NODE_ENV === 'production' ? '; secure' : ''}`;
    console.log('Set immediate session data:', sessionData);
  } catch (error) {
    console.error('Error setting immediate session data:', error);
  }
};

export const getImmediateSessionData = () => {
  try {
    const cookie = document.cookie
      .split('; ')
      .find(row => row.startsWith('user-session-data='));
    
    if (!cookie) return null;
    
    const sessionDataStr = cookie.split('=')[1];
    if (!sessionDataStr) return null;
    const sessionData = JSON.parse(decodeURIComponent(sessionDataStr));
    
    // Check if session data is recent (within 5 minutes)
    const isRecent = Date.now() - sessionData.timestamp < 5 * 60 * 1000;
    if (!isRecent) {
      clearImmediateSessionData();
      return null;
    }
    
    return sessionData;
  } catch (error) {
    console.error('Error getting immediate session data:', error);
    return null;
  }
};

export const clearImmediateSessionData = () => {
  try {
    document.cookie = 'user-session-data=; path=/; max-age=0; samesite=lax';
    console.log('Cleared immediate session data');
  } catch (error) {
    console.error('Error clearing immediate session data:', error);
  }
};

/**
 * Prefetches and caches user profile data for faster subsequent loads
 */
export const prefetchUserProfile = async (userId: string) => {
  try {
    const supabase = createClient();
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('type, email, name')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error('Error prefetching user profile:', error);
      return null;
    }
    
    // Cache in sessionStorage for the session duration
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(`user-profile-${userId}`, JSON.stringify({
        ...profile,
        timestamp: Date.now()
      }));
    }
    
    return profile;
  } catch (error) {
    console.error('Error in prefetchUserProfile:', error);
    return null;
  }
};

/**
 * Gets cached user profile data if available and recent
 */
export const getCachedUserProfile = (userId: string) => {
  try {
    if (typeof window === 'undefined') return null;
    
    // Try sessionStorage first (session-scoped)
    let cached = sessionStorage.getItem(`user-profile-${userId}`);
    let isSessionStorage = true;
    
    // Fall back to localStorage (persistent across sessions)
    if (!cached) {
      cached = localStorage.getItem(`user-profile-${userId}`);
      isSessionStorage = false;
    }
    
    if (!cached) return null;
    
    const profileData = JSON.parse(cached);
    
    // Different TTL for different storage types
    const ttl = isSessionStorage ? 10 * 60 * 1000 : 30 * 60 * 1000; // 10min session, 30min local
    const isRecent = Date.now() - profileData.timestamp < ttl;
    
    if (!isRecent) {
      // Clear both storages if expired
      sessionStorage.removeItem(`user-profile-${userId}`);
      localStorage.removeItem(`user-profile-${userId}`);
      return null;
    }
    
    // If found in localStorage but not sessionStorage, copy to session for faster access
    if (!isSessionStorage) {
      sessionStorage.setItem(`user-profile-${userId}`, cached);
    }
    
    return profileData;
  } catch (error) {
    console.error('Error getting cached user profile:', error);
    return null;
  }
};

/**
 * Enhanced caching with multiple storage layers
 */
export const setCachedUserProfile = (userId: string, profileData: any, persistent: boolean = false) => {
  try {
    if (typeof window === 'undefined') return;
    
    const dataWithTimestamp = {
      ...profileData,
      timestamp: Date.now()
    };
    
    const dataStr = JSON.stringify(dataWithTimestamp);
    
    // Always store in sessionStorage for immediate access
    sessionStorage.setItem(`user-profile-${userId}`, dataStr);
    
    // Optionally store in localStorage for persistence across sessions
    if (persistent) {
      localStorage.setItem(`user-profile-${userId}`, dataStr);
    }
    
    console.log(`Cached user profile for ${userId}`, { persistent, data: profileData });
  } catch (error) {
    console.error('Error caching user profile:', error);
  }
};

/**
 * Retry mechanism for auth operations
 */
interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  retryCondition?: (error: any) => boolean;
}

export const retryAuthOperation = async <T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> => {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
    retryCondition = (error) => {
      // Default: retry on network errors, timeouts, and certain auth errors
      const retryableMessages = [
        'network',
        'timeout',
        'connection',
        'temporary',
        'rate limit',
        'server error',
        '5',
        'auth session missing',
        'session missing',
        'session not found'
      ];
      
      const errorMessage = error?.message?.toLowerCase() || '';
      return retryableMessages.some(msg => errorMessage.includes(msg));
    }
  } = options;

  let lastError: any;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`Auth operation attempt ${attempt}/${maxAttempts}`);
      const result = await operation();
      
      if (attempt > 1) {
        console.log(`Auth operation succeeded on attempt ${attempt}`);
      }
      
      return result;
    } catch (error) {
      lastError = error;
      console.error(`Auth operation failed on attempt ${attempt}:`, error);
      
      // Don't retry on the last attempt or if error is not retryable
      if (attempt === maxAttempts || !retryCondition(error)) {
        break;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(baseDelay * Math.pow(backoffFactor, attempt - 1), maxDelay);
      console.log(`Retrying in ${delay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  console.error(`Auth operation failed after ${maxAttempts} attempts`);
  throw lastError;
};

/**
 * Enhanced auth state persistence across page reloads
 */
export const persistAuthState = (authState: {
  userId: string;
  email: string;
  userRole: string;
  sessionData?: any;
}) => {
  try {
    if (typeof window === 'undefined') return;
    
    const persistentState = {
      ...authState,
      timestamp: Date.now(),
      version: '1.0' // For future migrations
    };
    
    // Store in both storages
    const stateStr = JSON.stringify(persistentState);
    sessionStorage.setItem('auth-state', stateStr);
    localStorage.setItem('auth-state-backup', stateStr);
    
    console.log('Persisted auth state across storages');
  } catch (error) {
    console.error('Error persisting auth state:', error);
  }
};

export const getPersistedAuthState = () => {
  try {
    if (typeof window === 'undefined') return null;
    
    // Try sessionStorage first, then localStorage
    let stateStr = sessionStorage.getItem('auth-state');
    if (!stateStr) {
      stateStr = localStorage.getItem('auth-state-backup');
    }
    
    if (!stateStr) return null;
    
    const authState = JSON.parse(stateStr);
    
    // Check if persisted state is recent (within 1 hour)
    const isRecent = Date.now() - authState.timestamp < 60 * 60 * 1000;
    if (!isRecent) {
      clearPersistedAuthState();
      return null;
    }
    
    return authState;
  } catch (error) {
    console.error('Error getting persisted auth state:', error);
    return null;
  }
};

export const clearPersistedAuthState = () => {
  try {
    if (typeof window === 'undefined') return;
    
    sessionStorage.removeItem('auth-state');
    localStorage.removeItem('auth-state-backup');
    
    console.log('Cleared persisted auth state');
  } catch (error) {
    console.error('Error clearing persisted auth state:', error);
  }
};

/**
 * Enhanced auth state recovery with retry mechanisms
 */
export const recoverAuthStateWithRetry = async () => {
  return retryAuthOperation(
    async () => {
      console.log('Attempting auth state recovery...');
      
      // Try multiple recovery methods in order of reliability
      const recoveryMethods = [
        () => getPersistedAuthState(),
        () => getImmediateSessionData(),
        () => {
          // Try to get fresh session from Supabase
          const supabase = createClient();
          return supabase.auth.getSession();
        }
      ];
      
      for (const method of recoveryMethods) {
        try {
          const result = await method();
          if (result) {
            console.log('Auth state recovered successfully');
            return result;
          }
        } catch (error) {
          console.warn('Recovery method failed:', error);
          continue;
        }
      }
      
      throw new Error('All auth recovery methods failed');
    },
    {
      maxAttempts: 2,
      baseDelay: 500,
      retryCondition: (error) => {
        // Retry if it's a network/temporary error, but not if auth is actually invalid
        return !error.message.includes('invalid') && !error.message.includes('expired');
      }
    }
  );
};