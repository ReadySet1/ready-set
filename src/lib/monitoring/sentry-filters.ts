/**
 * Sentry Error Filtering Utilities
 *
 * This module provides shared filtering logic for Sentry error capture
 * across client, server, and edge runtimes.
 */

import type { ErrorEvent, EventHint } from '@sentry/nextjs';

/**
 * Custom filter function type
 */
export type CustomFilter = (event: ErrorEvent, hint: EventHint) => boolean;

/**
 * Options for creating beforeSend handler
 */
export interface BeforeSendOptions {
  /**
   * Additional custom filters to apply
   * Return false to drop the event, true to keep it
   */
  customFilters?: CustomFilter[];

  /**
   * Enable client-specific filters (browser extensions, ResizeObserver, etc.)
   */
  includeClientFilters?: boolean;

  /**
   * Enable server-specific filters (Prisma errors, connection errors, etc.)
   */
  includeServerFilters?: boolean;

  /**
   * Enable edge-specific filters (Next.js redirects, etc.)
   */
  includeEdgeFilters?: boolean;
}

/**
 * Check if error is from browser extensions
 */
function isExtensionError(event: ErrorEvent): boolean {
  const errorValue = event.exception?.values?.[0]?.value || '';
  const errorType = event.exception?.values?.[0]?.type || '';

  return (
    errorValue.includes('chrome-extension://') ||
    errorValue.includes('moz-extension://') ||
    errorType.includes('chrome-extension://') ||
    errorType.includes('moz-extension://')
  );
}

/**
 * Check if error is ResizeObserver (common browser noise)
 */
function isResizeObserverError(event: ErrorEvent): boolean {
  return event.exception?.values?.[0]?.value?.includes('ResizeObserver') ?? false;
}

/**
 * Check if error is a network error from client connectivity issues
 * (not API failures, which we want to track)
 */
function isNetworkError(event: ErrorEvent): boolean {
  const errorValue = event.exception?.values?.[0]?.value || '';

  // Only filter out network errors if they're NOT from our API
  if (errorValue.includes('NetworkError') || errorValue.includes('Failed to fetch')) {
    const url = event.request?.url;

    // If it's an API call or internal request, DON'T filter it out
    // We want to track API failures
    if (url) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL;
      const isApiCall = url.includes('/api/') || (appUrl && url.includes(appUrl));
      if (isApiCall) {
        return false; // Don't filter - we want to capture API errors
      }
    }

    // Filter out external network errors (likely client connectivity issues)
    return true;
  }

  return false;
}

/**
 * Check if error is a non-Error rejection (often from third-party libraries)
 */
function isNonErrorRejection(hint: EventHint): boolean {
  return hint.originalException !== null &&
         hint.originalException !== undefined &&
         typeof hint.originalException !== 'object';
}

/**
 * Check if error is a React Server Components streaming connection error
 * These occur when users navigate away or close browser during page load
 * Fixes: READY-SET-NEXTJS-1
 */
function isRSCConnectionError(event: ErrorEvent): boolean {
  const errorValue = event.exception?.values?.[0]?.value || '';

  // Filter "Connection closed" errors from react-server-dom-webpack
  // These are benign - typically caused by users navigating away
  return errorValue === 'Connection closed.' ||
         errorValue.includes('Connection closed');
}

/**
 * Check if error is a handled Supabase Realtime connection error
 * These are transient WebSocket issues that are already handled by the realtime client
 * Fixes: READY-SET-NEXTJS-6, READY-SET-NEXTJS-7, READY-SET-NEXTJS-8
 */
function isHandledRealtimeError(event: ErrorEvent): boolean {
  const errorType = event.exception?.values?.[0]?.type || '';
  const errorValue = event.exception?.values?.[0]?.value || '';

  // Check if it's a RealtimeConnectionError or RealtimeError
  const isRealtimeError =
    errorType === 'RealtimeConnectionError' ||
    errorType === 'RealtimeError' ||
    errorValue.includes('Channel subscription timed out') ||
    errorValue.includes('Failed to subscribe to channel');

  // Only filter if it's marked as handled
  const isHandled = event.tags?.handled === 'yes' || event.tags?.handled === true;

  return isRealtimeError && isHandled;
}

/**
 * Apply client-specific filters
 */
function applyClientFilters(event: ErrorEvent, hint: EventHint): boolean {
  // Filter out browser extension errors
  if (isExtensionError(event)) {
    return false;
  }

  // Filter out ResizeObserver errors
  if (isResizeObserverError(event)) {
    return false;
  }

  // Filter out network errors
  if (isNetworkError(event)) {
    return false;
  }

  // Filter out non-Error rejections
  if (isNonErrorRejection(hint)) {
    return false;
  }

  // Filter out RSC streaming connection errors (READY-SET-NEXTJS-1)
  if (isRSCConnectionError(event)) {
    return false;
  }

  // Filter out handled Realtime connection errors (READY-SET-NEXTJS-6/7/8)
  if (isHandledRealtimeError(event)) {
    return false;
  }

  return true;
}

/**
 * Apply server-specific filters
 */
function applyServerFilters(event: ErrorEvent): boolean {
  const errorValue = event.exception?.values?.[0]?.value || '';

  // Downgrade Prisma errors to warnings instead of filtering them out
  // This captures them without triggering error alerts
  if (errorValue.includes('P2002') || errorValue.includes('P2025')) {
    // Check if the error was marked as handled via tags
    const isHandled =
      event.tags?.handled === 'true' ||
      event.tags?.handled === true ||
      (event.contexts?.['metadata'] as Record<string, unknown> | undefined)?.handled === true;

    if (isHandled) {
      // Downgrade to warning level for handled errors
      event.level = 'warning';
    } else {
      // Keep as error for unhandled cases - might indicate a bug
      // These could reveal race conditions, data integrity issues, or
      // broken foreign key relationships
    }
  }

  return true;
}

/**
 * Apply edge-specific filters
 */
function applyEdgeFilters(event: ErrorEvent): boolean {
  const errorValue = event.exception?.values?.[0]?.value || '';

  // Filter out Next.js redirects (normal flow, not errors)
  if (errorValue.includes('NEXT_REDIRECT')) {
    return false;
  }

  return true;
}

/**
 * Create a beforeSend handler with specified filters
 *
 * @param options - Configuration options for filtering
 * @returns beforeSend handler function
 *
 * @example
 * ```ts
 * // For client config
 * beforeSend: createBeforeSend({
 *   includeClientFilters: true,
 *   customFilters: [(event, hint) => {
 *     // Custom filtering logic
 *     return !event.message?.includes('ignore-this');
 *   }]
 * })
 * ```
 */
export function createBeforeSend(options: BeforeSendOptions = {}) {
  return (event: ErrorEvent, hint: EventHint): ErrorEvent | null => {
    // Apply runtime-specific filters
    if (options.includeClientFilters && !applyClientFilters(event, hint)) {
      return null;
    }

    if (options.includeServerFilters && !applyServerFilters(event)) {
      return null;
    }

    if (options.includeEdgeFilters && !applyEdgeFilters(event)) {
      return null;
    }

    // Apply custom filters
    if (options.customFilters) {
      for (const filter of options.customFilters) {
        if (!filter(event, hint)) {
          return null;
        }
      }
    }

    return event;
  };
}

/**
 * List of errors to ignore (used with ignoreErrors config)
 */
export const CLIENT_IGNORE_ERRORS = [
  // Browser extensions
  'top.GLOBALS',
  'chrome-extension://',
  'moz-extension://',
  // Random plugins/extensions
  'Can\'t find variable: ZiteReader',
  'jigsaw is not defined',
  'ComboSearch is not defined',
  // Facebook blocked
  'fb_xd_fragment',
  // ISP optimizing proxy
  'bmi_SafeAddOnload',
  'EBCallBackMessageReceived',
  // Generic error messages that are usually noise
  'Non-Error promise rejection captured',
];

export const SERVER_IGNORE_ERRORS = [
  // Next.js specific errors
  'ECONNRESET',
  'EPIPE',
  'aborted',
];
