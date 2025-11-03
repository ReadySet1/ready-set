/**
 * Sentry Error Monitoring Utilities
 *
 * This module provides helper functions for integrating Sentry error tracking
 * throughout the application. It handles user context, custom error tracking,
 * and performance monitoring.
 */

import * as Sentry from '@sentry/nextjs';
import type { ErrorContext, SentryUser } from './types';

// Re-export types for convenience
export type { ErrorContext, SentryUser, BreadcrumbLevel, BreadcrumbCategory } from './types';

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
export function setSentryContext(context: string, data: Record<string, unknown>) {
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
  data?: Record<string, unknown>,
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
 * @param context - Additional typed context for better error tracking
 *
 * @example
 * ```ts
 * try {
 *   await updateDelivery(deliveryId);
 * } catch (error) {
 *   captureException(error, {
 *     action: 'update_delivery',
 *     feature: 'deliveries',
 *     metadata: { deliveryId }
 *   });
 *   // Handle error gracefully...
 * }
 * ```
 */
export function captureException(
  error: Error | unknown,
  context?: ErrorContext
) {
  if (context) {
    Sentry.withScope((scope) => {
      // Set tags for better filtering in Sentry
      if (context.action) scope.setTag('action', context.action);
      if (context.feature) scope.setTag('feature', context.feature);
      if (context.handled !== undefined) scope.setTag('handled', context.handled);

      // Set contexts
      if (context.component) {
        scope.setContext('component', {
          name: context.component,
          stack: context.componentStack,
        });
      }

      if (context.request) {
        scope.setContext('request', context.request);
      }

      if (context.metadata) {
        scope.setContext('metadata', context.metadata);
      }

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
  context?: Record<string, unknown>
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
 * Start a performance span
 * Use this to track performance of specific operations
 *
 * @param name - Name of the operation
 * @param op - Operation type (e.g., 'http.server', 'db.query')
 * @param callback - Async function to execute within the span
 * @param attributes - Optional custom attributes for better filtering/grouping
 * @returns Result of the callback function
 *
 * @example
 * ```ts
 * const result = await startSpan(
 *   'calculate_mileage',
 *   'db.query',
 *   async () => {
 *     return await calculateMileage(shiftId);
 *   },
 *   { shiftId: '123', driverId: 'driver-456' }
 * );
 * ```
 */
export async function startSpan<T>(
  name: string,
  op: string,
  callback: () => Promise<T>,
  attributes?: Record<string, unknown>
): Promise<T> {
  return await Sentry.startSpan(
    {
      name,
      op,
      attributes,
    },
    callback
  );
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
export function logErrorToSentry(error: Error, errorInfo: Record<string, unknown>) {
  Sentry.withScope((scope) => {
    scope.setContext('errorInfo', errorInfo);
    Sentry.captureException(error);
  });
}
