import { createHmac, timingSafeEqual } from 'node:crypto';

export const SIGNATURE_HEADER = 'x-readyset-signature';

/**
 * Compute an HMAC-SHA256 hex signature over the given body using the secret.
 *
 * Use the raw request body (string or Buffer) — JSON.stringify-then-sign is
 * fine as long as both sides agree on the canonical form. Prefer signing the
 * already-serialized body you're about to send.
 */
export function signPayload(secret: string, body: string | Buffer): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

/**
 * Constant-time verify of a hex-encoded HMAC-SHA256 signature.
 *
 * Returns false (rather than throwing) for any malformed input — invalid
 * hex, length mismatch, missing values — so callers can treat all failure
 * modes uniformly. A throw here would leak timing information about *which*
 * branch failed.
 */
export function verifySignature(
  secret: string,
  body: string | Buffer,
  providedSignature: string | null | undefined
): boolean {
  if (!secret || !providedSignature) return false;

  const expected = signPayload(secret, body);

  let providedBuf: Buffer;
  let expectedBuf: Buffer;
  try {
    providedBuf = Buffer.from(providedSignature, 'hex');
    expectedBuf = Buffer.from(expected, 'hex');
  } catch {
    return false;
  }

  if (providedBuf.length === 0 || providedBuf.length !== expectedBuf.length) {
    return false;
  }

  return timingSafeEqual(providedBuf, expectedBuf);
}
