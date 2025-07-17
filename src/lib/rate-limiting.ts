// src/lib/rate-limiting.ts
import { NextRequest, NextResponse } from 'next/server';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string;
}

// In-memory store for rate limiting (use Redis in production)
const requestCounts = new Map<string, { count: number; resetTime: number }>();

/**
 * Rate limiting middleware for API endpoints
 */
export function withRateLimit(config: RateLimitConfig) {
  return function rateLimit(request: NextRequest): NextResponse | null {
    const {
      windowMs = 15 * 60 * 1000, // 15 minutes default
      maxRequests = 100, // 100 requests default
      message = 'Too many requests. Please try again later.'
    } = config;

    // Get client identifier (IP address or user ID from auth)
    const clientId = getClientIdentifier(request);
    const now = Date.now();
    
    // Clean up expired entries
    cleanupExpiredEntries(now);
    
    // Get current count for this client
    const current = requestCounts.get(clientId);
    
    if (!current || now > current.resetTime) {
      // First request in this window or window has expired
      requestCounts.set(clientId, {
        count: 1,
        resetTime: now + windowMs
      });
      return null; // Allow request
    }
    
    if (current.count >= maxRequests) {
      // Rate limit exceeded
      const resetTimeSeconds = Math.ceil((current.resetTime - now) / 1000);
      
      const response = NextResponse.json(
        { 
          error: message,
          retryAfter: resetTimeSeconds 
        },
        { status: 429 }
      );
      
      response.headers.set('X-RateLimit-Limit', maxRequests.toString());
      response.headers.set('X-RateLimit-Remaining', '0');
      response.headers.set('X-RateLimit-Reset', current.resetTime.toString());
      response.headers.set('Retry-After', resetTimeSeconds.toString());
      
      return response;
    }
    
    // Increment counter
    current.count++;
    requestCounts.set(clientId, current);
    
    return null; // Allow request
  };
}

/**
 * Get client identifier for rate limiting
 */
function getClientIdentifier(request: NextRequest): string {
  // Try to get user ID from authorization header first
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // In a real implementation, you'd decode the JWT to get user ID
    // For now, use a hash of the token
    const token = authHeader.substring(7);
    return `user:${token.substring(0, 10)}`;
  }
  
  // Fall back to IP address
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : 
             request.headers.get('x-real-ip') || 
             'unknown';
  
  return `ip:${ip}`;
}

/**
 * Clean up expired entries to prevent memory leaks
 */
function cleanupExpiredEntries(now: number): void {
  for (const [key, value] of requestCounts.entries()) {
    if (now > value.resetTime) {
      requestCounts.delete(key);
    }
  }
}

/**
 * Predefined rate limit configurations for common scenarios
 */
export const RateLimitConfigs = {
  // Very strict for authentication endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    message: 'Too many authentication attempts. Please try again in 15 minutes.'
  },
  
  // Moderate for general API usage
  api: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    message: 'API rate limit exceeded. Please try again later.'
  },
  
  // Lenient for file uploads (larger operations)
  upload: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 50,
    message: 'Upload rate limit exceeded. Please try again later.'
  },
  
  // Strict for admin operations
  admin: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 50,
    message: 'Admin operation rate limit exceeded.'
  }
}; 