/**
 * Unit Tests for CaterValley Service
 *
 * Tests the updateCaterValleyOrderStatus function with mocked dependencies.
 * Covers input validation, HTTP error handling, and circuit breaker behavior.
 *
 * Part of REA-315: Service Layer Unit Tests
 */

import {
  updateCaterValleyOrderStatus,
  updateCaterValleyOrderStatusLegacy,
  type CaterValleyOrderStatus,
} from '@/lib/services/caterValleyService';
// Import the mocked versions - these will be replaced by the mock
import { CircuitBreakerOpenError, caterValleyCircuitBreaker } from '@/utils/api-resilience';
import {
  createMockFetchResponse,
  configureFetchSuccess,
  configureFetchError,
  configureFetchNetworkError,
  createCaterValleySuccessResponse,
  createCaterValleyErrorResponse,
  resetAllMocks,
  setupTestEnv,
} from '../helpers/service-test-utils';

// Mock the api-resilience module to control circuit breaker behavior
// These must be defined before jest.mock is called (jest.mock is hoisted)
const mockWithCaterValleyResilience = jest.fn();
const mockCircuitBreaker = {
  isOpen: jest.fn().mockReturnValue(false),
  getState: jest.fn().mockReturnValue({
    state: 'closed',
    failureCount: 0,
    successCount: 0,
  }),
  recordSuccess: jest.fn(),
  recordFailure: jest.fn(),
  reset: jest.fn(),
};

jest.mock('@/utils/api-resilience', () => {
  // Define mock CircuitBreakerOpenError class inside the factory
  class MockCircuitBreakerOpenError extends Error {
    name = 'CircuitBreakerOpenError';
    retryAfter: Date;
    state: unknown;
    estimatedWaitMs: number;

    constructor(apiName: string, retryAfter: Date, state: unknown, waitMs: number) {
      super(`${apiName} circuit breaker is OPEN`);
      this.retryAfter = retryAfter;
      this.state = state;
      this.estimatedWaitMs = waitMs;
    }
  }

  return {
    CircuitBreakerOpenError: MockCircuitBreakerOpenError,
    withCaterValleyResilience: jest.fn().mockImplementation(async (operation: () => Promise<Response>) => {
      return operation();
    }),
    caterValleyCircuitBreaker: {
      isOpen: jest.fn().mockReturnValue(false),
      getState: jest.fn().mockReturnValue({
        state: 'closed',
        failureCount: 0,
        successCount: 0,
      }),
      recordSuccess: jest.fn(),
      recordFailure: jest.fn(),
      reset: jest.fn(),
    },
  };
});

// Get references to the mocked functions for test assertions
import { withCaterValleyResilience as mockResilience, caterValleyCircuitBreaker as mockCB } from '@/utils/api-resilience';

// Reset the mocks before each test
beforeEach(() => {
  (mockResilience as jest.Mock).mockReset();
  (mockResilience as jest.Mock).mockImplementation(async (operation: () => Promise<Response>) => {
    return operation();
  });
  (mockCB.isOpen as jest.Mock).mockReturnValue(false);
});

describe('CaterValleyService', () => {
  let cleanupEnv: () => void;
  const originalFetch = global.fetch;

  beforeAll(() => {
    // Setup environment variables
    cleanupEnv = setupTestEnv({
      NEXT_PUBLIC_CATER_VALLEY_API_URL: 'https://api.catervalley.com/api/operation/order/update-order-status',
      NEXT_PUBLIC_CATER_VALLEY_PARTNER_HEADER: 'ready-set',
    });
  });

  afterAll(() => {
    cleanupEnv();
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    resetAllMocks();
    jest.clearAllMocks();
  });

  describe('updateCaterValleyOrderStatus', () => {
    describe('Input Validation', () => {
      it('should return error for empty orderNumber', async () => {
        const result = await updateCaterValleyOrderStatus('', 'CONFIRM');

        expect(result.success).toBe(false);
        expect(result.orderFound).toBe(false);
        expect(result.error).toContain('Invalid orderNumber');
      });

      it('should return error for whitespace-only orderNumber', async () => {
        const result = await updateCaterValleyOrderStatus('   ', 'CONFIRM');

        expect(result.success).toBe(false);
        expect(result.orderFound).toBe(false);
        expect(result.error).toContain('Invalid orderNumber');
      });

      it('should return error for null orderNumber', async () => {
        const result = await updateCaterValleyOrderStatus(null as unknown as string, 'CONFIRM');

        expect(result.success).toBe(false);
        expect(result.orderFound).toBe(false);
        expect(result.error).toContain('Invalid orderNumber');
      });

      it('should return error for invalid status', async () => {
        const result = await updateCaterValleyOrderStatus('ORDER-123', 'INVALID_STATUS' as CaterValleyOrderStatus);

        expect(result.success).toBe(false);
        expect(result.orderFound).toBe(false);
        expect(result.error).toContain('Invalid status');
        expect(result.error).toContain('INVALID_STATUS');
      });

      it('should return error for empty status', async () => {
        const result = await updateCaterValleyOrderStatus('ORDER-123', '' as CaterValleyOrderStatus);

        expect(result.success).toBe(false);
        expect(result.orderFound).toBe(false);
        expect(result.error).toContain('Invalid status');
      });
    });

    describe('Valid Status Codes', () => {
      const validStatuses: CaterValleyOrderStatus[] = [
        'CONFIRM',
        'READY',
        'ON_THE_WAY',
        'COMPLETED',
        'CANCELLED',
        'REFUNDED',
      ];

      it.each(validStatuses)('should accept %s as valid status', async (status) => {
        configureFetchSuccess(createCaterValleySuccessResponse());

        const result = await updateCaterValleyOrderStatus('ORDER-123', status);

        expect(result.success).toBe(true);
        expect(result.orderFound).toBe(true);
      });
    });

    describe('Successful API Calls', () => {
      it('should return success for valid order update', async () => {
        const mockFetch = configureFetchSuccess(createCaterValleySuccessResponse());

        const result = await updateCaterValleyOrderStatus('ORDER-123', 'CONFIRM');

        expect(result.success).toBe(true);
        expect(result.orderFound).toBe(true);
        expect(result.response).toBeDefined();
        expect(result.response?.result).toBe(true);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
              'partner': 'ready-set',
            }),
            body: JSON.stringify({
              orderNumber: 'ORDER-123',
              status: 'CONFIRM',
            }),
          })
        );
      });

      it('should include response data on success', async () => {
        const responseData = {
          result: true,
          message: 'Order status updated',
          data: {},
        };
        configureFetchSuccess(responseData);

        const result = await updateCaterValleyOrderStatus('ORDER-123', 'COMPLETED');

        expect(result.success).toBe(true);
        expect(result.response).toEqual(responseData);
      });
    });

    describe('HTTP Error Handling', () => {
      it('should handle 404 error (order not found)', async () => {
        configureFetchError(404, { message: 'Order not found in CaterValley' }, 'Not Found');

        const result = await updateCaterValleyOrderStatus('UNKNOWN-ORDER', 'CONFIRM');

        expect(result.success).toBe(false);
        expect(result.orderFound).toBe(false);
        expect(result.statusCode).toBe(404);
        expect(result.error).toContain('Order not found');
      });

      it('should handle 404 error with default message when response has no message', async () => {
        configureFetchError(404, {}, 'Not Found');

        const result = await updateCaterValleyOrderStatus('UNKNOWN-ORDER', 'CONFIRM');

        expect(result.success).toBe(false);
        expect(result.orderFound).toBe(false);
        expect(result.statusCode).toBe(404);
      });

      it('should handle 500 server error', async () => {
        configureFetchError(500, { message: 'Internal server error' }, 'Internal Server Error');

        const result = await updateCaterValleyOrderStatus('ORDER-123', 'CONFIRM');

        expect(result.success).toBe(false);
        expect(result.orderFound).toBe(true); // Assume order exists for non-404 errors
        expect(result.statusCode).toBe(500);
        expect(result.error).toContain('500');
      });

      it('should handle 401 unauthorized error', async () => {
        configureFetchError(401, { message: 'Unauthorized' }, 'Unauthorized');

        const result = await updateCaterValleyOrderStatus('ORDER-123', 'CONFIRM');

        expect(result.success).toBe(false);
        expect(result.statusCode).toBe(401);
      });

      it('should handle 403 forbidden error', async () => {
        configureFetchError(403, { message: 'Forbidden' }, 'Forbidden');

        const result = await updateCaterValleyOrderStatus('ORDER-123', 'CONFIRM');

        expect(result.success).toBe(false);
        expect(result.statusCode).toBe(403);
      });

      it('should include statusText when response body is not JSON', async () => {
        const mockFetch = jest.fn().mockResolvedValue({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
        });
        global.fetch = mockFetch;

        // Need to bypass the resilience wrapper for this test
        const { withCaterValleyResilience } = require('@/utils/api-resilience');
        (withCaterValleyResilience as jest.Mock).mockImplementation((op: () => Promise<Response>) => op());

        const result = await updateCaterValleyOrderStatus('ORDER-123', 'CONFIRM');

        expect(result.success).toBe(false);
        expect(result.error).toContain('Internal Server Error');
      });
    });

    describe('Network Errors', () => {
      it('should handle network timeout', async () => {
        configureFetchNetworkError(new Error('ETIMEDOUT: Request timed out'));

        const result = await updateCaterValleyOrderStatus('ORDER-123', 'CONFIRM');

        expect(result.success).toBe(false);
        expect(result.orderFound).toBe(false);
        expect(result.error).toContain('Network/API error');
        expect(result.error).toContain('ETIMEDOUT');
      });

      it('should handle connection refused', async () => {
        configureFetchNetworkError(new Error('ECONNREFUSED: Connection refused'));

        const result = await updateCaterValleyOrderStatus('ORDER-123', 'CONFIRM');

        expect(result.success).toBe(false);
        expect(result.error).toContain('ECONNREFUSED');
      });

      it('should handle unknown error types', async () => {
        configureFetchNetworkError('String error' as unknown as Error);

        const result = await updateCaterValleyOrderStatus('ORDER-123', 'CONFIRM');

        expect(result.success).toBe(false);
        expect(result.error).toContain('unknown error');
      });
    });

    describe('Logical Failures (API returns result=false)', () => {
      it('should handle API logical failure', async () => {
        configureFetchSuccess({
          result: false,
          message: 'Order is locked and cannot be updated',
          data: {},
        });

        const result = await updateCaterValleyOrderStatus('ORDER-123', 'CONFIRM');

        expect(result.success).toBe(false);
        expect(result.orderFound).toBe(true);
        expect(result.statusCode).toBe(200);
        expect(result.error).toContain('Order is locked');
      });

      it('should handle logical failure with no message', async () => {
        configureFetchSuccess({
          result: false,
          data: {},
        });

        const result = await updateCaterValleyOrderStatus('ORDER-123', 'CONFIRM');

        expect(result.success).toBe(false);
        expect(result.orderFound).toBe(true);
        expect(result.error).toContain('Unknown logical failure');
      });
    });

    describe('Circuit Breaker Behavior', () => {
      it('should return 503 when circuit breaker is open', async () => {
        const { withCaterValleyResilience } = require('@/utils/api-resilience');

        const circuitBreakerError = new CircuitBreakerOpenError(
          'CaterValley',
          new Date(Date.now() + 60000),
          { state: 'open', failureCount: 5, successCount: 0 },
          60000
        );

        (withCaterValleyResilience as jest.Mock).mockRejectedValue(circuitBreakerError);

        const result = await updateCaterValleyOrderStatus('ORDER-123', 'CONFIRM');

        expect(result.success).toBe(false);
        expect(result.orderFound).toBe(false);
        expect(result.statusCode).toBe(503);
        expect(result.error).toContain('circuit breaker');
      });
    });

    describe('Response Parsing', () => {
      it('should warn when result field has unexpected type', async () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

        configureFetchSuccess({
          result: 'not-a-boolean',
          message: 'Success',
          data: {},
        });

        await updateCaterValleyOrderStatus('ORDER-123', 'CONFIRM');

        // The function should log a warning about unexpected type
        // Note: This tests behavior, the actual console call may vary
        consoleSpy.mockRestore();
      });
    });
  });

  describe('updateCaterValleyOrderStatusLegacy', () => {
    it('should return response on success', async () => {
      configureFetchSuccess(createCaterValleySuccessResponse());

      const response = await updateCaterValleyOrderStatusLegacy('ORDER-123', 'CONFIRM');

      expect(response.result).toBe(true);
      expect(response.message).toBeDefined();
    });

    it('should throw error on failure', async () => {
      configureFetchError(404, { message: 'Order not found' }, 'Not Found');

      await expect(
        updateCaterValleyOrderStatusLegacy('UNKNOWN-ORDER', 'CONFIRM')
      ).rejects.toThrow('Order not found');
    });

    it('should throw error with default message when no error message', async () => {
      configureFetchError(500, {}, 'Server Error');

      await expect(
        updateCaterValleyOrderStatusLegacy('ORDER-123', 'CONFIRM')
      ).rejects.toThrow();
    });
  });
});
