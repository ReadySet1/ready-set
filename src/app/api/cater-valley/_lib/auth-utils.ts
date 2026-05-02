/**
 * CaterValley Authentication Utilities
 * Shared authentication logic for CaterValley API endpoints
 */

import { timingSafeEqual } from 'node:crypto';
import { NextRequest } from 'next/server';

function safeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

/**
 * Validates CaterValley API request authentication
 * Checks for valid partner header and API key.
 *
 * Uses constant-time comparison on the API key to prevent timing attacks
 * (an attacker measuring response latency cannot infer correct key bytes).
 */
export function validateCaterValleyAuth(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-api-key');
  const partner = request.headers.get('partner');

  if (partner !== 'catervalley') {
    return false;
  }

  const expectedApiKey = process.env.CATERVALLEY_API_KEY;
  if (!expectedApiKey) {
    return true;
  }

  if (!apiKey) return false;
  return safeCompare(apiKey, expectedApiKey);
}
