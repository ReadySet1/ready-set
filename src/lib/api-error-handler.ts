// src/lib/api-error-handler.ts
import { NextRequest, NextResponse } from 'next/server';
import { logError, logApiError, ErrorCategory, ErrorSeverity } from './error-logging';
import { addSecurityHeaders } from './auth-middleware';

// Standard API error response interface
export interface ApiErrorResponse {
  error: string;
  details?: string;
  code?: string;
  timestamp: string;
  requestId: string;
  statusCode: number;
}

// Custom error classes for better error handling
export class ApiError extends Error {
  public statusCode: number;
  public code?: string;
  public category?: ErrorCategory;
  public severity?: ErrorSeverity;

  constructor(
    message: string, 
    statusCode: number = 500, 
    code?: string, 
    category?: ErrorCategory, 
    severity?: ErrorSeverity
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.category = category;
    this.severity = severity;
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', ErrorCategory.VALIDATION, ErrorSeverity.HIGH);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends ApiError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR', ErrorCategory.AUTH, ErrorSeverity.CRITICAL);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends ApiError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR', ErrorCategory.AUTH, ErrorSeverity.CRITICAL);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND_ERROR', ErrorCategory.API, ErrorSeverity.MEDIUM);
    this.name = 'NotFoundError';
  }
}

export class DatabaseError extends ApiError {
  constructor(message: string, originalError?: any) {
    super(message, 500, 'DATABASE_ERROR', ErrorCategory.DATABASE, ErrorSeverity.CRITICAL);
    this.name = 'DatabaseError';
  }
}

export class ExternalServiceError extends ApiError {
  constructor(message: string, statusCode: number = 502) {
    super(message, statusCode, 'EXTERNAL_SERVICE_ERROR', ErrorCategory.INTEGRATION, ErrorSeverity.HIGH);
    this.name = 'ExternalServiceError';
  }
}

export class RateLimitError extends ApiError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_ERROR', ErrorCategory.API, ErrorSeverity.MEDIUM);
    this.name = 'RateLimitError';
  }
}

/**
 * Standardized error handler for API routes
 */
export function handleApiError(
  error: Error | unknown,
  request: NextRequest,
  additionalContext: Record<string, any> = {}
): NextResponse<ApiErrorResponse> {
  const startTime = performance.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  
  let statusCode = 500;
  let errorMessage = 'Internal Server Error';
  let errorCode = 'INTERNAL_ERROR';
  let category = ErrorCategory.API;
  let severity = ErrorSeverity.CRITICAL;

  // Handle different error types
  if (error instanceof ApiError) {
    statusCode = error.statusCode;
    errorMessage = error.message;
    errorCode = error.code || 'API_ERROR';
    category = error.category || ErrorCategory.API;
    severity = error.severity || ErrorSeverity.HIGH;
  } else if (error instanceof Error) {
    // Handle specific error types
    if (error.message.includes('Prisma') || error.message.includes('database')) {
      statusCode = 500;
      errorCode = 'DATABASE_ERROR';
      category = ErrorCategory.DATABASE;
      severity = ErrorSeverity.CRITICAL;
      errorMessage = process.env.NODE_ENV === 'development' 
        ? error.message 
        : 'Database operation failed';
    } else if (error.message.includes('validation') || error.message.includes('invalid')) {
      statusCode = 400;
      errorCode = 'VALIDATION_ERROR';
      category = ErrorCategory.VALIDATION;
      severity = ErrorSeverity.HIGH;
      errorMessage = error.message;
    } else if (error.message.includes('unauthorized') || error.message.includes('authentication')) {
      statusCode = 401;
      errorCode = 'AUTHENTICATION_ERROR';
      category = ErrorCategory.AUTH;
      severity = ErrorSeverity.CRITICAL;
      errorMessage = 'Authentication required';
    } else if (error.message.includes('forbidden') || error.message.includes('permission')) {
      statusCode = 403;
      errorCode = 'AUTHORIZATION_ERROR';
      category = ErrorCategory.AUTH;
      severity = ErrorSeverity.CRITICAL;
      errorMessage = 'Insufficient permissions';
    } else {
      errorMessage = process.env.NODE_ENV === 'development' 
        ? error.message 
        : 'Internal Server Error';
    }
  }

  // Log the error using centralized error logging
  const responseTime = performance.now() - startTime;
  logApiError(error, request.url, request.method, {
    statusCode,
    requestId,
    responseTime,
    ...additionalContext
  }, request);

  // Create error response
  const errorResponse: ApiErrorResponse = {
    error: errorMessage,
    code: errorCode,
    timestamp: new Date().toISOString(),
    requestId,
    statusCode,
    ...(process.env.NODE_ENV === 'development' && error instanceof Error && {
      details: error.stack
    })
  };

  // Create response with security headers
  const response = NextResponse.json(errorResponse, { 
    status: statusCode,
    headers: {
      'X-Request-ID': requestId,
      'X-Response-Time': `${responseTime.toFixed(2)}ms`,
      'X-Error-Code': errorCode
    }
  });

  return addSecurityHeaders(response) as NextResponse<ApiErrorResponse>;
}

/**
 * Higher-order function to wrap API route handlers with error handling
 */
export function withErrorHandler<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T,
  options: {
    operation?: string;
    category?: ErrorCategory;
    additionalContext?: Record<string, any>;
  } = {}
): T {
  return (async (...args: Parameters<T>) => {
    const request = args[0] as NextRequest;
    const startTime = performance.now();
    
    try {
      const response = await handler(...args);
      
      // Add performance headers to successful responses
      const responseTime = performance.now() - startTime;
      response.headers.set('X-Response-Time', `${responseTime.toFixed(2)}ms`);
      
      // Log slow responses
      if (responseTime > 1000) {
        logApiError(
          new Error(`Slow API response: ${responseTime.toFixed(2)}ms`),
          request.url,
          request.method,
          {
            operation: options.operation,
            responseTime,
            severity: ErrorSeverity.MEDIUM,
            ...options.additionalContext
          },
          request
        );
      }
      
      return response;
    } catch (error) {
      return handleApiError(error, request, {
        operation: options.operation,
        category: options.category,
        ...options.additionalContext
      });
    }
  }) as T;
}

/**
 * Higher-order function specifically for database operations
 */
export function withDatabaseErrorHandler<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T,
  operation: string = 'database_operation'
): T {
  return withErrorHandler(handler, {
    operation,
    category: ErrorCategory.DATABASE,
    additionalContext: { databaseOperation: operation }
  });
}

/**
 * Higher-order function specifically for authentication operations
 */
export function withAuthErrorHandler<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T,
  operation: string = 'auth_operation'
): T {
  return withErrorHandler(handler, {
    operation,
    category: ErrorCategory.AUTH,
    additionalContext: { authOperation: operation }
  });
}

/**
 * Utility function to create consistent validation error responses
 */
export function createValidationErrorResponse(
  message: string,
  details?: any,
  request?: NextRequest
): NextResponse<ApiErrorResponse> {
  const error = new ValidationError(message);
  if (request) {
    return handleApiError(error, request, { validationDetails: details });
  }
  
  const errorResponse: ApiErrorResponse = {
    error: message,
    code: 'VALIDATION_ERROR',
    timestamp: new Date().toISOString(),
    requestId: `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    statusCode: 400,
    details: process.env.NODE_ENV === 'development' ? JSON.stringify(details) : undefined
  };

  return NextResponse.json(errorResponse, { status: 400 });
}

/**
 * Utility function to create consistent authentication error responses
 */
export function createAuthErrorResponse(
  message: string = 'Authentication required',
  request?: NextRequest
): NextResponse<ApiErrorResponse> {
  const error = new AuthenticationError(message);
  if (request) {
    return handleApiError(error, request);
  }
  
  const errorResponse: ApiErrorResponse = {
    error: message,
    code: 'AUTHENTICATION_ERROR',
    timestamp: new Date().toISOString(),
    requestId: `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    statusCode: 401
  };

  return NextResponse.json(errorResponse, { status: 401 });
}

/**
 * Utility function to create consistent authorization error responses
 */
export function createAuthorizationErrorResponse(
  message: string = 'Insufficient permissions',
  request?: NextRequest
): NextResponse<ApiErrorResponse> {
  const error = new AuthorizationError(message);
  if (request) {
    return handleApiError(error, request);
  }
  
  const errorResponse: ApiErrorResponse = {
    error: message,
    code: 'AUTHORIZATION_ERROR',
    timestamp: new Date().toISOString(),
    requestId: `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    statusCode: 403
  };

  return NextResponse.json(errorResponse, { status: 403 });
}

/**
 * Utility function to handle Prisma errors specifically
 */
export function handlePrismaError(error: any, operation: string = 'database_operation'): ApiError {
  if (error?.code) {
    switch (error.code) {
      case 'P2025':
        return new NotFoundError('Record not found');
      case 'P2002':
        return new ValidationError('Unique constraint violation');
      case 'P2003':
        return new ValidationError('Foreign key constraint violation');
      case 'P1001':
        return new DatabaseError('Database connection failed');
      case 'P2024':
        return new DatabaseError('Connection timeout');
      default:
        return new DatabaseError(`Database operation failed: ${operation}`);
    }
  }
  
  return new DatabaseError(`Database operation failed: ${operation}`);
} 