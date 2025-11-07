/**
 * Driver Metadata Cache
 *
 * In-memory cache for driver metadata (name, vehicle info) to reduce database queries.
 * Driver metadata rarely changes, so caching for 5 minutes provides significant performance improvement.
 *
 * Performance Impact:
 * - Reduces database queries by ~95% for location updates
 * - Each driver updates location every 5 seconds = 12 queries/minute
 * - With caching: 12 queries/minute → ~0.2 queries/minute (cache refresh every 5 min)
 *
 * Memory Usage:
 * - ~100 bytes per cached entry
 * - With 50 drivers: ~5 KB total
 * - Auto-cleanup prevents unbounded growth
 */

export interface DriverMetadata {
  driverId: string;
  employeeId: string | null;
  vehicleNumber: string | null;
  firstName: string | null;
  lastName: string | null;
  userId: string;
}

interface CacheEntry {
  data: DriverMetadata;
  expiresAt: number; // Unix timestamp in milliseconds
}

/**
 * Configuration for driver metadata cache
 */
const CACHE_CONFIG = {
  /** Cache TTL in milliseconds (5 minutes) */
  TTL_MS: 5 * 60 * 1000,

  /** Cleanup interval in milliseconds (10 minutes) */
  CLEANUP_INTERVAL_MS: 10 * 60 * 1000,

  /** Maximum cache size (safety limit) */
  MAX_ENTRIES: 1000,
} as const;

/**
 * In-memory cache for driver metadata with automatic expiration and cleanup
 */
class DriverMetadataCache {
  private cache: Map<string, CacheEntry> = new Map();
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
   * Get driver metadata from cache
   * Returns null if not found or expired
   */
  get(driverId: string): DriverMetadata | null {
    const entry = this.cache.get(driverId);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() >= entry.expiresAt) {
      this.cache.delete(driverId);
      return null;
    }

    return entry.data;
  }

  /**
   * Store driver metadata in cache with TTL
   */
  set(driverId: string, metadata: DriverMetadata): void {
    // Prevent unbounded growth (safety mechanism)
    if (this.cache.size >= CACHE_CONFIG.MAX_ENTRIES) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    const entry: CacheEntry = {
      data: metadata,
      expiresAt: Date.now() + CACHE_CONFIG.TTL_MS,
    };

    this.cache.set(driverId, entry);
  }

  /**
   * Manually invalidate a driver's cached metadata
   * Useful when driver info is updated
   */
  invalidate(driverId: string): void {
    this.cache.delete(driverId);
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Remove expired entries to prevent memory leaks
   */
  private cleanup(): void {
    const now = Date.now();
    let removedCount = 0;

    for (const [driverId, entry] of this.cache.entries()) {
      if (now >= entry.expiresAt) {
        this.cache.delete(driverId);
        removedCount++;
      }
    }

    // Log cleanup in development only
    if (process.env.NODE_ENV === 'development' && removedCount > 0) {
      console.log(`[DriverMetadataCache] Cleaned up ${removedCount} expired entries`);
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  getStats(): {
    size: number;
    maxSize: number;
    ttlMs: number;
  } {
    return {
      size: this.cache.size,
      maxSize: CACHE_CONFIG.MAX_ENTRIES,
      ttlMs: CACHE_CONFIG.TTL_MS,
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
export const driverMetadataCache = new DriverMetadataCache();

// Auto-initialize on import (for Next.js server-side)
if (typeof window === 'undefined') {
  driverMetadataCache.initialize();
}
