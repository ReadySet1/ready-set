/**
 * Centralized Logging Utility
 * Provides consistent, environment-aware logging across the application
 */

import { isDev, isProd, isTest, isBuildTime, isRuntime } from './env-config';

interface LogConfig {
  development: boolean;
  production: boolean;
  test: boolean;
}

interface Logger {
  debug: (message: string, data?: any) => void;
  info: (message: string, data?: any) => void;
  warn: (message: string, data?: any) => void;
  error: (message: string, data?: any) => void;
}

/**
 * Creates a logger instance for a specific category
 * @param category - The category/component name for the logger
 * @param config - Configuration for which environments should log
 * @returns Logger instance with categorized logging methods
 */
const createLogger = (category: string, config: LogConfig): Logger => {
  const shouldLog = config[process.env.NODE_ENV as keyof LogConfig];
  
  return {
    debug: (message: string, data?: any) => {
      if (shouldLog) {
        console.debug(`[${category}]`, message, data);
      }
    },
    info: (message: string, data?: any) => {
      if (shouldLog) {
        console.info(`[${category}]`, message, data);
      }
    },
    warn: (message: string, data?: any) => {
      // Warnings should always be shown in all environments
      console.warn(`[${category}]`, message, data);
    },
    error: (message: string, data?: any) => {
      // Errors should always be shown in all environments
      console.error(`[${category}]`, message, data);
    },
  };
};

/**
 * Pre-configured logger instances for common categories
 */
export const loggers = {
  // Database/Prisma logging - only in development and test
  prisma: createLogger('PRISMA', {
    development: true,
    production: false,
    test: true,
  }),
  
  // Authentication logging - only in development
  auth: createLogger('AUTH', {
    development: true,
    production: false,
    test: false,
  }),
  
  // User context logging - only in development
  userContext: createLogger('USER_CONTEXT', {
    development: true,
    production: false,
    test: false,
  }),
  
  // Header component logging - only in development
  header: createLogger('HEADER', {
    development: true,
    production: false,
    test: false,
  }),
  
  // Real-time tracking logging - only in development
  tracking: createLogger('TRACKING', {
    development: true,
    production: false,
    test: true,
  }),
  
  // Service worker logging - only in development
  serviceWorker: createLogger('SERVICE_WORKER', {
    development: true,
    production: false,
    test: false,
  }),
  
  // General application logging - always enabled
  app: createLogger('APP', {
    development: true,
    production: true,
    test: true,
  }),
};

/**
 * Environment-based debug logging utility
 * Provides a simple way to create conditional debug logs
 */
export const debugLog = isDev ? console.log : () => {};

/**
 * Performance logging utility
 * Only logs in development for performance monitoring
 */
export const perfLog = isDev 
  ? (label: string, fn: () => void) => {
      console.time(label);
      fn();
      console.timeEnd(label);
    }
  : (label: string, fn: () => void) => fn();

// Export the main createLogger function for custom loggers
export { createLogger };
export type { Logger, LogConfig };
