/**
 * Environment-Based Configuration Utility
 * Provides centralized environment detection and build-time vs runtime separation
 */

// Environment detection
export const isDev = process.env.NODE_ENV === 'development';
export const isProd = process.env.NODE_ENV === 'production';
export const isTest = process.env.NODE_ENV === 'test';

// Build-time vs Runtime separation
export const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build';
export const isRuntime = !isBuildTime;

// Production Build Optimization utilities
export const debugLog = isDev ? console.log : () => {};
export const debugWarn = isDev ? console.warn : () => {};
export const debugInfo = isDev ? console.info : () => {};

// Performance logging utility
export const perfLog = isDev 
  ? (label: string, fn: () => void) => {
      console.time(label);
      fn();
      console.timeEnd(label);
    }
  : (label: string, fn: () => void) => fn();

// Conditional execution utilities
export const devOnly = <T>(fn: () => T): T | void => {
  if (isDev) {
    return fn();
  }
};

export const prodOnly = <T>(fn: () => T): T | void => {
  if (isProd) {
    return fn();
  }
};

export const testOnly = <T>(fn: () => T): T | void => {
  if (isTest) {
    return fn();
  }
};

// Build-time specific utilities
export const buildTimeOnly = <T>(fn: () => T): T | void => {
  if (isBuildTime) {
    return fn();
  }
};

export const runtimeOnly = <T>(fn: () => T): T | void => {
  if (isRuntime) {
    return fn();
  }
};

// Environment-specific feature flags
export const features = {
  // Logging features
  enableVerboseLogging: isDev,
  enablePerformanceLogging: isDev,
  enableDebugLogging: isDev,
  
  // Development features
  enableHotReload: isDev,
  enableSourceMaps: isDev,
  enableDevTools: isDev,
  
  // Production optimizations
  enableMinification: isProd,
  enableTreeShaking: isProd,
  enableCodeSplitting: isProd,
  
  // Testing features
  enableTestLogging: isTest,
  enableMockData: isTest,
};

// Environment-specific configuration
export const config = {
  // Database configuration
  database: {
    enableQueryLogging: isDev,
    enableConnectionLogging: isDev,
    enableHealthChecks: isProd || isDev,
  },
  
  // Authentication configuration
  auth: {
    enableDebugLogging: isDev,
    enableSessionLogging: isDev,
    enableErrorLogging: true, // Always enabled
  },
  
  // Component configuration
  components: {
    enableMountLogging: isDev,
    enableStateLogging: isDev,
    enableRenderLogging: isDev,
  },
  
  // API configuration
  api: {
    enableRequestLogging: isDev,
    enableResponseLogging: isDev,
    enableErrorLogging: true, // Always enabled
  },
  
  // Real-time features
  realtime: {
    enableConnectionLogging: isDev,
    enableEventLogging: isDev,
    enableErrorLogging: true, // Always enabled
  },
};

// Utility functions for conditional logging
export const conditionalLog = {
  // Only log in development
  dev: (message: string, data?: any) => {
    if (isDev) {
      console.log(`[DEV] ${message}`, data);
    }
  },
  
  // Only log in production (for critical issues)
  prod: (message: string, data?: any) => {
    if (isProd) {
      console.log(`[PROD] ${message}`, data);
    }
  },
  
  // Only log in test environment
  test: (message: string, data?: any) => {
    if (isTest) {
      console.log(`[TEST] ${message}`, data);
    }
  },
  
  // Always log (for errors and warnings)
  always: (message: string, data?: any) => {
    console.log(`[ALWAYS] ${message}`, data);
  },
};

// Build optimization helpers
export const buildOptimizations = {
  // Remove console logs in production builds
  removeConsoleLogs: isProd,
  
  // Enable source map generation
  enableSourceMaps: isDev,
  
  // Enable hot module replacement
  enableHMR: isDev,
  
  // Enable bundle analysis
  enableBundleAnalysis: isDev,
};

// Export environment info for debugging
export const envInfo = {
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PHASE: process.env.NEXT_PHASE,
  isDev,
  isProd,
  isTest,
  isBuildTime,
  isRuntime,
  features,
  config,
};

// Default export for convenience
export default {
  isDev,
  isProd,
  isTest,
  isBuildTime,
  isRuntime,
  debugLog,
  debugWarn,
  debugInfo,
  perfLog,
  devOnly,
  prodOnly,
  testOnly,
  buildTimeOnly,
  runtimeOnly,
  features,
  config,
  conditionalLog,
  buildOptimizations,
  envInfo,
};
