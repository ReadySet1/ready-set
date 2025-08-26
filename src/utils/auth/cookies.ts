// src/utils/auth/cookies.ts

/**
 * Clears all authentication-related cookies
 * This should be called during sign-out to ensure proper cleanup
 */
export const clearAuthCookies = (): void => {
  if (typeof window === "undefined") return;

  const cookiesToClear = [
    "user-session-data",
    "sb-access-token", 
    "sb-refresh-token",
    "sb-auth-token",
    "supabase-auth-token"
  ];

  cookiesToClear.forEach(cookieName => {
    // Clear cookie by setting expiration to past date
    document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    // Also try to clear with different path variations
    document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
    document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${window.location.hostname};`;
  });

  console.log("🧹 Auth cookies cleared successfully");
};

/**
 * Checks if any authentication cookies exist
 * Useful for determining if a user might still be authenticated
 */
export const hasAuthCookies = (): boolean => {
  if (typeof window === "undefined") return false;

  const cookies = document.cookie;
  const authCookieNames = [
    "user-session-data",
    "sb-access-token",
    "sb-refresh-token"
  ];

  return authCookieNames.some(name => cookies.includes(name));
};

/**
 * Gets the value of a specific cookie
 */
export const getCookie = (name: string): string | null => {
  if (typeof window === "undefined") return null;

  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match && match[2] ? decodeURIComponent(match[2]) : null;
};

/**
 * Sets a cookie with proper encoding
 */
export const setCookie = (name: string, value: string, options: {
  expires?: Date;
  path?: string;
  domain?: string;
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
} = {}): void => {
  if (typeof window === "undefined") return;

  const {
    expires = new Date(Date.now() + 24 * 60 * 60 * 1000), // Default: 24 hours
    path = "/",
    domain,
    secure = window.location.protocol === "https:",
    sameSite = "lax"
  } = options;

  let cookieString = `${name}=${encodeURIComponent(value)}`;
  
  if (expires) {
    cookieString += `; expires=${expires.toUTCString()}`;
  }
  
  if (path) {
    cookieString += `; path=${path}`;
  }
  
  if (domain) {
    cookieString += `; domain=${domain}`;
  }
  
  if (secure) {
    cookieString += "; secure";
  }
  
  if (sameSite) {
    cookieString += `; samesite=${sameSite}`;
  }

  document.cookie = cookieString;
};
