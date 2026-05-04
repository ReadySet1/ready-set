/**
 * @jest-environment node
 */
// src/__tests__/lib/security/hmac.test.ts

import { signPayload, verifySignature, SIGNATURE_HEADER } from '@/lib/security/hmac';

describe('signPayload + verifySignature', () => {
  const secret = 'shared-secret-between-readyset-and-partner';
  const body = JSON.stringify({ orderNumber: 'CV-ABC123', status: 'DELIVERED' });

  it('exposes the canonical signature header name', () => {
    expect(SIGNATURE_HEADER).toBe('x-readyset-signature');
  });

  it('produces a deterministic hex signature', async () => {
    const a = await signPayload(secret, body);
    const b = await signPayload(secret, body);
    expect(a).toEqual(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it('verifies a valid signature', async () => {
    const sig = await signPayload(secret, body);
    expect(await verifySignature(secret, body, sig)).toBe(true);
  });

  it('rejects when body has been tampered with', async () => {
    const sig = await signPayload(secret, body);
    const tampered = body.replace('DELIVERED', 'CANCELLED');
    expect(await verifySignature(secret, tampered, sig)).toBe(false);
  });

  it('rejects when secret differs', async () => {
    const sig = await signPayload(secret, body);
    expect(await verifySignature('different-secret', body, sig)).toBe(false);
  });

  it('rejects null/missing signature', async () => {
    expect(await verifySignature(secret, body, null)).toBe(false);
    expect(await verifySignature(secret, body, undefined)).toBe(false);
    expect(await verifySignature(secret, body, '')).toBe(false);
  });

  it('rejects when secret is empty', async () => {
    const sig = await signPayload(secret, body);
    expect(await verifySignature('', body, sig)).toBe(false);
  });

  it('rejects malformed hex signatures without throwing', async () => {
    expect(await verifySignature(secret, body, 'not-hex-at-all')).toBe(false);
    expect(await verifySignature(secret, body, 'abc123')).toBe(false); // wrong length
  });

  it('verifies signatures over Uint8Array bodies identically to string bodies', async () => {
    const encoder = new TextEncoder();
    const sigFromString = await signPayload(secret, body);
    const sigFromBytes = await signPayload(secret, encoder.encode(body));
    expect(sigFromString).toEqual(sigFromBytes);
    expect(await verifySignature(secret, encoder.encode(body), sigFromString)).toBe(true);
  });
});
