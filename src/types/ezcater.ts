/**
 * ezCater API Type Definitions
 *
 * Types for ezCater Delivery API configuration and integration.
 * See: https://api.ezcater.io/delivery-api
 */

/**
 * Configuration for ezCater API connection.
 */
export interface EzCaterConfig {
  /** GraphQL API endpoint URL */
  apiUrl: string;
  /** API authentication token (server-side only) */
  apiToken: string | undefined;
  /** Client identifier for API tracking (e.g., 'ready-set') */
  clientName: string;
  /** Software version for API tracking (e.g., '1.0.0') */
  clientVersion: string;
  /** Secret for validating inbound webhook signatures */
  webhookSecret: string | undefined;
}

/**
 * Result of config validation check.
 */
export interface EzCaterConfigValidation {
  /** Whether all required config values are present */
  isValid: boolean;
  /** List of missing required environment variable names */
  missingVars: string[];
}

/**
 * Required HTTP headers for ezCater API requests.
 */
export interface EzCaterApiHeaders {
  'Content-Type': 'application/json';
  Authorization: string;
  'apollographql-client-name': string;
  'apollographql-client-version': string;
}
