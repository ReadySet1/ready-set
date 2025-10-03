// src/__tests__/auth/enhanced-session-management.test.ts
// Basic test suite for enhanced session management types and utilities
// Note: Full integration tests require Jest ES module configuration updates

import { describe, it, expect } from '@jest/globals';
import { AuthError, AuthErrorType, DEFAULT_AUTH_CONFIG } from '@/types/auth';

describe('Authentication Types and Configuration', () => {
  describe('AuthError', () => {
    it('should create AuthError instances correctly', () => {
      const error = new AuthError(
        AuthErrorType.TOKEN_EXPIRED,
        'Token has expired',
        'token_expired',
        true,
        Date.now(),
        { userId: 'user_123' }
      );

      expect(error).toBeInstanceOf(Error);
      expect(error.type).toBe(AuthErrorType.TOKEN_EXPIRED);
      expect(error.message).toBe('Token has expired');
      expect(error.code).toBe('token_expired');
      expect(error.retryable).toBe(true);
      expect(error.context).toEqual({ userId: 'user_123' });
    });

    it('should have correct default values', () => {
      const error = new AuthError(AuthErrorType.NETWORK_ERROR, 'Network failed');

      expect(error.retryable).toBe(false); // Default value
      expect(error.timestamp).toBeDefined();
      expect(error.context).toBeUndefined();
    });
  });

  describe('AuthErrorType', () => {
    it('should have all required error types', () => {
      expect(AuthErrorType.TOKEN_EXPIRED).toBe('token_expired');
      expect(AuthErrorType.TOKEN_INVALID).toBe('token_invalid');
      expect(AuthErrorType.SESSION_EXPIRED).toBe('session_expired');
      expect(AuthErrorType.SESSION_INVALID).toBe('session_invalid');
      expect(AuthErrorType.NETWORK_ERROR).toBe('network_error');
      expect(AuthErrorType.SERVER_ERROR).toBe('server_error');
      expect(AuthErrorType.FINGERPRINT_MISMATCH).toBe('fingerprint_mismatch');
      expect(AuthErrorType.REFRESH_FAILED).toBe('refresh_failed');
    });
  });

  describe('DEFAULT_AUTH_CONFIG', () => {
    it('should have correct default configuration', () => {
      expect(DEFAULT_AUTH_CONFIG.tokenStrategy.accessToken.storage).toBe('memory');
      expect(DEFAULT_AUTH_CONFIG.tokenStrategy.accessToken.lifetime).toBe(15 * 60 * 1000);
      expect(DEFAULT_AUTH_CONFIG.tokenStrategy.accessToken.autoRefresh).toBe(true);

      expect(DEFAULT_AUTH_CONFIG.tokenStrategy.refreshToken.storage).toBe('httpOnlyCookie');
      expect(DEFAULT_AUTH_CONFIG.tokenStrategy.refreshToken.lifetime).toBe(7 * 24 * 60 * 60 * 1000);
      expect(DEFAULT_AUTH_CONFIG.tokenStrategy.refreshToken.rotation).toBe(true);

      expect(DEFAULT_AUTH_CONFIG.refreshConfig.enabled).toBe(true);
      expect(DEFAULT_AUTH_CONFIG.refreshConfig.maxRetries).toBe(3);

      expect(DEFAULT_AUTH_CONFIG.timeoutConfig.enabled).toBe(true);
      expect(DEFAULT_AUTH_CONFIG.timeoutConfig.warningTime).toBe(5);

      expect(DEFAULT_AUTH_CONFIG.enableCrossTabSync).toBe(true);
      expect(DEFAULT_AUTH_CONFIG.enableFingerprinting).toBe(true);
      expect(DEFAULT_AUTH_CONFIG.maxConcurrentSessions).toBe(5);
    });
  });
});

describe('Authentication System Integration', () => {
  it('should export all required types and utilities', () => {
    // Verify that our auth system exports are available
    expect(AuthError).toBeDefined();
    expect(AuthErrorType).toBeDefined();
    expect(DEFAULT_AUTH_CONFIG).toBeDefined();
  });

  it('should have comprehensive error type coverage', () => {
    const errorTypes = Object.values(AuthErrorType);
    expect(errorTypes.length).toBeGreaterThan(8); // Should have multiple error types

    // Verify key error types exist
    expect(errorTypes).toContain('token_expired');
    expect(errorTypes).toContain('session_expired');
    expect(errorTypes).toContain('network_error');
    expect(errorTypes).toContain('fingerprint_mismatch');
  });

  it('should support authentication configuration customization', () => {
    const customConfig = {
      ...DEFAULT_AUTH_CONFIG,
      tokenStrategy: {
        ...DEFAULT_AUTH_CONFIG.tokenStrategy,
        accessToken: {
          ...DEFAULT_AUTH_CONFIG.tokenStrategy.accessToken,
          lifetime: 30 * 60 * 1000, // 30 minutes
        },
      },
    };

    expect(customConfig.tokenStrategy.accessToken.lifetime).toBe(30 * 60 * 1000);
    expect(customConfig.tokenStrategy.accessToken.storage).toBe('memory');
  });
});

// Note: Full integration tests require additional Jest configuration
// to handle ES modules from Supabase dependencies. The current tests
// verify the type definitions and basic functionality without
// importing the complex auth modules that have ES module dependencies.