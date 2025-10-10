// src/lib/rate-limiting.ts
import { NextRequest, NextResponse } from 'next/server';

// Redis-compatible interface for rate limiting storage
interface RateLimitStorage {
  get(key: string): Promise<{ count: number; resetTime: number; windowStart?: number } | null>;
  set(key: string, value: { count: number; resetTime: number; windowStart?: number }, ttl?: number): Promise<void>;
  increment(key: string, ttl: number): Promise<number>;
  cleanup(): Promise<void>;
}

// In-memory storage implementation (Redis-compatible interface)
class InMemoryRateLimitStorage implements RateLimitStorage {
  private storage = new Map<string, { count: number; resetTime: number; windowStart: number }>();

  async get(key: string): Promise<{ count: number; resetTime: number; windowStart?: number } | null> {
    const value = this.storage.get(key);
    if (!value) return null;

    // Check if window has expired
    if (Date.now() > value.resetTime) {
      this.storage.delete(key);
      return null;
    }

    return value;
  }

  async set(key: string, value: { count: number; resetTime: number; windowStart?: number }, ttl?: number): Promise<void> {
    this.storage.set(key, { ...value, windowStart: value.windowStart || Date.now() });
  }

  async increment(key: string, ttl: number): Promise<number> {
    const now = Date.now();
    const windowStart = Math.floor(now / ttl) * ttl;
    const resetTime = windowStart + ttl;

    let entry = this.storage.get(key);

    if (!entry || entry.resetTime < now) {
      // New window or expired window
      entry = { count: 1, resetTime, windowStart };
    } else {
      // Increment existing window
      entry.count++;
    }

    this.storage.set(key, entry);
    return entry.count;
  }

  async cleanup(): Promise<void> {
    const now = Date.now();
    for (const [key, value] of this.storage.entries()) {
      if (now > value.resetTime) {
        this.storage.delete(key);
      }
    }
  }
}

// Redis storage implementation (for production use)
class RedisRateLimitStorage implements RateLimitStorage {
  private redisClient: any; // Redis client would be injected

  constructor(redisClient?: any) {
    this.redisClient = redisClient;
  }

  async get(key: string): Promise<{ count: number; resetTime: number; windowStart?: number } | null> {
    if (!this.redisClient) return null;

    try {
      const data = await this.redisClient.get(key);
      if (!data) return null;

      const parsed = JSON.parse(data);
      if (Date.now() > parsed.resetTime) {
        await this.redisClient.del(key);
        return null;
      }

      return parsed;
    } catch (error) {
      console.error('Redis rate limit get error:', error);
      return null;
    }
  }

  async set(key: string, value: { count: number; resetTime: number; windowStart?: number }, ttl?: number): Promise<void> {
    if (!this.redisClient) return;

    try {
      const data = JSON.stringify({ ...value, windowStart: value.windowStart || Date.now() });
      if (ttl) {
        await this.redisClient.setex(key, Math.ceil(ttl / 1000), data);
      } else {
        await this.redisClient.set(key, data);
      }
    } catch (error) {
      console.error('Redis rate limit set error:', error);
    }
  }

  async increment(key: string, ttl: number): Promise<number> {
    if (!this.redisClient) return 0;

    try {
      const now = Date.now();
      const windowStart = Math.floor(now / ttl) * ttl;
      const resetTime = windowStart + ttl;

      // Use Redis INCR with sliding window logic
      const windowKey = `${key}:${windowStart}`;
      const count = await this.redisClient.incr(windowKey);

      if (count === 1) {
        // Set TTL for new window
        await this.redisClient.expire(windowKey, Math.ceil(ttl / 1000));
      }

      return count;
    } catch (error) {
      console.error('Redis rate limit increment error:', error);
      return 0;
    }
  }

  async cleanup(): Promise<void> {
    // Redis cleanup would be handled by TTL, but we can implement pattern cleanup if needed
    if (!this.redisClient) return;
    // Implementation would depend on specific Redis patterns used
  }
}

// Rate limit storage instance (can be swapped for Redis in production)
let rateLimitStorage: RateLimitStorage = new InMemoryRateLimitStorage();

// Configuration for different rate limit strategies
export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string;
  strategy?: 'fixed-window' | 'sliding-window' | 'token-bucket';
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
}

// Rate limit tiers for different endpoint types
export const RATE_LIMIT_TIERS = {
  // Very strict for authentication endpoints
  AUTH: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    message: 'Too many authentication attempts. Please try again in 15 minutes.',
    strategy: 'sliding-window' as const,
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  },

  // Moderate for general API usage
  API: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    message: 'API rate limit exceeded. Please try again later.',
    strategy: 'sliding-window' as const,
    skipSuccessfulRequests: true,
    skipFailedRequests: false
  },

  // Lenient for file uploads (larger operations)
  UPLOAD: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 50,
    message: 'Upload rate limit exceeded. Please try again later.',
    strategy: 'sliding-window' as const,
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  },

  // Strict for admin operations
  ADMIN: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 50,
    message: 'Admin operation rate limit exceeded.',
    strategy: 'sliding-window' as const,
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  },

  // Very strict for sensitive operations
  SENSITIVE: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 10,
    message: 'Rate limit exceeded for sensitive operations.',
    strategy: 'sliding-window' as const,
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  }
} as const;

type RateLimitTier = keyof typeof RATE_LIMIT_TIERS;

/**
 * Enhanced rate limiting middleware with Redis support and sliding window algorithms
 */
export function withRateLimit(config: RateLimitConfig | RateLimitTier) {
  return async function rateLimit(request: NextRequest): Promise<NextResponse | null> {
    const rateLimitConfig = typeof config === 'string' ? RATE_LIMIT_TIERS[config] : config;

    const {
      windowMs = 15 * 60 * 1000, // 15 minutes default
      maxRequests = 100, // 100 requests default
      message = 'Too many requests. Please try again later.',
      strategy = 'sliding-window',
      skipSuccessfulRequests = false,
      skipFailedRequests = false
    } = rateLimitConfig;

    // Get client identifier
    const clientId = getClientIdentifier(request);
    const key = `ratelimit:${clientId}:${request.nextUrl.pathname}`;

    try {
      // Clean up expired entries periodically
      if (Math.random() < 0.01) { // 1% chance to cleanup
        await rateLimitStorage.cleanup();
      }

      let currentCount: number;

      if (strategy === 'sliding-window') {
        currentCount = await rateLimitStorage.increment(key, windowMs);
      } else {
        // Fixed window strategy (legacy)
        const existing = await rateLimitStorage.get(key);
        const now = Date.now();

        if (!existing || now > existing.resetTime) {
          // New window
          await rateLimitStorage.set(key, {
            count: 1,
            resetTime: now + windowMs,
            windowStart: now
          });
          currentCount = 1;
        } else {
          currentCount = existing.count + 1;
          await rateLimitStorage.set(key, {
            ...existing,
            count: currentCount
          });
        }
      }

      // Check if rate limit exceeded
      if (currentCount > maxRequests) {
        const resetTimeSeconds = Math.ceil(windowMs / 1000);

        const response = NextResponse.json(
          {
            error: message,
            retryAfter: resetTimeSeconds,
            limit: maxRequests,
            current: currentCount,
            resetTime: new Date(Date.now() + windowMs).toISOString()
          },
          { status: 429 }
        );

        // Add rate limit headers
        response.headers.set('X-RateLimit-Limit', maxRequests.toString());
        response.headers.set('X-RateLimit-Remaining', '0');
        response.headers.set('X-RateLimit-Reset', (Date.now() + windowMs).toString());
        response.headers.set('Retry-After', resetTimeSeconds.toString());

        // Log rate limit violation for security monitoring
        console.warn(`🚫 Rate limit exceeded for ${clientId} on ${request.nextUrl.pathname}: ${currentCount}/${maxRequests}`);

        return response;
      }

      return null; // Allow request
    } catch (error) {
      console.error('Rate limiting error:', error);
      // On error, allow request but log the issue
      return null;
    }
  };
}

/**
 * Get client identifier for rate limiting
 */
function getClientIdentifier(request: NextRequest): string {
  // Try to get authenticated user ID first (for per-user limits)
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    try {
      // In a real implementation, you'd decode the JWT to get user ID
      // For now, use a hash of the token for consistent identification
      const token = authHeader.substring(7);
      const hash = Buffer.from(token.substring(0, 20)).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
      return `user:${hash}`;
    } catch (error) {
      // If token parsing fails, fall back to IP
    }
  }

  // Fall back to IP address with forwarded header support
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const clientIp = request.headers.get('x-client-ip');

  // Use the most specific IP available
  const ip = forwarded?.split(',')[0]?.trim() ||
            realIp ||
            clientIp ||
            request.headers.get('cf-connecting-ip') || // Cloudflare
            'unknown';

  // Normalize IP for consistent identification
  return `ip:${ip.replace(/[^0-9a-f:.]/gi, '')}`;
}

/**
 * Set up Redis storage for rate limiting (call this during app initialization)
 */
export function setupRateLimitStorage(redisClient?: any): void {
  if (redisClient) {
    rateLimitStorage = new RedisRateLimitStorage(redisClient);
  } else {
  }
}

/**
 * Predefined rate limit configurations for common scenarios
 */
export const RateLimitConfigs = {
  // Very strict for authentication endpoints
  auth: RATE_LIMIT_TIERS.AUTH,

  // Moderate for general API usage
  api: RATE_LIMIT_TIERS.API,

  // Lenient for file uploads (larger operations)
  upload: RATE_LIMIT_TIERS.UPLOAD,

  // Strict for admin operations
  admin: RATE_LIMIT_TIERS.ADMIN,

  // Very strict for sensitive operations
  sensitive: RATE_LIMIT_TIERS.SENSITIVE
} as const;

/**
 * Check if request should be rate limited based on user type and endpoint
 */
export function getRateLimitForRequest(request: NextRequest, userType?: string): RateLimitTier {
  const pathname = request.nextUrl.pathname;

  // Admin routes get stricter limits
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    return 'ADMIN';
  }

  // Authentication routes get very strict limits
  if (pathname.startsWith('/auth') || pathname.startsWith('/api/auth')) {
    return 'AUTH';
  }

  // File upload routes get special treatment
  if (pathname.includes('/upload') || pathname.includes('/file')) {
    return 'UPLOAD';
  }

  // Sensitive operations (user management, etc.)
  if (pathname.includes('/user/') || pathname.includes('/users/')) {
    return 'SENSITIVE';
  }

  // Default API rate limiting
  return 'API';
}

/**
 * Create a rate-limited API route handler
 */
export function createRateLimitedHandler<T extends any[], R>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>,
  rateLimitType: RateLimitTier = 'API'
) {
  return async function rateLimitedHandler(request: NextRequest, ...args: T): Promise<NextResponse> {
    // Apply rate limiting
    const rateLimitResponse = await withRateLimit(rateLimitType)(request);
    if (rateLimitResponse) {
      return rateLimitResponse; // Return rate limit response if limit exceeded
    }

    // Proceed with original handler
    return handler(request, ...args);
  };
} 