/**
 * Catch-all debug endpoint for CaterValley API requests
 * This captures any requests that don't match existing endpoints
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const resolvedParams = await params;
  const headers = Object.fromEntries(request.headers.entries());
  const url = request.url;
  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
  const slug = resolvedParams.slug;

  console.log('=== CaterValley Catch-All Debug - GET Request ===');
  console.log('URL:', url);
  console.log('Slug:', slug);
  console.log('Headers:', headers);
  console.log('Search Params:', searchParams);
  console.log('=== End Debug Info ===');

  return NextResponse.json({
    method: 'GET',
    url,
    slug,
    headers,
    searchParams,
    message: 'Catch-all debug endpoint - request logged. This endpoint does not exist.',
    availableEndpoints: [
      'POST /api/cater-valley/orders/draft',
      'POST /api/cater-valley/orders/update',
      'POST /api/cater-valley/orders/confirm'
    ],
    timestamp: new Date().toISOString(),
  }, { status: 404 });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const resolvedParams = await params;
  const headers = Object.fromEntries(request.headers.entries());
  const url = request.url;
  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
  const slug = resolvedParams.slug;
  
  let body = null;
  try {
    body = await request.json();
  } catch (error) {
    try {
      const text = await request.text();
      body = { raw: text };
    } catch (textError) {
      body = { error: 'Could not parse body' };
    }
  }

  console.log('=== CaterValley Catch-All Debug - POST Request ===');
  console.log('URL:', url);
  console.log('Slug:', slug);
  console.log('Headers:', headers);
  console.log('Search Params:', searchParams);
  console.log('Body:', body);
  console.log('=== End Debug Info ===');

  return NextResponse.json({
    method: 'POST',
    url,
    slug,
    headers,
    searchParams,
    body,
    message: 'Catch-all debug endpoint - request logged. This endpoint does not exist.',
    availableEndpoints: [
      'POST /api/cater-valley/orders/draft',
      'POST /api/cater-valley/orders/update',
      'POST /api/cater-valley/orders/confirm'
    ],
    timestamp: new Date().toISOString(),
  }, { status: 404 });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const resolvedParams = await params;
  const headers = Object.fromEntries(request.headers.entries());
  const url = request.url;
  const slug = resolvedParams.slug;
  
  let body = null;
  try {
    body = await request.json();
  } catch (error) {
    try {
      const text = await request.text();
      body = { raw: text };
    } catch (textError) {
      body = { error: 'Could not parse body' };
    }
  }

  console.log('=== CaterValley Catch-All Debug - PUT Request ===');
  console.log('URL:', url);
  console.log('Slug:', slug);
  console.log('Headers:', headers);
  console.log('Body:', body);
  console.log('=== End Debug Info ===');

  return NextResponse.json({
    method: 'PUT',
    url,
    slug,
    headers,
    body,
    message: 'Catch-all debug endpoint - request logged. This endpoint does not exist.',
    availableEndpoints: [
      'POST /api/cater-valley/orders/draft',
      'POST /api/cater-valley/orders/update',
      'POST /api/cater-valley/orders/confirm'
    ],
    timestamp: new Date().toISOString(),
  }, { status: 404 });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const resolvedParams = await params;
  const headers = Object.fromEntries(request.headers.entries());
  const url = request.url;
  const slug = resolvedParams.slug;
  
  let body = null;
  try {
    body = await request.json();
  } catch (error) {
    try {
      const text = await request.text();
      body = { raw: text };
    } catch (textError) {
      body = { error: 'Could not parse body' };
    }
  }

  console.log('=== CaterValley Catch-All Debug - PATCH Request ===');
  console.log('URL:', url);
  console.log('Slug:', slug);
  console.log('Headers:', headers);
  console.log('Body:', body);
  console.log('=== End Debug Info ===');

  return NextResponse.json({
    method: 'PATCH',
    url,
    slug,
    headers,
    body,
    message: 'Catch-all debug endpoint - request logged. This endpoint does not exist.',
    availableEndpoints: [
      'POST /api/cater-valley/orders/draft',
      'POST /api/cater-valley/orders/update',
      'POST /api/cater-valley/orders/confirm'
    ],
    timestamp: new Date().toISOString(),
  }, { status: 404 });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const resolvedParams = await params;
  const headers = Object.fromEntries(request.headers.entries());
  const url = request.url;
  const slug = resolvedParams.slug;

  console.log('=== CaterValley Catch-All Debug - DELETE Request ===');
  console.log('URL:', url);
  console.log('Slug:', slug);
  console.log('Headers:', headers);
  console.log('=== End Debug Info ===');

  return NextResponse.json({
    method: 'DELETE',
    url,
    slug,
    headers,
    message: 'Catch-all debug endpoint - request logged. This endpoint does not exist.',
    availableEndpoints: [
      'POST /api/cater-valley/orders/draft',
      'POST /api/cater-valley/orders/update',
      'POST /api/cater-valley/orders/confirm'
    ],
    timestamp: new Date().toISOString(),
  }, { status: 404 });
} 