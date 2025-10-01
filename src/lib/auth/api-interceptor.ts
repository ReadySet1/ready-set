// src/lib/auth/api-interceptor.ts
// API request interceptor with automatic token refresh and retry logic

import { getTokenRefreshService } from './token-refresh-service';
import { getSessionManager } from './session-manager';
import { AuthError, AuthErrorType } from '@/types/auth';
import { authLogger } from '@/utils/logger';

// Request interceptor configuration
export interface ApiInterceptorConfig {
  enabled: boolean;
  retryAttempts: number;
  retryDelay: number;
  retryOnAuthErrors: boolean;
  showRetryIndicator: boolean;
  maxConcurrentRetries: number;
}

// Default configuration
const DEFAULT_CONFIG: ApiInterceptorConfig = {
  enabled: true,
  retryAttempts: 3,
  retryDelay: 1000,
  retryOnAuthErrors: true,
  showRetryIndicator: false,
  maxConcurrentRetries: 5,
};

// Retry queue to prevent duplicate requests during token refresh
class RetryQueue {
  private queue: Array<{
    request: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (error: any) => void;
    attempts: number;
  }> = [];
  private processing = false;
  private concurrentRetries = 0;

  async enqueue<T>(request: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        request,
        resolve,
        reject,
        attempts: 0,
      });

      if (!this.processing && this.concurrentRetries < DEFAULT_CONFIG.maxConcurrentRetries) {
        this.processQueue();
      }
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    while (this.queue.length > 0 && this.concurrentRetries < DEFAULT_CONFIG.maxConcurrentRetries) {
      const item = this.queue.shift()!;
      this.concurrentRetries++;

      try {
        const result = await this.executeWithRetry(item);
        item.resolve(result);
      } catch (error) {
        item.reject(error);
      } finally {
        this.concurrentRetries--;
      }
    }

    this.processing = false;
  }

  private async executeWithRetry(item: any): Promise<any> {
    const maxAttempts = DEFAULT_CONFIG.retryAttempts;

    for (let attempt = 0; attempt <= maxAttempts; attempt++) {
      try {
        item.attempts = attempt + 1;
        return await item.request();
      } catch (error) {
        if (attempt === maxAttempts) {
          throw error;
        }

        // Check if error is retryable
        if (!this.isRetryableError(error)) {
          throw error;
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, DEFAULT_CONFIG.retryDelay * (attempt + 1)));
      }
    }
  }

  private isRetryableError(error: any): boolean {
    // Network errors are retryable
    if (error.name === 'NetworkError' || error.message?.includes('network')) {
      return true;
    }

    // Auth errors that might be resolved by token refresh
    if (error.status === 401 || error.message?.includes('token') || error.message?.includes('unauthorized')) {
      return true;
    }

    // Server errors (5xx) are retryable
    if (error.status >= 500 && error.status < 600) {
      return true;
    }

    return false;
  }
}

// Enhanced fetch with authentication and retry logic
export class AuthenticatedFetch {
  private config: ApiInterceptorConfig;
  private retryQueue = new RetryQueue();
  private refreshPromise: Promise<string> | null = null;

  constructor(config: Partial<ApiInterceptorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    if (!this.config.enabled) {
      return fetch(input, init);
    }

    return this.retryQueue.enqueue(() => this.executeRequest(input, init));
  }

  private async executeRequest(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    try {
      // Get fresh token
      const token = await this.getValidToken();

      // Add authorization header
      const headers = new Headers(init?.headers);
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      // Execute request
      const response = await fetch(input, {
        ...init,
        headers,
      });

      // Handle authentication errors
      if (response.status === 401 && this.config.retryOnAuthErrors) {
        const sessionManager = getSessionManager();
        const isValid = await sessionManager.validateSession();

        if (!isValid) {
          // Session is invalid, redirect to login
          this.handleAuthenticationFailure();
          throw new AuthError(
            AuthErrorType.TOKEN_INVALID,
            'Authentication failed',
            'invalid_session',
            false
          );
        }

        // Try refreshing token and retrying request
        try {
          const newToken = await this.refreshTokenAndRetry();
          headers.set('Authorization', `Bearer ${newToken}`);

          // Retry the request with new token
          const retryResponse = await fetch(input, {
            ...init,
            headers,
          });

          if (retryResponse.status === 401) {
            // Still unauthorized after refresh, session is invalid
            this.handleAuthenticationFailure();
            throw new AuthError(
              AuthErrorType.TOKEN_INVALID,
              'Authentication failed after token refresh',
              'persistent_auth_failure',
              false
            );
          }

          return retryResponse;
        } catch (refreshError) {
          this.handleAuthenticationFailure();
          throw refreshError;
        }
      }

      return response;
    } catch (error) {
      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new AuthError(
          AuthErrorType.NETWORK_ERROR,
          'Network request failed',
          error.message,
          true
        );
      }

      throw error;
    }
  }

  private async getValidToken(): Promise<string | null> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.getFreshToken();
    }

    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async getFreshToken(): Promise<string> {
    try {
      const tokenRefreshService = getTokenRefreshService();
      const token = await tokenRefreshService.getFreshToken();

      if (!token) {
        throw new AuthError(
          AuthErrorType.TOKEN_INVALID,
          'No valid token available',
          'no_token',
          false
        );
      }

      return token;
    } catch (error) {
      authLogger.error('AuthenticatedFetch: Failed to get fresh token', error);

      // If token refresh fails, clear session and redirect to login
      this.handleAuthenticationFailure();
      throw error;
    }
  }

  private async refreshTokenAndRetry(): Promise<string> {
    const tokenRefreshService = getTokenRefreshService();
    return await tokenRefreshService.refreshTokenWithRetry();
  }

  public handleAuthenticationFailure(): void {
    // Clear authentication state
    const sessionManager = getSessionManager();
    sessionManager.clearSession();

    // Redirect to login page if in browser
    if (typeof window !== 'undefined') {
      // Use replace to avoid back button issues
      window.location.replace('/sign-in?error=session_expired');
    }
  }

  // Convenience methods for common HTTP methods
  async get(url: string, options?: RequestInit): Promise<Response> {
    return this.fetch(url, { ...options, method: 'GET' });
  }

  async post(url: string, data?: any, options?: RequestInit): Promise<Response> {
    return this.fetch(url, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
  }

  async put(url: string, data?: any, options?: RequestInit): Promise<Response> {
    return this.fetch(url, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
  }

  async delete(url: string, options?: RequestInit): Promise<Response> {
    return this.fetch(url, { ...options, method: 'DELETE' });
  }

  // Update configuration
  updateConfig(config: Partial<ApiInterceptorConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Global authenticated fetch instance
let authenticatedFetch: AuthenticatedFetch | null = null;

export function getAuthenticatedFetch(config?: Partial<ApiInterceptorConfig>): AuthenticatedFetch {
  if (!authenticatedFetch) {
    authenticatedFetch = new AuthenticatedFetch(config);
  } else if (config) {
    authenticatedFetch.updateConfig(config);
  }
  return authenticatedFetch;
}

// Helper function to create authenticated request options
export function createAuthRequestOptions(token?: string): RequestInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return {
    headers,
    credentials: 'same-origin',
  };
}

// Helper function to handle API responses with authentication errors
export async function handleApiResponse(response: Response): Promise<any> {
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    let errorData = null;

    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
      }
    } catch {
      // Ignore JSON parsing errors
    }

    // Handle authentication errors
    if (response.status === 401) {
      const authFetch = getAuthenticatedFetch();
      authFetch.handleAuthenticationFailure();
    }

    throw new Error(errorMessage);
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return await response.json();
  }

  return await response.text();
}

// Export types for use in other modules
export type { ApiInterceptorConfig as InterceptorConfig };
