// src/config/file-config.ts

/**
 * File upload and storage configuration
 */

/**
 * Signed URL expiration times (in seconds)
 *
 * IMPORTANT: Shorter expiration is more secure as URLs can't be used indefinitely.
 * Since we regenerate signed URLs on fetch, users are not affected by shorter durations.
 *
 * Recommendations:
 * - SHORT: For temporary access (30 minutes - 1 hour)
 * - MEDIUM: For session-based access (1 hour - 1 day)
 * - LONG: For persistent access with regeneration (1 week - 1 month)
 *
 * Previous value was 1 year (31536000 seconds) which is too long for security best practices.
 */
export const SIGNED_URL_EXPIRATION = {
  /** 30 minutes - for temporary file viewing */
  SHORT: 30 * 60,
  /** 1 hour - for file downloads and viewing */
  MEDIUM: 60 * 60,
  /** 1 day - for persistent access with caching */
  DAY: 24 * 60 * 60,
  /** 1 week - for long-term access with regeneration */
  WEEK: 7 * 24 * 60 * 60,
  /** 1 month - maximum recommended duration */
  MONTH: 30 * 24 * 60 * 60,
} as const;

/**
 * Default signed URL expiration for file uploads
 * Using 1 week as a balance between security and user experience
 * Files are regenerated on fetch, so this primarily affects cached URLs
 */
export const DEFAULT_SIGNED_URL_EXPIRATION = SIGNED_URL_EXPIRATION.WEEK;

/**
 * Address usage history configuration
 */
export const ADDRESS_USAGE_CONFIG = {
  /** Multiplier for fetching extra records to account for duplicates */
  FETCH_MULTIPLIER: 3,
  /** Default limit for recent addresses */
  DEFAULT_LIMIT: 5,
} as const;
