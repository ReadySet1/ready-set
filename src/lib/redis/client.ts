/**
 * Upstash Redis client + in-memory fallback.
 *
 * In production we use Upstash's REST-based Redis (works in Node + Edge
 * runtime, native Vercel integration). In tests and local development we
 * fall back to an in-memory implementation so neither needs a live Redis
 * connection — the same abstraction shape, different storage.
 *
 * The Upstash import is dynamic so Jest doesn't have to transpile its
 * ESM-only transitive deps (uncrypto). Users who never touch Upstash in
 * tests pay no transform cost.
 *
 * Required env vars for production:
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 *
 * If either is missing, the in-memory fallback is used and a warning is
 * logged once per process.
 */

import type { Redis as UpstashRedis } from '@upstash/redis';

export type RedisLike = Pick<UpstashRedis, 'get' | 'set' | 'incr' | 'expire' | 'del' | 'exists'>;

let cachedClient: RedisLike | null = null;
let pendingClient: Promise<RedisLike> | null = null;
let warnedOnce = false;

async function buildUpstashClient(url: string, token: string): Promise<RedisLike> {
  const { Redis } = await import('@upstash/redis');
  return new Redis({ url, token, automaticDeserialization: true });
}

/**
 * In-memory implementation matching the subset of the Redis interface we
 * use. Sufficient for tests and local development; never use in production
 * for shared state (it's per-process and lost on restart).
 */
function buildInMemoryClient(): RedisLike {
  const store = new Map<string, { value: unknown; expiresAt: number | null }>();

  function isExpired(entry: { expiresAt: number | null }): boolean {
    return entry.expiresAt !== null && entry.expiresAt <= Date.now();
  }

  function purgeIfExpired(key: string): void {
    const entry = store.get(key);
    if (entry && isExpired(entry)) store.delete(key);
  }

  return {
    get: (async (key: string) => {
      purgeIfExpired(key);
      const entry = store.get(key);
      return entry ? (entry.value as any) : null;
    }) as RedisLike['get'],

    set: (async (key: string, value: unknown, opts?: any) => {
      const ttlSeconds: number | undefined = opts?.ex;
      const ttlMs: number | undefined = opts?.px;
      const nx: boolean | undefined = opts?.nx;
      if (nx && store.has(key)) {
        purgeIfExpired(key);
        if (store.has(key)) return null;
      }
      let expiresAt: number | null = null;
      if (typeof ttlSeconds === 'number') expiresAt = Date.now() + ttlSeconds * 1000;
      else if (typeof ttlMs === 'number') expiresAt = Date.now() + ttlMs;
      store.set(key, { value, expiresAt });
      return 'OK';
    }) as RedisLike['set'],

    incr: (async (key: string) => {
      purgeIfExpired(key);
      const entry = store.get(key);
      const next = (entry ? Number(entry.value) : 0) + 1;
      store.set(key, { value: next, expiresAt: entry?.expiresAt ?? null });
      return next;
    }) as RedisLike['incr'],

    expire: (async (key: string, seconds: number) => {
      const entry = store.get(key);
      if (!entry) return 0;
      entry.expiresAt = Date.now() + seconds * 1000;
      return 1;
    }) as RedisLike['expire'],

    del: (async (...keys: string[]) => {
      let removed = 0;
      for (const key of keys) {
        if (store.delete(key)) removed++;
      }
      return removed;
    }) as RedisLike['del'],

    exists: (async (...keys: string[]) => {
      let count = 0;
      for (const key of keys) {
        purgeIfExpired(key);
        if (store.has(key)) count++;
      }
      return count;
    }) as RedisLike['exists'],
  };
}

/**
 * Synchronous accessor for the rate-limit fallback path that needs an
 * immediate client. Returns the cached client if available, else builds
 * an in-memory one and caches it. Production Upstash callers should use
 * `getRedisClientAsync` to take advantage of the async build path.
 */
export function getRedisClient(): RedisLike {
  if (cachedClient) return cachedClient;

  // Sync path: in-memory only. Upstash requires async dynamic import.
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    if (!warnedOnce && process.env.NODE_ENV === 'production') {
      console.warn(
        '[redis] sync getRedisClient() called with Upstash configured — caller should use getRedisClientAsync(). Falling back to in-memory.'
      );
      warnedOnce = true;
    }
  }

  cachedClient = buildInMemoryClient();
  return cachedClient;
}

/**
 * Async accessor preferred by callers that can await. Returns the Upstash
 * client when configured, or the in-memory fallback otherwise. Caches the
 * promise to avoid double-building.
 */
export async function getRedisClientAsync(): Promise<RedisLike> {
  if (cachedClient) return cachedClient;
  if (pendingClient) return pendingClient;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    pendingClient = buildUpstashClient(url, token).then((c) => {
      cachedClient = c;
      pendingClient = null;
      return c;
    });
    return pendingClient;
  }

  if (!warnedOnce && process.env.NODE_ENV === 'production') {
    console.warn(
      '[redis] UPSTASH_REDIS_REST_URL/_TOKEN not configured — falling back to in-memory client. ' +
        'Idempotency + rate-limiting will not be shared across instances.'
    );
    warnedOnce = true;
  }

  cachedClient = buildInMemoryClient();
  return cachedClient;
}

/**
 * Test-only helper. Resets the cached client so subsequent accessor calls
 * rebuild against current env vars. Do not call in production code.
 */
export function _resetRedisClientForTests(): void {
  cachedClient = null;
  pendingClient = null;
  warnedOnce = false;
}
