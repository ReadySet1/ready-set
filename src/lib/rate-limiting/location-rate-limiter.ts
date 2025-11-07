/**
 * Location Update Rate Limiter
 *
 * Enforces rate limits on driver location updates to prevent:
 * - DoS attacks (malicious clients spamming updates)
 * - Database overload
 * - Excessive Realtime broadcasting
 * - Cost overruns (Supabase charges per operation)
 *
 * Rate Limit: 1 update per 5 seconds per driver (12 updates/minute)
 *
 * Implementation:
 * - In-memory Map tracking last update timestamp per driver
 * - Automatic cleanup of old entries to prevent memory leaks
 * - Thread-safe for concurrent requests (Map operations are atomic)
 */

import { RATE_LIMIT_CONFIG } from '@/constants/realtime-config';

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Time until next allowed update (in milliseconds), null if allowed */
  retryAfter: number | null;
  /** Human-readable message */
  message: string;
}

/**
 * In-memory rate limiter for driver location updates
 */
class LocationRateLimiter {
  private lastUpdateTimes: Map<string, number> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private isInitialized: boolean = false;
  private violationCounts: Map<string, number> = new Map();

  /**
   * Initialize the rate limiter and start automatic cleanup
   * Idempotent - safe to call multiple times
   */
  initialize(): void {
    if (this.isInitialized) {
      return;
    }

    // Start periodic cleanup to prevent memory leaks
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, RATE_LIMIT_CONFIG.CLEANUP_INTERVAL_MS);

    // Ensure cleanup happens on Node.js process exit (in development)
    if (typeof process !== 'undefined' && process.on) {
      process.on('beforeExit', () => this.destroy());
    }

    this.isInitialized = true;
  }

  /**
   * Check if a driver's location update is allowed (READ-ONLY)
   * @deprecated Use checkAndRecordLimit() instead to avoid race conditions
   * This method only checks without recording, which can lead to race conditions
   * in concurrent scenarios. Kept for backward compatibility with tests.
   */
  checkLimit(driverId: string): RateLimitResult {
    const now = Date.now();
    const lastUpdate = this.lastUpdateTimes.get(driverId);

    // First update for this driver - always allowed
    if (lastUpdate === undefined) {
      return {
        allowed: true,
        retryAfter: null,
        message: 'Request allowed',
      };
    }

    const timeSinceLastUpdate = now - lastUpdate;
    const isAllowed = timeSinceLastUpdate >= RATE_LIMIT_CONFIG.MIN_UPDATE_INTERVAL_MS;

    if (isAllowed) {
      return {
        allowed: true,
        retryAfter: null,
        message: 'Request allowed',
      };
    }

    // Rate limit exceeded
    const retryAfter = RATE_LIMIT_CONFIG.MIN_UPDATE_INTERVAL_MS - timeSinceLastUpdate;

    // Track violation for monitoring
    const currentCount = this.violationCounts.get(driverId) || 0;
    this.violationCounts.set(driverId, currentCount + 1);

    return {
      allowed: false,
      retryAfter,
      message: `Rate limit exceeded. Try again in ${Math.ceil(retryAfter / 1000)} seconds.`,
    };
  }

  /**
   * Atomically check AND record a location update to prevent race conditions.
   *
   * SECURITY FIX: This method prevents the race condition where two concurrent
   * requests could both pass checkLimit() before either calls recordUpdate().
   *
   * By recording the update BEFORE returning success, we ensure that concurrent
   * requests are properly rate-limited even under high concurrency.
   *
   * @param driverId - The driver ID to check and record
   * @returns RateLimitResult with allowed status
   */
  checkAndRecordLimit(driverId: string): RateLimitResult {
    const now = Date.now();
    const lastUpdate = this.lastUpdateTimes.get(driverId);

    // First update for this driver - record and allow
    if (lastUpdate === undefined) {
      // ATOMICALLY record before returning (prevents race condition)
      this.lastUpdateTimes.set(driverId, now);
      return {
        allowed: true,
        retryAfter: null,
        message: 'Request allowed',
      };
    }

    const timeSinceLastUpdate = now - lastUpdate;
    const isAllowed = timeSinceLastUpdate >= RATE_LIMIT_CONFIG.MIN_UPDATE_INTERVAL_MS;

    if (isAllowed) {
      // ATOMICALLY record before returning (prevents race condition)
      // Prevent unbounded growth (safety mechanism)
      if (this.lastUpdateTimes.size >= RATE_LIMIT_CONFIG.MAX_ENTRIES) {
        // Remove oldest entry
        const firstKey = this.lastUpdateTimes.keys().next().value;
        if (firstKey) {
          this.lastUpdateTimes.delete(firstKey);
          this.violationCounts.delete(firstKey);
        }
      }
      this.lastUpdateTimes.set(driverId, now);

      return {
        allowed: true,
        retryAfter: null,
        message: 'Request allowed',
      };
    }

    // Rate limit exceeded - track violation
    const retryAfter = RATE_LIMIT_CONFIG.MIN_UPDATE_INTERVAL_MS - timeSinceLastUpdate;
    const currentCount = this.violationCounts.get(driverId) || 0;
    this.violationCounts.set(driverId, currentCount + 1);

    return {
      allowed: false,
      retryAfter,
      message: `Rate limit exceeded. Try again in ${Math.ceil(retryAfter / 1000)} seconds.`,
    };
  }

  /**
   * Record a successful location update
   * Call this after a location update is successfully processed
   */
  recordUpdate(driverId: string): void {
    // Prevent unbounded growth (safety mechanism)
    if (this.lastUpdateTimes.size >= RATE_LIMIT_CONFIG.MAX_ENTRIES) {
      // Remove oldest entry
      const firstKey = this.lastUpdateTimes.keys().next().value;
      if (firstKey) {
        this.lastUpdateTimes.delete(firstKey);
        this.violationCounts.delete(firstKey);
      }
    }

    this.lastUpdateTimes.set(driverId, Date.now());
  }

  /**
   * Manually reset rate limit for a driver
   * Useful for testing or administrative overrides
   */
  reset(driverId: string): void {
    this.lastUpdateTimes.delete(driverId);
    this.violationCounts.delete(driverId);
  }

  /**
   * Clear all rate limit data
   */
  clear(): void {
    this.lastUpdateTimes.clear();
    this.violationCounts.clear();
  }

  /**
   * Remove stale entries to prevent memory leaks
   * Called automatically on a schedule
   */
  private cleanup(): void {
    const now = Date.now();
    let removedCount = 0;

    for (const [driverId, lastUpdate] of this.lastUpdateTimes.entries()) {
      if (now - lastUpdate >= RATE_LIMIT_CONFIG.STALE_THRESHOLD_MS) {
        this.lastUpdateTimes.delete(driverId);
        this.violationCounts.delete(driverId);
        removedCount++;
      }
    }

    // Log cleanup in development only
    if (process.env.NODE_ENV === 'development' && removedCount > 0) {
      console.log(`[LocationRateLimiter] Cleaned up ${removedCount} stale entries`);
    }
  }

  /**
   * Get rate limiter statistics for monitoring
   */
  getStats(): {
    activeDrivers: number;
    totalViolations: number;
    maxEntries: number;
    config: typeof RATE_LIMIT_CONFIG;
  } {
    const totalViolations = Array.from(this.violationCounts.values()).reduce(
      (sum, count) => sum + count,
      0
    );

    return {
      activeDrivers: this.lastUpdateTimes.size,
      totalViolations,
      maxEntries: RATE_LIMIT_CONFIG.MAX_ENTRIES,
      config: RATE_LIMIT_CONFIG,
    };
  }

  /**
   * Get violation count for a specific driver
   * Useful for monitoring potential abuse
   */
  getViolationCount(driverId: string): number {
    return this.violationCounts.get(driverId) || 0;
  }

  /**
   * Destroy the rate limiter and stop cleanup interval
   * Should be called on server shutdown
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
    this.isInitialized = false;
  }
}

// Export singleton instance
export const locationRateLimiter = new LocationRateLimiter();

// Auto-initialize on import (for Next.js server-side)
if (typeof window === 'undefined') {
  locationRateLimiter.initialize();
}

/**
 * Error class for rate limit violations
 * Includes retry-after information for clients
 */
export class RateLimitExceededError extends Error {
  constructor(
    public readonly driverId: string,
    public readonly retryAfter: number
  ) {
    super(`Rate limit exceeded for driver ${driverId}. Retry after ${Math.ceil(retryAfter / 1000)} seconds.`);
    this.name = 'RateLimitExceededError';
  }
}
