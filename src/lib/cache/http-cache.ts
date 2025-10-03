/**
 * HTTP Caching Utilities
 *
 * Provides utilities for implementing HTTP caching with proper headers,
 * ETag support, and conditional request handling.
 */

import { NextRequest, NextResponse } from "next/server";

/**
 * Cache control configurations for different data types
 */
export const CACHE_CONFIGS = {
  // Vendor metrics: Cache for 5 minutes (relatively static data)
  VENDOR_METRICS: {
    maxAge: 5 * 60, // 5 minutes
    sMaxAge: 5 * 60, // 5 minutes for shared caches
    staleWhileRevalidate: 60, // 1 minute stale while revalidating
  },

  // Vendor orders: Cache for 2 minutes (more dynamic data)
  VENDOR_ORDERS: {
    maxAge: 2 * 60, // 2 minutes
    sMaxAge: 2 * 60, // 2 minutes for shared caches
    staleWhileRevalidate: 30, // 30 seconds stale while revalidating
  },

  // Dashboard metrics: Cache for 10 minutes (aggregated data)
  DASHBOARD_METRICS: {
    maxAge: 10 * 60, // 10 minutes
    sMaxAge: 10 * 60, // 10 minutes for shared caches
    staleWhileRevalidate: 120, // 2 minutes stale while revalidating
  }
} as const;

/**
 * Generate Cache-Control header value
 */
export function generateCacheControl(config: {
  maxAge: number;
  sMaxAge?: number;
  staleWhileRevalidate?: number;
  public?: boolean;
}): string {
  const directives = [];

  directives.push(`max-age=${config.maxAge}`);

  if (config.sMaxAge !== undefined) {
    directives.push(`s-maxage=${config.sMaxAge}`);
  }

  if (config.staleWhileRevalidate !== undefined) {
    directives.push(`stale-while-revalidate=${config.staleWhileRevalidate}`);
  }

  if (config.public) {
    directives.push('public');
  } else {
    directives.push('private');
  }

  return directives.join(', ');
}

/**
 * Generate ETag from data content
 */
export function generateEtag(data: any): string {
  const content = JSON.stringify(data);
  const hash = Buffer.from(content).toString('base64').slice(0, 16);
  return `"${hash}-${Date.now()}"`;
}

/**
 * Create HTTP response with caching headers
 */
export function createCachedResponse(
  data: any,
  config: {
    maxAge: number;
    sMaxAge?: number;
    staleWhileRevalidate?: number;
    public?: boolean;
  },
  status: number = 200
): NextResponse {
  const etag = generateEtag(data);
  const cacheControl = generateCacheControl(config);

  return NextResponse.json(data, {
    status,
    headers: {
      'Cache-Control': cacheControl,
      'ETag': etag,
      'Last-Modified': new Date().toUTCString(),
    }
  });
}

/**
 * Create 304 Not Modified response for conditional requests
 */
export function createNotModifiedResponse(etag: string): NextResponse {
  return new NextResponse(null, {
    status: 304,
    headers: {
      'ETag': etag,
      'Last-Modified': new Date().toUTCString(),
    }
  });
}

/**
 * Check if request has matching ETag for conditional requests
 */
export function isConditionalRequest(request: NextRequest, etag: string): boolean {
  const ifNoneMatch = request.headers.get('If-None-Match');
  const ifModifiedSince = request.headers.get('If-Modified-Since');

  if (ifNoneMatch && ifNoneMatch.includes(etag.replace(/"/g, ''))) {
    return true;
  }

  // If-Modified-Since is less reliable for our use case since we're using content-based ETags
  // but we can still support it for completeness
  if (ifModifiedSince) {
    const lastModified = new Date().toUTCString();
    const clientModified = new Date(ifModifiedSince).getTime();
    const serverModified = new Date(lastModified).getTime();

    // If the content hasn't been modified since the client's last request
    if (clientModified >= serverModified) {
      return true;
    }
  }

  return false;
}

/**
 * Handle conditional request logic
 */
export function handleConditionalRequest(
  request: NextRequest,
  cachedData: any,
  cacheConfig: {
    maxAge: number;
    sMaxAge?: number;
    staleWhileRevalidate?: number;
    public?: boolean;
  }
): NextResponse | null {
  if (!cachedData) {
    return null; // No cached data, proceed with normal request
  }

  const etag = generateEtag(cachedData);

  if (isConditionalRequest(request, etag)) {
    return createNotModifiedResponse(etag);
  }

  // Return fresh response with caching headers
  return createCachedResponse(cachedData, cacheConfig);
}

/**
 * Record cache performance metrics
 */
export function recordCacheMetrics(
  endpoint: string,
  cacheHit: boolean,
  duration: number,
  userId?: string,
  userType?: string
) {
  // Import here to avoid circular dependencies
  const { recordApiPerformance } = require('../monitoring/dashboard-performance');

  recordApiPerformance(endpoint, 'GET', duration, {
    cacheHit,
    userId,
    userType,
  });
}
