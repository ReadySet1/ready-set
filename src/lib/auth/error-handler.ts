// src/lib/auth/error-handler.ts
// Comprehensive error handling and fallback mechanisms for authentication

import { AuthError, AuthErrorType } from '@/types/auth';
import { authLogger } from '@/utils/logger';
import { getSessionManager } from './session-manager';
import { getTokenRefreshService } from './token-refresh-service';

// Error recovery strategies
interface ErrorRecoveryStrategy {
  canRecover: (error: AuthError) => boolean;
  recover: (error: AuthError) => Promise<void>;
  priority: number; // Higher priority = try first
}

// Error reporting interface
interface ErrorReport {
  error: AuthError;
  context: {
    timestamp: string;
    userAgent: string;
    url: string;
    userId?: string;
    sessionId?: string;
  };
  recoveryAttempted: boolean;
  recoverySuccessful: boolean;
}

// Error recovery strategies
const RECOVERY_STRATEGIES: ErrorRecoveryStrategy[] = [
  // Token refresh strategy (highest priority)
  {
    canRecover: (error) => error.type === AuthErrorType.TOKEN_EXPIRED || error.type === AuthErrorType.TOKEN_INVALID,
    recover: async (error) => {
      const tokenRefreshService = getTokenRefreshService();
      await tokenRefreshService.refreshTokenWithRetry();
    },
    priority: 10,
  },

  // Session recovery strategy
  {
    canRecover: (error) => error.type === AuthErrorType.SESSION_EXPIRED || error.type === AuthErrorType.SESSION_INVALID,
    recover: async (error) => {
      const sessionManager = getSessionManager();
      await sessionManager.refreshToken();
    },
    priority: 9,
  },

  // Network retry strategy
  {
    canRecover: (error) => error.type === AuthErrorType.NETWORK_ERROR && error.retryable,
    recover: async (error) => {
      // Wait for network connectivity
      await new Promise(resolve => setTimeout(resolve, 2000));
    },
    priority: 8,
  },

  // Fingerprint mismatch recovery (lowest priority - usually requires user intervention)
  {
    canRecover: (error) => error.type === AuthErrorType.FINGERPRINT_MISMATCH,
    recover: async (error) => {
      // This usually requires user to re-authenticate
      // Clear session and redirect to login
      const sessionManager = getSessionManager();
      await sessionManager.clearSession();

      if (typeof window !== 'undefined') {
        window.location.href = '/sign-in?error=device_changed';
      }
    },
    priority: 1,
  },
];

// Error handler class
export class AuthErrorHandler {
  private recoveryAttempts = new Map<string, number>();
  private maxRecoveryAttempts = 3;
  private errorReports: ErrorReport[] = [];

  // Handle authentication error with automatic recovery
  async handleError(error: AuthError, context?: Record<string, any>): Promise<boolean> {
    authLogger.error('AuthErrorHandler: Handling authentication error', { error, context });

    // Create error report
    const report = this.createErrorReport(error, context);
    this.errorReports.push(report);

    // Check if we've exceeded max recovery attempts for this error type
    const attemptKey = `${error.type}_${context?.userId || 'unknown'}`;
    const attempts = this.recoveryAttempts.get(attemptKey) || 0;

    if (attempts >= this.maxRecoveryAttempts) {
      authLogger.warn('AuthErrorHandler: Max recovery attempts exceeded', { error, attempts });
      this.handleMaxAttemptsExceeded(error, report);
      return false;
    }

    // Try recovery strategies in priority order
    const applicableStrategies = RECOVERY_STRATEGIES
      .filter(strategy => strategy.canRecover(error))
      .sort((a, b) => b.priority - a.priority);

    for (const strategy of applicableStrategies) {
      try {
        authLogger.debug('AuthErrorHandler: Attempting recovery strategy', {
          strategy: strategy.priority,
          error: error.type
        });

        await strategy.recover(error);

        // Recovery successful
        report.recoverySuccessful = true;
        this.recoveryAttempts.set(attemptKey, attempts + 1);

        authLogger.info('AuthErrorHandler: Recovery successful', { error, strategy: strategy.priority });
        return true;

      } catch (recoveryError) {
        authLogger.warn('AuthErrorHandler: Recovery strategy failed', {
          strategy: strategy.priority,
          error: error.type,
          recoveryError
        });

        // Continue to next strategy
        continue;
      }
    }

    // All recovery strategies failed
    report.recoveryAttempted = true;
    authLogger.error('AuthErrorHandler: All recovery strategies failed', { error });

    return false;
  }

  // Handle case where max recovery attempts exceeded
  private handleMaxAttemptsExceeded(error: AuthError, report: ErrorReport): void {
    // Force logout and redirect to login
    const sessionManager = getSessionManager();
    sessionManager.clearSession();

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams({
        error: 'max_recovery_attempts',
        type: error.type,
      });

      window.location.replace(`/sign-in?${params.toString()}`);
    }
  }

  // Create error report for monitoring
  private createErrorReport(error: AuthError, context?: Record<string, any>): ErrorReport {
    return {
      error,
      context: {
        timestamp: new Date().toISOString(),
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
        url: typeof window !== 'undefined' ? window.location.href : 'server',
        userId: context?.userId,
        sessionId: context?.sessionId,
      },
      recoveryAttempted: false,
      recoverySuccessful: false,
    };
  }

  // Get error statistics for monitoring
  getErrorStatistics(): {
    totalErrors: number;
    errorsByType: Record<AuthErrorType, number>;
    recoverySuccessRate: number;
    recentErrors: ErrorReport[];
  } {
    const errorsByType = this.errorReports.reduce((acc, report) => {
      acc[report.error.type] = (acc[report.error.type] || 0) + 1;
      return acc;
    }, {} as Record<AuthErrorType, number>);

    const successfulRecoveries = this.errorReports.filter(r => r.recoverySuccessful).length;
    const recoverySuccessRate = this.errorReports.length > 0 ? successfulRecoveries / this.errorReports.length : 0;

    return {
      totalErrors: this.errorReports.length,
      errorsByType,
      recoverySuccessRate,
      recentErrors: this.errorReports.slice(-10), // Last 10 errors
    };
  }

  // Clear error history
  clearErrorHistory(): void {
    this.errorReports = [];
    this.recoveryAttempts.clear();
  }

  // Send error report to monitoring service (implement based on your monitoring setup)
  private async sendErrorReport(report: ErrorReport): Promise<void> {
    try {
      // This would integrate with your error monitoring service (e.g., Sentry, LogRocket, etc.)
      // For now, just log it
      authLogger.info('AuthErrorHandler: Error report created', { report });

      // Example: Send to external service
      // await fetch('/api/errors', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(report),
      // });
    } catch (error) {
      authLogger.error('AuthErrorHandler: Failed to send error report', error);
    }
  }
}

// Global error handler instance
let authErrorHandler: AuthErrorHandler | null = null;

export function getAuthErrorHandler(): AuthErrorHandler {
  if (!authErrorHandler) {
    authErrorHandler = new AuthErrorHandler();
  }
  return authErrorHandler;
}

// Helper function to handle authentication errors in API calls
export async function handleAuthError<T>(
  operation: () => Promise<T>,
  context?: Record<string, any>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AuthError) {
      const errorHandler = getAuthErrorHandler();
      const recovered = await errorHandler.handleError(error, context);

      if (recovered) {
        // Retry the operation after recovery
        return await operation();
      }
    }

    // Re-throw if not recovered or not an auth error
    throw error;
  }
}

// Enhanced error boundary for React components
export class AuthErrorBoundary extends Error {
  public readonly type: AuthErrorType;
  public readonly retryable: boolean;
  public readonly context?: Record<string, any>;

  constructor(
    type: AuthErrorType,
    message: string,
    retryable: boolean = false,
    context?: Record<string, any>
  ) {
    super(message);
    this.name = 'AuthErrorBoundary';
    this.type = type;
    this.retryable = retryable;
    this.context = context;
  }
}

// Create auth error from various error types
export function createAuthError(
  error: any,
  defaultType: AuthErrorType = AuthErrorType.SERVER_ERROR
): AuthError {
  if (error instanceof AuthError) {
    return error;
  }

  let type = defaultType;
  let retryable = false;

  // Determine error type based on error properties
  if (error.message?.includes('token') || error.message?.includes('JWT')) {
    type = AuthErrorType.TOKEN_INVALID;
  } else if (error.message?.includes('session')) {
    type = AuthErrorType.SESSION_INVALID;
  } else if (error.message?.includes('network') || error.name === 'NetworkError') {
    type = AuthErrorType.NETWORK_ERROR;
    retryable = true;
  } else if (error.message?.includes('fingerprint')) {
    type = AuthErrorType.FINGERPRINT_MISMATCH;
  } else if (error.status === 401) {
    type = AuthErrorType.TOKEN_INVALID;
  } else if (error.status >= 500) {
    type = AuthErrorType.SERVER_ERROR;
    retryable = true;
  }

  return new AuthError(
    type,
    error.message || 'Authentication error occurred',
    error.code || 'unknown',
    retryable,
    Date.now(),
    {
      originalError: error,
      stack: error.stack,
    }
  );
}

// Export types and utilities
export type { ErrorRecoveryStrategy, ErrorReport };
