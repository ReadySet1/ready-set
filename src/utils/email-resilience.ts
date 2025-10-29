/**
 * Email API Resilience Utilities
 *
 * Provides retry logic, circuit breaker pattern, and timeout handling
 * specifically for email API calls (Resend).
 *
 * Part of REA-77: External API Resilience Implementation
 */

import { emailResilienceLogger } from './logger';

// ============================================================================
// Configuration Types
// ============================================================================

export interface EmailResilienceConfig {
  timeout: number; // Timeout in milliseconds (default: 30000)
  maxRetries: number; // Maximum retry attempts (default: 3)
  baseDelay: number; // Base delay for exponential backoff in ms (default: 1000)
  maxDelay: number; // Maximum delay cap in ms (default: 10000)
  enableCircuitBreaker: boolean; // Enable circuit breaker (default: true)
  circuitBreakerThreshold: number; // Failures before opening (default: 3)
  circuitBreakerTimeout: number; // Time before half-open in ms (default: 60000)
}

export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  successCount: number;
  lastFailureTime?: number;
  lastAttemptTime?: number;
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
 * Default configuration for email API resilience.
 *
 * Configuration Rationale:
 * - **Timeout (30s)**: Longer than generic APIs due to:
 *   - Larger email payloads (HTML templates, attachments)
 *   - Template rendering and processing overhead
 *   - Email service provider processing time
 *
 * - **Circuit Breaker Threshold (3)**: Stricter than generic APIs because:
 *   - Email is a critical user-facing feature
 *   - Failures directly impact user experience
 *   - We want to fail fast if email service is degraded
 *
 * - **Max Retries (3)**: Standard retry count with exponential backoff (1s, 2s, 4s)
 *
 * @see {@link isRetryableEmailError} for error classification logic
 */
export const DEFAULT_EMAIL_RESILIENCE_CONFIG: EmailResilienceConfig = {
  timeout: 30000, // 30 seconds - longer for email processing
  maxRetries: 3,
  baseDelay: 1000, // 1s, 2s, 4s pattern
  maxDelay: 10000, // Cap at 10 seconds
  enableCircuitBreaker: true,
  circuitBreakerThreshold: 3, // Stricter for critical email notifications
  circuitBreakerTimeout: 60000, // 60 seconds
};

// ============================================================================
// Circuit Breaker Implementation
// ============================================================================

export class EmailCircuitBreaker {
  private state: CircuitBreakerState = {
    state: 'closed',
    failureCount: 0,
    successCount: 0,
  };

  private config: EmailResilienceConfig;

  constructor(config: Partial<EmailResilienceConfig> = {}) {
    this.config = { ...DEFAULT_EMAIL_RESILIENCE_CONFIG, ...config };
  }

  /**
   * Check if circuit breaker is open (blocking requests)
   */
  isOpen(): boolean {
    if (!this.config.enableCircuitBreaker) {
      return false;
    }

    if (this.state.state === 'open') {
      // Check if we should transition to half-open
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
   * Record a successful request
   */
  recordSuccess(): void {
    if (!this.config.enableCircuitBreaker) {
      return;
    }

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
   */
  recordFailure(): void {
    if (!this.config.enableCircuitBreaker) {
      return;
    }

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
    emailResilienceLogger.warn('[Email Circuit Breaker] Opening circuit after threshold failures', {
      failureCount: this.state.failureCount,
      threshold: this.config.circuitBreakerThreshold,
    });

    this.state.state = 'open';
    this.state.lastFailureTime = Date.now();
  }

  private transitionToHalfOpen(): void {
    emailResilienceLogger.info('[Email Circuit Breaker] Transitioning to half-open state');

    this.state.state = 'half-open';
    this.state.successCount = 0;
  }

  private transitionToClosed(): void {
    emailResilienceLogger.info('[Email Circuit Breaker] Closing circuit after recovery');

    this.state.state = 'closed';
    this.state.failureCount = 0;
    this.state.successCount = 0;
  }
}

// Global circuit breaker instance for email service
export const emailCircuitBreaker = new EmailCircuitBreaker();

// ============================================================================
// Error Classification
// ============================================================================

/**
 * Determine if an error should be retried based on status code or error type
 *
 * Uses the exported constants {@link RETRYABLE_STATUS_CODES}, {@link NON_RETRYABLE_STATUS_CODES},
 * and {@link RETRYABLE_NETWORK_ERRORS} for classification.
 */
export function isRetryableEmailError(error: any): boolean {
  // Check for retryable HTTP status codes
  const statusCode = error?.statusCode || error?.status;
  if (statusCode) {
    // Retry on server errors and rate limiting
    if (RETRYABLE_STATUS_CODES.includes(statusCode)) {
      return true;
    }

    // Don't retry on client errors
    if (NON_RETRYABLE_STATUS_CODES.includes(statusCode)) {
      return false;
    }
  }

  // Check for network errors
  if (error instanceof Error) {
    const message = error.message.toUpperCase();

    // Check against known retryable network errors
    if (RETRYABLE_NETWORK_ERRORS.some((errType) => message.includes(errType))) {
      return true;
    }

    // Also check for common network error keywords
    const additionalNetworkKeywords = ['TIMEOUT', 'NETWORK'];
    if (additionalNetworkKeywords.some((keyword) => message.includes(keyword))) {
      return true;
    }
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
  config: EmailResilienceConfig
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
 * Retry an operation with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<EmailResilienceConfig> = {}
): Promise<T> {
  const fullConfig: EmailResilienceConfig = {
    ...DEFAULT_EMAIL_RESILIENCE_CONFIG,
    ...config,
  };

  let lastError: any;

  for (let attempt = 1; attempt <= fullConfig.maxRetries; attempt++) {
    try {
      // Check circuit breaker before attempting
      if (emailCircuitBreaker.isOpen()) {
        throw new Error('Email circuit breaker is OPEN - blocking request');
      }

      // Execute operation with timeout
      const result = await Promise.race<T>([
        operation(),
        new Promise<T>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Email operation timeout after ${fullConfig.timeout}ms`)),
            fullConfig.timeout
          )
        ),
      ]);

      // Success - record with circuit breaker
      emailCircuitBreaker.recordSuccess();

      if (attempt > 1) {
        emailResilienceLogger.info(`[Email Resilience] Operation succeeded after ${attempt} attempts`);
      }

      return result;
    } catch (error: any) {
      lastError = error;

      emailResilienceLogger.warn(`[Email Resilience] Attempt ${attempt}/${fullConfig.maxRetries} failed:`, {
        error: error.message || error,
        statusCode: error.statusCode || error.status,
      });

      // Record failure with circuit breaker
      emailCircuitBreaker.recordFailure();

      // Check if error is retryable
      const isRetryable = isRetryableEmailError(error);

      if (!isRetryable) {
        emailResilienceLogger.warn('[Email Resilience] Non-retryable error detected - aborting retry');
        throw error;
      }

      // Don't retry if this was the last attempt
      if (attempt >= fullConfig.maxRetries) {
        emailResilienceLogger.error(
          `[Email Resilience] All ${fullConfig.maxRetries} attempts failed - giving up`
        );
        throw error;
      }

      // Check for rate limiting with Retry-After
      const retryAfterDelay = getRetryAfterDelay(error);
      let delay: number;

      if (retryAfterDelay !== null) {
        delay = retryAfterDelay;
        emailResilienceLogger.info(
          `[Email Resilience] Rate limited - respecting Retry-After: ${delay}ms`
        );
      } else {
        delay = calculateBackoffDelay(attempt, fullConfig);
        emailResilienceLogger.info(
          `[Email Resilience] Waiting ${delay}ms before attempt ${attempt + 1}`
        );
      }

      await sleep(delay);
    }
  }

  // Should never reach here, but TypeScript requires it
  throw lastError;
}

// ============================================================================
// Convenience Wrapper for Email Operations
// ============================================================================

/**
 * Wrap an email send operation with full resilience (retry + circuit breaker + timeout)
 */
export async function sendEmailWithResilience<T>(
  operation: () => Promise<T>,
  config?: Partial<EmailResilienceConfig>
): Promise<T> {
  try {
    return await withRetry(operation, config);
  } catch (error: any) {
    // Log final failure
    emailResilienceLogger.error('[Email Resilience] Email operation failed after all retries:', {
      error: error.message || error,
      statusCode: error.statusCode || error.status,
      circuitBreakerState: emailCircuitBreaker.getState().state,
    });

    throw error;
  }
}
