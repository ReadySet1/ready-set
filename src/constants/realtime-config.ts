/**
 * Configuration constants for Supabase Realtime tracking system
 *
 * These values control WebSocket behavior, rate limiting, caching, and other
 * realtime-related settings. Centralized here for easy tuning and consistency.
 *
 * NOTE: Some values are intentionally conservative for production safety.
 * They can be adjusted based on actual load and performance metrics.
 */

// ============================================================================
// WebSocket Connection Configuration
// ============================================================================

/**
 * Connection configuration for Supabase Realtime client
 */
export const CONNECTION_CONFIG = {
  /**
   * Heartbeat interval (milliseconds)
   * NOTE: Supabase has built-in WebSocket heartbeats, this is redundant.
   * Kept for reference but should be removed in cleanup.
   * @deprecated Use Supabase's built-in heartbeat instead
   */
  HEARTBEAT_INTERVAL_MS: 30000,

  /**
   * Initial reconnection delay after disconnect (milliseconds)
   * Exponential backoff starts from this value: 1s → 2s → 4s → 5s (max)
   */
  RECONNECT_DELAY_MS: 1000,

  /**
   * Maximum reconnection delay (milliseconds)
   * Caps exponential backoff to prevent excessively long waits
   */
  RECONNECT_DELAY_MAX_MS: 5000,

  /**
   * Number of reconnection attempts before giving up
   * Set to Infinity for production (never give up)
   */
  RECONNECT_ATTEMPTS: Infinity,

  /**
   * Connection timeout (milliseconds)
   * Time to wait for connection before considering it failed
   */
  TIMEOUT_MS: 10000,
} as const;

// ============================================================================
// Rate Limiting Configuration
// ============================================================================

/**
 * Rate limiting for driver location updates
 * Prevents DoS attacks and database overload
 */
export const RATE_LIMIT_CONFIG = {
  /**
   * Minimum time between location updates per driver (milliseconds)
   * 5 seconds = 12 updates per minute per driver
   *
   * Reasoning:
   * - Real-time enough for live tracking (updates every 5s)
   * - Prevents excessive database writes
   * - Reasonable for battery/bandwidth considerations
   */
  MIN_UPDATE_INTERVAL_MS: 5 * 1000,

  /**
   * Cleanup interval for rate limit map (milliseconds)
   * Removes stale entries every 15 minutes
   */
  CLEANUP_INTERVAL_MS: 15 * 60 * 1000,

  /**
   * Consider rate limit entry stale after this duration (milliseconds)
   * 30 minutes without updates = driver is inactive, clean up entry
   */
  STALE_THRESHOLD_MS: 30 * 60 * 1000,

  /**
   * Maximum rate limit map size (safety limit)
   * Prevents unbounded memory growth
   */
  MAX_ENTRIES: 1000,
} as const;

// ============================================================================
// Caching Configuration
// ============================================================================

/**
 * Caching configuration for driver metadata
 * Reduces database queries for driver info (name, vehicle, etc.)
 */
export const CACHE_CONFIG = {
  /**
   * Cache TTL for driver metadata (milliseconds)
   * 5 minutes is reasonable since driver info rarely changes
   *
   * Performance impact:
   * - Without cache: 12 queries/minute per driver (location update interval)
   * - With cache: ~0.2 queries/minute per driver (cache refresh)
   * - 98% reduction in queries
   */
  DRIVER_METADATA_TTL_MS: 5 * 60 * 1000,

  /**
   * Cleanup interval for cache (milliseconds)
   * Removes expired entries every 10 minutes
   */
  CLEANUP_INTERVAL_MS: 10 * 60 * 1000,

  /**
   * Maximum cache size (safety limit)
   * Prevents unbounded memory growth
   */
  MAX_ENTRIES: 1000,
} as const;

// ============================================================================
// Payload Validation Configuration
// ============================================================================

/**
 * Size and length limits for realtime payloads
 * Prevents oversized messages and DoS attacks
 */
export const PAYLOAD_CONFIG = {
  /**
   * Maximum payload size in bytes (64KB)
   * Phoenix/Supabase channel limit for broadcast messages
   */
  MAX_PAYLOAD_SIZE: 64 * 1024,

  /**
   * Maximum length for general string fields
   * Reasonable limit for names, titles, etc.
   */
  MAX_STRING_LENGTH: 1000,

  /**
   * Maximum length for message/description fields
   * Allows longer content without being excessive
   */
  MAX_MESSAGE_LENGTH: 2000,

  /**
   * Maximum length for ID fields (UUIDs, identifiers)
   * Standard UUID is 36 chars, this allows ample room
   */
  MAX_ID_LENGTH: 255,

  /**
   * Maximum length for address fields
   * Street addresses can be lengthy
   */
  MAX_ADDRESS_LENGTH: 500,
} as const;

// ============================================================================
// Memory Management Configuration
// ============================================================================

/**
 * Memory limits for admin dashboard tracking
 * Prevents memory leaks from unbounded data growth
 */
export const MEMORY_CONFIG = {
  /**
   * Maximum number of recent location updates to keep in memory
   * Admin dashboard uses this to display recent driver movement
   */
  MAX_RECENT_LOCATIONS: 100,

  /**
   * Threshold for processed locations Set cleanup
   * When size exceeds this, delete oldest entries
   * Reduced from 1000 to 500 for more aggressive cleanup
   */
  PROCESSED_LOCATIONS_THRESHOLD: 500,

  /**
   * Number of entries to remove during cleanup
   * Remove in batches for efficiency
   * Increased from 100 to 250 for larger cleanup batches
   */
  PROCESSED_LOCATIONS_CLEANUP_BATCH: 250,

  /**
   * Time-based cleanup interval (milliseconds)
   * Run cleanup every 15 minutes to remove old entries
   */
  TIME_BASED_CLEANUP_INTERVAL_MS: 15 * 60 * 1000,

  /**
   * Maximum age for location entries (milliseconds)
   * Remove entries older than 1 hour
   */
  LOCATION_ENTRY_MAX_AGE_MS: 60 * 60 * 1000,
} as const;

// ============================================================================
// Feature Flag Configuration
// ============================================================================

/**
 * Feature flag configuration
 */
export const FEATURE_FLAG_CONFIG = {
  /**
   * Minimum percentage value (0%)
   * Below this is invalid
   */
  MIN_PERCENTAGE: 0,

  /**
   * Maximum percentage value (100%)
   * Above this is invalid
   */
  MAX_PERCENTAGE: 100,
} as const;

// ============================================================================
// Location Update Configuration
// ============================================================================

/**
 * Configuration for location tracking intervals
 */
export const LOCATION_TRACKING_CONFIG = {
  /**
   * Default location update interval (milliseconds)
   * How often drivers send location updates
   */
  DEFAULT_UPDATE_INTERVAL_MS: 5000, // 5 seconds

  /**
   * High accuracy update interval (milliseconds)
   * Used when driver is on delivery or high precision needed
   */
  HIGH_ACCURACY_INTERVAL_MS: 2000, // 2 seconds

  /**
   * Low power update interval (milliseconds)
   * Used when driver is idle or battery is low
   */
  LOW_POWER_INTERVAL_MS: 10000, // 10 seconds

  /**
   * Geolocation options timeout (milliseconds)
   * Max time to wait for GPS location
   */
  GEOLOCATION_TIMEOUT_MS: 5000,

  /**
   * Maximum age of cached location (milliseconds)
   * Don't use cached position older than this
   */
  GEOLOCATION_MAX_AGE_MS: 10000,
} as const;

// ============================================================================
// Export all configs
// ============================================================================

/**
 * Combined realtime configuration
 * Use individual configs for better tree-shaking
 */
export const REALTIME_CONFIG = {
  CONNECTION: CONNECTION_CONFIG,
  RATE_LIMIT: RATE_LIMIT_CONFIG,
  CACHE: CACHE_CONFIG,
  PAYLOAD: PAYLOAD_CONFIG,
  MEMORY: MEMORY_CONFIG,
  FEATURE_FLAG: FEATURE_FLAG_CONFIG,
  LOCATION_TRACKING: LOCATION_TRACKING_CONFIG,
} as const;
