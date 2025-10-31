/**
 * Generic API Resilience Utilities
 *
 * Provides retry logic, circuit breaker pattern, and timeout handling
 * for any external API integration (CaterValley, Google Maps, etc.)
 *
 * Part of REA-77: External API Resilience Implementation
 */

import { apiResilienceLogger } from './logger';
import { createAlert, AlertType, AlertSeverity } from '@/lib/alerting';

// ============================================================================
// Configuration Types
// ============================================================================

export interface ApiResilienceConfig {
  timeout: number; // Timeout in milliseconds (default: 15000)
  maxRetries: number; // Maximum retry attempts (default: 3)
  baseDelay: number; // Base delay for exponential backoff in ms (default: 1000)
  maxDelay: number; // Maximum delay cap in ms (default: 10000)
  enableCircuitBreaker: boolean; // Enable circuit breaker (default: true)
  circuitBreakerThreshold: number; // Failures before opening (default: 5)
  circuitBreakerTimeout: number; // Time before half-open in ms (default: 60000)
  inactivityResetTimeout: number; // Time before auto-reset on inactivity in ms (default: 300000 - 5 minutes)
  retryableStatusCodes: number[]; // HTTP status codes that should trigger retry
  retryableErrors: string[]; // Error messages/codes that should trigger retry
}

export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  successCount: number;
  lastFailureTime?: number;
  lastAttemptTime?: number;
}

/**
 * Comprehensive monitoring data for circuit breaker observability.
 * Part of REA-92: Add Circuit Breaker Monitoring and Alerts
 */
export interface CircuitBreakerMonitoringData {
  name: string;
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  successCount: number;
  lastFailureTime?: string;
  lastAttemptTime?: string;
  nextHalfOpenTime?: string;
  config: {
    threshold: number;
    timeout: number;
    inactivityResetTimeout: number;
  };
  metrics: {
    totalRequests: number;
    totalFailures: number;
    totalSuccesses: number;
    openTransitions: number;
    halfOpenTransitions: number;
    closeTransitions: number;
    autoResetCount: number;
    failureRate: number;
  };
  health: {
    status: 'healthy' | 'degraded' | 'critical';
    message: string;
  };
}

// ============================================================================
// Custom Error Classes
// ============================================================================

/**
 * Error thrown when circuit breaker is open and blocking requests.
 * Includes retry-after information for better client experience.
 *
 * Part of REA-93: Improve Circuit Breaker Error Messages
 */
export class CircuitBreakerOpenError extends Error {
  public readonly statusCode = 503;

  constructor(
    public readonly apiName: string,
    public readonly retryAfter: Date,
    public readonly state: CircuitBreakerState,
    public readonly estimatedWaitMs: number
  ) {
    const waitSeconds = Math.ceil(estimatedWaitMs / 1000);
    super(
      `${apiName} circuit breaker is OPEN. ` +
      `Service temporarily unavailable. ` +
      `Retry after ${retryAfter.toISOString()} ` +
      `(approximately ${waitSeconds} seconds)`
    );
    this.name = 'CircuitBreakerOpenError';

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CircuitBreakerOpenError);
    }
  }

  /**
   * Convert error to JSON for API responses
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      apiName: this.apiName,
      retryAfter: this.retryAfter.toISOString(),
      retryAfterSeconds: Math.ceil(this.estimatedWaitMs / 1000),
      estimatedWaitMs: this.estimatedWaitMs,
      circuitBreakerState: {
        state: this.state.state,
        failureCount: this.state.failureCount,
      },
    };
  }
}

// ============================================================================
// Error Classification Constants
// ============================================================================

/**
 * HTTP status codes that indicate transient failures and should be retried.
 * These errors are typically temporary and may succeed on subsequent attempts.
 */
export const RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504] as const;

/**
 * HTTP status codes that indicate permanent failures and should NOT be retried.
 * These errors require user intervention or code changes to resolve.
 */
export const NON_RETRYABLE_STATUS_CODES = [400, 401, 403, 404] as const;

/**
 * Network error codes/messages that indicate transient failures and should be retried.
 * These are typically connection-level issues that may resolve on retry.
 */
export const RETRYABLE_NETWORK_ERRORS = ['ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND'] as const;

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default configuration for generic API resilience (CaterValley, Google Maps, etc.).
 *
 * Configuration Rationale:
 * - **Timeout (15s)**: Shorter than email APIs due to:
 *   - Simpler request/response payloads
 *   - APIs designed for lower latency
 *   - Faster to fail and retry if unresponsive
 *
 * - **Circuit Breaker Threshold (5)**: More lenient than email because:
 *   - External APIs may have occasional transient issues
 *   - We want to allow more attempts before failing fast
 *   - Less critical than user-facing email notifications
 *
 * - **Max Retries (3)**: Standard retry count with exponential backoff (1s, 2s, 4s)
 *
 * @see {@link isRetryableApiError} for error classification logic
 * @see {@link DEFAULT_EMAIL_RESILIENCE_CONFIG} for comparison with email configuration
 */
export const DEFAULT_API_RESILIENCE_CONFIG: ApiResilienceConfig = {
  timeout: 15000, // 15 seconds - faster timeout for APIs
  maxRetries: 3,
  baseDelay: 1000, // 1s, 2s, 4s pattern
  maxDelay: 10000, // Cap at 10 seconds
  enableCircuitBreaker: true,
  circuitBreakerThreshold: 5, // More lenient for external APIs
  circuitBreakerTimeout: 60000, // 60 seconds
  inactivityResetTimeout: 300000, // 5 minutes - auto-reset circuit breaker after extended inactivity
  retryableStatusCodes: [...RETRYABLE_STATUS_CODES],
  retryableErrors: [...RETRYABLE_NETWORK_ERRORS],
};

// ============================================================================
// Circuit Breaker Implementation
// ============================================================================

/**
 * Circuit Breaker Implementation
 *
 * ⚠️ SERVERLESS/MULTI-INSTANCE WARNING:
 *
 * This implementation uses in-memory state and is NOT distributed across instances.
 *
 * In serverless or multi-instance deployments (Vercel, AWS Lambda, etc.):
 * - Each instance maintains separate, independent circuit breaker state
 * - State does NOT synchronize between instances
 * - State resets on cold starts
 * - Circuit may open on one instance but remain closed on others
 * - Metrics are per-instance, not system-wide
 *
 * This means:
 * - The same API might be available on Instance A but blocked on Instance B
 * - Total failure counts are distributed across instances
 * - Circuit breakers may open at different times on different instances
 * - Recovery (half-open → closed) happens independently per instance
 *
 * For distributed circuit breaking with shared state across instances,
 * consider using:
 * - Redis (with Redis-based circuit breaker library)
 * - DynamoDB or other distributed state stores
 * - External circuit breaker services (e.g., Resilience4j with distributed state)
 *
 * However, this per-instance approach has benefits:
 * - No external dependencies or additional infrastructure
 * - Zero latency for state checks
 * - Natural load distribution (different instances may have different thresholds)
 * - Automatic recovery on instance restart
 *
 * Part of REA-92, REA-93, REA-94: Circuit Breaker Improvements
 */
export class ApiCircuitBreaker {
  private state: CircuitBreakerState = {
    state: 'closed',
    failureCount: 0,
    successCount: 0,
  };

  private config: ApiResilienceConfig;
  private name: string;

  /**
   * Metrics for monitoring and observability.
   * Part of REA-92: Add Circuit Breaker Monitoring and Alerts
   */
  private metrics = {
    totalRequests: 0,
    totalFailures: 0,
    totalSuccesses: 0,
    openTransitions: 0,
    halfOpenTransitions: 0,
    closeTransitions: 0,
    autoResetCount: 0, // Track automatic resets due to inactivity
  };

  constructor(name: string, config: Partial<ApiResilienceConfig> = {}) {
    this.name = name;
    this.config = { ...DEFAULT_API_RESILIENCE_CONFIG, ...config };
  }

  /**
   * Check if circuit breaker is open (blocking requests)
   *
   * ⚠️ WARNING: This method has side effects!
   * - Checks for inactivity reset (may reset state)
   * - May transition from open to half-open if timeout expired
   *
   * These side effects are intentional for automatic recovery,
   * but callers should be aware that the circuit breaker state
   * may change as a result of calling this method.
   *
   * @returns true if circuit is open (requests blocked), false otherwise
   */
  isOpen(): boolean {
    if (!this.config.enableCircuitBreaker) {
      return false;
    }

    // Check for inactivity reset before checking state
    // NOTE: This has side effects - may reset the circuit breaker
    this.checkInactivityReset();

    if (this.state.state === 'open') {
      // Check if we should transition to half-open
      // NOTE: This has side effects - may transition state
      if (
        this.state.lastFailureTime &&
        Date.now() - this.state.lastFailureTime >= this.config.circuitBreakerTimeout
      ) {
        this.transitionToHalfOpen();
        return false;
      }
      return true;
    }

    return false;
  }

  /**
   * Check if circuit breaker should auto-reset due to inactivity.
   * Part of REA-92: Add Circuit Breaker Monitoring and Alerts
   *
   * WARNING: Auto-reset could mask ongoing issues. Monitor autoResetCount metric
   * to detect if the circuit breaker is repeatedly auto-resetting, which may
   * indicate persistent upstream problems rather than transient failures.
   */
  private checkInactivityReset(): void {
    if (
      this.state.lastAttemptTime &&
      this.state.state === 'open' &&
      Date.now() - this.state.lastAttemptTime >= this.config.inactivityResetTimeout
    ) {
      this.metrics.autoResetCount++;

      apiResilienceLogger.warn(
        `[${this.name} Circuit Breaker] Auto-resetting due to ${this.config.inactivityResetTimeout}ms inactivity ` +
        `(autoResetCount: ${this.metrics.autoResetCount})`,
        {
          inactivityPeriodMs: Date.now() - this.state.lastAttemptTime,
          autoResetCount: this.metrics.autoResetCount,
          previousFailureCount: this.state.failureCount,
        }
      );

      this.reset();
    }
  }

  /**
   * Record a successful request
   */
  recordSuccess(): void {
    if (!this.config.enableCircuitBreaker) {
      return;
    }

    // Track metrics
    this.metrics.totalRequests++;
    this.metrics.totalSuccesses++;

    this.state.lastAttemptTime = Date.now();

    if (this.state.state === 'half-open') {
      this.state.successCount++;

      // After 1 successful request in half-open, close the circuit
      if (this.state.successCount >= 1) {
        this.transitionToClosed();
      }
    } else if (this.state.state === 'closed') {
      // Reset failure count on success
      this.state.failureCount = 0;
    }
  }

  /**
   * Record a failed request
   *
   * ⚠️ NOTE ON CONCURRENCY:
   * These state updates are NOT atomic. In serverless environments with multiple
   * concurrent requests, there's potential for race conditions where:
   * - Two failures happen simultaneously and both increment the counter
   * - The final count may be inconsistent (e.g., 5 instead of 6)
   *
   * However, this is acceptable because:
   * - Each instance maintains its own state (see class-level documentation)
   * - The circuit breaker is designed to be "eventually correct"
   * - Missing 1-2 failures won't significantly impact the protection mechanism
   * - The threshold provides a buffer (e.g., 5 failures before opening)
   *
   * For applications requiring strict distributed consistency, consider:
   * - Redis with atomic INCR operations
   * - Distributed state management with optimistic locking
   */
  recordFailure(): void {
    if (!this.config.enableCircuitBreaker) {
      return;
    }

    // Track metrics (non-atomic operations)
    this.metrics.totalRequests++;
    this.metrics.totalFailures++;

    this.state.failureCount++;
    this.state.lastFailureTime = Date.now();
    this.state.lastAttemptTime = Date.now();

    // Open circuit if threshold reached
    if (
      this.state.state === 'closed' &&
      this.state.failureCount >= this.config.circuitBreakerThreshold
    ) {
      this.transitionToOpen();
    } else if (this.state.state === 'half-open') {
      // If failure in half-open, go back to open
      this.transitionToOpen();
    }
  }

  /**
   * Get current circuit breaker state
   */
  getState(): CircuitBreakerState {
    return { ...this.state };
  }

  /**
   * Get comprehensive monitoring data for observability.
   * Part of REA-92: Add Circuit Breaker Monitoring and Alerts
   */
  getMonitoringData(): CircuitBreakerMonitoringData {
    const failureRate = this.metrics.totalRequests > 0
      ? (this.metrics.totalFailures / this.metrics.totalRequests) * 100
      : 0;

    // Determine health status
    let healthStatus: 'healthy' | 'degraded' | 'critical';
    let healthMessage: string;

    if (this.state.state === 'open') {
      healthStatus = 'critical';
      healthMessage = `Circuit breaker is OPEN. Service unavailable until ${
        this.state.lastFailureTime
          ? new Date(this.state.lastFailureTime + this.config.circuitBreakerTimeout).toISOString()
          : 'unknown'
      }`;
    } else if (this.state.state === 'half-open') {
      healthStatus = 'degraded';
      healthMessage = 'Circuit breaker is HALF-OPEN. Testing service recovery.';
    } else if (this.metrics.autoResetCount >= 3) {
      // WARNING: Repeated auto-resets may indicate persistent upstream issues
      healthStatus = 'degraded';
      healthMessage = `Circuit breaker has auto-reset ${this.metrics.autoResetCount} times due to inactivity. ` +
        'This may indicate persistent upstream issues rather than transient failures.';
    } else if (failureRate > 50) {
      healthStatus = 'degraded';
      healthMessage = `High failure rate: ${failureRate.toFixed(1)}%`;
    } else if (this.metrics.autoResetCount > 0) {
      healthStatus = 'healthy';
      healthMessage = `Circuit breaker is operating normally (${this.metrics.autoResetCount} auto-reset${this.metrics.autoResetCount > 1 ? 's' : ''}).`;
    } else {
      healthStatus = 'healthy';
      healthMessage = 'Circuit breaker is operating normally.';
    }

    return {
      name: this.name,
      state: this.state.state,
      failureCount: this.state.failureCount,
      successCount: this.state.successCount,
      lastFailureTime: this.state.lastFailureTime
        ? new Date(this.state.lastFailureTime).toISOString()
        : undefined,
      lastAttemptTime: this.state.lastAttemptTime
        ? new Date(this.state.lastAttemptTime).toISOString()
        : undefined,
      nextHalfOpenTime:
        this.state.state === 'open' && this.state.lastFailureTime
          ? new Date(this.state.lastFailureTime + this.config.circuitBreakerTimeout).toISOString()
          : undefined,
      config: {
        threshold: this.config.circuitBreakerThreshold,
        timeout: this.config.circuitBreakerTimeout,
        inactivityResetTimeout: this.config.inactivityResetTimeout,
      },
      metrics: {
        ...this.metrics,
        failureRate,
      },
      health: {
        status: healthStatus,
        message: healthMessage,
      },
    };
  }

  /**
   * Reset circuit breaker (for testing or manual intervention)
   */
  reset(): void {
    this.state = {
      state: 'closed',
      failureCount: 0,
      successCount: 0,
    };
  }

  private transitionToOpen(): void {
    this.metrics.openTransitions++;

    const estimatedRecoveryTime = new Date(Date.now() + this.config.circuitBreakerTimeout);

    apiResilienceLogger.warn(`[${this.name} Circuit Breaker] Opening circuit after threshold failures`, {
      failureCount: this.state.failureCount,
      threshold: this.config.circuitBreakerThreshold,
    });

    // Create alert for circuit breaker opening (REA-92)
    createAlert(
      AlertType.SERVICE_DOWN,
      AlertSeverity.CRITICAL,
      `${this.name} Circuit Breaker Opened`,
      `Circuit breaker opened after ${this.state.failureCount} consecutive failures (threshold: ${this.config.circuitBreakerThreshold}). Service will attempt recovery at ${estimatedRecoveryTime.toISOString()}.`,
      'circuit-breaker',
      {
        api: this.name,
        failureCount: this.state.failureCount,
        threshold: this.config.circuitBreakerThreshold,
        estimatedRecoveryTime: estimatedRecoveryTime.toISOString(),
        circuitBreakerTimeout: this.config.circuitBreakerTimeout,
      }
    );

    this.state.state = 'open';
    this.state.lastFailureTime = Date.now();
  }

  private transitionToHalfOpen(): void {
    this.metrics.halfOpenTransitions++;

    apiResilienceLogger.info(`[${this.name} Circuit Breaker] Transitioning to half-open state`);

    this.state.state = 'half-open';
    this.state.successCount = 0;
  }

  private transitionToClosed(): void {
    this.metrics.closeTransitions++;

    apiResilienceLogger.info(`[${this.name} Circuit Breaker] Closing circuit after recovery`);

    this.state.state = 'closed';
    this.state.failureCount = 0;
    this.state.successCount = 0;
  }
}

// Global circuit breaker instances
export const caterValleyCircuitBreaker = new ApiCircuitBreaker('CaterValley');

// ============================================================================
// Error Classification
// ============================================================================

/**
 * Determine if an error should be retried
 */
export function isRetryableApiError(error: any, config: ApiResilienceConfig): boolean {
  // Check for retryable HTTP status codes
  const statusCode = error?.statusCode || error?.status;
  if (statusCode && config.retryableStatusCodes.includes(statusCode)) {
    return true;
  }

  // Check for network errors
  if (error instanceof Error) {
    const message = error.message.toUpperCase();
    return config.retryableErrors.some((errType) => message.includes(errType.toUpperCase()));
  }

  // Check for fetch abort errors
  if (error?.name === 'AbortError') {
    return true;
  }

  // Default: don't retry unknown errors
  return false;
}

/**
 * Extract Retry-After delay from rate limit error
 */
export function getRetryAfterDelay(error: any): number | null {
  // Check for Retry-After header (in seconds)
  const retryAfter =
    error?.headers?.['Retry-After'] ||
    error?.headers?.['retry-after'] ||
    error?.response?.headers?.['Retry-After'] ||
    error?.response?.headers?.['retry-after'];

  if (retryAfter) {
    const retryAfterSeconds = parseInt(retryAfter, 10);
    if (!isNaN(retryAfterSeconds)) {
      return retryAfterSeconds * 1000; // Convert to milliseconds
    }
  }

  return null;
}

// ============================================================================
// Retry Logic with Exponential Backoff
// ============================================================================

/**
 * Calculate delay for exponential backoff with jitter
 */
export function calculateBackoffDelay(
  attempt: number,
  config: ApiResilienceConfig
): number {
  // Exponential: baseDelay * 2^(attempt - 1)
  // Example: 1s, 2s, 4s, 8s, 16s...
  const exponentialDelay = config.baseDelay * Math.pow(2, attempt - 1);

  // Cap at maxDelay
  const cappedDelay = Math.min(exponentialDelay, config.maxDelay);

  // Add jitter (±30% randomization to prevent thundering herd)
  const jitterRange = cappedDelay * 0.3;
  const jitter = Math.random() * jitterRange * 2 - jitterRange;
  const finalDelay = Math.max(0, cappedDelay + jitter);

  return Math.floor(finalDelay);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry an operation with exponential backoff for a specific API
 */
export async function withApiRetry<T>(
  apiName: string,
  circuitBreaker: ApiCircuitBreaker,
  operation: () => Promise<T>,
  config: Partial<ApiResilienceConfig> = {}
): Promise<T> {
  const fullConfig: ApiResilienceConfig = {
    ...DEFAULT_API_RESILIENCE_CONFIG,
    ...config,
  };

  // CRITICAL: Check circuit breaker BEFORE retry loop for fast-fail
  // If circuit is already open, fail immediately without attempting any retries
  if (circuitBreaker.isOpen()) {
    const state = circuitBreaker.getState();
    const waitTime = state.lastFailureTime
      ? (state.lastFailureTime + fullConfig.circuitBreakerTimeout) - Date.now()
      : fullConfig.circuitBreakerTimeout;

    const retryAfter = new Date(Date.now() + Math.max(0, waitTime));

    apiResilienceLogger.warn(`[${apiName} Resilience] Circuit breaker is OPEN - failing fast without retry`, {
      circuitState: state.state,
      failureCount: state.failureCount,
      retryAfter: retryAfter.toISOString(),
    });

    throw new CircuitBreakerOpenError(
      apiName,
      retryAfter,
      state,
      Math.max(0, waitTime)
    );
  }

  let lastError: any;

  for (let attempt = 1; attempt <= fullConfig.maxRetries; attempt++) {
    try {
      // SECONDARY CHECK: Circuit may have opened during retry loop (concurrent failures)
      // This catches circuits that open after we've started retrying
      if (circuitBreaker.isOpen()) {
        const state = circuitBreaker.getState();
        const waitTime = state.lastFailureTime
          ? (state.lastFailureTime + fullConfig.circuitBreakerTimeout) - Date.now()
          : fullConfig.circuitBreakerTimeout;

        const retryAfter = new Date(Date.now() + Math.max(0, waitTime));

        throw new CircuitBreakerOpenError(
          apiName,
          retryAfter,
          state,
          Math.max(0, waitTime)
        );
      }

      // Execute operation with timeout
      const result = await Promise.race<T>([
        operation(),
        new Promise<T>((_, reject) =>
          setTimeout(
            () => reject(new Error(`${apiName} operation timeout after ${fullConfig.timeout}ms`)),
            fullConfig.timeout
          )
        ),
      ]);

      // Success - record with circuit breaker
      circuitBreaker.recordSuccess();

      if (attempt > 1) {
        apiResilienceLogger.info(`[${apiName} Resilience] Operation succeeded after ${attempt} attempts`);
      }

      return result;
    } catch (error: any) {
      lastError = error;

      apiResilienceLogger.warn(`[${apiName} Resilience] Attempt ${attempt}/${fullConfig.maxRetries} failed:`, {
        error: error.message || error,
        statusCode: error.statusCode || error.status,
      });

      // Record failure with circuit breaker
      circuitBreaker.recordFailure();

      // Check if error is retryable
      const isRetryable = isRetryableApiError(error, fullConfig);

      if (!isRetryable) {
        apiResilienceLogger.warn(`[${apiName} Resilience] Non-retryable error detected - aborting retry`);
        throw error;
      }

      // Don't retry if this was the last attempt
      if (attempt >= fullConfig.maxRetries) {
        apiResilienceLogger.error(
          `[${apiName} Resilience] All ${fullConfig.maxRetries} attempts failed - giving up`
        );
        throw error;
      }

      // Check for rate limiting with Retry-After
      const retryAfterDelay = getRetryAfterDelay(error);
      let delay: number;

      if (retryAfterDelay !== null) {
        delay = retryAfterDelay;
        apiResilienceLogger.info(
          `[${apiName} Resilience] Rate limited - respecting Retry-After: ${delay}ms`
        );
      } else {
        delay = calculateBackoffDelay(attempt, fullConfig);
        apiResilienceLogger.info(
          `[${apiName} Resilience] Waiting ${delay}ms before attempt ${attempt + 1}`
        );
      }

      await sleep(delay);
    }
  }

  // Should never reach here, but TypeScript requires it
  throw lastError;
}

// ============================================================================
// Convenience Wrappers for Specific APIs
// ============================================================================

/**
 * Wrap a CaterValley API operation with full resilience
 */
export async function withCaterValleyResilience<T>(
  operation: () => Promise<T>,
  config?: Partial<ApiResilienceConfig>
): Promise<T> {
  try {
    return await withApiRetry('CaterValley', caterValleyCircuitBreaker, operation, config);
  } catch (error: any) {
    // Log final failure
    apiResilienceLogger.error('[CaterValley Resilience] Operation failed after all retries:', {
      error: error.message || error,
      statusCode: error.statusCode || error.status,
      circuitBreakerState: caterValleyCircuitBreaker.getState().state,
    });

    throw error;
  }
}

// ============================================================================
// HTTP Response Helpers
// ============================================================================

/**
 * Create a properly formatted HTTP 503 response for circuit breaker errors.
 * Includes Retry-After header for client guidance.
 *
 * Part of REA-93: Improve Circuit Breaker Error Messages
 *
 * @example
 * ```typescript
 * try {
 *   await withCaterValleyResilience(operation);
 * } catch (error) {
 *   if (error instanceof CircuitBreakerOpenError) {
 *     return circuitBreakerErrorResponse(error);
 *   }
 *   throw error;
 * }
 * ```
 */
export function circuitBreakerErrorResponse(error: CircuitBreakerOpenError): Response {
  const errorJson = error.toJSON();

  return new Response(JSON.stringify(errorJson), {
    status: 503,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': errorJson.retryAfterSeconds.toString(),
      'X-Circuit-Breaker-State': error.state.state,
    },
  });
}
