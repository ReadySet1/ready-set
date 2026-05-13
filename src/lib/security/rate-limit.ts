/**
 * Per-partner sliding-window rate limiting.
 *
 * Keyed by (partner, route) so a partner spamming /orders/draft can't
 * starve another partner's traffic, and so a misbehaving partner only
 * starves itself on the affected route. Uses Upstash's official
 * `@upstash/ratelimit` helper when Redis is configured (lazy-loaded so
 * Jest doesn't have to transpile its ESM-only deps); falls back to a
 * simple in-memory counter otherwise.
 *
 * Rate-limit decisions fall open on errors: if Redis is unreachable we
 * allow the request rather than returning 429 for an infrastructure
 * problem on our side.
 */

import { NextResponse } from 'next/server';

import { getRedisClient, type RedisLike } from '@/lib/redis/client';

const DEFAULT_LIMIT = 100;
const WINDOW_SECONDS = 60;

interface RateLimitDecision {
  success: boolean;
  remaining: number;
  reset: number;
}

type Decider = (key: string) => Promise<RateLimitDecision>;

let cachedDecider: Decider | null = null;

async function buildUpstashDecider(): Promise<Decider | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const [{ Ratelimit }, { Redis }] = await Promise.all([
    import('@upstash/ratelimit'),
    import('@upstash/redis'),
  ]);
  const redis = new Redis({ url, token, automaticDeserialization: true });
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(DEFAULT_LIMIT, `${WINDOW_SECONDS} s`),
    analytics: false,
    prefix: 'rl',
  });

  return async (key: string) => {
    const result = await limiter.limit(key);
    return {
      success: result.success,
      remaining: result.remaining,
      reset: result.reset,
    };
  };
}

function buildInMemoryDecider(client: RedisLike): Decider {
  return async (key: string) => {
    const fullKey = `rl:${key}`;
    const count = (await client.incr(fullKey)) as number;
    if (count === 1) await client.expire(fullKey, WINDOW_SECONDS);
    const success = count <= DEFAULT_LIMIT;
    return {
      success,
      remaining: Math.max(0, DEFAULT_LIMIT - count),
      reset: Date.now() + WINDOW_SECONDS * 1000,
    };
  };
}

async function getDecider(): Promise<Decider> {
  if (cachedDecider) return cachedDecider;
  const upstash = await buildUpstashDecider();
  cachedDecider = upstash ?? buildInMemoryDecider(getRedisClient());
  return cachedDecider;
}

/**
 * Apply per-partner rate limiting at the top of an order route.
 * Returns a 429 NextResponse if the limit is exceeded, or null if the
 * request should proceed.
 */
export async function enforceRateLimit(
  partnerSlug: string,
  routeName: string
): Promise<NextResponse | null> {
  const key = `${partnerSlug}:${routeName}`;
  let decision: RateLimitDecision;
  try {
    const decide = await getDecider();
    decision = await decide(key);
  } catch (error) {
    console.warn('[rate-limit] backend error, falling open:', error);
    return null;
  }

  if (decision.success) return null;

  const retryAfterSeconds = Math.max(1, Math.ceil((decision.reset - Date.now()) / 1000));
  return NextResponse.json(
    {
      status: 'ERROR',
      message: `Rate limit exceeded for ${routeName}. Retry in ${retryAfterSeconds}s.`,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSeconds),
        'X-RateLimit-Limit': String(DEFAULT_LIMIT),
        'X-RateLimit-Remaining': String(decision.remaining),
        'X-RateLimit-Reset': String(decision.reset),
      },
    }
  );
}

/**
 * Test-only: reset the cached decider so subsequent calls rebuild against
 * current env vars and a fresh in-memory store.
 */
export function _resetRateLimiterForTests(): void {
  cachedDecider = null;
}
