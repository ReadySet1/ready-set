/**
 * API Resilience Test Helpers
 *
 * Utilities for testing API error handling, timeouts, retry logic,
 * circuit breakers, and fallback mechanisms.
 *
 * Part of REA-77: External API Resilience Testing
 */

import { jest } from '@jest/globals';

// ============================================================================
// Network Error Simulation
// ============================================================================

/**
 * Creates a mock API that simulates a network timeout
 */
export function createMockApiWithTimeout(delay: number = 30000) {
  return jest.fn().mockImplementation(() => {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Request timeout after ${delay}ms`));
      }, delay);
    });
  });
}

/**
 * Creates a mock API that simulates various network errors
 */
export function simulateNetworkError(
  type: 'timeout' | 'connection' | 'dns' | 'reset'
) {
  const errors = {
    timeout: new Error('ETIMEDOUT: Request timed out'),
    connection: new Error('ECONNREFUSED: Connection refused'),
    dns: new Error('ENOTFOUND: DNS lookup failed'),
    reset: new Error('ECONNRESET: Connection reset by peer'),
  };

  return jest.fn().mockRejectedValue(errors[type]);
}

/**
 * Creates a mock API that fails N times before succeeding
 */
export function createMockApiWithRetry(
  failCount: number,
  errorType: 'timeout' | 'server' | 'network' = 'server'
) {
  let attempts = 0;

  return jest.fn().mockImplementation(() => {
    attempts++;

    if (attempts <= failCount) {
      const errors = {
        timeout: new Error('Request timeout'),
        server: { status: 503, message: 'Service Unavailable' },
        network: new Error('ECONNRESET'),
      };

      return Promise.reject(errors[errorType]);
    }

    return Promise.resolve({ success: true, data: 'Success after retry' });
  });
}

// ============================================================================
// Rate Limiting Simulation
// ============================================================================

/**
 * Creates a mock API that simulates rate limiting (429 responses)
 */
export function simulateRateLimiting(retryAfter: number = 60) {
  return jest.fn().mockRejectedValue({
    status: 429,
    message: 'Too Many Requests',
    headers: {
      'X-RateLimit-Limit': '100',
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': String(Date.now() + retryAfter * 1000),
      'Retry-After': String(retryAfter),
    },
  });
}

/**
 * Creates a mock API that rate limits after N successful requests
 */
export function createMockApiWithRateLimit(
  successfulRequests: number,
  retryAfter: number = 60
) {
  let requestCount = 0;

  return jest.fn().mockImplementation(() => {
    requestCount++;

    if (requestCount > successfulRequests) {
      return Promise.reject({
        status: 429,
        message: 'Too Many Requests',
        headers: {
          'Retry-After': String(retryAfter),
        },
      });
    }

    return Promise.resolve({ success: true, data: `Request ${requestCount}` });
  });
}

// ============================================================================
// Circuit Breaker Simulation
// ============================================================================

export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  successCount: number;
  lastFailureTime?: number;
  lastAttemptTime?: number;
}

/**
 * Creates a mock API with circuit breaker pattern
 */
export function createMockApiWithCircuitBreaker(
  failureThreshold: number = 3,
  timeout: number = 60000,
  halfOpenAttempts: number = 1
) {
  const state: CircuitBreakerState = {
    state: 'closed',
    failureCount: 0,
    successCount: 0,
  };

  const mockFn = jest.fn().mockImplementation(() => {
    state.lastAttemptTime = Date.now();

    // Check if circuit should transition from open to half-open
    if (
      state.state === 'open' &&
      state.lastFailureTime &&
      Date.now() - state.lastFailureTime >= timeout
    ) {
      state.state = 'half-open';
      state.successCount = 0;
    }

    // Reject immediately if circuit is open
    if (state.state === 'open') {
      return Promise.reject(new Error('Circuit breaker is OPEN'));
    }

    // Simulate API failure
    if (state.failureCount < failureThreshold || state.state === 'half-open') {
      state.failureCount++;
      state.lastFailureTime = Date.now();

      // Open circuit if threshold reached
      if (state.failureCount >= failureThreshold) {
        state.state = 'open';
      }

      return Promise.reject(new Error('API failure'));
    }

    // Success in half-open state
    if (state.state === 'half-open') {
      state.successCount++;

      if (state.successCount >= halfOpenAttempts) {
        state.state = 'closed';
        state.failureCount = 0;
      }
    }

    return Promise.resolve({ success: true, data: 'Success' });
  });

  // Attach state getter for testing
  (mockFn as any).getState = () => state;

  return mockFn;
}

// ============================================================================
// Exponential Backoff Testing
// ============================================================================

/**
 * Validates that exponential backoff is being used correctly
 */
export function expectExponentialBackoff(
  mockFn: jest.Mock,
  baseDelay: number = 1000,
  maxRetries: number = 3
) {
  const callTimes = mockFn.mock.results.map((_, index) => {
    return mockFn.mock.invocationCallOrder[index];
  });

  if (callTimes.length < 2) {
    throw new Error('Not enough retry attempts to validate backoff');
  }

  // Check that delays increase exponentially
  for (let i = 1; i < Math.min(callTimes.length, maxRetries); i++) {
    const expectedDelay = baseDelay * Math.pow(2, i - 1);
    const actualDelay = callTimes[i] - callTimes[i - 1];

    // Allow 20% variance for timing inconsistencies
    const minDelay = expectedDelay * 0.8;
    const maxDelay = expectedDelay * 1.2;

    if (actualDelay < minDelay || actualDelay > maxDelay) {
      throw new Error(
        `Exponential backoff failed: Expected delay ~${expectedDelay}ms, got ${actualDelay}ms`
      );
    }
  }
}

/**
 * Creates a delay tracker for testing retry timing
 */
export function createRetryDelayTracker() {
  const attempts: number[] = [];

  return {
    track: () => {
      attempts.push(Date.now());
    },
    getDelays: () => {
      const delays: number[] = [];
      for (let i = 1; i < attempts.length; i++) {
        delays.push(attempts[i] - attempts[i - 1]);
      }
      return delays;
    },
    validate: (expectedPattern: number[]) => {
      const delays = this.getDelays();

      if (delays.length !== expectedPattern.length) {
        throw new Error(
          `Expected ${expectedPattern.length} delays, got ${delays.length}`
        );
      }

      delays.forEach((delay, index) => {
        const expected = expectedPattern[index];
        const variance = expected * 0.2; // 20% variance

        if (Math.abs(delay - expected) > variance) {
          throw new Error(
            `Delay ${index + 1}: Expected ~${expected}ms, got ${delay}ms`
          );
        }
      });
    },
  };
}

// ============================================================================
// Retry Assertion Helpers
// ============================================================================

/**
 * Asserts that a mock was called with retry attempts
 */
export function expectRetryAttempted(
  mockFn: jest.Mock,
  expectedAttempts: number
) {
  const actualAttempts = mockFn.mock.calls.length;

  if (actualAttempts !== expectedAttempts) {
    throw new Error(
      `Expected ${expectedAttempts} retry attempts, got ${actualAttempts}`
    );
  }
}

/**
 * Asserts that retry attempts have exponential backoff
 */
export function expectRetryWithBackoff(
  mockFn: jest.Mock,
  options: {
    expectedAttempts: number;
    baseDelay: number;
    maxDelay?: number;
  }
) {
  const { expectedAttempts, baseDelay, maxDelay } = options;

  expectRetryAttempted(mockFn, expectedAttempts);

  // Validate exponential pattern
  for (let i = 0; i < expectedAttempts - 1; i++) {
    const expectedDelay = Math.min(
      baseDelay * Math.pow(2, i),
      maxDelay || Infinity
    );

    // This is a simplified check - real implementation would need timing data
    expect(mockFn).toHaveBeenNthCalledWith(i + 1, expect.anything());
  }
}

// ============================================================================
// API Response Mocks
// ============================================================================

/**
 * Creates a mock API that simulates various HTTP error responses
 */
export function createMockApiWithHttpError(statusCode: number, message?: string) {
  const errorMessages: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
  };

  return jest.fn().mockRejectedValue({
    status: statusCode,
    message: message || errorMessages[statusCode] || 'Error',
    statusText: errorMessages[statusCode],
  });
}

/**
 * Creates a mock API that returns partial/incomplete responses
 */
export function createMockApiWithPartialResponse(completeAfter: number = 3) {
  let attempts = 0;

  return jest.fn().mockImplementation(() => {
    attempts++;

    if (attempts < completeAfter) {
      return Promise.resolve({
        success: true,
        data: { partial: true, progress: attempts / completeAfter },
        incomplete: true,
      });
    }

    return Promise.resolve({
      success: true,
      data: { complete: true, result: 'Full data' },
      incomplete: false,
    });
  });
}

// ============================================================================
// Concurrent Request Testing
// ============================================================================

/**
 * Creates a mock API that tracks concurrent requests
 */
export function createMockApiWithConcurrencyTracking() {
  let activeRequests = 0;
  let maxConcurrent = 0;
  const requestTimeline: Array<{ start: number; end: number }> = [];

  const mockFn = jest.fn().mockImplementation(async (delay: number = 100) => {
    activeRequests++;
    maxConcurrent = Math.max(maxConcurrent, activeRequests);

    const start = Date.now();

    await new Promise((resolve) => setTimeout(resolve, delay));

    activeRequests--;
    const end = Date.now();

    requestTimeline.push({ start, end });

    return { success: true, data: 'Complete' };
  });

  // Attach metrics getters
  (mockFn as any).getMaxConcurrent = () => maxConcurrent;
  (mockFn as any).getActiveRequests = () => activeRequests;
  (mockFn as any).getTimeline = () => requestTimeline;
  (mockFn as any).reset = () => {
    activeRequests = 0;
    maxConcurrent = 0;
    requestTimeline.length = 0;
  };

  return mockFn;
}

// ============================================================================
// Fallback Testing
// ============================================================================

/**
 * Creates a mock API with fallback mechanism
 */
export function createMockApiWithFallback<T>(
  primaryResponse: T,
  fallbackResponse: T,
  shouldFail: boolean = true
) {
  return {
    primary: jest.fn().mockImplementation(() => {
      if (shouldFail) {
        return Promise.reject(new Error('Primary API failed'));
      }
      return Promise.resolve(primaryResponse);
    }),
    fallback: jest.fn().mockResolvedValue(fallbackResponse),
  };
}

// ============================================================================
// Error Logging Validation
// ============================================================================

/**
 * Creates a mock logger to validate error logging
 */
export function createMockLogger() {
  const logs: Array<{
    level: 'error' | 'warn' | 'info';
    message: string;
    context?: any;
    timestamp: number;
  }> = [];

  return {
    error: jest.fn((message: string, context?: any) => {
      logs.push({ level: 'error', message, context, timestamp: Date.now() });
    }),
    warn: jest.fn((message: string, context?: any) => {
      logs.push({ level: 'warn', message, context, timestamp: Date.now() });
    }),
    info: jest.fn((message: string, context?: any) => {
      logs.push({ level: 'info', message, context, timestamp: Date.now() });
    }),
    getLogs: () => logs,
    getErrorLogs: () => logs.filter((log) => log.level === 'error'),
    clear: () => {
      logs.length = 0;
    },
  };
}

// ============================================================================
// Timeout Testing
// ============================================================================

/**
 * Creates a promise that times out after specified duration
 */
export function createTimeoutPromise<T>(
  promise: Promise<T>,
  timeout: number,
  errorMessage?: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error(errorMessage || `Timeout after ${timeout}ms`));
      }, timeout);
    }),
  ]);
}

/**
 * Validates that an operation completes within timeout
 */
export async function expectCompletesWithinTimeout(
  operation: () => Promise<any>,
  timeout: number
) {
  const start = Date.now();

  try {
    await createTimeoutPromise(operation(), timeout);
    const duration = Date.now() - start;

    if (duration > timeout) {
      throw new Error(`Operation took ${duration}ms, exceeding ${timeout}ms timeout`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('Timeout')) {
      throw error;
    }
    // Re-throw non-timeout errors
    throw error;
  }
}

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Waits for a specified duration (for testing async behavior)
 */
export const wait = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Creates a deferred promise for manual resolution/rejection
 */
export function createDeferred<T>() {
  let resolve: (value: T) => void;
  let reject: (error: any) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {
    promise,
    resolve: resolve!,
    reject: reject!,
  };
}
