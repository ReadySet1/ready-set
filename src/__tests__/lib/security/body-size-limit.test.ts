// src/__tests__/lib/security/body-size-limit.test.ts

import {
  enforceBodySizeLimit,
  DEFAULT_MAX_BODY_BYTES,
} from '@/lib/security/body-size-limit';

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost:3000/api/cater-valley/orders/draft', {
    method: 'POST',
    headers,
  });
}

describe('enforceBodySizeLimit', () => {
  it('exposes a 1MB default limit', () => {
    expect(DEFAULT_MAX_BODY_BYTES).toBe(1_000_000);
  });

  it('allows requests with no Content-Length header', () => {
    expect(enforceBodySizeLimit(makeRequest())).toBeNull();
  });

  it('allows requests within the limit', () => {
    expect(enforceBodySizeLimit(makeRequest({ 'content-length': '500' }))).toBeNull();
    expect(
      enforceBodySizeLimit(makeRequest({ 'content-length': String(DEFAULT_MAX_BODY_BYTES) }))
    ).toBeNull();
  });

  it('rejects requests over the limit with 413', async () => {
    const response = enforceBodySizeLimit(
      makeRequest({ 'content-length': String(DEFAULT_MAX_BODY_BYTES + 1) })
    );
    expect(response?.status).toBe(413);
    const body = await response!.json();
    expect(body.status).toBe('ERROR');
    expect(body.message).toMatch(/too large/i);
    expect(body.maxBytes).toBe(DEFAULT_MAX_BODY_BYTES);
  });

  it('rejects negative or non-numeric Content-Length with 400', async () => {
    const negResponse = enforceBodySizeLimit(makeRequest({ 'content-length': '-1' }));
    expect(negResponse?.status).toBe(400);

    const nanResponse = enforceBodySizeLimit(makeRequest({ 'content-length': 'abc' }));
    expect(nanResponse?.status).toBe(400);
  });

  it('respects an explicit per-route limit', async () => {
    const customLimit = 100;
    const tooBig = enforceBodySizeLimit(makeRequest({ 'content-length': '101' }), customLimit);
    expect(tooBig?.status).toBe(413);

    const fine = enforceBodySizeLimit(makeRequest({ 'content-length': '50' }), customLimit);
    expect(fine).toBeNull();
  });
});
