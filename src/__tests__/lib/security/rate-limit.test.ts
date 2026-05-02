/**
 * @jest-environment node
 */
// src/__tests__/lib/security/rate-limit.test.ts

import {
  enforceRateLimit,
  _resetRateLimiterForTests,
} from '@/lib/security/rate-limit';
import { _resetRedisClientForTests } from '@/lib/redis/client';

describe('enforceRateLimit (in-memory fallback)', () => {
  beforeEach(() => {
    _resetRateLimiterForTests();
    _resetRedisClientForTests();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it('returns null while under the limit', async () => {
    for (let i = 0; i < 10; i++) {
      const result = await enforceRateLimit('catervalley', 'orders.draft');
      expect(result).toBeNull();
    }
  });

  it('returns 429 once the per-window limit is exceeded', async () => {
    // Default limit is 100/min in the in-memory decider.
    for (let i = 0; i < 100; i++) {
      const result = await enforceRateLimit('catervalley', 'orders.draft');
      expect(result).toBeNull();
    }
    const overflow = await enforceRateLimit('catervalley', 'orders.draft');
    expect(overflow?.status).toBe(429);

    const body = await overflow!.json();
    expect(body.status).toBe('ERROR');
    expect(body.message).toMatch(/rate limit/i);

    expect(overflow!.headers.get('Retry-After')).toBeTruthy();
    expect(overflow!.headers.get('X-RateLimit-Limit')).toBe('100');
    expect(overflow!.headers.get('X-RateLimit-Remaining')).toBe('0');
  });

  it('isolates per-partner counters', async () => {
    for (let i = 0; i < 100; i++) {
      await enforceRateLimit('catervalley', 'orders.draft');
    }
    expect((await enforceRateLimit('catervalley', 'orders.draft'))?.status).toBe(429);
    // Same route, different partner — should have its own bucket.
    expect(await enforceRateLimit('catercow', 'orders.draft')).toBeNull();
  });

  it('isolates per-route counters within a partner', async () => {
    for (let i = 0; i < 100; i++) {
      await enforceRateLimit('catervalley', 'orders.draft');
    }
    expect((await enforceRateLimit('catervalley', 'orders.draft'))?.status).toBe(429);
    // Different route on the same partner — separate bucket.
    expect(await enforceRateLimit('catervalley', 'orders.update')).toBeNull();
  });

  // The "falls open on backend error" path is exercised by enforceRateLimit's
  // try/catch around the decider call. Verifying it requires intercepting
  // a module-level export, which jest.spyOn can't do for const-exported
  // functions in this transpilation. The behavior is documented in
  // rate-limit.ts and validated end-to-end by smoke testing in staging.
});
