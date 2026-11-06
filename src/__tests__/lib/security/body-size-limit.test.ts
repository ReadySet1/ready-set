/**
 * @jest-environment node
 */
// src/__tests__/lib/security/body-size-limit.test.ts

import {
  enforceBodySizeLimit,
  enforcePartnerBodyPolicy,
  partnerBodyLimit,
  readJsonBody,
  DEFAULT_MAX_BODY_BYTES,
  PARTNER_MAX_BODY_BYTES,
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

const PARTNERS_URL = 'http://localhost:3000/api/partners/orders/draft';
const CATER_VALLEY_URL = 'http://localhost:3000/api/cater-valley/orders/draft';

/**
 * A body sent without Content-Length (chunked), streamed in pieces. Built as
 * a plain object: jest.setup replaces the global Request with a mock that
 * has no `body` stream (route tests exercise that text() fallback).
 */
function streamedRequest(url: string, payload: string, chunkBytes = 16 * 1024): Request {
  const bytes = new TextEncoder().encode(payload);
  let sent = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= bytes.byteLength) {
        controller.close();
        return;
      }
      const next = bytes.slice(sent, sent + chunkBytes);
      sent += next.byteLength;
      controller.enqueue(next);
    },
  });
  return {
    url,
    method: 'POST',
    headers: new Headers({ 'content-type': 'application/json' }),
    body,
    text: () => Promise.reject(new Error('must read the stream, not text()')),
  } as unknown as Request;
}

describe('partnerBodyLimit', () => {
  it('is 256 KB for the partner routes', () => {
    expect(PARTNER_MAX_BODY_BYTES).toBe(256 * 1024);
    expect(partnerBodyLimit(new Request(PARTNERS_URL, { method: 'POST' }))).toBe(
      PARTNER_MAX_BODY_BYTES
    );
  });

  it('keeps the 1 MB limit for the CaterValley routes', () => {
    expect(partnerBodyLimit(new Request(CATER_VALLEY_URL, { method: 'POST' }))).toBe(
      DEFAULT_MAX_BODY_BYTES
    );
  });
});

describe('enforcePartnerBodyPolicy', () => {
  const request = (url: string, headers: Record<string, string>) =>
    new Request(url, { method: 'POST', headers });

  it('accepts application/json (with or without parameters) on the partner routes', () => {
    expect(
      enforcePartnerBodyPolicy(request(PARTNERS_URL, { 'content-type': 'application/json' }))
    ).toBeNull();
    expect(
      enforcePartnerBodyPolicy(
        request(PARTNERS_URL, { 'content-type': 'Application/JSON; charset=utf-8' })
      )
    ).toBeNull();
  });

  it.each([['text/plain'], ['application/x-www-form-urlencoded'], ['']])(
    'answers 415 for content-type %p on the partner routes',
    async (contentType) => {
      const headers: Record<string, string> = contentType ? { 'content-type': contentType } : {};
      const response = enforcePartnerBodyPolicy(request(PARTNERS_URL, headers));
      expect(response?.status).toBe(415);
      const body = await response!.json();
      expect(body.status).toBe('ERROR');
      expect(body.message).toMatch(/application\/json/);
    }
  );

  it('does not check the content-type on the CaterValley routes', () => {
    expect(
      enforcePartnerBodyPolicy(request(CATER_VALLEY_URL, { 'content-type': 'text/plain' }))
    ).toBeNull();
  });

  it('applies the per-route Content-Length limit', () => {
    const over = String(PARTNER_MAX_BODY_BYTES + 1);
    expect(
      enforcePartnerBodyPolicy(
        request(PARTNERS_URL, { 'content-type': 'application/json', 'content-length': over })
      )?.status
    ).toBe(413);
    expect(
      enforcePartnerBodyPolicy(
        request(CATER_VALLEY_URL, { 'content-type': 'application/json', 'content-length': over })
      )
    ).toBeNull();
  });
});

describe('readJsonBody', () => {
  it('parses a JSON body within the limit', async () => {
    const request = new Request(PARTNERS_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hello: 'world' }),
    });
    await expect(readJsonBody(request)).resolves.toEqual({ ok: true, body: { hello: 'world' } });
  });

  it('answers 413 for a streamed body over the limit even without Content-Length', async () => {
    const request = streamedRequest(PARTNERS_URL, 'a'.repeat(PARTNER_MAX_BODY_BYTES + 1));
    expect(request.headers.get('content-length')).toBeNull();

    const result = await readJsonBody(request);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(413);
    const body = await result.response.json();
    expect(body.maxBytes).toBe(PARTNER_MAX_BODY_BYTES);
  });

  it('parses a streamed JSON body within the limit', async () => {
    const request = streamedRequest(PARTNERS_URL, JSON.stringify({ items: 'x'.repeat(50_000) }), 4096);
    const result = await readJsonBody(request);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((result.body as { items: string }).items).toHaveLength(50_000);
  });

  it('counts bytes, not characters', async () => {
    // 3-byte characters: under the limit in characters, over it in bytes.
    const chars = Math.floor(PARTNER_MAX_BODY_BYTES / 3) + 10;
    const request = new Request(PARTNERS_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ note: '\u20ac'.repeat(chars) }),
    });
    const result = await readJsonBody(request);
    expect(result.ok).toBe(false);
  });

  it('keeps the CaterValley limit on the CaterValley routes', async () => {
    const request = streamedRequest(CATER_VALLEY_URL, 'a'.repeat(PARTNER_MAX_BODY_BYTES + 1));
    const result = await readJsonBody(request);
    // Not too large for CaterValley; it is just not valid JSON.
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(400);
  });

  it('answers 400 for a body that is not valid JSON', async () => {
    const request = new Request(PARTNERS_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json',
    });
    const result = await readJsonBody(request);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(400);
    await expect(result.response.json()).resolves.toEqual({
      status: 'ERROR',
      message: 'Invalid JSON in request body',
    });
  });
});
