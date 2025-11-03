/**
 * Type definitions for Sentry error monitoring
 */

/**
 * Context information to attach to error reports
 * Provides structured metadata for debugging and analysis
 */
export interface ErrorContext {
  /** User ID associated with the error */
  userId?: string;

  /** The action being performed when the error occurred */
  action?: string;

  /** The feature or module where the error occurred */
  feature?: string;

  /** Component name where the error occurred (for React errors) */
  component?: string;

  /** Component stack trace (for React errors) */
  componentStack?: string;

  /** Whether the error was handled gracefully */
  handled?: boolean;

  /** HTTP request information */
  request?: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
  };

  /** Additional custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * User information for Sentry context
 */
export interface SentryUser {
  /** Unique user identifier */
  id: string;

  /** User email (optional, for better tracking) */
  email?: string;

  /** User role (optional, helps identify permission-related errors) */
  role?: string;

  /** Username (optional) */
  username?: string;
}

/**
 * Breadcrumb levels for tracking user actions
 */
export type BreadcrumbLevel = 'fatal' | 'error' | 'warning' | 'info' | 'debug';

/**
 * Breadcrumb category for organizing events
 */
export type BreadcrumbCategory =
  | 'auth'
  | 'navigation'
  | 'ui'
  | 'console'
  | 'xhr'
  | 'fetch'
  | 'websocket'
  | 'error'
  | 'user'
  | 'custom';
