// src/utils/api-monitoring.ts
import { NextRequest, NextResponse } from 'next/server';

interface PerformanceMetrics {
  endpoint: string;
  method: string;
  statusCode: number;
  duration: number;
  timestamp: Date;
  userId?: string;
  userType?: string;
}

/**
 * Middleware wrapper for API routes to add performance monitoring
 */
export function withPerformanceMonitoring<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T,
  endpoint: string
): T {
  return (async (...args: Parameters<T>) => {
    const startTime = performance.now();
    const request = args[0] as NextRequest;
    
    try {
      const response = await handler(...args);
      const duration = performance.now() - startTime;
      
      // Log performance metrics
      const metrics: PerformanceMetrics = {
        endpoint,
        method: request.method,
        statusCode: response.status,
        duration,
        timestamp: new Date(),
        userId: response.headers.get('X-User-Id') || undefined,
        userType: response.headers.get('X-User-Type') || undefined,
      };
      
      // Log slow requests
      if (duration > 1000) {
        console.warn('Slow API request detected:', metrics);
      }
      
      // You could send these metrics to your monitoring service
      // await sendToMonitoringService(metrics);
      
      // Add performance headers
      response.headers.set('X-Response-Time', `${duration.toFixed(2)}ms`);
      response.headers.set('X-Request-Id', crypto.randomUUID());
      
      return response;
    } catch (error) {
      const duration = performance.now() - startTime;
      
      // Log error metrics
      console.error('API request failed:', {
        endpoint,
        method: request.method,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      throw error;
    }
  }) as T;
}

/**
 * Rate limiting middleware
 */
interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyGenerator?: (req: NextRequest) => string; // Function to generate rate limit key
}

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function withRateLimit(config: RateLimitConfig) {
  const { windowMs, maxRequests, keyGenerator } = config;
  
  return function rateLimit<T extends (...args: any[]) => Promise<NextResponse>>(
    handler: T
  ): T {
    return (async (...args: Parameters<T>) => {
      const request = args[0] as NextRequest;
      const key = keyGenerator ? keyGenerator(request) : request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || 'anonymous';
      const now = Date.now();
      
      // Get or create rate limit entry
      let entry = rateLimitStore.get(key);
      
      if (!entry || entry.resetTime < now) {
        entry = {
          count: 0,
          resetTime: now + windowMs,
        };
        rateLimitStore.set(key, entry);
      }
      
      // Check rate limit
      if (entry.count >= maxRequests) {
        const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
        
        return NextResponse.json(
          { error: 'Too many requests', retryAfter },
          {
            status: 429,
            headers: {
              'Retry-After': retryAfter.toString(),
              'X-RateLimit-Limit': maxRequests.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': new Date(entry.resetTime).toISOString(),
            },
          }
        );
      }
      
      // Increment count
      entry.count++;
      
      // Call the handler
      const response = await handler(...args);
      
      // Add rate limit headers
      response.headers.set('X-RateLimit-Limit', maxRequests.toString());
      response.headers.set('X-RateLimit-Remaining', (maxRequests - entry.count).toString());
      response.headers.set('X-RateLimit-Reset', new Date(entry.resetTime).toISOString());
      
      return response;
    }) as T;
  };
}

// Usage example:
/*
import { withPerformanceMonitoring, withRateLimit } from '@/utils/api-monitoring';

// Apply rate limiting
const rateLimited = withRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
  keyGenerator: (req) => {
    // Rate limit by user ID if authenticated, otherwise by IP
    const userId = req.headers.get('x-user-id');
    return userId || req.ip || 'anonymous';
  },
});

// Apply both rate limiting and performance monitoring
export const GET = withPerformanceMonitoring(
  rateLimited(async (request: NextRequest) => {
    // Your API logic here
  }),
  '/api/dashboard-metrics'
);
*/
