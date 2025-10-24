/**
 * In-memory cache for Supabase signed URLs with TTL
 * Reduces N+1 queries when fetching multiple files
 */

import { createClient } from '@/utils/supabase/server';
import { DEFAULT_SIGNED_URL_EXPIRATION, SIGNED_URL_EXPIRATION } from '@/config/file-config';

interface CachedSignedUrl {
  url: string;
  expiresAt: number; // timestamp in ms
}

class SignedUrlCache {
  private cache: Map<string, CachedSignedUrl> = new Map();
  private readonly TTL_BUFFER_MS = 60 * 1000; // 1 minute buffer before actual expiration

  /**
   * Get cache key for a file path and bucket
   */
  private getCacheKey(bucket: string, filePath: string): string {
    return `${bucket}:${filePath}`;
  }

  /**
   * Check if cached URL is still valid
   */
  private isValid(cached: CachedSignedUrl): boolean {
    return cached.expiresAt > Date.now() + this.TTL_BUFFER_MS;
  }

  /**
   * Get signed URL from cache or generate new one
   */
  async getSignedUrl(
    bucket: string,
    filePath: string,
    expirationSeconds: number = DEFAULT_SIGNED_URL_EXPIRATION
  ): Promise<{ url: string; fromCache: boolean } | null> {
    const cacheKey = this.getCacheKey(bucket, filePath);
    const cached = this.cache.get(cacheKey);

    // Return cached URL if still valid
    if (cached && this.isValid(cached)) {
      return { url: cached.url, fromCache: true };
    }

    // Generate new signed URL
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, expirationSeconds);

      if (error || !data) {
        console.error(`Failed to generate signed URL for ${filePath}:`, error);
        return null;
      }

      // Cache the new URL
      const expiresAt = Date.now() + (expirationSeconds * 1000);
      this.cache.set(cacheKey, {
        url: data.signedUrl,
        expiresAt
      });

      return { url: data.signedUrl, fromCache: false };
    } catch (error) {
      console.error(`Error generating signed URL for ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Batch get signed URLs for multiple files (optimized)
   */
  async getBatchSignedUrls(
    bucket: string,
    filePaths: string[],
    expirationSeconds: number = DEFAULT_SIGNED_URL_EXPIRATION
  ): Promise<Map<string, string>> {
    const results = new Map<string, string>();

    // Process all URLs in parallel
    const promises = filePaths.map(async (filePath) => {
      const result = await this.getSignedUrl(bucket, filePath, expirationSeconds);
      if (result) {
        results.set(filePath, result.url);
      }
    });

    await Promise.all(promises);

    return results;
  }

  /**
   * Clear expired entries from cache
   */
  pruneExpired(): void {
    const now = Date.now();
    for (const [key, cached] of this.cache.entries()) {
      if (cached.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear entire cache (useful for testing)
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics (for monitoring)
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Singleton instance
let signedUrlCache: SignedUrlCache | null = null;

/**
 * Get the singleton signed URL cache instance
 */
export function getSignedUrlCache(): SignedUrlCache {
  if (!signedUrlCache) {
    signedUrlCache = new SignedUrlCache();

    // Prune expired entries every 5 minutes
    setInterval(() => {
      signedUrlCache?.pruneExpired();
    }, 5 * 60 * 1000);
  }

  return signedUrlCache;
}

/**
 * Clear the cache (useful for testing)
 */
export function clearSignedUrlCache(): void {
  signedUrlCache?.clear();
}
