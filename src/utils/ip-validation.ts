// src/utils/ip-validation.ts

import { isIP } from 'net';

/**
 * IP Validation Utilities
 *
 * Provides reusable IP address validation and classification functions
 * for security and rate limiting purposes.
 */

/**
 * Validate if a string is a valid IPv4 or IPv6 address
 * Uses Node.js built-in isIP function for reliable validation
 *
 * @param ip - The IP address string to validate
 * @returns true if valid IPv4 or IPv6, false otherwise
 */
export function isValidIp(ip: string): boolean {
  // Use Node.js built-in isIP function
  // Returns 4 for IPv4, 6 for IPv6, 0 for invalid
  return isIP(ip) !== 0;
}

/**
 * Check if an IP address is in a private/reserved range.
 * Private IPs should not be used for rate limiting from x-forwarded-for
 * as they can be spoofed by clients.
 *
 * Detects:
 * - IPv4: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8, 169.254.0.0/16
 * - IPv6: ::1, fe80::/10 (link-local), fc00::/7 (unique local), fd00::/8 (unique local)
 *
 * @param ip - The IP address to check
 * @returns true if the IP is in a private/reserved range, false otherwise
 *
 * @example
 * ```typescript
 * isPrivateIp('10.0.0.1')      // true - Private IPv4
 * isPrivateIp('192.168.1.1')   // true - Private IPv4
 * isPrivateIp('8.8.8.8')       // false - Public IPv4
 * isPrivateIp('::1')           // true - IPv6 loopback
 * isPrivateIp('fe80::1')       // true - IPv6 link-local
 * ```
 */
export function isPrivateIp(ip: string): boolean {
  // IPv4 private ranges
  const privateV4Ranges = [
    /^10\./,                    // 10.0.0.0/8
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
    /^192\.168\./,              // 192.168.0.0/16
    /^127\./,                   // Loopback
    /^169\.254\./,              // Link-local
  ];

  // IPv6 private/special ranges
  const privateV6Ranges = [
    /^::1$/,                    // Loopback
    /^fe80:/,                   // Link-local
    /^fc00:/,                   // Unique local
    /^fd00:/,                   // Unique local
  ];

  for (const range of privateV4Ranges) {
    if (range.test(ip)) return true;
  }

  for (const range of privateV6Ranges) {
    if (range.test(ip)) return true;
  }

  return false;
}

/**
 * Extract and validate client IP from headers.
 *
 * SECURITY NOTE: Only use this in environments where x-forwarded-for is set by
 * a trusted proxy (e.g., Vercel, Cloudflare). Do NOT use with user-facing proxies.
 *
 * Environment Variables:
 * - TRUST_PROXY: Set to 'true' to trust x-forwarded-for header (default: true for Vercel/production)
 * - Set to 'false' in development or untrusted environments
 *
 * DEPLOYMENT REQUIREMENTS:
 * - Must be deployed behind a trusted proxy (Vercel, Cloudflare, AWS ALB, etc.)
 * - Proxy must set x-forwarded-for with the real client IP
 * - Do NOT expose this endpoint directly to the internet without a proxy
 *
 * @param forwardedFor - x-forwarded-for header value
 * @param realIp - x-real-ip header value
 * @returns Valid IP address or 'unknown-ip' constant if no valid IP found
 */
export function extractClientIp(forwardedFor: string | null, realIp: string | null): string {
  // Check if we should trust proxy headers (default true for production)
  const trustProxy = process.env.TRUST_PROXY !== 'false';

  // Try x-forwarded-for first (set by Vercel/trusted proxy)
  if (trustProxy && forwardedFor) {
    const firstIp = forwardedFor.split(',')[0]?.trim();
    if (firstIp && isValidIp(firstIp) && !isPrivateIp(firstIp)) {
      return firstIp;
    } else if (firstIp && isPrivateIp(firstIp)) {
      console.warn(`[IP Validation] Rejected private IP from x-forwarded-for: ${firstIp.substring(0, 10)}...`);
    }
  }

  // Fall back to x-real-ip (also requires trust)
  if (trustProxy && realIp && isValidIp(realIp) && !isPrivateIp(realIp)) {
    return realIp;
  }

  // No valid IP found - use constant identifier
  // This prevents user-controlled values (like email) from being used for rate limiting
  return 'unknown-ip';
}
