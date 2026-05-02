/**
 * @jest-environment node
 */
// src/__tests__/lib/security/idempotency.test.ts

import { _resetRedisClientForTests } from '@/lib/redis/client';
import {
  readIdempotencyContext,
  replayCachedResponse,
  storeAndReturnResponse,
} from '@/lib/security/idempotency';

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost:3000/api/cater-valley/orders/draft', {
    method: 'POST',
    headers,
  });
}

describe('idempotency helpers', () => {
  beforeEach(() => {
    _resetRedisClientForTests();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  describe('readIdempotencyContext', () => {
    it('returns the trimmed key when header is present', () => {
      const ctx = readIdempotencyContext(
        makeRequest({ 'idempotency-key': '  abc-123  ' }),
        'catervalley'
      );
      expect(ctx.key).toBe('abc-123');
      expect(ctx.partnerSlug).toBe('catervalley');
    });

    it('returns null when header is missing', () => {
      expect(readIdempotencyContext(makeRequest(), 'catervalley').key).toBeNull();
    });

    it('returns null when header is empty/whitespace', () => {
      expect(readIdempotencyContext(makeRequest({ 'idempotency-key': '   ' }), 'cv').key).toBeNull();
    });
  });

  describe('replay + store flow', () => {
    it('returns null on first request (no cached response)', async () => {
      const ctx = readIdempotencyContext(
        makeRequest({ 'idempotency-key': 'first-call' }),
        'catervalley'
      );
      expect(await replayCachedResponse(ctx)).toBeNull();
    });

    it('caches a response and replays it on the second call', async () => {
      const ctx = readIdempotencyContext(
        makeRequest({ 'idempotency-key': 'replay-me' }),
        'catervalley'
      );

      const first = await storeAndReturnResponse(ctx, 201, {
        orderId: 'abc-123',
        status: 'SUCCESS',
      });
      expect(first.status).toBe(201);

      const replayed = await replayCachedResponse(ctx);
      expect(replayed).not.toBeNull();
      expect(replayed!.status).toBe(201);
      expect(replayed!.headers.get('x-idempotent-replay')).toBe('true');
      const body = await replayed!.json();
      expect(body).toEqual({ orderId: 'abc-123', status: 'SUCCESS' });
    });

    it('isolates replays per partner', async () => {
      const cvCtx = readIdempotencyContext(
        makeRequest({ 'idempotency-key': 'shared-key' }),
        'catervalley'
      );
      const ccCtx = readIdempotencyContext(
        makeRequest({ 'idempotency-key': 'shared-key' }),
        'catercow'
      );

      await storeAndReturnResponse(cvCtx, 201, { partner: 'cv' });

      // CaterCow asking the same key should NOT see CaterValley's cached
      // response — partner is part of the cache key.
      expect(await replayCachedResponse(ccCtx)).toBeNull();
    });

    it('returns a fresh NextResponse even when no key is provided', async () => {
      const ctx = readIdempotencyContext(makeRequest(), 'catervalley');
      const out = await storeAndReturnResponse(ctx, 200, { ok: true });
      expect(out.status).toBe(200);
      expect(await out.json()).toEqual({ ok: true });
      expect(await replayCachedResponse(ctx)).toBeNull();
    });

    it('replays the correct status code (e.g. 409 race response)', async () => {
      const ctx = readIdempotencyContext(
        makeRequest({ 'idempotency-key': 'race-key' }),
        'catervalley'
      );
      await storeAndReturnResponse(ctx, 409, { status: 'ERROR', message: 'duplicate' });
      const replayed = await replayCachedResponse(ctx);
      expect(replayed!.status).toBe(409);
    });
  });
});
