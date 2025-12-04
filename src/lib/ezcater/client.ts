/**
 * ezCater GraphQL Client
 *
 * Configures and exports the GraphQL client for ezCater Delivery API.
 * Provides request logging, error handling, and retry logic.
 */

import { GraphQLClient, ClientError } from 'graphql-request';
import {
  getEzCaterApiUrl,
  getEzCaterHeaders,
  validateEzCaterConfig,
  isEzCaterEnabled,
} from '@/config/ezcater';
import { EzCaterApiError } from './errors';
import { withEzCaterResilience } from './resilience';
import { ezCaterLogger } from '@/utils/logger';
import type {
  EzCaterGraphQLResponse,
  EzCaterMutationResponse,
} from '@/types/ezcater';

// Lazy-initialized client singleton
let clientInstance: GraphQLClient | null = null;

/**
 * Get or create the ezCater GraphQL client.
 * Uses lazy initialization to avoid errors during module load when env vars are missing.
 */
function getClient(): GraphQLClient {
  if (!clientInstance) {
    validateEzCaterConfig();

    const headers = getEzCaterHeaders();
    clientInstance = new GraphQLClient(getEzCaterApiUrl(), {
      headers: {
        'Content-Type': headers['Content-Type'],
        'Authorization': headers.Authorization,
        'apollographql-client-name': headers['apollographql-client-name'],
        'apollographql-client-version': headers['apollographql-client-version'],
      },
    });
  }
  return clientInstance;
}

/**
 * Reset client instance.
 * Primarily for testing to clear cached client.
 */
export function resetClient(): void {
  clientInstance = null;
}

/**
 * Generate a unique request ID for tracking and debugging.
 */
function generateRequestId(): string {
  return `ezc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Options for executing GraphQL queries.
 */
export interface ExecuteQueryOptions {
  /** Skip resilience wrapper (for testing) */
  skipResilience?: boolean;
  /** Custom request ID for tracking */
  requestId?: string;
  /** Operation name for logging */
  operationName?: string;
}

/**
 * Execute a GraphQL query/mutation against ezCater API.
 *
 * Features:
 * - Automatic request logging with timing
 * - Error transformation to EzCaterApiError
 * - Retry logic with circuit breaker
 * - Request ID generation for tracing
 *
 * @example
 * ```typescript
 * const response = await executeQuery<CourierAssignResponse>(
 *   COURIER_ASSIGN_MUTATION,
 *   { input: { deliveryId: '123', courier: { id: 'driver-1' } } },
 *   { operationName: 'courierAssign' }
 * );
 * ```
 */
export async function executeQuery<T>(
  query: string,
  variables?: Record<string, unknown>,
  options: ExecuteQueryOptions = {}
): Promise<T> {
  const requestId = options.requestId || generateRequestId();
  const operationName = options.operationName || 'unknown';

  if (!isEzCaterEnabled()) {
    throw new EzCaterApiError(
      'ezCater integration is not enabled. Missing EZCATER_API_TOKEN.',
      503,
      { requestId, operation: operationName }
    );
  }

  const startTime = Date.now();

  ezCaterLogger.info(`[ezCater] Starting ${operationName}`, {
    requestId,
    variables: sanitizeVariablesForLog(variables),
  });

  const executeOperation = async (): Promise<T> => {
    try {
      const client = getClient();
      const result = await client.request<T>(query, variables);

      const duration = Date.now() - startTime;
      ezCaterLogger.info(`[ezCater] ${operationName} completed`, {
        requestId,
        duration: `${duration}ms`,
      });

      return result;
    } catch (error: unknown) {
      const duration = Date.now() - startTime;

      if (error instanceof ClientError) {
        const clientError = error as ClientError;
        ezCaterLogger.error(`[ezCater] ${operationName} GraphQL error`, {
          requestId,
          duration: `${duration}ms`,
          status: clientError.response?.status,
          errors: clientError.response?.errors,
        });

        throw EzCaterApiError.fromGraphQLResponse(
          clientError.response as EzCaterGraphQLResponse<T>,
          { requestId, operation: operationName }
        );
      }

      ezCaterLogger.error(`[ezCater] ${operationName} failed`, {
        requestId,
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new EzCaterApiError(
        error instanceof Error ? error.message : 'Unknown error',
        502,
        { requestId, operation: operationName }
      );
    }
  };

  if (options.skipResilience) {
    return executeOperation();
  }

  return withEzCaterResilience(executeOperation);
}

/**
 * Check mutation response for userErrors and throw if present.
 *
 * ezCater mutations return userErrors for business logic failures.
 * This helper validates the response and throws EzCaterApiError if errors exist.
 *
 * @example
 * ```typescript
 * const response = await executeQuery<CourierAssignResponse>(...);
 * checkMutationResponse(response.courierAssign, {
 *   operation: 'courierAssign',
 *   deliveryId: input.deliveryId,
 * });
 * ```
 */
export function checkMutationResponse(
  response: EzCaterMutationResponse,
  context: { requestId?: string; operation?: string; deliveryId?: string } = {}
): void {
  if (response.userErrors && response.userErrors.length > 0) {
    throw EzCaterApiError.fromUserErrors(response.userErrors, context);
  }
}

/**
 * Sanitize variables for logging (remove sensitive data).
 * Redacts phone numbers from courier objects.
 */
function sanitizeVariablesForLog(
  variables?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!variables) return undefined;

  // Deep clone to avoid modifying original
  const sanitized = JSON.parse(JSON.stringify(variables));

  // Sanitize courier phone numbers
  if (sanitized.input && typeof sanitized.input === 'object') {
    const input = sanitized.input as Record<string, unknown>;
    if (input.courier && typeof input.courier === 'object') {
      const courier = input.courier as Record<string, unknown>;
      if (courier.phone) {
        courier.phone = '[REDACTED]';
      }
    }
  }

  return sanitized;
}
