// src/lib/session-encryption.ts

/**
 * Simple encryption utility for client-side session data
 *
 * SECURITY NOTE: This provides basic obfuscation but is NOT a complete solution
 * to XSS attacks. A sophisticated attacker with XSS access can still:
 * - Read the encryption key from the code
 * - Decrypt the stored data
 * - Execute arbitrary JavaScript
 *
 * For full security, consider:
 * 1. Using httpOnly cookies (requires backend changes)
 * 2. Implementing Content Security Policy (CSP)
 * 3. Regular security audits
 * 4. Input sanitization to prevent XSS
 *
 * This encryption adds a layer of defense-in-depth but should not be
 * relied upon as the sole security measure.
 */

const ENCRYPTION_KEY = process.env.NEXT_PUBLIC_SESSION_ENCRYPTION_KEY || 'default-key-change-me';

/**
 * Simple XOR-based encryption with Base64 encoding
 * Note: This is obfuscation, not cryptographic security
 */
function xorEncrypt(text: string, key: string): string {
  let encrypted = '';
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    encrypted += String.fromCharCode(charCode);
  }
  return btoa(encrypted); // Base64 encode
}

/**
 * Decrypt XOR-encrypted data
 */
function xorDecrypt(encrypted: string, key: string): string {
  const decoded = atob(encrypted); // Base64 decode
  let decrypted = '';
  for (let i = 0; i < decoded.length; i++) {
    const charCode = decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    decrypted += String.fromCharCode(charCode);
  }
  return decrypted;
}

/**
 * Encrypt session data before storing in sessionStorage
 */
export function encryptSession(sessionData: unknown): string {
  const jsonString = JSON.stringify(sessionData);
  return xorEncrypt(jsonString, ENCRYPTION_KEY);
}

/**
 * Decrypt session data retrieved from sessionStorage
 */
export function decryptSession<T>(encryptedData: string): T | null {
  try {
    const decrypted = xorDecrypt(encryptedData, ENCRYPTION_KEY);
    return JSON.parse(decrypted) as T;
  } catch (error) {
    console.error('Failed to decrypt session data:', error);
    return null;
  }
}

/**
 * Securely store session in sessionStorage with encryption
 */
export function storeEncryptedSession(key: string, data: unknown): void {
  try {
    const encrypted = encryptSession(data);
    sessionStorage.setItem(key, encrypted);
  } catch (error) {
    console.error('Failed to store encrypted session:', error);
    throw error;
  }
}

/**
 * Retrieve and decrypt session from sessionStorage
 */
export function retrieveEncryptedSession<T>(key: string): T | null {
  try {
    const encrypted = sessionStorage.getItem(key);
    if (!encrypted) return null;
    return decryptSession<T>(encrypted);
  } catch (error) {
    console.error('Failed to retrieve encrypted session:', error);
    return null;
  }
}
