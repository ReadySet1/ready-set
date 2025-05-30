import { useCallback, useRef, useState } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface UseApiCacheOptions {
  /**
   * Cache duration in milliseconds
   * @default 300000 (5 minutes)
   */
  cacheDuration?: number;
  /**
   * Whether to return stale data while revalidating
   * @default true
   */
  staleWhileRevalidate?: boolean;
  /**
   * Stale time in milliseconds - how long to serve stale data
   * @default 600000 (10 minutes)
   */
  staleTime?: number;
}

/**
 * Custom hook for API caching to reduce redundant requests
 * Implements stale-while-revalidate pattern for better UX
 */
export function useApiCache<T>(options: UseApiCacheOptions = {}) {
  const {
    cacheDuration = 5 * 60 * 1000, // 5 minutes
    staleWhileRevalidate = true,
    staleTime = 10 * 60 * 1000, // 10 minutes
  } = options;

  const cache = useRef<Map<string, CacheEntry<T>>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const getCachedData = useCallback((key: string): T | null => {
    const entry = cache.current.get(key);
    if (!entry) return null;

    const now = Date.now();
    
    // If data is fresh, return it
    if (now < entry.expiresAt) {
      return entry.data;
    }

    // If stale-while-revalidate is enabled and data is within stale time
    if (staleWhileRevalidate && now < entry.timestamp + staleTime) {
      return entry.data;
    }

    // Data is too old, remove from cache
    cache.current.delete(key);
    return null;
  }, [staleWhileRevalidate, staleTime]);

  const setCachedData = useCallback((key: string, data: T) => {
    const now = Date.now();
    cache.current.set(key, {
      data,
      timestamp: now,
      expiresAt: now + cacheDuration,
    });
  }, [cacheDuration]);

  const fetchWithCache = useCallback(async <TResult = T>(
    key: string,
    fetcher: () => Promise<TResult>,
    options?: { forceRefresh?: boolean }
  ): Promise<TResult> => {
    const { forceRefresh = false } = options || {};

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cachedData = getCachedData(key) as TResult | null;
      if (cachedData !== null) {
        return cachedData;
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await fetcher();
      setCachedData(key, data as unknown as T);
      return data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [getCachedData, setCachedData]);

  const invalidateCache = useCallback((key?: string) => {
    if (key) {
      cache.current.delete(key);
    } else {
      cache.current.clear();
    }
  }, []);

  const isStale = useCallback((key: string): boolean => {
    const entry = cache.current.get(key);
    if (!entry) return true;

    const now = Date.now();
    return now >= entry.expiresAt;
  }, []);

  return {
    fetchWithCache,
    getCachedData,
    setCachedData,
    invalidateCache,
    isStale,
    isLoading,
    error,
  };
}

/**
 * Generate a cache key from URL and parameters
 */
export function createCacheKey(url: string, params?: Record<string, any>): string {
  if (!params) return url;
  
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });
  
  const paramString = searchParams.toString();
  return paramString ? `${url}?${paramString}` : url;
} 