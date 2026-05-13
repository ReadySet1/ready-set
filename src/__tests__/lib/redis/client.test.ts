/**
 * @jest-environment node
 */
// src/__tests__/lib/redis/client.test.ts

import {
  getRedisClient,
  getRedisClientAsync,
  _resetRedisClientForTests,
} from '@/lib/redis/client';

describe('redis client (in-memory fallback)', () => {
  beforeEach(() => {
    _resetRedisClientForTests();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it('returns the same client on repeated synchronous calls', () => {
    const a = getRedisClient();
    const b = getRedisClient();
    expect(a).toBe(b);
  });

  it('async accessor returns the in-memory client when Upstash is unconfigured', async () => {
    const client = await getRedisClientAsync();
    expect(typeof client.get).toBe('function');
    expect(typeof client.set).toBe('function');
  });

  describe('basic key/value operations', () => {
    it('round-trips a string value', async () => {
      const client = getRedisClient();
      await client.set('hello', 'world');
      expect(await client.get('hello')).toBe('world');
    });

    it('round-trips an object value', async () => {
      const client = getRedisClient();
      await client.set('order', { id: 'abc', status: 'CONFIRMED' });
      expect(await client.get('order')).toEqual({ id: 'abc', status: 'CONFIRMED' });
    });

    it('returns null for missing keys', async () => {
      const client = getRedisClient();
      expect(await client.get('nope')).toBeNull();
    });

    it('expires values after the TTL passes', async () => {
      jest.useFakeTimers();
      try {
        const client = getRedisClient();
        await client.set('temp', 'gone-soon', { ex: 1 });
        expect(await client.get('temp')).toBe('gone-soon');
        jest.advanceTimersByTime(2_000);
        expect(await client.get('temp')).toBeNull();
      } finally {
        jest.useRealTimers();
      }
    });

    it('exists() reflects current keys including TTL', async () => {
      const client = getRedisClient();
      await client.set('present', 1);
      expect(await client.exists('present')).toBe(1);
      expect(await client.exists('absent')).toBe(0);
    });

    it('del() removes the key', async () => {
      const client = getRedisClient();
      await client.set('a', 1);
      await client.set('b', 2);
      expect(await client.del('a', 'b', 'c')).toBe(2);
      expect(await client.get('a')).toBeNull();
    });
  });

  describe('counter operations (used by rate limiter fallback)', () => {
    it('incr increments a missing key from 0 → 1', async () => {
      const client = getRedisClient();
      expect(await client.incr('counter')).toBe(1);
      expect(await client.incr('counter')).toBe(2);
    });

    it('expire sets a TTL on an existing key', async () => {
      jest.useFakeTimers();
      try {
        const client = getRedisClient();
        await client.set('with-ttl', 1);
        await client.expire('with-ttl', 1);
        expect(await client.get('with-ttl')).toBe(1);
        jest.advanceTimersByTime(2_000);
        expect(await client.get('with-ttl')).toBeNull();
      } finally {
        jest.useRealTimers();
      }
    });

    it('expire returns 0 when key is missing', async () => {
      const client = getRedisClient();
      expect(await client.expire('missing', 60)).toBe(0);
    });
  });
});
