import { NextRequest, NextResponse } from 'next/server';
import {
  ApiError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  DatabaseError,
  ExternalServiceError,
  RateLimitError,
  BusinessLogicError,
  handleApiError,
  withErrorHandler,
  withDatabaseErrorHandler,
  withAuthErrorHandler,
  createValidationErrorResponse,
  createAuthErrorResponse,
  createAuthorizationErrorResponse,
  createBusinessLogicErrorResponse,
  handlePrismaError,
} from '../api-error-handler';
import { ErrorCategory, ErrorSeverity } from '../error-logging';

// Mock the error-logging module
jest.mock('../error-logging', () => ({
  logError: jest.fn(),
  logApiError: jest.fn(),
  ErrorCategory: {
    API: 'api',
    VALIDATION: 'validation',
    AUTH: 'auth',
    DATABASE: 'database',
    INTEGRATION: 'integration',
  },
  ErrorSeverity: {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical',
  },
}));

// Mock the auth-middleware module
jest.mock('../auth-middleware', () => ({
  addSecurityHeaders: jest.fn((response) => response),
}));

// Mock NextRequest
const createMockRequest = (url: string = 'http://localhost/api/test', method: string = 'GET'): NextRequest => {
  return new NextRequest(url, { method });
};

describe('API Error Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ApiError class', () => {
    it('creates error with default values', () => {
      const error = new ApiError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe('ApiError');
      expect(error.code).toBeUndefined();
      expect(error.category).toBeUndefined();
      expect(error.severity).toBeUndefined();
    });

    it('creates error with custom status code', () => {
      const error = new ApiError('Bad request', 400);
      expect(error.statusCode).toBe(400);
    });

    it('creates error with all parameters', () => {
      const error = new ApiError(
        'Custom error',
        422,
        'CUSTOM_CODE',
        ErrorCategory.VALIDATION,
        ErrorSeverity.HIGH
      );
      expect(error.message).toBe('Custom error');
      expect(error.statusCode).toBe(422);
      expect(error.code).toBe('CUSTOM_CODE');
      expect(error.category).toBe(ErrorCategory.VALIDATION);
      expect(error.severity).toBe(ErrorSeverity.HIGH);
    });
  });

  describe('ValidationError class', () => {
    it('creates validation error with correct defaults', () => {
      const error = new ValidationError('Invalid input');
      expect(error.message).toBe('Invalid input');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.name).toBe('ValidationError');
      expect(error.category).toBe(ErrorCategory.VALIDATION);
      expect(error.severity).toBe(ErrorSeverity.HIGH);
    });
  });

  describe('AuthenticationError class', () => {
    it('creates authentication error with default message', () => {
      const error = new AuthenticationError();
      expect(error.message).toBe('Authentication required');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('AUTHENTICATION_ERROR');
      expect(error.name).toBe('AuthenticationError');
      expect(error.category).toBe(ErrorCategory.AUTH);
      expect(error.severity).toBe(ErrorSeverity.CRITICAL);
    });

    it('creates authentication error with custom message', () => {
      const error = new AuthenticationError('Token expired');
      expect(error.message).toBe('Token expired');
    });
  });

  describe('AuthorizationError class', () => {
    it('creates authorization error with default message', () => {
      const error = new AuthorizationError();
      expect(error.message).toBe('Insufficient permissions');
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('AUTHORIZATION_ERROR');
      expect(error.name).toBe('AuthorizationError');
      expect(error.category).toBe(ErrorCategory.AUTH);
      expect(error.severity).toBe(ErrorSeverity.CRITICAL);
    });

    it('creates authorization error with custom message', () => {
      const error = new AuthorizationError('Admin access required');
      expect(error.message).toBe('Admin access required');
    });
  });

  describe('NotFoundError class', () => {
    it('creates not found error with default message', () => {
      const error = new NotFoundError();
      expect(error.message).toBe('Resource not found');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND_ERROR');
      expect(error.name).toBe('NotFoundError');
      expect(error.category).toBe(ErrorCategory.API);
      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
    });

    it('creates not found error with custom message', () => {
      const error = new NotFoundError('User not found');
      expect(error.message).toBe('User not found');
    });
  });

  describe('DatabaseError class', () => {
    it('creates database error', () => {
      const error = new DatabaseError('Connection failed');
      expect(error.message).toBe('Connection failed');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('DATABASE_ERROR');
      expect(error.name).toBe('DatabaseError');
      expect(error.category).toBe(ErrorCategory.DATABASE);
      expect(error.severity).toBe(ErrorSeverity.CRITICAL);
    });
  });

  describe('ExternalServiceError class', () => {
    it('creates external service error with default status', () => {
      const error = new ExternalServiceError('Service unavailable');
      expect(error.message).toBe('Service unavailable');
      expect(error.statusCode).toBe(502);
      expect(error.code).toBe('EXTERNAL_SERVICE_ERROR');
      expect(error.name).toBe('ExternalServiceError');
      expect(error.category).toBe(ErrorCategory.INTEGRATION);
      expect(error.severity).toBe(ErrorSeverity.HIGH);
    });

    it('creates external service error with custom status', () => {
      const error = new ExternalServiceError('Gateway timeout', 504);
      expect(error.statusCode).toBe(504);
    });
  });

  describe('RateLimitError class', () => {
    it('creates rate limit error with default message', () => {
      const error = new RateLimitError();
      expect(error.message).toBe('Rate limit exceeded');
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('RATE_LIMIT_ERROR');
      expect(error.name).toBe('RateLimitError');
      expect(error.category).toBe(ErrorCategory.API);
      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
    });

    it('creates rate limit error with custom message', () => {
      const error = new RateLimitError('Too many requests per minute');
      expect(error.message).toBe('Too many requests per minute');
    });
  });

  describe('BusinessLogicError class', () => {
    it('creates business logic error with default code', () => {
      const error = new BusinessLogicError('Order cannot be cancelled');
      expect(error.message).toBe('Order cannot be cancelled');
      expect(error.statusCode).toBe(422);
      expect(error.code).toBe('BUSINESS_LOGIC_ERROR');
      expect(error.name).toBe('BusinessLogicError');
      expect(error.category).toBe(ErrorCategory.VALIDATION);
      expect(error.severity).toBe(ErrorSeverity.HIGH);
    });

    it('creates business logic error with custom code', () => {
      const error = new BusinessLogicError('Invalid order state', 'ORDER_STATE_ERROR');
      expect(error.code).toBe('ORDER_STATE_ERROR');
    });
  });

  describe('handleApiError', () => {
    it('handles ApiError instances correctly', async () => {
      const request = createMockRequest();
      const error = new ValidationError('Invalid data');

      const response = handleApiError(error, request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('Invalid data');
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.statusCode).toBe(400);
      expect(body.requestId).toBeDefined();
      expect(body.timestamp).toBeDefined();
    });

    it('handles generic Error with database-related message', async () => {
      const request = createMockRequest();
      const error = new Error('Prisma client error');

      const response = handleApiError(error, request);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.code).toBe('DATABASE_ERROR');
    });

    it('handles generic Error with validation-related message', async () => {
      const request = createMockRequest();
      const error = new Error('validation failed');

      const response = handleApiError(error, request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('handles generic Error with unauthorized message', async () => {
      const request = createMockRequest();
      const error = new Error('unauthorized access');

      const response = handleApiError(error, request);
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.code).toBe('AUTHENTICATION_ERROR');
    });

    it('handles generic Error with forbidden message', async () => {
      const request = createMockRequest();
      const error = new Error('forbidden action');

      const response = handleApiError(error, request);
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.code).toBe('AUTHORIZATION_ERROR');
    });

    it('handles generic Error with permission message', async () => {
      const request = createMockRequest();
      const error = new Error('permission denied');

      const response = handleApiError(error, request);
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.code).toBe('AUTHORIZATION_ERROR');
    });

    it('handles unknown error types', async () => {
      const request = createMockRequest();
      const error = 'String error';

      const response = handleApiError(error, request);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.code).toBe('INTERNAL_ERROR');
    });

    it('includes additional context in logging', async () => {
      const request = createMockRequest();
      const error = new ApiError('Test error', 500);
      const additionalContext = { userId: '123', operation: 'test' };

      handleApiError(error, request, additionalContext);

      const { logApiError } = require('../error-logging');
      expect(logApiError).toHaveBeenCalled();
    });

    it('adds request ID header to response', async () => {
      const request = createMockRequest();
      const error = new ApiError('Test error', 500);

      const response = handleApiError(error, request);

      expect(response.headers.get('X-Request-ID')).toBeDefined();
      expect(response.headers.get('X-Response-Time')).toBeDefined();
      expect(response.headers.get('X-Error-Code')).toBeDefined();
    });
  });

  describe('withErrorHandler', () => {
    it('passes through successful responses', async () => {
      const request = createMockRequest();
      const mockHandler = jest.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      );

      const wrappedHandler = withErrorHandler(mockHandler);
      const response = await wrappedHandler(request);
      const body = await response.json();

      expect(body.success).toBe(true);
      expect(response.headers.get('X-Response-Time')).toBeDefined();
    });

    it('catches and handles errors from handler', async () => {
      const request = createMockRequest();
      const mockHandler = jest.fn().mockRejectedValue(
        new ValidationError('Test validation error')
      );

      const wrappedHandler = withErrorHandler(mockHandler);
      const response = await wrappedHandler(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('passes options to error handler', async () => {
      const request = createMockRequest();
      const mockHandler = jest.fn().mockRejectedValue(new Error('Test'));

      const wrappedHandler = withErrorHandler(mockHandler, {
        operation: 'test_operation',
        category: ErrorCategory.DATABASE,
        additionalContext: { extra: 'data' },
      });

      const response = await wrappedHandler(request);

      expect(response.status).toBe(500);
    });
  });

  describe('withDatabaseErrorHandler', () => {
    it('wraps handler with database error handling', async () => {
      const request = createMockRequest();
      const mockHandler = jest.fn().mockRejectedValue(
        new DatabaseError('Connection failed')
      );

      const wrappedHandler = withDatabaseErrorHandler(mockHandler, 'test_db_operation');
      const response = await wrappedHandler(request);

      expect(response.status).toBe(500);
    });
  });

  describe('withAuthErrorHandler', () => {
    it('wraps handler with auth error handling', async () => {
      const request = createMockRequest();
      const mockHandler = jest.fn().mockRejectedValue(
        new AuthenticationError()
      );

      const wrappedHandler = withAuthErrorHandler(mockHandler, 'test_auth_operation');
      const response = await wrappedHandler(request);

      expect(response.status).toBe(401);
    });
  });

  describe('createValidationErrorResponse', () => {
    it('creates validation error response without request', async () => {
      const response = createValidationErrorResponse('Field is required');
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('Field is required');
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('creates validation error response with request', async () => {
      const request = createMockRequest();
      const response = createValidationErrorResponse('Field is required', { field: 'email' }, request);

      expect(response.status).toBe(400);
    });
  });

  describe('createAuthErrorResponse', () => {
    it('creates auth error response with default message', async () => {
      const response = createAuthErrorResponse();
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error).toBe('Authentication required');
      expect(body.code).toBe('AUTHENTICATION_ERROR');
    });

    it('creates auth error response with custom message', async () => {
      const response = createAuthErrorResponse('Session expired');
      const body = await response.json();

      expect(body.error).toBe('Session expired');
    });

    it('creates auth error response with request', async () => {
      const request = createMockRequest();
      const response = createAuthErrorResponse('Invalid token', request);

      expect(response.status).toBe(401);
    });
  });

  describe('createAuthorizationErrorResponse', () => {
    it('creates authorization error response with default message', async () => {
      const response = createAuthorizationErrorResponse();
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.error).toBe('Insufficient permissions');
      expect(body.code).toBe('AUTHORIZATION_ERROR');
    });

    it('creates authorization error response with custom message', async () => {
      const response = createAuthorizationErrorResponse('Admin only');
      const body = await response.json();

      expect(body.error).toBe('Admin only');
    });

    it('creates authorization error response with request', async () => {
      const request = createMockRequest();
      const response = createAuthorizationErrorResponse('Not allowed', request);

      expect(response.status).toBe(403);
    });
  });

  describe('createBusinessLogicErrorResponse', () => {
    it('creates business logic error response without request', async () => {
      const response = createBusinessLogicErrorResponse('Cannot cancel completed order');
      const body = await response.json();

      expect(response.status).toBe(422);
      expect(body.error).toBe('Cannot cancel completed order');
      expect(body.code).toBe('BUSINESS_LOGIC_ERROR');
    });

    it('creates business logic error response with details', async () => {
      const response = createBusinessLogicErrorResponse(
        'Invalid state transition',
        { currentState: 'COMPLETED', attemptedState: 'CANCELLED' }
      );
      const body = await response.json();

      expect(response.status).toBe(422);
    });

    it('creates business logic error response with request', async () => {
      const request = createMockRequest();
      const response = createBusinessLogicErrorResponse(
        'Business rule violated',
        { rule: 'order_cancellation' },
        request
      );

      expect(response.status).toBe(422);
    });
  });

  describe('handlePrismaError', () => {
    it('handles P2025 - Record not found', () => {
      const prismaError = { code: 'P2025' };
      const result = handlePrismaError(prismaError);

      expect(result).toBeInstanceOf(NotFoundError);
      expect(result.message).toBe('Record not found');
    });

    it('handles P2002 - Unique constraint violation', () => {
      const prismaError = { code: 'P2002' };
      const result = handlePrismaError(prismaError);

      expect(result).toBeInstanceOf(ValidationError);
      expect(result.message).toBe('Unique constraint violation');
    });

    it('handles P2003 - Foreign key constraint violation', () => {
      const prismaError = { code: 'P2003' };
      const result = handlePrismaError(prismaError);

      expect(result).toBeInstanceOf(ValidationError);
      expect(result.message).toBe('Foreign key constraint violation');
    });

    it('handles P1001 - Database connection failed', () => {
      const prismaError = { code: 'P1001' };
      const result = handlePrismaError(prismaError);

      expect(result).toBeInstanceOf(DatabaseError);
      expect(result.message).toBe('Database connection failed');
    });

    it('handles P2024 - Connection timeout', () => {
      const prismaError = { code: 'P2024' };
      const result = handlePrismaError(prismaError);

      expect(result).toBeInstanceOf(DatabaseError);
      expect(result.message).toBe('Connection timeout');
    });

    it('handles unknown Prisma error code', () => {
      const prismaError = { code: 'P9999' };
      const result = handlePrismaError(prismaError, 'custom_operation');

      expect(result).toBeInstanceOf(DatabaseError);
      expect(result.message).toBe('Database operation failed: custom_operation');
    });

    it('handles error without code', () => {
      const error = { message: 'Unknown error' };
      const result = handlePrismaError(error, 'test_operation');

      expect(result).toBeInstanceOf(DatabaseError);
      expect(result.message).toBe('Database operation failed: test_operation');
    });

    it('handles null error', () => {
      const result = handlePrismaError(null, 'null_operation');

      expect(result).toBeInstanceOf(DatabaseError);
      expect(result.message).toBe('Database operation failed: null_operation');
    });
  });
});
