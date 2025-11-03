/**
 * Sentry Error Monitoring Utilities
 *
 * This module provides helper functions for integrating Sentry error tracking
 * throughout the application. It handles user context, custom error tracking,
 * and performance monitoring.
 */

import * as Sentry from '@sentry/nextjs';

/**
 * User information for Sentry context
 */
export interface SentryUser {
  id: string;
  email?: string;
  role?: string;
  name?: string;
}

/**
 * Set user context for Sentry error tracking
 * Call this after successful authentication to attach user info to all errors
 *
 * @param user - User information to attach to Sentry events
 *
 * @example
 * ```ts
 * // In your auth callback or session handler
 * import { setSentryUser } from '@/lib/monitoring/sentry';
 *
 * setSentryUser({
 *   id: session.user.id,
 *   email: session.user.email,
 *   role: session.user.role,
 *   name: session.user.name
 * });
 * ```
 */
export function setSentryUser(user: SentryUser | null) {
  if (!user) {
    // Clear user context (e.g., on logout)
    Sentry.setUser(null);
    return;
  }

  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.name,
    // Add custom attributes
    role: user.role,
  });
}

/**
 * Set additional context for Sentry events
 * Useful for tracking specific application states or metadata
 *
 * @param context - Name of the context
 * @param data - Data to attach
 *
 * @example
 * ```ts
 * setSentryContext('delivery', {
 *   deliveryId: '123',
 *   status: 'in_transit',
 *   driverId: 'driver-456'
 * });
 * ```
 */
export function setSentryContext(context: string, data: Record<string, any>) {
  Sentry.setContext(context, data);
}

/**
 * Add a breadcrumb for debugging
 * Breadcrumbs are a trail of events that happened before an error
 *
 * @param message - Description of the event
 * @param data - Additional data
 * @param level - Severity level
 *
 * @example
 * ```ts
 * addSentryBreadcrumb('User started delivery', {
 *   deliveryId: '123',
 *   driverId: 'driver-456'
 * });
 * ```
 */
export function addSentryBreadcrumb(
  message: string,
  data?: Record<string, any>,
  level: 'debug' | 'info' | 'warning' | 'error' = 'info'
) {
  Sentry.addBreadcrumb({
    message,
    level,
    data,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Manually capture an exception
 * Use this for caught exceptions that you still want to track
 *
 * @param error - The error to capture
 * @param context - Additional context
 *
 * @example
 * ```ts
 * try {
 *   await updateDelivery(deliveryId);
 * } catch (error) {
 *   captureException(error, {
 *     deliveryId,
 *     action: 'update_delivery'
 *   });
 *   // Handle error gracefully...
 * }
 * ```
 */
export function captureException(
  error: Error | unknown,
  context?: Record<string, any>
) {
  if (context) {
    Sentry.withScope((scope) => {
      scope.setContext('additional', context);
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}

/**
 * Capture a custom message (not an error)
 * Useful for tracking important events or warnings
 *
 * @param message - The message to capture
 * @param level - Severity level
 * @param context - Additional context
 *
 * @example
 * ```ts
 * captureMessage('GPS accuracy below threshold', 'warning', {
 *   accuracy: gpsData.accuracy,
 *   driverId: driver.id
 * });
 * ```
 */
export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' | 'debug' = 'info',
  context?: Record<string, any>
) {
  if (context) {
    Sentry.withScope((scope) => {
      scope.setContext('additional', context);
      Sentry.captureMessage(message, level);
    });
  } else {
    Sentry.captureMessage(message, level);
  }
}

/**
 * Start a performance transaction
 * Use this to track performance of specific operations
 *
 * @param name - Name of the operation
 * @param op - Operation type (e.g., 'http.server', 'db.query')
 * @returns Transaction object (call .finish() when done)
 *
 * @example
 * ```ts
 * const transaction = startTransaction('calculate_mileage', 'db.query');
 * try {
 *   await calculateMileage(shiftId);
 * } finally {
 *   transaction?.finish();
 * }
 * ```
 */
export function startTransaction(name: string, op: string) {
  return Sentry.startTransaction({
    name,
    op,
  });
}

/**
 * Add tags for filtering in Sentry
 *
 * @param tags - Key-value pairs to tag
 *
 * @example
 * ```ts
 * setSentryTags({
 *   feature: 'delivery_tracking',
 *   environment: 'production'
 * });
 * ```
 */
export function setSentryTags(tags: Record<string, string>) {
  Sentry.setTags(tags);
}

/**
 * Error boundary fallback handler
 * Use this in React Error Boundaries to capture and display errors
 */
export function logErrorToSentry(error: Error, errorInfo: any) {
  Sentry.withScope((scope) => {
    scope.setContext('errorInfo', errorInfo);
    Sentry.captureException(error);
  });
}
