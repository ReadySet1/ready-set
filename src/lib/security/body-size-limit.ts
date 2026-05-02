import { NextRequest, NextResponse } from 'next/server';

export const DEFAULT_MAX_BODY_BYTES = 1_000_000; // 1 MB

/**
 * Reject requests whose Content-Length exceeds the limit. Returns a
 * 413 NextResponse if the limit is breached, or null if the request is
 * within bounds (caller continues).
 *
 * This is a defense-in-depth check — Vercel and most edge proxies have
 * their own body limits, but we want a predictable, application-level
 * rejection for partner traffic so callers get a structured error
 * envelope instead of a transparent gateway error.
 *
 * Note: only checks the declared Content-Length header. A malicious
 * client could lie about it; pair this with a runtime cap on .text()
 * length if the threat model requires it.
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

  if (declared > maxBytes) {
    return NextResponse.json(
      {
        status: 'ERROR',
        message: `Request body too large (max ${maxBytes} bytes)`,
        maxBytes,
      },
      { status: 413 }
    );
  }
  return null;
}
