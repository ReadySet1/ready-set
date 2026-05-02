/**
 * HMAC-SHA256 utilities built on the Web Crypto API.
 *
 * We deliberately avoid `node:crypto` here because this module is reachable
 * from a client component (`SingleOrder.tsx` → `brokerSyncService` →
 * `caterValleyService` re-exports). Webpack can't bundle `node:` URIs for
 * the browser, so the build breaks the moment a client-reachable graph
 * touches Node built-ins. Web Crypto (`globalThis.crypto.subtle`) is
 * available in both Node 18+ and modern browsers, so the same code works
 * in either environment.
 */

export const SIGNATURE_HEADER = 'x-readyset-signature';

const encoder = new TextEncoder();

function toBytes(body: string | Uint8Array): ArrayBuffer {
  const view = typeof body === 'string' ? encoder.encode(body) : body;
  // Slice yields a fresh ArrayBuffer (not SharedArrayBuffer) which the
  // Web Crypto API typings require.
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
}

function bytesToHex(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let hex = '';
  for (let i = 0; i < view.length; i++) {
    hex += view[i]!.toString(16).padStart(2, '0');
  }
  return hex;
}

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length === 0 || hex.length % 2 !== 0) return null;
  if (!/^[0-9a-fA-F]+$/.test(hex)) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  const keyBytes = encoder.encode(secret);
  const keyBuffer = keyBytes.buffer.slice(
    keyBytes.byteOffset,
    keyBytes.byteOffset + keyBytes.byteLength
  ) as ArrayBuffer;
  return globalThis.crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/**
 * Compute an HMAC-SHA256 hex signature over the given body using the secret.
 *
 * Use the raw request body — JSON.stringify-then-sign is fine as long as
 * both sides agree on the canonical form. Prefer signing the already-
 * serialized body you're about to send.
 */
export async function signPayload(secret: string, body: string | Uint8Array): Promise<string> {
  const key = await importHmacKey(secret);
  const sig = await globalThis.crypto.subtle.sign('HMAC', key, toBytes(body));
  return bytesToHex(sig);
}

/**
 * Constant-time verify of a hex-encoded HMAC-SHA256 signature.
 *
 * Returns false (rather than throwing) for any malformed input — invalid
 * hex, length mismatch, missing values — so callers can treat all failure
 * modes uniformly. A throw here would leak timing information about *which*
 * branch failed.
 *
 * Verification uses `crypto.subtle.verify`, which is implemented in
 * constant time on every platform we target.
 */
export async function verifySignature(
  secret: string,
  body: string | Uint8Array,
  providedSignature: string | null | undefined
): Promise<boolean> {
  if (!secret || !providedSignature) return false;
  const sigBytes = hexToBytes(providedSignature);
  if (!sigBytes) return false;
  const sigBuffer = sigBytes.buffer.slice(
    sigBytes.byteOffset,
    sigBytes.byteOffset + sigBytes.byteLength
  ) as ArrayBuffer;
  try {
    const key = await importHmacKey(secret);
    return await globalThis.crypto.subtle.verify('HMAC', key, sigBuffer, toBytes(body));
  } catch {
    return false;
  }
}
