// src/lib/auth/token-refresh-service.ts
// Automatic token refresh service with background renewal and retry logic

import { Session, User } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/client';
import {
  TokenRefreshConfig,
  AuthError,
  AuthErrorType,
  DEFAULT_AUTH_CONFIG,
  EnhancedSession,
} from '@/types/auth';
import { authLogger } from '@/utils/logger';

// Token refresh queue management
class TokenRefreshQueue {
  private queue: Array<{ resolve: (token: string) => void; reject: (error: any) => void }> = [];
  private isRefreshing = false;

  async enqueue(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject });

      if (!this.isRefreshing) {
        this.processQueue();
      }
    });
  }

  private async processQueue() {
    if (this.isRefreshing || this.queue.length === 0) return;

    this.isRefreshing = true;

    try {
      if (typeof window === 'undefined') {
        throw new Error('TokenRefreshService can only be used on client side');
      }

      const { getSessionManager } = await import('./session-manager');
      const sessionManager = getSessionManager();
      const enhancedSession = await sessionManager.refreshToken();

      if (!enhancedSession) {
        throw new AuthError(
          AuthErrorType.REFRESH_FAILED,
          'Failed to refresh token',
          'no_session',
          false
        );
      }

      // Resolve all queued requests with the new token
      this.queue.forEach(({ resolve }) => {
        resolve(enhancedSession.accessToken);
      });

    } catch (error) {
      // Reject all queued requests
      this.queue.forEach(({ reject }) => {
        reject(error);
      });
    } finally {
      this.queue = [];
      this.isRefreshing = false;
    }
  }
}

// Token refresh service class
export class TokenRefreshService {
  private config: TokenRefreshConfig;
  private supabase: any;
  private refreshQueue = new TokenRefreshQueue();
  private refreshTimer: NodeJS.Timeout | null = null;
  private backgroundRefreshTimer: NodeJS.Timeout | null = null;
  private retryCount = 0;
  private maxRetries: number;

  constructor(config: Partial<TokenRefreshConfig> = {}) {
    this.config = { ...DEFAULT_AUTH_CONFIG.refreshConfig, ...config };
    this.maxRetries = this.config.maxRetries;
    this.initializeSupabase();
  }

  private async initializeSupabase() {
    try {
      this.supabase = await createClient();
      authLogger.debug('TokenRefreshService: Supabase client initialized');
    } catch (error) {
      authLogger.error('TokenRefreshService: Failed to initialize Supabase client', error);
      throw error;
    }
  }

  // Start automatic token refresh
  startAutoRefresh(session: Session): void {
    this.stopAutoRefresh();

    if (!this.config.enabled || !session.expires_at) return;

    const expiresAt = session.expires_at * 1000;
    const now = Date.now();
    const timeUntilRefresh = expiresAt - now - (this.config.refreshThreshold * 60 * 1000);

    if (timeUntilRefresh > 0) {
      authLogger.debug('TokenRefreshService: Scheduling token refresh', {
        timeUntilRefresh: `${Math.round(timeUntilRefresh / 1000)}s`
      });

      this.refreshTimer = setTimeout(() => {
        this.refreshTokenWithRetry();
      }, timeUntilRefresh);
    } else {
      // Token is already close to expiry or expired, refresh immediately
      this.refreshTokenWithRetry();
    }

    // Start background refresh if enabled
    if (this.config.backgroundRefresh) {
      this.startBackgroundRefresh(session);
    }
  }

  private startBackgroundRefresh(session: Session): void {
    // Refresh token in background every 10 minutes for proactive renewal
    const backgroundInterval = 10 * 60 * 1000; // 10 minutes

    this.backgroundRefreshTimer = setInterval(() => {
      const timeUntilExpiry = (session.expires_at || 0) * 1000 - Date.now();

      // Only refresh in background if token expires in more than 15 minutes
      if (timeUntilExpiry > 15 * 60 * 1000) {
        authLogger.debug('TokenRefreshService: Performing background refresh');

        this.supabase.auth.refreshSession()
          .then(({ data, error }: { data: any; error: any }) => {
            if (error) {
              authLogger.warn('TokenRefreshService: Background refresh failed', error);
            } else {
              authLogger.debug('TokenRefreshService: Background refresh successful');
            }
          })
          .catch((error: any) => {
            authLogger.warn('TokenRefreshService: Background refresh error', error);
          });
      }
    }, backgroundInterval);
  }

  // Stop automatic refresh
  stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    if (this.backgroundRefreshTimer) {
      clearInterval(this.backgroundRefreshTimer);
      this.backgroundRefreshTimer = null;
    }
  }

  // Refresh token with retry logic
  async refreshTokenWithRetry(): Promise<string> {
    this.retryCount = 0;

    while (this.retryCount <= this.maxRetries) {
      try {
        const token = await this.refreshToken();
        this.retryCount = 0; // Reset on success
        return token;
      } catch (error) {
        this.retryCount++;

        if (this.retryCount > this.maxRetries) {
          throw error;
        }

        authLogger.warn('TokenRefreshService: Refresh attempt failed, retrying', {
          attempt: this.retryCount,
          maxRetries: this.maxRetries,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * this.retryCount));
      }
    }

    throw new AuthError(
      AuthErrorType.REFRESH_FAILED,
      'Token refresh failed after maximum retries',
      'max_retries_exceeded',
      false
    );
  }

  // Core token refresh logic
  private async refreshToken(): Promise<string> {
    try {
      // Use the refresh queue to prevent duplicate requests
      if (this.config.queueRequests) {
        return await this.refreshQueue.enqueue();
      }

      // Direct refresh for non-queued requests
      const { data, error } = await this.supabase.auth.refreshSession();

      if (error) {
        throw new AuthError(
          AuthErrorType.REFRESH_FAILED,
          error.message || 'Token refresh failed',
          error.message || 'unknown',
          this.isRetryableError(error)
        );
      }

      if (!data.session?.access_token) {
        throw new AuthError(
          AuthErrorType.REFRESH_FAILED,
          'No access token in refresh response',
          'no_token',
          false
        );
      }

      authLogger.debug('TokenRefreshService: Token refreshed successfully');
      return data.session.access_token;

    } catch (error) {
      authLogger.error('TokenRefreshService: Token refresh error', error);
      throw error;
    }
  }

  private isRetryableError(error: any): boolean {
    const retryableMessages = [
      'network',
      'timeout',
      'connection',
      'temporary',
      'rate limit',
      'too many requests'
    ];

    const errorMessage = (error.message || '').toLowerCase();
    return retryableMessages.some(msg => errorMessage.includes(msg));
  }

  // Get fresh token (used by API interceptors)
  async getFreshToken(): Promise<string> {
    try {
      if (typeof window === 'undefined') {
        throw new Error('TokenRefreshService can only be used on client side');
      }

      // Check if current token is still valid
      const { getSessionManager } = await import('./session-manager');
      const sessionManager = getSessionManager();
      const isValid = await sessionManager.validateSession();

      if (isValid && sessionManager.getCurrentSession()) {
        return sessionManager.getCurrentSession()!.accessToken;
      }

      // Refresh token if needed
      return await this.refreshTokenWithRetry();
    } catch (error) {
      authLogger.error('TokenRefreshService: Failed to get fresh token', error);
      throw error;
    }
  }

  // Check if token needs refresh
  shouldRefresh(session: Session | null): boolean {
    if (!session || !session.expires_at || !this.config.enabled) return false;

    const expiresAt = session.expires_at * 1000;
    const now = Date.now();
    const timeUntilExpiry = expiresAt - now;

    return timeUntilExpiry < (this.config.refreshThreshold * 60 * 1000);
  }

  // Update configuration
  updateConfig(config: Partial<TokenRefreshConfig>): void {
    this.config = { ...this.config, ...config };
    this.maxRetries = this.config.maxRetries;
  }

  // Cleanup
  destroy(): void {
    this.stopAutoRefresh();
    this.refreshQueue = new TokenRefreshQueue();
  }
}

// Global token refresh service instance
let tokenRefreshService: TokenRefreshService | null = null;

export function getTokenRefreshService(config?: Partial<TokenRefreshConfig>): TokenRefreshService {
  if (!tokenRefreshService) {
    tokenRefreshService = new TokenRefreshService(config);
  } else if (config) {
    tokenRefreshService.updateConfig(config);
  }
  return tokenRefreshService;
}

export function destroyTokenRefreshService(): void {
  if (tokenRefreshService) {
    tokenRefreshService.destroy();
    tokenRefreshService = null;
  }
}
