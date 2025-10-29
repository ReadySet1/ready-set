// src/lib/auth/oauth-redirect-validator.ts
/**
 * OAuth Redirect Validation Utility
 * Implements exact domain whitelist for OAuth callbacks to prevent subdomain attacks
 *
 * SECURITY: This replaces suffix-based matching to prevent attacks like:
 * - evil.com -> evilreadysetllc.com (suffix match)
 * - attacker-readysetllc.com (subdomain attack)
 */

import { authLogger } from '@/utils/logger';

// Exact whitelist of allowed redirect domains
const ALLOWED_REDIRECT_DOMAINS = [
  'readysetllc.com',
  'www.readysetllc.com',
  'localhost:3000',
  '127.0.0.1:3000',
] as const;

// Production domains only (for production environment checks)
const PRODUCTION_DOMAINS = [
  'readysetllc.com',
  'www.readysetllc.com',
] as const;

/**
 * Validates OAuth redirect URLs against exact domain whitelist
 * @param redirectUrl - The URL to validate
 * @param isProduction - Whether running in production environment
 * @returns true if the redirect URL is safe, false otherwise
 */
export function validateOAuthRedirect(redirectUrl: string, isProduction = false): boolean {
  try {
    // Parse the URL
    const url = new URL(redirectUrl);

    // Get the full host (domain + port)
    const host = url.host.toLowerCase();

    // Select appropriate whitelist based on environment
    const allowedDomains = isProduction ? PRODUCTION_DOMAINS : ALLOWED_REDIRECT_DOMAINS;

    // Exact match validation (no suffix matching)
    const isAllowed = (allowedDomains as readonly string[]).includes(host);

    if (!isAllowed) {
      authLogger.warn('OAuth redirect validation failed', {
        redirectUrl,
        host,
        allowedDomains: allowedDomains,
        reason: 'Host not in whitelist'
      });
    }

    return isAllowed;
  } catch (error) {
    authLogger.error('Error parsing OAuth redirect URL', {
      redirectUrl,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return false;
  }
}

/**
 * Validates OAuth state parameter to prevent CSRF attacks
 *
 * IMPORTANT: State Storage Implementation Required
 *
 * The state parameter must be stored securely before initiating OAuth flow
 * and retrieved during the callback. Recommended implementation:
 *
 * @example
 * // Step 1: Initiating OAuth flow
 * import { generateOAuthState } from '@/lib/auth/oauth-redirect-validator';
 * import { cookies } from 'next/headers';
 *
 * const state = generateOAuthState();
 * cookies().set('oauth_state', state, {
 *   httpOnly: true,
 *   secure: process.env.NODE_ENV === 'production',
 *   sameSite: 'lax',
 *   maxAge: 60 * 10 // 10 minutes
 * });
 * // Redirect to OAuth provider with state parameter
 *
 * @example
 * // Step 2: OAuth callback handler
 * import { validateOAuthState } from '@/lib/auth/oauth-redirect-validator';
 * import { cookies } from 'next/headers';
 *
 * const callbackState = searchParams.get('state');
 * const savedState = cookies().get('oauth_state')?.value;
 *
 * if (!validateOAuthState(callbackState, savedState)) {
 *   return { error: 'Invalid OAuth state - possible CSRF attack' };
 * }
 *
 * // Clear the state cookie after validation
 * cookies().delete('oauth_state');
 *
 * @param state - The state parameter from OAuth callback
 * @param expectedState - The expected state value (stored in session/cookie)
 * @returns true if state is valid, false otherwise
 */
export function validateOAuthState(state: string | null, expectedState: string | null): boolean {
  if (!state || !expectedState) {
    authLogger.warn('OAuth state validation failed: missing state parameter');
    return false;
  }

  const isValid = state === expectedState;

  if (!isValid) {
    authLogger.warn('OAuth state validation failed: state mismatch');
  }

  return isValid;
}

/**
 * Generates a secure random state parameter for OAuth flows
 * @returns A cryptographically secure random string
 */
export function generateOAuthState(): string {
  // Generate 32 bytes of random data
  const array = new Uint8Array(32);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(array);
  } else {
    // Fallback for server-side (Node.js)
    // Using dynamic require for compatibility (wrapped in try-catch)
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const crypto = require('crypto');
      crypto.randomFillSync(array);
    } catch (error) {
      // SECURITY: Never fallback to Math.random() for OAuth state generation
      // OAuth state parameters are critical for CSRF protection and must be cryptographically secure
      authLogger.error('Crypto module not available - OAuth cannot proceed safely', error);
      throw new Error('Secure random number generation unavailable - OAuth cannot proceed safely');
    }
  }

  // Convert to base64url (URL-safe base64)
  // Note: Buffer is available in Node.js but not in browser
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(array)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  } else {
    // Browser fallback using btoa
    const base64 = btoa(String.fromCharCode(...array));
    return base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
}

/**
 * Validates that a URL is using HTTPS in production
 * @param url - The URL to validate
 * @param isProduction - Whether running in production environment
 * @returns true if URL is secure or not in production, false otherwise
 */
export function validateSecureProtocol(url: string, isProduction = false): boolean {
  try {
    const parsedUrl = new URL(url);

    // In production, only allow HTTPS
    if (isProduction && parsedUrl.protocol !== 'https:') {
      authLogger.warn('Insecure protocol in production', {
        url,
        protocol: parsedUrl.protocol
      });
      return false;
    }

    // In development, allow HTTP for localhost
    if (!isProduction && parsedUrl.protocol === 'http:') {
      const host = parsedUrl.hostname;
      if (host === 'localhost' || host === '127.0.0.1') {
        return true;
      }
    }

    return parsedUrl.protocol === 'https:';
  } catch (error) {
    authLogger.error('Error validating protocol', {
      url,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return false;
  }
}

/**
 * Comprehensive OAuth redirect validation
 * Combines all validation checks for OAuth callbacks
 */
export function validateOAuthCallback(params: {
  redirectUrl: string;
  state: string | null;
  expectedState: string | null;
  isProduction?: boolean;
}): { valid: boolean; error?: string } {
  const { redirectUrl, state, expectedState, isProduction = false } = params;

  // Validate state parameter
  if (!validateOAuthState(state, expectedState)) {
    return {
      valid: false,
      error: 'Invalid OAuth state parameter - possible CSRF attack'
    };
  }

  // Validate redirect URL domain
  if (!validateOAuthRedirect(redirectUrl, isProduction)) {
    return {
      valid: false,
      error: 'Invalid redirect domain - not in whitelist'
    };
  }

  // Validate secure protocol
  if (!validateSecureProtocol(redirectUrl, isProduction)) {
    return {
      valid: false,
      error: 'Insecure protocol - HTTPS required in production'
    };
  }

  return { valid: true };
}
