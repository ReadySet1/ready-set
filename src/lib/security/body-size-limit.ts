import { NextRequest, NextResponse } from 'next/server';

export const DEFAULT_MAX_BODY_BYTES = 1_000_000; // 1 MB

/** Body limit the partner contract promises on `/api/partners/*` (256 KB). */
export const PARTNER_MAX_BODY_BYTES = 256 * 1024;

const PARTNER_ROUTE_PREFIX = '/api/partners/';

function isPartnerRoute(request: Request | NextRequest): boolean {
  try {
    return new URL(request.url).pathname.startsWith(PARTNER_ROUTE_PREFIX);
  } catch {
    return false;
  }
}

/**
 * Body limit for a partner order route. The order handlers are shared by the
 * canonical `/api/partners/*` URLs (contract: 256 KB) and the legacy
 * `/api/cater-valley/*` URLs, which keep their 1 MB limit.
 */
export function partnerBodyLimit(request: Request | NextRequest): number {
  return isPartnerRoute(request) ? PARTNER_MAX_BODY_BYTES : DEFAULT_MAX_BODY_BYTES;
}

function tooLarge(maxBytes: number): NextResponse {
  return NextResponse.json(
    {
      status: 'ERROR',
      message: `Request body too large (max ${maxBytes} bytes)`,
      maxBytes,
    },
    { status: 413 }
  );
}

/**
 * Reject requests whose Content-Length exceeds the limit. Returns a
 * 413 NextResponse if the limit is breached, or null if the request is
 * within bounds (caller continues).
 *
 * This is a defense-in-depth check — edge proxies have their own body
 * limits, but we want a predictable, application-level rejection for
 * partner traffic so callers get a structured error envelope instead of a
 * transparent gateway error.
 *
 * Note: only checks the declared Content-Length header, which a client can
 * omit (chunked) or understate. Read the body with `readJsonBody` to enforce
 * the limit on the bytes actually received.
 */
export function enforceBodySizeLimit(
  request: Request | NextRequest,
  maxBytes: number = DEFAULT_MAX_BODY_BYTES
): NextResponse | null {
  const header = request.headers.get('content-length');
  if (!header) return null;

  const declared = Number(header);
  if (!Number.isFinite(declared) || declared < 0) {
    return NextResponse.json(
      { status: 'ERROR', message: 'Invalid Content-Length header' },
      { status: 400 }
    );
  }

  if (declared > maxBytes) return tooLarge(maxBytes);
  return null;
}

/**
 * Early checks for a partner order route, before auth: on `/api/partners/*`
 * a Content-Type other than `application/json` is a 415 (contract); then the
 * declared Content-Length is checked against the route's limit.
 */
export function enforcePartnerBodyPolicy(request: Request | NextRequest): NextResponse | null {
  if (isPartnerRoute(request)) {
    const mediaType = (request.headers.get('content-type') ?? '')
      .split(';')[0]!
      .trim()
      .toLowerCase();
    if (mediaType !== 'application/json') {
      return NextResponse.json(
        { status: 'ERROR', message: 'Unsupported Content-Type (must be application/json)' },
        { status: 415 }
      );
    }
  }
  return enforceBodySizeLimit(request, partnerBodyLimit(request));
}

export type ReadJsonBodyResult =
  | { ok: true; body: unknown }
  | { ok: false; response: NextResponse };

/**
 * Read and parse a JSON body, stopping as soon as more than the route's
 * limit (see partnerBodyLimit) has been received — so a chunked or
 * understated body can't get past the Content-Length check. Answers 413
 * when too large and 400 when the body isn't valid JSON.
 */
export async function readJsonBody(
  request: Request | NextRequest,
  maxBytes: number = partnerBodyLimit(request)
): Promise<ReadJsonBodyResult> {
  let text: string;
  if (request.body && typeof request.body.getReader === 'function') {
    const chunks: Uint8Array[] = [];
    let received = 0;
    const reader = request.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, response: tooLarge(maxBytes) };
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    text = new TextDecoder().decode(bytes);
  } else {
    // No readable stream (e.g. a test double): measure what text() returns.
    text = await request.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) {
      return { ok: false, response: tooLarge(maxBytes) };
    }
  }

  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { status: 'ERROR', message: 'Invalid JSON in request body' },
        { status: 400 }
      ),
    };
  }
}
