/**
 * ezCater API Error Classes
 *
 * Custom error handling for ezCater GraphQL API responses.
 * Handles both GraphQL-level errors and business logic errors (userErrors).
 */

import { ExternalServiceError } from '@/lib/api-error-handler';
import type { EzCaterUserError, EzCaterGraphQLResponse } from '@/types/ezcater';

/**
 * Context information attached to ezCater API errors for debugging and logging.
 */
export interface EzCaterErrorContext {
  /** Unique request identifier for tracing */
  requestId?: string;
  /** The delivery ID being operated on */
  deliveryId?: string;
  /** The operation name (e.g., 'courierAssign') */
  operation?: string;
  /** GraphQL-level errors from the response */
  graphqlErrors?: Array<{ message: string; path?: string[] }>;
  /** Business logic errors from mutation responses */
  userErrors?: EzCaterUserError[];
}

/**
 * Error thrown when ezCater API requests fail.
 *
 * Handles two types of errors:
 * 1. GraphQL-level errors (network, syntax, server errors)
 * 2. Business logic errors (userErrors in mutation responses)
 *
 * @example
 * ```typescript
 * try {
 *   await courierAssign({ deliveryId: '123', courier: { id: 'driver-1' } });
 * } catch (error) {
 *   if (error instanceof EzCaterApiError) {
 *     if (error.isUserError) {
 *       // Handle business logic error (e.g., invalid delivery state)
 *       console.log('User errors:', error.userErrors);
 *     } else {
 *       // Handle GraphQL/network error
 *       console.log('API error:', error.message);
 *     }
 *   }
 * }
 * ```
 */
export class EzCaterApiError extends ExternalServiceError {
  public readonly context: EzCaterErrorContext;
  public readonly userErrors: EzCaterUserError[];
  public readonly isUserError: boolean;

  constructor(
    message: string,
    statusCode: number = 502,
    context: EzCaterErrorContext = {}
  ) {
    super(message, statusCode);
    this.name = 'EzCaterApiError';
    this.context = context;
    this.userErrors = context.userErrors || [];
    this.isUserError = this.userErrors.length > 0;
  }

  /**
   * Create error from GraphQL response errors.
   * Used when the GraphQL layer returns errors (syntax, server, etc.)
   */
  static fromGraphQLResponse<T>(
    response: EzCaterGraphQLResponse<T>,
    context: Partial<EzCaterErrorContext> = {}
  ): EzCaterApiError {
    if (response.errors && response.errors.length > 0) {
      const messages = response.errors.map((e) => e.message).join('; ');
      return new EzCaterApiError(`GraphQL Error: ${messages}`, 502, {
        ...context,
        graphqlErrors: response.errors,
      });
    }
    return new EzCaterApiError('Unknown GraphQL error', 502, context);
  }

  /**
   * Create error from userErrors in mutation response.
   * Used when the mutation succeeds at GraphQL level but fails business validation.
   *
   * Returns HTTP 422 (Unprocessable Entity) since the request was valid
   * but couldn't be processed due to business rules.
   */
  static fromUserErrors(
    userErrors: EzCaterUserError[],
    context: Partial<EzCaterErrorContext> = {}
  ): EzCaterApiError {
    const messages = userErrors.map((e) => e.message).join('; ');
    return new EzCaterApiError(
      `Business Logic Error: ${messages}`,
      422, // Unprocessable Entity for business logic errors
      { ...context, userErrors }
    );
  }

  /**
   * Serialize error for JSON responses and logging.
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      context: this.context,
      userErrors: this.userErrors,
      isUserError: this.isUserError,
    };
  }
}

/**
 * Determine if an ezCater API error should be retried.
 *
 * Non-retryable errors:
 * - Business logic errors (userErrors) - these won't change on retry
 * - 4xx errors (except 429 rate limiting) - client errors need fixes
 *
 * Retryable errors:
 * - 5xx server errors
 * - 429 rate limiting
 * - Network/timeout errors
 */
export function isEzCaterRetryableError(error: unknown): boolean {
  if (error instanceof EzCaterApiError) {
    // Don't retry user/business logic errors - they won't change
    if (error.isUserError) return false;

    // Don't retry 4xx errors except 429 (rate limiting)
    if (
      error.statusCode >= 400 &&
      error.statusCode < 500 &&
      error.statusCode !== 429
    ) {
      return false;
    }
  }

  // Default: allow retry for unknown errors
  return true;
}
