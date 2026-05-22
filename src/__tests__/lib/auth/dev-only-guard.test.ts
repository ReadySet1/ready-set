import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { devOnlyGuard } from '@/lib/auth/dev-only-guard';

describe('devOnlyGuard', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    // Restore original NODE_ENV after each test
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: originalEnv,
      configurable: true,
    });
  });

  it('returns null when NODE_ENV is "development"', () => {
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'development',
      configurable: true,
    });

    expect(devOnlyGuard()).toBeNull();
  });

  it('returns null when NODE_ENV is "test"', () => {
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'test',
      configurable: true,
    });

    expect(devOnlyGuard()).toBeNull();
  });

  it('returns null when NODE_ENV is undefined', () => {
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: undefined,
      configurable: true,
    });

    expect(devOnlyGuard()).toBeNull();
  });

  it('returns a 404 NextResponse when NODE_ENV is "production"', async () => {
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'production',
      configurable: true,
    });

    const response = devOnlyGuard();

    expect(response).not.toBeNull();
    expect(response?.status).toBe(404);

    const body = await response?.json();
    expect(body).toEqual({ error: 'Not Found' });
  });
});
