/**
 * Error Response Builder
 *
 * Centralized utility for constructing consistent error responses across the application.
 * This ensures all API errors follow the same structure and include appropriate details
 * based on the environment (development vs production).
 */

import { v4 as uuidv4 } from 'uuid';
import { ENV_CONFIG } from '@/config/upload-config';
import type { ErrorResponse, ErrorResponseDetails, ErrorResponseDiagnostics } from '@/types/upload';

export interface BuildErrorResponseOptions {
  /** Unique correlation ID for tracking the error across logs (auto-generated if not provided) */
  correlationId?: string;

  /** Whether the error is retryable by the client */
  retryable?: boolean;

  /** Suggested retry delay in milliseconds (only if retryable is true) */
  retryAfter?: number;

  /** Additional error details (only included in development) */
  details?: ErrorResponseDetails;

  /** Diagnostic information for debugging (only included in development) */
  diagnostics?: ErrorResponseDiagnostics;
}

/**
 * Builds a consistent error response object for API errors.
 *
 * This function ensures all error responses:
 * - Have a consistent structure
 * - Include correlation IDs for tracking
 * - Only expose sensitive details in development
 * - Follow the ErrorResponse type contract
 *
 * @param message - User-friendly error message
 * @param type - Error type identifier (e.g., 'STORAGE_ERROR', 'VALIDATION_ERROR')
 * @param options - Additional error response options
 * @returns Structured error response object
 *
 * @example
 * ```typescript
 * return NextResponse.json(
 *   buildErrorResponse(
 *     'Failed to upload file to storage',
 *     'STORAGE_ERROR',
 *     {
 *       retryable: true,
 *       retryAfter: RETRY_CONFIG.BASE_DELAY,
 *       details: { bucket: 'fileUploader', filePath: path },
 *       diagnostics: { operation: 'storage_upload', originalError: error.message }
 *     }
 *   ),
 *   { status: 500 }
 * );
 * ```
 */
export function buildErrorResponse(
  message: string,
  type: string,
  options: BuildErrorResponseOptions = {}
): ErrorResponse {
  const {
    correlationId = uuidv4(),
    retryable,
    retryAfter,
    details,
    diagnostics
  } = options;

  const response: ErrorResponse = {
    error: message,
    errorType: type,
    correlationId,
    retryable,
    retryAfter,
  };

  // Only include sensitive details and diagnostics in development
  if (ENV_CONFIG.includeDiagnostics) {
    if (details) {
      response.details = details;
    }
    if (diagnostics) {
      response.diagnostics = diagnostics;
    }
  }

  return response;
}
