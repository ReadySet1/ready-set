/**
 * CaterValley Authentication Utilities
 * Shared authentication logic for CaterValley API endpoints
 */

import { NextRequest } from 'next/server';

/**
 * Validates CaterValley API request authentication
 * Checks for valid partner header and API key
 *
 * @param request - The incoming Next.js request
 * @returns true if authenticated, false otherwise
 */
export function validateCaterValleyAuth(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-api-key');
  const partner = request.headers.get('partner');

  // Check for CaterValley-specific partner header
  if (partner !== 'catervalley') {
    return false;
  }

  // In production, validate the API key against stored credentials
  const expectedApiKey = process.env.CATERVALLEY_API_KEY;
  if (expectedApiKey && apiKey !== expectedApiKey) {
    return false;
  }

  return true;
}
