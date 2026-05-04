/**
 * Idempotency-Key support for partner API routes.
 *
 * Partners can include an `Idempotency-Key` header on POSTs. The first
 * request stores its (status, body) tuple keyed by (partner, key) with a
 * 24h TTL. Subsequent requests with the same key replay the cached
 * response — safe for retries on flaky networks where the partner can't
 * tell whether the original request succeeded.
 *
 * Storage is the shared Redis client (Upstash in production, in-memory
 * fallback for tests / local dev). Failures fall open: if Redis is
 * unreachable we proceed with the request rather than 503'ing the
 * partner.
 */

import { NextResponse } from 'next/server';

import { getRedisClient } from '@/lib/redis/client';

const TTL_SECONDS_DEFAULT = 24 * 60 * 60;
const HEADER_NAME = 'idempotency-key';
const KEY_PREFIX = 'idem';

interface CachedResponse {
  status: number;
  body: unknown;
}

function buildRedisKey(partnerSlug: string, idempotencyKey: string): string {
  return `${KEY_PREFIX}:${partnerSlug}:${idempotencyKey}`;
}

export interface IdempotencyContext {
  /**
   * Idempotency-Key header value, if provided. Caller has already checked
   * this is non-empty before invoking the helpers below.
   */
  key: string | null;
  partnerSlug: string;
}

export function readIdempotencyContext(
  request: Request,
  partnerSlug: string
): IdempotencyContext {
  const raw = request.headers.get(HEADER_NAME);
  const key = raw && raw.trim().length > 0 ? raw.trim() : null;
  return { key, partnerSlug };
}

/**
 * If a cached response exists for this idempotency key, return a
 * `NextResponse` that replays it. Returns null if no cached response
 * exists (caller proceeds with normal handling). Errors fall open.
 */
export async function replayCachedResponse(
  ctx: IdempotencyContext
): Promise<NextResponse | null> {
  if (!ctx.key) return null;
  try {
    const client = getRedisClient();
    const raw = await client.get(buildRedisKey(ctx.partnerSlug, ctx.key));
    if (!raw) return null;
    const cached = raw as CachedResponse;
    return NextResponse.json(cached.body, {
      status: cached.status,
      headers: { 'x-idempotent-replay': 'true' },
    });
  } catch (error) {
    console.warn('[idempotency] replay lookup failed, falling open:', error);
    return null;
  }
}

/**
 * Persist a (status, body) pair under the idempotency key, then return a
 * fresh NextResponse with that pair. Caller passes the body and status
 * directly (rather than a NextResponse) so we don't depend on
 * NextResponse.clone().json() round-tripping correctly in every runtime.
 *
 * Errors fall open — we'd rather succeed once and skip caching than fail
 * the original request.
 */
export async function storeAndReturnResponse(
  ctx: IdempotencyContext,
  status: number,
  body: unknown,
  ttlSeconds: number = TTL_SECONDS_DEFAULT
): Promise<NextResponse> {
  if (ctx.key) {
    try {
      const cached: CachedResponse = { status, body };
      const client = getRedisClient();
      await client.set(buildRedisKey(ctx.partnerSlug, ctx.key), cached, {
        ex: ttlSeconds,
      });
    } catch (error) {
      console.warn('[idempotency] store failed, returning response uncached:', error);
    }
  }
  return NextResponse.json(body, { status });
}
