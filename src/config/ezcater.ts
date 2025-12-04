/**
 * ezCater API Configuration
 *
 * Configuration for ezCater Delivery API integration.
 * See: https://api.ezcater.io/delivery-api
 *
 * Required environment variables:
 * - EZCATER_API_TOKEN: API authentication token
 *
 * Optional environment variables:
 * - EZCATER_API_URL: GraphQL endpoint (default: https://api.ezcater.com/graphql)
 * - EZCATER_CLIENT_NAME: Client identifier for tracking (default: ready-set)
 * - EZCATER_CLIENT_VERSION: Version for tracking (default: 1.0.0)
 * - EZCATER_WEBHOOK_SECRET: Secret for validating inbound webhooks
 */

import type {
  EzCaterConfig,
  EzCaterConfigValidation,
  EzCaterApiHeaders,
} from '@/types/ezcater';

/**
 * ezCater API configuration object.
 * Values are read from environment variables with sensible defaults.
 */
export const EZCATER_CONFIG: EzCaterConfig = {
  apiUrl: process.env.EZCATER_API_URL || 'https://api.ezcater.com/graphql',
  apiToken: process.env.EZCATER_API_TOKEN,
  clientName: process.env.EZCATER_CLIENT_NAME || 'ready-set',
  clientVersion: process.env.EZCATER_CLIENT_VERSION || '1.0.0',
  webhookSecret: process.env.EZCATER_WEBHOOK_SECRET,
} as const;

/**
 * Check if ezCater integration is enabled.
 * Integration is considered enabled when the API token is configured.
 *
 * @returns true if API token is configured
 */
export function isEzCaterEnabled(): boolean {
  return Boolean(EZCATER_CONFIG.apiToken);
}

/**
 * Validate that all required ezCater configuration values are present.
 *
 * @returns Validation result with isValid flag and list of missing vars
 */
export function checkEzCaterConfig(): EzCaterConfigValidation {
  const missingVars: string[] = [];

  if (!EZCATER_CONFIG.apiToken) {
    missingVars.push('EZCATER_API_TOKEN');
  }

  return {
    isValid: missingVars.length === 0,
    missingVars,
  };
}

/**
 * Validate ezCater configuration and throw if required values are missing.
 * Call this before making API requests to ensure proper configuration.
 *
 * @throws Error if required environment variables are not configured
 */
export function validateEzCaterConfig(): void {
  const validation = checkEzCaterConfig();

  if (!validation.isValid) {
    throw new Error(
      `ezCater configuration error: Missing required environment variables: ${validation.missingVars.join(', ')}. ` +
        `Please configure these in your .env file or environment.`
    );
  }
}

/**
 * Get the required HTTP headers for ezCater API requests.
 * Validates configuration before returning headers.
 *
 * @throws Error if API token is not configured
 * @returns Headers object for fetch/axios requests
 */
export function getEzCaterHeaders(): EzCaterApiHeaders {
  validateEzCaterConfig();

  return {
    'Content-Type': 'application/json',
    Authorization: EZCATER_CONFIG.apiToken!,
    'apollographql-client-name': EZCATER_CONFIG.clientName,
    'apollographql-client-version': EZCATER_CONFIG.clientVersion,
  };
}

/**
 * Get ezCater API URL.
 *
 * @returns The configured GraphQL endpoint URL
 */
export function getEzCaterApiUrl(): string {
  return EZCATER_CONFIG.apiUrl;
}
