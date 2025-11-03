/**
 * Feature Flags
 *
 * Centralized feature flag management for gradual rollout and A/B testing.
 * Allows enabling/disabling features for specific users or percentages.
 */

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
 */
const DEFAULT_FLAGS: Record<FeatureFlagKey, FeatureFlagConfig> = {
  [FEATURE_FLAGS.USE_REALTIME_TRACKING]: {
    enabled: false, // Disabled by default - enable via environment variable
    rolloutPercentage: 0,
  },
  [FEATURE_FLAGS.USE_REALTIME_LOCATION_UPDATES]: {
    enabled: false, // Disabled by default - enable via environment variable
    rolloutPercentage: 0,
  },
  [FEATURE_FLAGS.USE_REALTIME_ADMIN_DASHBOARD]: {
    enabled: false, // Disabled by default - enable via environment variable
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
   */
  private loadEnvironmentOverrides(): void {
    // NEXT_PUBLIC_FF_USE_REALTIME_TRACKING=true
    // NEXT_PUBLIC_FF_USE_REALTIME_LOCATION_UPDATES=50 (rollout percentage)

    Object.values(FEATURE_FLAGS).forEach((flagKey) => {
      const envKey = `NEXT_PUBLIC_FF_${flagKey.toUpperCase()}`;
      const envValue = process.env[envKey];

      if (envValue !== undefined) {
        const currentConfig = this.flags.get(flagKey) || { enabled: false };

        // If value is "true" or "false", set enabled
        if (envValue === 'true' || envValue === 'false') {
          this.flags.set(flagKey, {
            ...currentConfig,
            enabled: envValue === 'true',
          });
        }
        // If value is a number, set rollout percentage
        else {
          const percentage = parseInt(envValue, 10);
          if (!isNaN(percentage) && percentage >= 0 && percentage <= 100) {
            this.flags.set(flagKey, {
              ...currentConfig,
              enabled: percentage > 0,
              rolloutPercentage: percentage,
            });
          }
        }
      }
    });
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
function hashUserId(userId: string, flagKey: string): number {
  let hash = 0;
  const input = `${userId}:${flagKey}`;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash) % 100;
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
export function enableFeature(flagKey: FeatureFlagKey): void {
  featureFlagStore.enable(flagKey);
}

/**
 * Disable a feature flag globally
 */
export function disableFeature(flagKey: FeatureFlagKey): void {
  featureFlagStore.disable(flagKey);
}

/**
 * Set rollout percentage for gradual rollout
 */
export function setFeatureRollout(flagKey: FeatureFlagKey, percentage: number): void {
  featureFlagStore.setRolloutPercentage(flagKey, percentage);
}

/**
 * Enable feature for specific users
 */
export function enableFeatureForUsers(
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
 * Disable feature for specific users
 */
export function disableFeatureForUsers(
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
 * Enable feature for specific roles
 */
export function enableFeatureForRoles(
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
