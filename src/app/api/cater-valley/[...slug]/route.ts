/**
 * Catch-all endpoint for unmatched CaterValley API requests.
 *
 * Returns a stable 404 with the list of valid endpoints so partner clients
 * can self-diagnose typos. Never echoes request headers or body — the
 * previous version returned full headers (including x-api-key) in the
 * JSON response, which was a credential disclosure surface.
 *
 * In non-production, additional context (slug, search params, body)
 * is included to aid local debugging.
 */

import { NextRequest, NextResponse } from 'next/server';

import { isDebugEnabled, redactHeaders } from '../_lib/debug-guard';

const AVAILABLE_ENDPOINTS = [
  'POST /api/cater-valley/orders/draft',
  'POST /api/cater-valley/orders/update',
  'POST /api/cater-valley/orders/confirm',
  'POST /api/cater-valley/update-order-status',
];

const NOT_FOUND_MESSAGE = 'Endpoint not found.';

async function readBodySafely(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    try {
      const text = await request.text();
      return text ? { raw: text } : null;
    } catch {
      return null;
    }
  }
}

function basePayload(method: string) {
  return {
    method,
    message: NOT_FOUND_MESSAGE,
    availableEndpoints: AVAILABLE_ENDPOINTS,
    timestamp: new Date().toISOString(),
  };
}

async function debugContext(
  request: NextRequest,
  slug: string[],
  includeBody: boolean
): Promise<Record<string, unknown>> {
  if (!isDebugEnabled()) return {};
  const headers = Object.fromEntries(request.headers.entries());
  const searchParams = request.nextUrl?.searchParams
    ? Object.fromEntries(request.nextUrl.searchParams.entries())
    : Object.fromEntries(new URL(request.url).searchParams.entries());

  const ctx: Record<string, unknown> = {
    slug,
    headers: redactHeaders(headers),
    searchParams,
  };
  if (includeBody) {
    ctx.body = await readBodySafely(request);
  }
  return ctx;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  return NextResponse.json(
    { ...basePayload('GET'), ...(await debugContext(request, slug, false)) },
    { status: 404 }
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  return NextResponse.json(
    { ...basePayload('POST'), ...(await debugContext(request, slug, true)) },
    { status: 404 }
  );
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  return NextResponse.json(
    { ...basePayload('PUT'), ...(await debugContext(request, slug, true)) },
    { status: 404 }
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  return NextResponse.json(
    { ...basePayload('PATCH'), ...(await debugContext(request, slug, true)) },
    { status: 404 }
  );
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  return NextResponse.json(
    { ...basePayload('DELETE'), ...(await debugContext(request, slug, false)) },
    { status: 404 }
  );
}
