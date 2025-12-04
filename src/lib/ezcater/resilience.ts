/**
 * ezCater API Resilience
 *
 * Circuit breaker and retry logic for ezCater GraphQL API.
 * Provides fault tolerance for external API calls with automatic recovery.
 */

import {
  ApiCircuitBreaker,
  withApiRetry,
  type ApiResilienceConfig,
} from '@/utils/api-resilience';

/**
 * ezCater-specific resilience configuration.
 *
 * Configuration Rationale:
 * - **Timeout (20s)**: GraphQL can be slightly slower than REST
 * - **Max Retries (3)**: Standard retry count with exponential backoff
 * - **Circuit Breaker Threshold (5)**: Opens after 5 consecutive failures
 * - **Circuit Breaker Timeout (60s)**: Time before half-open attempt
 */
export const EZCATER_RESILIENCE_CONFIG: Partial<ApiResilienceConfig> = {
  timeout: 20000, // 20s - GraphQL can be slower
  maxRetries: 3,
  baseDelay: 1000, // 1s, 2s, 4s pattern
  maxDelay: 10000, // Cap at 10 seconds
  circuitBreakerThreshold: 5,
  circuitBreakerTimeout: 60000, // 1 minute
};

/**
 * Circuit breaker instance for ezCater API.
 *
 * Note: This is an in-memory circuit breaker. In serverless deployments,
 * each instance maintains separate state. See ApiCircuitBreaker docs for details.
 */
export const ezCaterCircuitBreaker = new ApiCircuitBreaker(
  'ezCater',
  EZCATER_RESILIENCE_CONFIG
);

/**
 * Execute operation with ezCater resilience (retry + circuit breaker).
 *
 * Wraps any async operation with:
 * - Automatic retries with exponential backoff
 * - Circuit breaker protection
 * - Timeout handling
 *
 * @example
 * ```typescript
 * const result = await withEzCaterResilience(async () => {
 *   return await client.request(query, variables);
 * });
 * ```
 */
export async function withEzCaterResilience<T>(
  operation: () => Promise<T>,
  config?: Partial<ApiResilienceConfig>
): Promise<T> {
  const fullConfig = {
    ...EZCATER_RESILIENCE_CONFIG,
    ...config,
  };

  return withApiRetry('ezCater', ezCaterCircuitBreaker, operation, fullConfig);
}

/**
 * Get circuit breaker monitoring data for health checks.
 *
 * Returns current state, metrics, and health status for monitoring dashboards.
 *
 * @example
 * ```typescript
 * const status = getEzCaterCircuitBreakerStatus();
 * if (status.health.status === 'critical') {
 *   // Alert: ezCater API is unavailable
 * }
 * ```
 */
export function getEzCaterCircuitBreakerStatus() {
  return ezCaterCircuitBreaker.getMonitoringData();
}

/**
 * Reset the ezCater circuit breaker.
 * Primarily for testing purposes.
 */
export function resetEzCaterCircuitBreaker() {
  ezCaterCircuitBreaker.reset();
}
