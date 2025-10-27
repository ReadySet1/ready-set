/**
 * React Query and caching configuration
 * Centralized cache settings for consistency across the application
 */

/**
 * React Query staleTime configurations (in milliseconds)
 *
 * staleTime: How long data is considered fresh before refetching
 * - Data within staleTime won't trigger a refetch even if a component remounts
 * - Set longer for stable data, shorter for frequently changing data
 */
export const STALE_TIME = {
  /** Very short - 30 seconds for real-time data */
  REALTIME: 30 * 1000,
  /** Short - 2 minutes for frequently changing data */
  SHORT: 2 * 60 * 1000,
  /** Medium - 5 minutes for moderately stable data (default for most queries) */
  MEDIUM: 5 * 60 * 1000,
  /** Long - 15 minutes for stable data */
  LONG: 15 * 60 * 1000,
  /** Very long - 1 hour for rarely changing data */
  VERY_LONG: 60 * 60 * 1000,
} as const;

/**
 * React Query gcTime (garbage collection time) configurations (in milliseconds)
 *
 * gcTime: How long unused/inactive data stays in cache before being garbage collected
 * - Should typically be longer than staleTime
 * - Data can be instantly returned from cache within gcTime even if stale
 */
export const GC_TIME = {
  /** Very short - 2 minutes for temporary data */
  VERY_SHORT: 2 * 60 * 1000,
  /** Short - 5 minutes for ephemeral data */
  SHORT: 5 * 60 * 1000,
  /** Medium - 10 minutes for standard caching (default for most queries) */
  MEDIUM: 10 * 60 * 1000,
  /** Long - 30 minutes for persistent caching */
  LONG: 30 * 60 * 1000,
  /** Very long - 1 hour for rarely accessed stable data */
  VERY_LONG: 60 * 60 * 1000,
} as const;

/**
 * Recommended cache configurations for common use cases
 */
export const CACHE_PRESETS = {
  /** For real-time data that changes frequently (e.g., live updates, notifications) */
  REALTIME: {
    staleTime: STALE_TIME.REALTIME,
    gcTime: GC_TIME.SHORT,
  },
  /** For user-specific frequently accessed data (e.g., recent addresses, favorites) */
  USER_DATA: {
    staleTime: STALE_TIME.SHORT,
    gcTime: GC_TIME.SHORT,
  },
  /** For moderately stable data (e.g., address lists, user profiles) */
  STANDARD: {
    staleTime: STALE_TIME.MEDIUM,
    gcTime: GC_TIME.MEDIUM,
  },
  /** For stable reference data (e.g., settings, configurations) */
  STABLE: {
    staleTime: STALE_TIME.LONG,
    gcTime: GC_TIME.LONG,
  },
  /** For rarely changing data (e.g., static content, system config) */
  STATIC: {
    staleTime: STALE_TIME.VERY_LONG,
    gcTime: GC_TIME.VERY_LONG,
  },
} as const;
