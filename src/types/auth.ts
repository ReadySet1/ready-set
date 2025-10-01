// src/types/auth.ts
// Enhanced authentication types for improved session management

import { User, Session } from '@supabase/supabase-js';
import { UserType } from './user';

// Token management strategy interface
export interface TokenStrategy {
  accessToken: {
    storage: 'memory'; // Never in localStorage for security
    lifetime: number; // in milliseconds
    autoRefresh: boolean;
    refreshThreshold: number; // Refresh X minutes before expiry
  };
  refreshToken: {
    storage: 'httpOnlyCookie';
    lifetime: number; // in milliseconds
    rotation: boolean;
    secure: boolean;
    sameSite: 'strict' | 'lax' | 'none';
  };
}

// Session fingerprint for integrity validation
export interface SessionFingerprint {
  userAgent: string;
  screenResolution: string;
  timezone: string;
  language: string;
  platform: string;
  cookiesEnabled: boolean;
  hash: string; // Derived hash of above properties
}

// Enhanced session data structure
export interface EnhancedSession {
  id: string;
  userId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  fingerprint: SessionFingerprint;
  deviceInfo: {
    ip?: string;
    location?: string;
    userAgent: string;
    platform: string;
    browser: string;
  };
  createdAt: number;
  lastActivityAt: number;
  isActive: boolean;
  suspiciousActivity?: boolean;
}

// Session management interface
export interface SessionManager {
  validateSession(): Promise<boolean>;
  refreshToken(): Promise<EnhancedSession | null>;
  synchronizeTabs(): void;
  handleExpiration(): void;
  detectSuspiciousActivity(): boolean;
  revokeSession(sessionId: string): Promise<void>;
  getActiveSessions(): Promise<EnhancedSession[]>;
  clearAllSessions(): Promise<void>;
}

// Authentication state management
export interface AuthState {
  user: User | null;
  session: Session | null;
  enhancedSession: EnhancedSession | null;
  userRole: UserType | null;
  isLoading: boolean;
  isAuthenticating: boolean;
  error: string | null;
  lastActivity: number;
  sessionExpiresAt: number | null;
  needsRefresh: boolean;
  suspiciousActivity: boolean;
}

// Token refresh configuration
export interface TokenRefreshConfig {
  enabled: boolean;
  refreshThreshold: number; // minutes before expiry to refresh
  maxRetries: number;
  retryDelay: number;
  backgroundRefresh: boolean;
  queueRequests: boolean;
  showRefreshIndicator: boolean;
}

// Session timeout configuration
export interface SessionTimeoutConfig {
  enabled: boolean;
  warningTime: number; // minutes before expiry to show warning
  extendPrompt: boolean;
  maxExtensions: number;
  extensionDuration: number; // minutes to extend by
  autoExtend: boolean;
}

// Cross-tab synchronization events
export type AuthSyncEvent =
  | 'SESSION_CREATED'
  | 'SESSION_UPDATED'
  | 'SESSION_EXPIRED'
  | 'SESSION_REVOKED'
  | 'TOKEN_REFRESHED'
  | 'SUSPICIOUS_ACTIVITY'
  | 'LOGOUT';

// Cross-tab synchronization message
export interface AuthSyncMessage {
  type: AuthSyncEvent;
  payload: any;
  timestamp: number;
  sessionId: string;
  tabId: string;
}

// Authentication context configuration
export interface AuthContextConfig {
  tokenStrategy: TokenStrategy;
  refreshConfig: TokenRefreshConfig;
  timeoutConfig: SessionTimeoutConfig;
  enableCrossTabSync: boolean;
  enableFingerprinting: boolean;
  enableSuspiciousActivityDetection: boolean;
  maxConcurrentSessions: number;
  sessionCleanupInterval: number;
}

// Authentication error types
export enum AuthErrorType {
  TOKEN_EXPIRED = 'token_expired',
  TOKEN_INVALID = 'token_invalid',
  SESSION_EXPIRED = 'session_expired',
  SESSION_INVALID = 'session_invalid',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  NETWORK_ERROR = 'network_error',
  SERVER_ERROR = 'server_error',
  REFRESH_FAILED = 'refresh_failed',
  FINGERPRINT_MISMATCH = 'fingerprint_mismatch',
  CONCURRENT_SESSION_LIMIT = 'concurrent_session_limit',
}

// Enhanced authentication error class
export class AuthError extends Error {
  public readonly type: AuthErrorType;
  public readonly code?: string;
  public readonly retryable: boolean;
  public readonly timestamp: number;
  public readonly context?: Record<string, any>;

  constructor(
    type: AuthErrorType,
    message: string,
    code?: string,
    retryable: boolean = false,
    timestamp: number = Date.now(),
    context?: Record<string, any>
  ) {
    super(message);
    this.name = 'AuthError';
    this.type = type;
    this.code = code;
    this.retryable = retryable;
    this.timestamp = timestamp;
    this.context = context;
  }
}

// Session activity tracking
export interface SessionActivity {
  action: string;
  timestamp: number;
  metadata?: Record<string, any>;
  ip?: string;
  userAgent?: string;
}

// Remember me functionality
export interface RememberMeConfig {
  enabled: boolean;
  duration: number; // days
  secureStorage: boolean;
  promptOnExpiry: boolean;
}

// Device trust configuration
export interface DeviceTrustConfig {
  enabled: boolean;
  trustDuration: number; // days
  requireVerification: boolean;
  maxTrustedDevices: number;
  suspiciousActivityThreshold: number;
}

// Export default configuration
export const DEFAULT_AUTH_CONFIG: AuthContextConfig = {
  tokenStrategy: {
    accessToken: {
      storage: 'memory',
      lifetime: 15 * 60 * 1000, // 15 minutes
      autoRefresh: true,
      refreshThreshold: 5 * 60 * 1000, // 5 minutes
    },
    refreshToken: {
      storage: 'httpOnlyCookie',
      lifetime: 7 * 24 * 60 * 60 * 1000, // 7 days
      rotation: true,
      secure: true,
      sameSite: 'strict',
    },
  },
  refreshConfig: {
    enabled: true,
    refreshThreshold: 5, // minutes
    maxRetries: 3,
    retryDelay: 1000,
    backgroundRefresh: true,
    queueRequests: true,
    showRefreshIndicator: false,
  },
  timeoutConfig: {
    enabled: true,
    warningTime: 5, // minutes
    extendPrompt: true,
    maxExtensions: 3,
    extensionDuration: 30, // minutes
    autoExtend: false,
  },
  enableCrossTabSync: true,
  enableFingerprinting: true,
  enableSuspiciousActivityDetection: true,
  maxConcurrentSessions: 5,
  sessionCleanupInterval: 60 * 1000, // 1 minute
};
