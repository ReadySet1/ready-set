// src/__tests__/lib/security/hmac.test.ts

import { signPayload, verifySignature, SIGNATURE_HEADER } from '@/lib/security/hmac';

describe('signPayload + verifySignature', () => {
  const secret = 'shared-secret-between-readyset-and-partner';
  const body = JSON.stringify({ orderNumber: 'CV-ABC123', status: 'DELIVERED' });

  it('exposes the canonical signature header name', () => {
    expect(SIGNATURE_HEADER).toBe('x-readyset-signature');
  });

  it('produces a deterministic hex signature', () => {
    const a = signPayload(secret, body);
    const b = signPayload(secret, body);
    expect(a).toEqual(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it('verifies a valid signature', () => {
    const sig = signPayload(secret, body);
    expect(verifySignature(secret, body, sig)).toBe(true);
  });

  it('rejects when body has been tampered with', () => {
    const sig = signPayload(secret, body);
    const tampered = body.replace('DELIVERED', 'CANCELLED');
    expect(verifySignature(secret, tampered, sig)).toBe(false);
  });

  it('rejects when secret differs', () => {
    const sig = signPayload(secret, body);
    expect(verifySignature('different-secret', body, sig)).toBe(false);
  });

  it('rejects null/missing signature', () => {
    expect(verifySignature(secret, body, null)).toBe(false);
    expect(verifySignature(secret, body, undefined)).toBe(false);
    expect(verifySignature(secret, body, '')).toBe(false);
  });

  it('rejects when secret is empty', () => {
    const sig = signPayload(secret, body);
    expect(verifySignature('', body, sig)).toBe(false);
  });

  it('rejects malformed hex signatures without throwing', () => {
    expect(verifySignature(secret, body, 'not-hex-at-all')).toBe(false);
    expect(verifySignature(secret, body, 'abc123')).toBe(false); // wrong length
  });

  it('verifies signatures over Buffer bodies identically to string bodies', () => {
    const sigFromString = signPayload(secret, body);
    const sigFromBuffer = signPayload(secret, Buffer.from(body, 'utf8'));
    expect(sigFromString).toEqual(sigFromBuffer);
    expect(verifySignature(secret, Buffer.from(body, 'utf8'), sigFromString)).toBe(true);
  });
});
