/**
 * Realtime Logging Utility
 *
 * Structured logging for Realtime operations with environment-aware behavior:
 * - Development: Verbose console output for debugging
 * - Production: Minimal console output, error reporting to Sentry
 *
 * Benefits:
 * - Consistent log format across Realtime codebase
 * - Integration with Sentry for error tracking
 * - Environment-aware verbosity
 * - Structured data for log aggregation
 * - Performance optimized (no-op in production for debug logs)
 */

import * as Sentry from '@sentry/nextjs';

/**
 * Log levels (ordered by severity)
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * Context data for structured logging
 */
export interface LogContext {
  driverId?: string;
  channelName?: string;
  eventType?: string;
  connectionState?: string;
  error?: Error | unknown;
  metadata?: Record<string, unknown>;
}

/**
 * Configuration for Realtime logger
 */
const LOGGER_CONFIG = {
  /** Prefix for all log messages */
  PREFIX: '[Realtime]',

  /** Enable verbose logging in development */
  VERBOSE_DEV: process.env.NODE_ENV === 'development',

  /** Enable Sentry reporting in production */
  SENTRY_ENABLED: process.env.NODE_ENV === 'production',
} as const;

/**
 * Format log message with context
 */
function formatMessage(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` ${JSON.stringify(context)}` : '';
  return `${LOGGER_CONFIG.PREFIX} [${level.toUpperCase()}] ${timestamp} ${message}${contextStr}`;
}

/**
 * Send error to Sentry with context
 */
function reportToSentry(message: string, context?: LogContext): void {
  if (!LOGGER_CONFIG.SENTRY_ENABLED) {
    return;
  }

  const error = context?.error instanceof Error ? context.error : new Error(message);

  Sentry.captureException(error, {
    level: 'error',
    tags: {
      component: 'realtime',
      channelName: context?.channelName,
      eventType: context?.eventType,
    },
    extra: {
      driverId: context?.driverId,
      connectionState: context?.connectionState,
      metadata: context?.metadata,
    },
  });
}

/**
 * Realtime Logger Class
 */
class RealtimeLogger {
  /**
   * Log debug message (development only)
   * No-op in production for performance
   */
  debug(message: string, context?: LogContext): void {
    if (!LOGGER_CONFIG.VERBOSE_DEV) {
      return; // No-op in production
    }

    console.log(formatMessage(LogLevel.DEBUG, message, context));
  }

  /**
   * Log info message
   * Verbose in development, minimal in production
   */
  info(message: string, context?: LogContext): void {
    if (LOGGER_CONFIG.VERBOSE_DEV) {
      console.log(formatMessage(LogLevel.INFO, message, context));
    } else {
      // Minimal output in production
      console.log(`${LOGGER_CONFIG.PREFIX} ${message}`);
    }
  }

  /**
   * Log warning message
   * Always logged, with context in development
   */
  warn(message: string, context?: LogContext): void {
    if (LOGGER_CONFIG.VERBOSE_DEV) {
      console.warn(formatMessage(LogLevel.WARN, message, context));
    } else {
      console.warn(`${LOGGER_CONFIG.PREFIX} ${message}`);
    }

    // Add breadcrumb for Sentry
    if (LOGGER_CONFIG.SENTRY_ENABLED) {
      Sentry.addBreadcrumb({
        category: 'realtime',
        message,
        level: 'warning',
        data: context,
      });
    }
  }

  /**
   * Log error message
   * Always logged and reported to Sentry in production
   */
  error(message: string, context?: LogContext): void {
    if (LOGGER_CONFIG.VERBOSE_DEV) {
      console.error(formatMessage(LogLevel.ERROR, message, context));
    } else {
      console.error(`${LOGGER_CONFIG.PREFIX} ${message}`);
    }

    // Report to Sentry in production
    reportToSentry(message, context);
  }

  /**
   * Log connection state change
   * Special logging for connection lifecycle events
   */
  connection(state: string, channelName: string, metadata?: Record<string, unknown>): void {
    this.info(`Connection state: ${state}`, {
      channelName,
      connectionState: state,
      metadata,
    });
  }

  /**
   * Log broadcast event
   * Special logging for message broadcasting
   */
  broadcast(eventType: string, channelName: string, metadata?: Record<string, unknown>): void {
    this.debug(`Broadcast: ${eventType}`, {
      channelName,
      eventType,
      metadata,
    });
  }

  /**
   * Log subscription event
   * Special logging for channel subscriptions
   */
  subscription(action: 'subscribe' | 'unsubscribe', channelName: string): void {
    this.info(`Channel ${action}: ${channelName}`, {
      channelName,
      eventType: action,
    });
  }

  /**
   * Log rate limit violation
   * Special logging for rate limiting events
   */
  rateLimit(driverId: string, retryAfter: number): void {
    this.warn(`Rate limit exceeded for driver ${driverId}`, {
      driverId,
      metadata: {
        retryAfterMs: retryAfter,
        retryAfterSec: Math.ceil(retryAfter / 1000),
      },
    });
  }

  /**
   * Log cache operation
   * Special logging for cache hits/misses
   */
  cache(operation: 'hit' | 'miss' | 'set' | 'invalidate', key: string): void {
    this.debug(`Cache ${operation}: ${key}`, {
      metadata: { cacheOperation: operation, cacheKey: key },
    });
  }
}

// Export singleton instance
export const realtimeLogger = new RealtimeLogger();

// Export convenience functions
export const {
  debug,
  info,
  warn,
  error,
  connection,
  broadcast,
  subscription,
  rateLimit,
  cache,
} = realtimeLogger;
