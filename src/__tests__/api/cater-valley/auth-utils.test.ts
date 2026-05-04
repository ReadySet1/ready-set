// src/__tests__/api/cater-valley/auth-utils.test.ts

import { validateCaterValleyAuth } from '@/app/api/cater-valley/_lib/auth-utils';
import { NextRequest } from 'next/server';

function createRequest(headers: Record<string, string>): NextRequest {
  return new NextRequest('http://localhost:3000/api/cater-valley/orders/draft', {
    method: 'POST',
    headers,
  });
}

describe('validateCaterValleyAuth', () => {
  const ORIGINAL_KEY = process.env.CATERVALLEY_API_KEY;
  const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.CATERVALLEY_API_KEY = 'super-secret-test-key-1234567890';
  });

  afterEach(() => {
    if (ORIGINAL_KEY === undefined) {
      delete process.env.CATERVALLEY_API_KEY;
    } else {
      process.env.CATERVALLEY_API_KEY = ORIGINAL_KEY;
    }
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  });

  it('rejects requests with wrong partner header', () => {
    const req = createRequest({
      partner: 'someoneelse',
      'x-api-key': 'super-secret-test-key-1234567890',
    });
    expect(validateCaterValleyAuth(req)).toBe(false);
  });

  it('rejects requests with missing partner header', () => {
    const req = createRequest({ 'x-api-key': 'super-secret-test-key-1234567890' });
    expect(validateCaterValleyAuth(req)).toBe(false);
  });

  it('rejects requests with missing api key when env key is configured', () => {
    const req = createRequest({ partner: 'catervalley' });
    expect(validateCaterValleyAuth(req)).toBe(false);
  });

  it('rejects requests with wrong api key', () => {
    const req = createRequest({
      partner: 'catervalley',
      'x-api-key': 'super-secret-test-key-WRONG_VALUE',
    });
    expect(validateCaterValleyAuth(req)).toBe(false);
  });

  it('rejects requests with api key of different length', () => {
    const req = createRequest({
      partner: 'catervalley',
      'x-api-key': 'short',
    });
    expect(validateCaterValleyAuth(req)).toBe(false);
  });

  it('accepts requests with correct partner + api key', () => {
    const req = createRequest({
      partner: 'catervalley',
      'x-api-key': 'super-secret-test-key-1234567890',
    });
    expect(validateCaterValleyAuth(req)).toBe(true);
  });

  it('accepts requests when env key is unset in non-production (local dev fallback)', () => {
    delete process.env.CATERVALLEY_API_KEY;
    process.env.NODE_ENV = 'development';
    const req = createRequest({
      partner: 'catervalley',
      'x-api-key': 'whatever',
    });
    expect(validateCaterValleyAuth(req)).toBe(true);
  });

  it('rejects requests when env key is unset in production (fail-closed)', () => {
    delete process.env.CATERVALLEY_API_KEY;
    process.env.NODE_ENV = 'production';
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const req = createRequest({
      partner: 'catervalley',
      'x-api-key': 'whatever',
    });
    expect(validateCaterValleyAuth(req)).toBe(false);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('uses constant-time comparison (no early-exit on first byte mismatch)', () => {
    // Sanity test for timing-safe behavior: keys differing in the first
    // byte vs the last byte should both reject without observable
    // branch divergence beyond what the runtime allows. This isn't a
    // strict timing assertion (Jest can't measure ns reliably) but
    // verifies neither path throws and both return false.
    const requests = [
      createRequest({
        partner: 'catervalley',
        'x-api-key': 'Xuper-secret-test-key-1234567890',
      }),
      createRequest({
        partner: 'catervalley',
        'x-api-key': 'super-secret-test-key-123456789X',
      }),
    ];
    for (const req of requests) {
      expect(validateCaterValleyAuth(req)).toBe(false);
    }
  });
});
