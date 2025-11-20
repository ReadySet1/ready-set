/**
 * Feature Flags
 *
 * Centralized feature flag management for gradual rollout and A/B testing.
 * Allows enabling/disabling features for specific users or percentages.
 */

import { FEATURE_FLAG_CONFIG } from '@/constants/realtime-config';
import { realtimeLogger } from '@/lib/logging/realtime-logger';

// ============================================================================
// Feature Flag Definitions
// ============================================================================

export const FEATURE_FLAGS = {
  // Realtime features
  USE_REALTIME_TRACKING: 'use_realtime_tracking',
  USE_REALTIME_LOCATION_UPDATES: 'use_realtime_location_updates',
  USE_REALTIME_ADMIN_DASHBOARD: 'use_realtime_admin_dashboard',
  USE_REALTIME_DRIVER_MESSAGING: 'use_realtime_driver_messaging',

  // Fallback behavior
  REALTIME_FALLBACK_TO_SSE: 'realtime_fallback_to_sse',
  REALTIME_FALLBACK_TO_REST: 'realtime_fallback_to_rest',
} as const;

export type FeatureFlagKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

// ============================================================================
// Feature Flag Configuration
// ============================================================================

interface FeatureFlagConfig {
  enabled: boolean;
  rolloutPercentage?: number; // 0-100
  enabledForUsers?: string[]; // User IDs
  enabledForRoles?: string[]; // User roles
  disabledForUsers?: string[]; // User IDs to explicitly disable
}

/**
 * Default feature flag configuration
 *
 * PRODUCTION SAFETY: All Realtime features default to DISABLED.
 * Enable them explicitly via environment variables (e.g., NEXT_PUBLIC_FF_USE_REALTIME_LOCATION_UPDATES=true)
 * This prevents accidental WebSocket usage in production and ensures gradual rollout control.
 */
const DEFAULT_FLAGS: Record<FeatureFlagKey, FeatureFlagConfig> = {
  [FEATURE_FLAGS.USE_REALTIME_TRACKING]: {
    enabled: false, // Disabled by default - enable via environment variable
    rolloutPercentage: 0,
  },
  [FEATURE_FLAGS.USE_REALTIME_LOCATION_UPDATES]: {
    enabled: false, // PRODUCTION SAFETY: Disabled by default - enable via NEXT_PUBLIC_FF_USE_REALTIME_LOCATION_UPDATES=true
    rolloutPercentage: 0,
  },
  [FEATURE_FLAGS.USE_REALTIME_ADMIN_DASHBOARD]: {
    enabled: false, // PRODUCTION SAFETY: Disabled by default - enable via NEXT_PUBLIC_FF_USE_REALTIME_ADMIN_DASHBOARD=true
    rolloutPercentage: 0,
  },
  [FEATURE_FLAGS.USE_REALTIME_DRIVER_MESSAGING]: {
    enabled: false,
    rolloutPercentage: 0,
  },
  [FEATURE_FLAGS.REALTIME_FALLBACK_TO_SSE]: {
    enabled: true, // Always allow fallback to SSE
  },
  [FEATURE_FLAGS.REALTIME_FALLBACK_TO_REST]: {
    enabled: true, // Always allow fallback to REST
  },
};

// ============================================================================
// Environment Variable Mapping
// ============================================================================

/**
 * Static mapping from feature flag keys to environment variables.
 *
 * IMPORTANT: Next.js only inlines environment variables on the client when they
 * are referenced via literal property access (process.env.NEXT_PUBLIC_...).
 *
 * Using dynamic access (process.env[envKey]) works on the server, but returns
 * undefined in the browser bundle. This mapping ensures that client-side code
 * receives the correct values while still allowing us to iterate over flags.
 */
const FEATURE_FLAG_ENV_MAP: Record<FeatureFlagKey, string | undefined> = {
  [FEATURE_FLAGS.USE_REALTIME_TRACKING]: process.env.NEXT_PUBLIC_FF_USE_REALTIME_TRACKING,
  [FEATURE_FLAGS.USE_REALTIME_LOCATION_UPDATES]:
    process.env.NEXT_PUBLIC_FF_USE_REALTIME_LOCATION_UPDATES,
  [FEATURE_FLAGS.USE_REALTIME_ADMIN_DASHBOARD]:
    process.env.NEXT_PUBLIC_FF_USE_REALTIME_ADMIN_DASHBOARD,
  [FEATURE_FLAGS.USE_REALTIME_DRIVER_MESSAGING]:
    process.env.NEXT_PUBLIC_FF_USE_REALTIME_DRIVER_MESSAGING,
  [FEATURE_FLAGS.REALTIME_FALLBACK_TO_SSE]:
    process.env.NEXT_PUBLIC_FF_REALTIME_FALLBACK_TO_SSE,
  [FEATURE_FLAGS.REALTIME_FALLBACK_TO_REST]:
    process.env.NEXT_PUBLIC_FF_REALTIME_FALLBACK_TO_REST,
};

// ============================================================================
// Feature Flag Storage
// ============================================================================

/**
 * In-memory feature flag storage
 * In production, this would be backed by a database or configuration service
 */
class FeatureFlagStore {
  private flags: Map<FeatureFlagKey, FeatureFlagConfig> = new Map();

  constructor() {
    // Initialize with default flags
    Object.entries(DEFAULT_FLAGS).forEach(([key, config]) => {
      this.flags.set(key as FeatureFlagKey, config);
    });

    // Load overrides from environment variables
    this.loadEnvironmentOverrides();
  }

  /**
   * Load feature flag overrides from environment variables
   * Wrapped in try-catch to prevent app crashes from malformed env vars
   */
  private loadEnvironmentOverrides(): void {
    // NEXT_PUBLIC_FF_USE_REALTIME_TRACKING=true
    // NEXT_PUBLIC_FF_USE_REALTIME_LOCATION_UPDATES=50 (rollout percentage)

    try {
      Object.values(FEATURE_FLAGS).forEach((flagKey) => {
        try {
          // Use static env mapping for client compatibility; envKey is only for logging
          const envKey = `NEXT_PUBLIC_FF_${flagKey.toUpperCase()}`;
          const envValue = FEATURE_FLAG_ENV_MAP[flagKey];

          if (envValue === undefined) {
            return; // No override for this flag
          }

          const currentConfig = this.flags.get(flagKey) || { enabled: false };

          // If value is "true" or "false", set enabled
          if (envValue === 'true' || envValue === 'false') {
            this.flags.set(flagKey, {
              ...currentConfig,
              enabled: envValue === 'true',
            });
            return;
          }

          // If value is a number, set rollout percentage
          const percentage = this.parsePercentage(envValue);
          if (percentage !== null) {
            this.flags.set(flagKey, {
              ...currentConfig,
              enabled: percentage > 0,
              rolloutPercentage: percentage,
            });
          } else {
            // Invalid value - log warning and use default
            realtimeLogger.warn(`Invalid feature flag value for ${envKey}: "${envValue}"`, {
              metadata: {
                envKey,
                envValue,
                expectedFormat: 'true|false|0-100',
              }
            });
          }
        } catch (error) {
          // Log error for this specific flag but continue processing others
          realtimeLogger.error(`Failed to load feature flag override: ${flagKey}`, {
            error,
            metadata: { flagKey }
          });
        }
      });
    } catch (error) {
      // Catch-all for unexpected errors
      realtimeLogger.error('Failed to load feature flag environment overrides', {
        error,
        metadata: { message: 'Using default flag values' }
      });
      // Continue with defaults - don't crash the app
    }
  }

  /**
   * Parse and validate percentage value from env var
   * Returns null if invalid
   */
  private parsePercentage(value: string): number | null {
    const percentage = parseInt(value, 10);

    if (isNaN(percentage)) {
      return null; // Not a number
    }

    if (percentage < FEATURE_FLAG_CONFIG.MIN_PERCENTAGE || percentage > FEATURE_FLAG_CONFIG.MAX_PERCENTAGE) {
      return null; // Out of valid range (0-100)
    }

    return percentage;
  }

  /**
   * Get feature flag configuration
   */
  getFlag(key: FeatureFlagKey): FeatureFlagConfig {
    return this.flags.get(key) || { enabled: false };
  }

  /**
   * Set feature flag configuration
   */
  setFlag(key: FeatureFlagKey, config: Partial<FeatureFlagConfig>): void {
    const currentConfig = this.getFlag(key);
    this.flags.set(key, { ...currentConfig, ...config });
  }

  /**
   * Enable a feature flag
   */
  enable(key: FeatureFlagKey): void {
    this.setFlag(key, { enabled: true });
  }

  /**
   * Disable a feature flag
   */
  disable(key: FeatureFlagKey): void {
    this.setFlag(key, { enabled: false });
  }

  /**
   * Set rollout percentage for a feature flag
   */
  setRolloutPercentage(key: FeatureFlagKey, percentage: number): void {
    if (percentage < 0 || percentage > 100) {
      throw new Error('Rollout percentage must be between 0 and 100');
    }
    this.setFlag(key, { enabled: percentage > 0, rolloutPercentage: percentage });
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

const featureFlagStore = new FeatureFlagStore();

// ============================================================================
// Feature Flag Evaluation
// ============================================================================

/**
 * Context for feature flag evaluation
 */
export interface FeatureFlagContext {
  userId?: string;
  userRole?: string;
  userEmail?: string;
}

/**
 * Hash function for consistent user bucketing
 */
/**
 * Hash function for consistent user bucketing using MurmurHash3-inspired algorithm
 * Provides better distribution than simple string hash for percentage-based feature rollouts
 *
 * SECURITY FIX: Previous implementation had a no-op bug (hash & hash always equals hash)
 * This implementation uses proper bit mixing for avalanche effect
 */
function hashUserId(userId: string, flagKey: string): number {
  const input = `${userId}:${flagKey}`;
  let hash = 0;

  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    // MurmurHash3-inspired mixing with proper avalanche effect
    hash = Math.imul(hash ^ char, 0x5bd1e995);
    hash ^= hash >>> 15;
  }

  // Final mix for better distribution
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc6a4a793);
  hash ^= hash >>> 16;

  // Use unsigned 32-bit to avoid negative numbers, then modulo 100
  return (hash >>> 0) % 100;
}

/**
 * Check if a feature flag is enabled for a given context
 */
export function isFeatureEnabled(
  flagKey: FeatureFlagKey,
  context?: FeatureFlagContext,
): boolean {
  const config = featureFlagStore.getFlag(flagKey);

  // If flag is explicitly disabled, return false
  if (!config.enabled) {
    return false;
  }

  // If no context provided, return the enabled status
  if (!context?.userId) {
    return config.enabled;
  }

  // Check if user is explicitly disabled
  if (config.disabledForUsers?.includes(context.userId)) {
    return false;
  }

  // Check if user is explicitly enabled
  if (config.enabledForUsers?.includes(context.userId)) {
    return true;
  }

  // Check if user role is enabled
  if (context.userRole && config.enabledForRoles?.includes(context.userRole)) {
    return true;
  }

  // Check rollout percentage using consistent hashing
  if (config.rolloutPercentage !== undefined) {
    const bucket = hashUserId(context.userId, flagKey);
    return bucket < config.rolloutPercentage;
  }

  return config.enabled;
}

/**
 * Get all enabled feature flags for a context
 */
export function getEnabledFeatures(context?: FeatureFlagContext): FeatureFlagKey[] {
  return Object.values(FEATURE_FLAGS).filter((flagKey) =>
    isFeatureEnabled(flagKey, context),
  );
}

// ============================================================================
// Feature Flag Management (Admin)
// ============================================================================

/**
 * Enable a feature flag globally
 */
/**
 * SECURITY: Feature flag management functions removed from public exports.
 * These functions allowed unauthorized modification of feature flags at runtime.
 *
 * For admin feature flag management, use the authenticated server actions in:
 * @see src/app/actions/admin/feature-flags-admin.ts
 *
 * Internal helper functions below are no longer exported to prevent misuse.
 */

/**
 * @internal - Do not export. Use server actions for admin operations.
 */
function enableFeature(flagKey: FeatureFlagKey): void {
  featureFlagStore.enable(flagKey);
}

/**
 * @internal - Do not export. Use server actions for admin operations.
 */
function disableFeature(flagKey: FeatureFlagKey): void {
  featureFlagStore.disable(flagKey);
}

/**
 * @internal - Do not export. Use server actions for admin operations.
 */
function setFeatureRollout(flagKey: FeatureFlagKey, percentage: number): void {
  featureFlagStore.setRolloutPercentage(flagKey, percentage);
}

/**
 * @internal - Do not export. Use server actions for admin operations.
 */
function enableFeatureForUsers(
  flagKey: FeatureFlagKey,
  userIds: string[],
): void {
  const config = featureFlagStore.getFlag(flagKey);
  featureFlagStore.setFlag(flagKey, {
    ...config,
    enabledForUsers: [...(config.enabledForUsers || []), ...userIds],
  });
}

/**
 * @internal - Do not export. Use server actions for admin operations.
 */
function disableFeatureForUsers(
  flagKey: FeatureFlagKey,
  userIds: string[],
): void {
  const config = featureFlagStore.getFlag(flagKey);
  featureFlagStore.setFlag(flagKey, {
    ...config,
    disabledForUsers: [...(config.disabledForUsers || []), ...userIds],
  });
}

/**
 * @internal - Do not export. Use server actions for admin operations.
 */
function enableFeatureForRoles(
  flagKey: FeatureFlagKey,
  roles: string[],
): void {
  const config = featureFlagStore.getFlag(flagKey);
  featureFlagStore.setFlag(flagKey, {
    ...config,
    enabledForRoles: [...(config.enabledForRoles || []), ...roles],
  });
}

/**
 * Get feature flag configuration (for admin UI)
 */
export function getFeatureConfig(flagKey: FeatureFlagKey): FeatureFlagConfig {
  return featureFlagStore.getFlag(flagKey);
}

/**
 * Get all feature flag configurations (for admin UI)
 */
export function getAllFeatureConfigs(): Record<FeatureFlagKey, FeatureFlagConfig> {
  const configs: Partial<Record<FeatureFlagKey, FeatureFlagConfig>> = {};
  Object.values(FEATURE_FLAGS).forEach((flagKey) => {
    configs[flagKey] = featureFlagStore.getFlag(flagKey);
  });
  return configs as Record<FeatureFlagKey, FeatureFlagConfig>;
}
