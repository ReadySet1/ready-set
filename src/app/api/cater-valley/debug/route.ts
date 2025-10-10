/**
 * Debug endpoint to capture CaterValley API requests
 * This will help identify what URLs CaterValley is actually calling
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const headers = Object.fromEntries(request.headers.entries());
  const url = request.url;
  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());

  console.log('=== CaterValley Debug - GET Request ===');
  console.log('URL:', url);
  console.log('Headers:', headers);
  console.log('Search Params:', searchParams);
  console.log('=== End Debug Info ===');

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
  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
  
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

  console.log('=== CaterValley Debug - POST Request ===');
  console.log('URL:', url);
  console.log('Headers:', headers);
  console.log('Search Params:', searchParams);
  console.log('Body:', body);
  console.log('=== End Debug Info ===');

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

  console.log('=== CaterValley Debug - PUT Request ===');
  console.log('URL:', url);
  console.log('Headers:', headers);
  console.log('Body:', body);
  console.log('=== End Debug Info ===');

  return NextResponse.json({
    method: 'PUT',
    url,
    headers,
    body,
    message: 'Debug endpoint - request logged',
    timestamp: new Date().toISOString(),
  });
}

export async function PATCH(request: NextRequest) {
  const headers = Object.fromEntries(request.headers.entries());
  const url = request.url;
  
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

  console.log('=== CaterValley Debug - PATCH Request ===');
  console.log('URL:', url);
  console.log('Headers:', headers);
  console.log('Body:', body);
  console.log('=== End Debug Info ===');

  return NextResponse.json({
    method: 'PATCH',
    url,
    headers,
    body,
    message: 'Debug endpoint - request logged',
    timestamp: new Date().toISOString(),
  });
} 