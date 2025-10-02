// src/lib/error-logging.ts
import { NextRequest } from 'next/server';

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Error categories for better organization
export enum ErrorCategory {
  AUTH = 'auth',
  DATABASE = 'database',
  API = 'api',
  VALIDATION = 'validation',
  NETWORK = 'network',
  FILE_UPLOAD = 'file_upload',
  ORDER_PROCESSING = 'order_processing',
  PAYMENT = 'payment',
  INTEGRATION = 'integration',
  UNKNOWN = 'unknown'
}

// Enhanced error context interface for comprehensive error collection
export interface ErrorContext {
  // User context
  user?: {
    id: string;
    email: string;
    role: string;
    isAuthenticated: boolean;
    lastLogin?: string;
  };

  // Session context
  session?: {
    id: string;
    timestamp: number;
    duration: number;
    pageViews: number;
  };

  // Route context
  route?: {
    path: string;
    params: Record<string, any>;
    query: Record<string, any>;
    referrer?: string;
  };

  // Component context
  component?: {
    name: string;
    props?: Record<string, any>;
    state?: Record<string, any>;
    hierarchy: string[]; // Component tree path
  };

  // Browser context
  browser?: {
    userAgent: string;
    viewport: { width: number; height: number };
    screen: { width: number; height: number };
    language: string;
    timezone: string;
    cookiesEnabled: boolean;
    onlineStatus: boolean;
  };

  // Request context (for API errors)
  request?: {
    endpoint?: string;
    method?: string;
    statusCode?: number;
    responseTime?: number;
    requestData?: Record<string, any>;
    headers?: Record<string, string>;
  };

  // Application context
  app?: {
    version: string;
    environment: string;
    buildId?: string;
    featureFlags?: Record<string, boolean>;
  };

  // Error boundary context
  errorBoundary?: {
    name: string;
    level: 'global' | 'section' | 'component';
    parent?: string;
    retryCount?: number;
  };

  // Additional custom context
  custom?: Record<string, any>;

  // Request-level properties (extracted from request info)
  endpoint?: string;
  method?: string;
  ip?: string;
  userAgent?: string;
  origin?: string;
  referer?: string;

  // Timestamp
  timestamp: string;
}

// Structured error interface
export interface StructuredError {
  id: string;
  timestamp: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  message: string;
  error: Error | unknown;
  context: ErrorContext;
  tags: string[];
  fingerprint: string; // For error grouping
}

// Error metrics tracking
interface ErrorMetrics {
  totalErrors: number;
  errorsBySeverity: Record<ErrorSeverity, number>;
  errorsByCategory: Record<ErrorCategory, number>;
  recentErrors: StructuredError[];
  topErrors: Array<{ fingerprint: string; count: number; lastSeen: string }>;
}


// In-memory error storage (would be replaced with database/external service in production)
class ErrorStore {
  private errors: StructuredError[] = [];
  private readonly maxErrors = 1000; // Keep last 1000 errors in memory
  private errorCounts: Map<string, number> = new Map();

  add(error: StructuredError): void {
    this.errors.unshift(error);
    
    // Keep only the most recent errors
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(0, this.maxErrors);
    }

    // Update error counts for tracking
    const currentCount = this.errorCounts.get(error.fingerprint) || 0;
    this.errorCounts.set(error.fingerprint, currentCount + 1);
  }

  getMetrics(): ErrorMetrics {
    const now = new Date();
    const oneHour = 60 * 60 * 1000;
    const recentErrors = this.errors.filter(
      error => now.getTime() - new Date(error.timestamp).getTime() < oneHour
    );

    return {
      totalErrors: this.errors.length,
      errorsBySeverity: this.countBySeverity(),
      errorsByCategory: this.countByCategory(),
      recentErrors: recentErrors.slice(0, 10),
      topErrors: this.getTopErrors()
    };
  }

  private countBySeverity(): Record<ErrorSeverity, number> {
    return this.errors.reduce((acc, error) => {
      acc[error.severity] = (acc[error.severity] || 0) + 1;
      return acc;
    }, {} as Record<ErrorSeverity, number>);
  }

  private countByCategory(): Record<ErrorCategory, number> {
    return this.errors.reduce((acc, error) => {
      acc[error.category] = (acc[error.category] || 0) + 1;
      return acc;
    }, {} as Record<ErrorCategory, number>);
  }

  private getTopErrors(): Array<{ fingerprint: string; count: number; lastSeen: string }> {
    return Array.from(this.errorCounts.entries())
      .map(([fingerprint, count]) => {
        const lastError = this.errors.find(e => e.fingerprint === fingerprint);
        return {
          fingerprint,
          count,
          lastSeen: lastError?.timestamp || new Date().toISOString()
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  getRecentErrors(limit: number = 50): StructuredError[] {
    return this.errors.slice(0, limit);
  }

  getErrorsByCategory(category: ErrorCategory): StructuredError[] {
    return this.errors.filter(error => error.category === category);
  }

  getErrorsBySeverity(severity: ErrorSeverity): StructuredError[] {
    return this.errors.filter(error => error.severity === severity);
  }
}

// Global error store instance
const errorStore = new ErrorStore();

/**
 * Generate a unique fingerprint for error grouping
 */
function generateFingerprint(error: Error | unknown, context: any): string {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const source = context.source || 'unknown';
  const endpoint = context.endpoint || 'unknown';
  
  // Create a simple hash-like string for grouping similar errors
  const fingerprint = `${source}-${endpoint}-${errorMessage.substring(0, 100)}`;
  return Buffer.from(fingerprint).toString('base64').substring(0, 16);
}

/**
 * Determine error severity based on error type and context
 */
function determineSeverity(error: Error | unknown, context: any): ErrorSeverity {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const statusCode = context.statusCode || 500;

  // Critical errors
  if (statusCode >= 500 || 
      errorMessage.includes('database') ||
      errorMessage.includes('payment') ||
      context.category === ErrorCategory.AUTH) {
    return ErrorSeverity.CRITICAL;
  }

  // High severity errors
  if (statusCode >= 400 ||
      errorMessage.includes('validation') ||
      errorMessage.includes('unauthorized')) {
    return ErrorSeverity.HIGH;
  }

  // Medium severity errors
  if (context.category === ErrorCategory.FILE_UPLOAD ||
      context.category === ErrorCategory.INTEGRATION) {
    return ErrorSeverity.MEDIUM;
  }

  return ErrorSeverity.LOW;
}

/**
 * Determine error category based on error type and context
 */
function determineCategory(error: Error | unknown, context: any): ErrorCategory {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const source = context.source || '';
  const endpoint = context.endpoint || '';

  if (source.includes('auth') || errorMessage.includes('unauthorized') || errorMessage.includes('authentication')) {
    return ErrorCategory.AUTH;
  }

  if (errorMessage.includes('database') || errorMessage.includes('prisma') || errorMessage.includes('connection')) {
    return ErrorCategory.DATABASE;
  }

  if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
    return ErrorCategory.VALIDATION;
  }

  if (source.includes('upload') || errorMessage.includes('file')) {
    return ErrorCategory.FILE_UPLOAD;
  }

  if (source.includes('order') || endpoint.includes('order')) {
    return ErrorCategory.ORDER_PROCESSING;
  }

  if (errorMessage.includes('payment') || errorMessage.includes('stripe')) {
    return ErrorCategory.PAYMENT;
  }

  if (source.includes('api') || endpoint.includes('api')) {
    return ErrorCategory.API;
  }

  return ErrorCategory.UNKNOWN;
}

/**
 * Extract request information safely
 */
function extractRequestInfo(request?: NextRequest): Record<string, any> {
  if (!request) return {};

  try {
    const url = new URL(request.url);
    return {
      endpoint: url.pathname,
      method: request.method,
      userAgent: request.headers.get('user-agent')?.substring(0, 200),
      ip: request.headers.get('x-forwarded-for')?.split(',')[0] || 
          request.headers.get('x-real-ip') || 
          'unknown',
      origin: request.headers.get('origin'),
      referer: request.headers.get('referer')
    };
  } catch (err) {
    return { endpoint: 'unknown', method: 'unknown' };
  }
}

/**
 * Sanitize sensitive data from context
 */
function sanitizeContext(context: any): any {
  if (!context || typeof context !== 'object') return context;

  const sensitiveKeys = ['password', 'token', 'key', 'secret', 'authorization', 'cookie'];
  const sanitized = { ...context };

  function sanitizeObject(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        result[key] = '[REDACTED]';
      } else if (typeof value === 'object') {
        result[key] = sanitizeObject(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  return sanitizeObject(sanitized);
}

/**
 * Main error logging function
 */
export function logError(
  error: Error | unknown,
  context: {
    source: string;
    message?: string;
    category?: ErrorCategory;
    severity?: ErrorSeverity;
    endpoint?: string;
    method?: string;
    userId?: string;
    sessionId?: string;
    statusCode?: number;
    requestData?: any;
    responseTime?: number;
    additionalContext?: Record<string, any>;
  },
  request?: NextRequest
): StructuredError {
  const timestamp = new Date().toISOString();
  const errorId = `error_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  
  // Extract request information
  const requestInfo = extractRequestInfo(request);

  // Build context
  const fullContext = {
    ...requestInfo,
    ...context,
    stackTrace: error instanceof Error ? error.stack : undefined,
    additionalContext: sanitizeContext(context.additionalContext),
    timestamp: new Date().toISOString()
  };

  // Determine error properties
  const category = context.category || determineCategory(error, fullContext);
  const severity = context.severity || determineSeverity(error, fullContext);
  const fingerprint = generateFingerprint(error, fullContext);

  // Create structured error
  const structuredError: StructuredError = {
    id: errorId,
    timestamp,
    severity,
    category,
    message: context.message || (error instanceof Error ? error.message : String(error)),
    error,
    context: fullContext,
    tags: [category, severity, fullContext.source],
    fingerprint
  };

  // Store error
  errorStore.add(structuredError);

  // Log to console with appropriate level
  const logLevel = severity === ErrorSeverity.CRITICAL || severity === ErrorSeverity.HIGH ? 'error' : 'warn';
  const consoleMethod = console[logLevel];
  
  consoleMethod(`[${severity.toUpperCase()}] [${category.toUpperCase()}] ${structuredError.message}`, {
    errorId,
    fingerprint,
    context: sanitizeContext(fullContext),
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : error
  });

  // Integrate with alerting system for critical errors
  if (typeof window === 'undefined') { // Server-side only
    try {
      const { monitorErrorPatterns } = require('./alerting');
      monitorErrorPatterns(structuredError);
    } catch (alertError) {
      // Fail silently if alerting is not available
      console.warn('Alerting system not available:', alertError);
    }
  }


  return structuredError;
}

/**
 * Quick error logging function for common use cases
 */
export function logApiError(
  error: Error | unknown,
  endpoint: string,
  method: string = 'UNKNOWN',
  additionalContext: Record<string, any> = {},
  request?: NextRequest
): StructuredError {
  return logError(error, {
    source: 'api',
    category: ErrorCategory.API,
    endpoint,
    method,
    ...additionalContext
  }, request);
}

/**
 * Error logging for database operations
 */
export function logDatabaseError(
  error: Error | unknown,
  operation: string,
  additionalContext: Record<string, any> = {}
): StructuredError {
  return logError(error, {
    source: 'database',
    category: ErrorCategory.DATABASE,
    message: `Database operation failed: ${operation}`,
    ...additionalContext
  });
}

/**
 * Error logging for authentication operations
 */
export function logAuthError(
  error: Error | unknown,
  operation: string,
  userId?: string,
  request?: NextRequest
): StructuredError {
  return logError(error, {
    source: 'auth',
    category: ErrorCategory.AUTH,
    message: `Authentication operation failed: ${operation}`,
    userId,
    severity: ErrorSeverity.CRITICAL
  }, request);
}

/**
 * Get error metrics and statistics
 */
export function getErrorMetrics(): ErrorMetrics {
  return errorStore.getMetrics();
}

/**
 * Get recent errors
 */
export function getRecentErrors(limit: number = 50): StructuredError[] {
  return errorStore.getRecentErrors(limit);
}

/**
 * Get errors by category
 */
export function getErrorsByCategory(category: ErrorCategory): StructuredError[] {
  return errorStore.getErrorsByCategory(category);
}

/**
 * Get errors by severity
 */
export function getErrorsBySeverity(severity: ErrorSeverity): StructuredError[] {
  return errorStore.getErrorsBySeverity(severity);
}

/**
 * Collect comprehensive error context from browser and application state
 */
export function collectErrorContext(additionalContext: Record<string, any> = {}): ErrorContext {
  const timestamp = new Date().toISOString();

  // Collect browser context
  const browserContext = typeof window !== 'undefined' ? {
    userAgent: navigator.userAgent,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    },
    screen: {
      width: window.screen.width,
      height: window.screen.height
    },
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    cookiesEnabled: navigator.cookieEnabled,
    onlineStatus: navigator.onLine
  } : undefined;

  // Collect route context (Next.js router)
  const routeContext = typeof window !== 'undefined' ? {
    path: window.location.pathname,
    params: {},
    query: Object.fromEntries(new URLSearchParams(window.location.search)),
    referrer: document.referrer || undefined
  } : undefined;

  // Collect user context (from localStorage or context)
  const userContext = typeof window !== 'undefined' ? (() => {
    try {
      const userData = localStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        return {
          id: user.id || 'unknown',
          email: user.email || 'unknown',
          role: user.role || 'unknown',
          isAuthenticated: !!user.id,
          lastLogin: user.lastLogin || undefined
        };
      }
      return {
        id: 'anonymous',
        email: 'anonymous',
        role: 'guest',
        isAuthenticated: false
      };
    } catch {
      return {
        id: 'unknown',
        email: 'unknown',
        role: 'unknown',
        isAuthenticated: false
      };
    }
  })() : undefined;

  // Collect session context
  const sessionContext = typeof window !== 'undefined' ? (() => {
    try {
      const sessionData = sessionStorage.getItem('session');
      if (sessionData) {
        const session = JSON.parse(sessionData);
        return {
          id: session.id || 'unknown',
          timestamp: session.timestamp || Date.now(),
          duration: session.duration || 0,
          pageViews: session.pageViews || 1
        };
      }
      return {
        id: `session_${Date.now()}`,
        timestamp: Date.now(),
        duration: 0,
        pageViews: 1
      };
    } catch {
      return {
        id: `session_${Date.now()}`,
        timestamp: Date.now(),
        duration: 0,
        pageViews: 1
      };
    }
  })() : undefined;

  // Collect application context
  const appContext = {
    version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    buildId: process.env.NEXT_PUBLIC_BUILD_ID || undefined
  };

  return {
    user: userContext,
    session: sessionContext,
    route: routeContext,
    browser: browserContext,
    app: appContext,
    timestamp,
    custom: additionalContext
  };
}

/**
 * Enhanced error boundary helper for React components with comprehensive context collection
 */
export function createErrorBoundaryLogger(componentName: string, level: 'global' | 'section' | 'component' = 'component') {
  return (error: Error, errorInfo: any, additionalContext: Record<string, any> = {}) => {
    const errorContext = collectErrorContext({
      component: {
        name: componentName,
        hierarchy: errorInfo?.componentStack ? parseComponentStack(errorInfo.componentStack) : [componentName],
        ...additionalContext
      },
      errorBoundary: {
        name: componentName,
        level,
        retryCount: additionalContext.retryCount || 0
      }
    });

    logError(error, {
      source: 'react',
      category: determineReactErrorCategory(error, errorInfo),
      message: `React ${level} error in ${componentName}`,
      ...errorContext
    });
  };
}

/**
 * Parse React component stack to extract component hierarchy
 */
function parseComponentStack(componentStack: string): string[] {
  if (!componentStack) return [];

  return componentStack
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.includes('in ') || line.includes('at '))
    .map(line => {
      // Extract component name from stack trace line
      const match = line.match(/(?:in|at)\s+([^(]+)/);
      return match?.[1]?.trim() || line.trim();
    })
    .filter(name => name && name !== 'ErrorBoundary');
}

/**
 * Determine React-specific error category based on error and component stack
 */
function determineReactErrorCategory(error: Error, errorInfo: any): ErrorCategory {
  const errorMessage = error.message.toLowerCase();
  const componentStack = errorInfo?.componentStack?.toLowerCase() || '';

  // Auth-related errors
  if (errorMessage.includes('auth') || componentStack.includes('auth')) {
    return ErrorCategory.AUTH;
  }

  // Network/API errors
  if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('api')) {
    return ErrorCategory.API;
  }

  // Form/validation errors
  if (errorMessage.includes('validation') || errorMessage.includes('invalid') || errorMessage.includes('form')) {
    return ErrorCategory.VALIDATION;
  }

  // State/context errors
  if (errorMessage.includes('context') || errorMessage.includes('state') || errorMessage.includes('redux')) {
    return ErrorCategory.UNKNOWN; // Could be enhanced to have a STATE category
  }

  // Component lifecycle errors
  if (errorMessage.includes('component') || errorMessage.includes('lifecycle') || errorMessage.includes('render')) {
    return ErrorCategory.UNKNOWN; // Could be enhanced to have a RENDER category
  }

  return ErrorCategory.UNKNOWN;
}

/**
 * Create a React Error Boundary hook for functional components
 */
export function useErrorBoundary() {
  return (error: Error, errorInfo?: { componentStack?: string }) => {
    // This would be used with a custom hook that throws errors to be caught by boundaries
    const enhancedError = new Error(`Component error: ${error.message}`);
    enhancedError.stack = `${enhancedError.stack}\nComponent Stack: ${errorInfo?.componentStack || 'Not available'}`;
    throw enhancedError;
  };
} 