// src/lib/session-encryption.ts

/**
 * Session storage utility for client-side session data
 *
 * SECURITY NOTICE: sessionStorage provides NO security against XSS attacks.
 * - Any JavaScript running in the browser can access sessionStorage
 * - XSS attacks can steal all data stored here
 * - This is for USER EXPERIENCE only, NOT security
 *
 * IMPORTANT: Never store sensitive tokens or credentials in sessionStorage.
 * For secure session management, use httpOnly cookies set by the backend.
 *
 * Current implementation:
 * - Stores minimal session data (sessionId only) in sessionStorage
 * - uploadToken is kept in React state (memory) only
 * - On page refresh, user needs to create a new session
 *
 * Future improvement:
 * - Migrate to httpOnly cookies for token storage
 * - Implement proper CSRF protection
 * - Add Content Security Policy (CSP)
 */

/**
 * Store session data in sessionStorage (plaintext - no false security)
 *
 * SECURITY: Only stores non-sensitive data. Use for UX only.
 */
export function storeSession(key: string, data: unknown): void {
  try {
    const jsonString = JSON.stringify(data);
    sessionStorage.setItem(key, jsonString);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Failed to store session:', error);
    }
    throw error;
  }
}

/**
 * Retrieve session data from sessionStorage
 *
 * SECURITY: Assumes data in sessionStorage is untrusted. Validate after retrieval.
 */
export function retrieveSession<T>(key: string): T | null {
  try {
    const data = sessionStorage.getItem(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Failed to retrieve session:', error);
    }
    return null;
  }
}

/**
 * Remove session data from sessionStorage
 */
export function removeSession(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Failed to remove session:', error);
    }
  }
}

// Legacy exports for backwards compatibility - will be removed in future
export const storeEncryptedSession = storeSession;
export const retrieveEncryptedSession = retrieveSession;
