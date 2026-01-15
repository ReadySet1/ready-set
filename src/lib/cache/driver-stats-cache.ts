/**
 * Driver Stats Cache
 *
 * In-memory cache for driver statistics to reduce database queries.
 * Uses period-based TTL to balance freshness with performance.
 *
 * Cache TTL by period:
 * - today: 2 minutes (frequently updated)
 * - week: 5 minutes
 * - month: 10 minutes
 * - all: 15 minutes (rarely changes)
 *
 * Memory Usage:
 * - ~500 bytes per cached entry
 * - With 50 drivers × 4 periods: ~100 KB total
 */

import type { AggregatedDriverStats, DriverStatsSummary, StatsPeriod } from '@/services/tracking/driver-stats';

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  expiresAt: number;
}

/**
 * Configuration for driver stats cache
 */
const CACHE_CONFIG = {
  /** Cache TTL in milliseconds by period */
  TTL_MS: {
    today: 2 * 60 * 1000,    // 2 minutes
    week: 5 * 60 * 1000,     // 5 minutes
    month: 10 * 60 * 1000,   // 10 minutes
    all: 15 * 60 * 1000,     // 15 minutes
  } as Record<StatsPeriod, number>,

  /** Cleanup interval in milliseconds (10 minutes) */
  CLEANUP_INTERVAL_MS: 10 * 60 * 1000,

  /** Maximum cache size (safety limit) */
  MAX_ENTRIES: 500,
} as const;

/**
 * Generate cache key for individual driver stats
 */
function getDriverStatsKey(driverId: string, period: StatsPeriod): string {
  return `driver:${driverId}:${period}`;
}

/**
 * Generate cache key for summary stats
 */
function getSummaryKey(period: StatsPeriod, includeInactive: boolean): string {
  return `summary:${period}:${includeInactive ? 'all' : 'active'}`;
}

/**
 * In-memory cache for driver statistics with automatic expiration and cleanup
 */
class DriverStatsCache {
  private cache: Map<string, CacheEntry<AggregatedDriverStats | DriverStatsSummary>> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private isInitialized: boolean = false;

  /**
   * Initialize the cache and start automatic cleanup
   * Idempotent - safe to call multiple times
   */
  initialize(): void {
    if (this.isInitialized) {
      return;
    }

    // Start periodic cleanup to prevent memory leaks
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, CACHE_CONFIG.CLEANUP_INTERVAL_MS);

    // Ensure cleanup happens on Node.js process exit (in development)
    if (typeof process !== 'undefined' && process.on) {
      process.on('beforeExit', () => this.destroy());
    }

    this.isInitialized = true;
  }

  /**
   * Get driver stats from cache
   * Returns null if not found or expired
   */
  getDriverStats(driverId: string, period: StatsPeriod): {
    data: AggregatedDriverStats;
    cachedAt: Date;
    freshUntil: Date;
  } | null {
    const key = getDriverStatsKey(driverId, period);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() >= entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return {
      data: entry.data as AggregatedDriverStats,
      cachedAt: new Date(entry.cachedAt),
      freshUntil: new Date(entry.expiresAt),
    };
  }

  /**
   * Store driver stats in cache with period-based TTL
   */
  setDriverStats(driverId: string, period: StatsPeriod, stats: AggregatedDriverStats): void {
    this.enforceMaxSize();

    const key = getDriverStatsKey(driverId, period);
    const now = Date.now();
    const ttl = CACHE_CONFIG.TTL_MS[period];

    const entry: CacheEntry<AggregatedDriverStats> = {
      data: stats,
      cachedAt: now,
      expiresAt: now + ttl,
    };

    this.cache.set(key, entry);
  }

  /**
   * Get summary stats from cache
   */
  getSummary(period: StatsPeriod, includeInactive: boolean): {
    data: DriverStatsSummary;
    cachedAt: Date;
    freshUntil: Date;
  } | null {
    const key = getSummaryKey(period, includeInactive);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() >= entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return {
      data: entry.data as DriverStatsSummary,
      cachedAt: new Date(entry.cachedAt),
      freshUntil: new Date(entry.expiresAt),
    };
  }

  /**
   * Store summary stats in cache
   */
  setSummary(period: StatsPeriod, includeInactive: boolean, summary: DriverStatsSummary): void {
    this.enforceMaxSize();

    const key = getSummaryKey(period, includeInactive);
    const now = Date.now();
    const ttl = CACHE_CONFIG.TTL_MS[period];

    const entry: CacheEntry<DriverStatsSummary> = {
      data: summary,
      cachedAt: now,
      expiresAt: now + ttl,
    };

    this.cache.set(key, entry);
  }

  /**
   * Invalidate a specific driver's cached stats (all periods)
   * Call this when a driver completes a delivery or ends a shift
   */
  invalidateDriver(driverId: string): void {
    const periods: StatsPeriod[] = ['today', 'week', 'month', 'all'];
    for (const period of periods) {
      const key = getDriverStatsKey(driverId, period);
      this.cache.delete(key);
    }

    // Also invalidate summaries since driver stats affect totals
    this.invalidateSummaries();
  }

  /**
   * Invalidate all summary caches
   * Call this when any driver's stats change
   */
  invalidateSummaries(): void {
    const periods: StatsPeriod[] = ['today', 'week', 'month', 'all'];
    for (const period of periods) {
      this.cache.delete(getSummaryKey(period, true));
      this.cache.delete(getSummaryKey(period, false));
    }
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Enforce maximum cache size to prevent unbounded growth
   */
  private enforceMaxSize(): void {
    if (this.cache.size >= CACHE_CONFIG.MAX_ENTRIES) {
      // Remove oldest entries (first 10%)
      const toRemove = Math.ceil(CACHE_CONFIG.MAX_ENTRIES * 0.1);
      const iterator = this.cache.keys();
      for (let i = 0; i < toRemove; i++) {
        const key = iterator.next().value;
        if (key) {
          this.cache.delete(key);
        }
      }
    }
  }

  /**
   * Remove expired entries to prevent memory leaks
   */
  private cleanup(): void {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now >= entry.expiresAt) {
        this.cache.delete(key);
        removedCount++;
      }
    }

    // Log cleanup in development only
    if (process.env.NODE_ENV === 'development' && removedCount > 0) {
      console.log(`[DriverStatsCache] Cleaned up ${removedCount} expired entries`);
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  getStats(): {
    size: number;
    maxSize: number;
    ttlConfig: typeof CACHE_CONFIG.TTL_MS;
  } {
    return {
      size: this.cache.size,
      maxSize: CACHE_CONFIG.MAX_ENTRIES,
      ttlConfig: CACHE_CONFIG.TTL_MS,
    };
  }

  /**
   * Destroy the cache and stop cleanup interval
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
export const driverStatsCache = new DriverStatsCache();

// Auto-initialize on import (for Next.js server-side)
if (typeof window === 'undefined') {
  driverStatsCache.initialize();
}
