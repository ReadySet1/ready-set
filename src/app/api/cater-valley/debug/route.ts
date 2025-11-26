/**
 * Debug endpoint to capture CaterValley API requests
 * This will help identify what URLs CaterValley is actually calling
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const headers = Object.fromEntries(request.headers.entries());
  const url = request.url;
  const searchParams = request.nextUrl
    ? Object.fromEntries(request.nextUrl.searchParams.entries())
    : Object.fromEntries(new URL(url).searchParams.entries());

          
  return NextResponse.json({
    method: 'GET',
    url,
    headers,
    searchParams,
    message: 'Debug endpoint - request logged',
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  const headers = Object.fromEntries(request.headers.entries());
  const url = request.url;
  const searchParams = request.nextUrl
    ? Object.fromEntries(request.nextUrl.searchParams.entries())
    : Object.fromEntries(new URL(url).searchParams.entries());
  
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

            
  return NextResponse.json({
    method: 'POST',
    url,
    headers,
    searchParams,
    body,
    message: 'Debug endpoint - request logged',
    timestamp: new Date().toISOString(),
  });
}

export async function PUT(request: NextRequest) {
  const headers = Object.fromEntries(request.headers.entries());
  const url = request.url;
  const searchParams = request.nextUrl
    ? Object.fromEntries(request.nextUrl.searchParams.entries())
    : Object.fromEntries(new URL(url).searchParams.entries());

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

          
  return NextResponse.json({
    method: 'PUT',
    url,
    headers,
    searchParams,
    body,
    message: 'Debug endpoint - request logged',
    timestamp: new Date().toISOString(),
  });
}

export async function PATCH(request: NextRequest) {
  const headers = Object.fromEntries(request.headers.entries());
  const url = request.url;
  const searchParams = request.nextUrl
    ? Object.fromEntries(request.nextUrl.searchParams.entries())
    : Object.fromEntries(new URL(url).searchParams.entries());

  let body: Record<string, unknown> | null = null;
  try {
    const jsonBody = await request.json();
    // Ensure we always get an object with content
    body = jsonBody !== null && jsonBody !== undefined && Object.keys(jsonBody).length > 0
      ? jsonBody
      : { error: 'Could not parse body' };
  } catch (error) {
    try {
      const text = await request.text();
      body = text ? { raw: text } : { error: 'Could not parse body' };
    } catch (textError) {
      body = { error: 'Could not parse body' };
    }
  }

  return NextResponse.json({
    method: 'PATCH',
    url,
    headers,
    searchParams,
    body,
    message: 'Debug endpoint - request logged',
    timestamp: new Date().toISOString(),
  });
} 