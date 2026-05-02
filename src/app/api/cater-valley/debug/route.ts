/**
 * Debug endpoint to capture CaterValley API requests.
 *
 * Only active in non-production environments. In production it returns 404
 * with no body details — echoing request headers/body to anonymous callers
 * was leaking the x-api-key and partner header values previously.
 */

import { NextRequest, NextResponse } from 'next/server';

import { isDebugEnabled, redactHeaders } from '../_lib/debug-guard';

const PRODUCTION_404 = NextResponse.json({ error: 'Not Found' }, { status: 404 });

function notFoundIfProd(): NextResponse | null {
  return isDebugEnabled() ? null : PRODUCTION_404;
}

async function readBodySafely(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    try {
      const text = await request.text();
      return text ? { raw: text } : null;
    } catch {
      return { error: 'Could not parse body' };
    }
  }
}

function describe(request: NextRequest, method: string, body: unknown = undefined) {
  const url = request.url;
  const headers = Object.fromEntries(request.headers.entries());
  const searchParams = request.nextUrl
    ? Object.fromEntries(request.nextUrl.searchParams.entries())
    : Object.fromEntries(new URL(url).searchParams.entries());

  return {
    method,
    url,
    headers: redactHeaders(headers),
    searchParams,
    ...(body !== undefined ? { body } : {}),
    message: 'Debug endpoint - request logged (sensitive headers redacted)',
    timestamp: new Date().toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const blocked = notFoundIfProd();
  if (blocked) return blocked;
  return NextResponse.json(describe(request, 'GET'));
}

export async function POST(request: NextRequest) {
  const blocked = notFoundIfProd();
  if (blocked) return blocked;
  const body = await readBodySafely(request);
  return NextResponse.json(describe(request, 'POST', body));
}

export async function PUT(request: NextRequest) {
  const blocked = notFoundIfProd();
  if (blocked) return blocked;
  const body = await readBodySafely(request);
  return NextResponse.json(describe(request, 'PUT', body));
}

export async function PATCH(request: NextRequest) {
  const blocked = notFoundIfProd();
  if (blocked) return blocked;
  const body = await readBodySafely(request);
  return NextResponse.json(describe(request, 'PATCH', body));
}
