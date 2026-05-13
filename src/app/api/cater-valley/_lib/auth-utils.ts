/**
 * Partner Order API authentication utilities.
 *
 * Historically these were CaterValley-specific (single hardcoded
 * partner + env-var key). They now delegate to the partner registry
 * (`src/lib/services/partner-registry.ts`), which looks up the partner
 * row in `api_partners` keyed by SHA-256(apiKey) and verifies the
 * `partner` header matches the row's slug.
 *
 * The cater-valley URLs live on for backward compatibility; the
 * underlying authentication is fully partner-agnostic and works for
 * any registry entry.
 */

import { NextRequest, NextResponse } from 'next/server';

import {
  authenticatePartner,
  type AuthFailureReason,
  type AuthResult,
  type ResolvedPartner,
} from '@/lib/services/partner-registry';

export type { ResolvedPartner } from '@/lib/services/partner-registry';

/**
 * Authenticate an incoming partner request and either return the
 * resolved partner or a 401 NextResponse to short-circuit the route.
 *
 * Centralizing this here means every order route gets identical 401
 * envelopes regardless of which auth-failure reason fired.
 */
export async function authenticatePartnerRequest(
  request: NextRequest | Request
): Promise<{ ok: true; partner: ResolvedPartner } | { ok: false; response: NextResponse }> {
  const result: AuthResult = await authenticatePartner(request);
  if (result.ok) {
    return { ok: true, partner: result.partner };
  }
  return { ok: false, response: buildUnauthorizedResponse(result.reason) };
}

function buildUnauthorizedResponse(reason: AuthFailureReason): NextResponse {
  // We deliberately return a generic message to avoid leaking which
  // header was wrong. The reason is logged for observability.
  console.warn(`[partner-auth] rejected request: ${reason}`);
  return NextResponse.json(
    {
      status: 'ERROR',
      message: 'Unauthorized - Invalid API key or partner header',
    },
    { status: 401 }
  );
}

/**
 * Backward-compatible synchronous boolean check used by older tests
 * and code paths that haven't been migrated to the async resolver.
 *
 * Reads `partner` and `x-api-key` headers; returns true when the
 * header values match the legacy single-partner env var. New code
 * should use `authenticatePartnerRequest` so the resolved partner is
 * available downstream.
 *
 * @deprecated Prefer `authenticatePartnerRequest` so order routes can
 * read partner-specific values (display name, order prefix, webhook
 * secret) from the resolved row.
 */
export function validateCaterValleyAuth(request: NextRequest): boolean {
  const partner = request.headers.get('partner');
  const apiKey = request.headers.get('x-api-key');

  if (partner !== 'catervalley') return false;

  const expectedApiKey = process.env.CATERVALLEY_API_KEY;
  if (!expectedApiKey) {
    if (process.env.NODE_ENV === 'production') {
      console.error(
        '[CaterValley] CATERVALLEY_API_KEY is not configured — rejecting request.'
      );
      return false;
    }
    return true;
  }

  if (!apiKey) return false;
  return safeCompare(apiKey, expectedApiKey);
}

function safeCompare(a: string, b: string): boolean {
  // Local copy retained so this synchronous wrapper has no async deps.
  // The async path uses the registry's constant-time compare.
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { timingSafeEqual } = require('node:crypto') as typeof import('node:crypto');
  return timingSafeEqual(aBuf, bBuf);
}
