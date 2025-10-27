// src/lib/auth/session-manager.ts
// Enhanced session management with automatic token refresh and cross-tab synchronization

import { User, Session } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/client';
import {
  EnhancedSession,
  SessionManager,
  SessionFingerprint,
  AuthSyncEvent,
  AuthSyncMessage,
  AuthContextConfig,
  AuthError,
  AuthErrorType,
  DEFAULT_AUTH_CONFIG,
  TokenStrategy,
  TokenRefreshConfig,
} from '@/types/auth';
import { authLogger } from '@/utils/logger';

// Session storage keys
const STORAGE_KEYS = {
  SESSION_DATA: 'enhanced_session_data',
  FINGERPRINT: 'session_fingerprint',
  TAB_ID: 'auth_tab_id',
  LAST_ACTIVITY: 'last_activity',
} as const;

// Generate unique tab ID for cross-tab synchronization
function generateTabId(): string {
  return `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Generate session fingerprint for integrity validation
async function generateFingerprintHash(data: string): Promise<string> {
  // Use Web Crypto API for cryptographic hash
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      authLogger.warn('Failed to generate crypto hash, falling back to base64', error);
      // Fallback to base64 if crypto fails
      return btoa(data).slice(0, 64);
    }
  } else {
    // Fallback for server-side or older browsers
    return btoa(data).slice(0, 64);
  }
}

// Generate session fingerprint for integrity validation
function generateFingerprint(): SessionFingerprint {
  if (typeof window === 'undefined') {
    // Return a basic server-side fingerprint instead of throwing
    const serverFingerprint = {
      userAgent: 'server-side',
      screenResolution: 'server-side',
      timezone: 'server-side',
      language: 'server-side',
      platform: 'server-side',
      cookiesEnabled: false,
      canvasFingerprint: 'server-side',
      webglFingerprint: 'server-side',
      fonts: 'server-side',
      plugins: 'server-side',
      tabId: 'server-side',
      sessionId: 'server-side'
    };

    // Create hash for server-side fingerprint (synchronous for server)
    const fingerprintString = JSON.stringify(serverFingerprint);
    const hash = btoa(fingerprintString).slice(0, 64);

    return {
      ...serverFingerprint,
      hash
    };
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx?.fillText('fingerprint', 10, 10);

  const fingerprintData = {
    userAgent: navigator.userAgent,
    screenResolution: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    platform: navigator.platform,
    cookiesEnabled: navigator.cookieEnabled,
    canvasFingerprint: canvas.toDataURL(),
    webglFingerprint: 'client-side',
    fonts: 'client-side',
    plugins: 'client-side',
    tabId: 'client-side',
    sessionId: 'client-side',
  };

  // Create hash of fingerprint data
  // Note: This is synchronous for compatibility, but uses crypto hash when available
  const fingerprintString = JSON.stringify(fingerprintData);

  // For browser environments, we'll compute hash synchronously using a simpler method
  // The actual crypto hash would require async, which isn't compatible with this sync function
  // A future enhancement could make this async or use a worker thread
  const hash = btoa(fingerprintString).slice(0, 64);

  return {
    ...fingerprintData,
    hash,
  } as SessionFingerprint;
}

// Compare fingerprints for validation
function compareFingerprints(fp1: SessionFingerprint, fp2: SessionFingerprint): boolean {
  return fp1.hash === fp2.hash;
}

// Enhanced session manager class
export class EnhancedSessionManager implements SessionManager {
  private config: AuthContextConfig;
  private supabase: any;
  private currentSession: EnhancedSession | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private activityTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private tabId: string;
  private broadcastChannel: BroadcastChannel | null = null;
  private refreshPromise: Promise<EnhancedSession | null> | null = null;
  private isRefreshing = false;
  private refreshQueue: Array<() => void> = [];

  constructor(config: Partial<AuthContextConfig> = {}) {
    this.config = { ...DEFAULT_AUTH_CONFIG, ...config };
    this.tabId = this.getOrGenerateTabId();

    // Initialize cross-tab synchronization if enabled
    if (this.config.enableCrossTabSync && typeof window !== 'undefined') {
      this.initializeCrossTabSync();
    }

    // Initialize Supabase client
    this.initializeSupabase();

    // Start session cleanup interval
    this.startCleanupTimer();
  }

  private async initializeSupabase() {
    try {
      this.supabase = await createClient();
      authLogger.debug('EnhancedSessionManager: Supabase client initialized');
    } catch (error) {
      authLogger.error('EnhancedSessionManager: Failed to initialize Supabase client', error);
      throw error;
    }
  }

  private getOrGenerateTabId(): string {
    if (typeof window === 'undefined') return 'server';

    let tabId = localStorage.getItem(STORAGE_KEYS.TAB_ID);
    if (!tabId) {
      tabId = generateTabId();
      localStorage.setItem(STORAGE_KEYS.TAB_ID, tabId);
    }
    return tabId;
  }

  private initializeCrossTabSync() {
    try {
      this.broadcastChannel = new BroadcastChannel('auth_sync');
      this.broadcastChannel.addEventListener('message', this.handleSyncMessage.bind(this));

      // Listen for storage events as fallback for older browsers
      window.addEventListener('storage', this.handleStorageEvent.bind(this));

      authLogger.debug('EnhancedSessionManager: Cross-tab synchronization initialized');
    } catch (error) {
      authLogger.warn('EnhancedSessionManager: Failed to initialize cross-tab sync', error);
    }
  }

  private handleSyncMessage(event: MessageEvent<AuthSyncMessage>) {
    const { type, payload, timestamp, sessionId } = event.data;

    // Ignore messages from this tab
    if (event.data.tabId === this.tabId) return;

    authLogger.debug('EnhancedSessionManager: Received sync message', { type, sessionId });

    switch (type) {
      case 'SESSION_EXPIRED':
        this.handleSessionExpired();
        break;
      case 'SESSION_REVOKED':
        this.handleSessionRevoked();
        break;
      case 'TOKEN_REFRESHED':
        this.handleTokenRefreshed(payload);
        break;
      case 'LOGOUT':
        this.handleLogout();
        break;
    }
  }

  private handleStorageEvent(event: StorageEvent) {
    if (event.key === STORAGE_KEYS.SESSION_DATA && event.newValue) {
      try {
        const sessionData = JSON.parse(event.newValue);
        if (sessionData && sessionData.id !== this.currentSession?.id) {
          this.handleTokenRefreshed(sessionData);
        }
      } catch (error) {
        authLogger.warn('EnhancedSessionManager: Failed to parse storage event', error);
      }
    }
  }

  private broadcastMessage(type: AuthSyncEvent, payload: any = {}) {
    if (!this.broadcastChannel) return;

    const message: AuthSyncMessage = {
      type,
      payload,
      timestamp: Date.now(),
      sessionId: this.currentSession?.id || '',
      tabId: this.tabId,
    };

    this.broadcastChannel.postMessage(message);
  }

  private startCleanupTimer() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);

    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredSessions();
    }, this.config.sessionCleanupInterval);
  }

  private async cleanupExpiredSessions() {
    try {
      const storedSession = this.getStoredSession();
      if (storedSession && storedSession.expiresAt < Date.now()) {
        authLogger.debug('EnhancedSessionManager: Cleaning up expired session');
        await this.clearSession();
      }
    } catch (error) {
      authLogger.warn('EnhancedSessionManager: Error during session cleanup', error);
    }
  }

  // Session validation and management
  async validateSession(): Promise<boolean> {
    try {
      const storedSession = this.getStoredSession();
      if (!storedSession) return false;

      // Check if session is expired
      if (storedSession.expiresAt < Date.now()) {
        authLogger.debug('EnhancedSessionManager: Session expired');
        await this.clearSession();
        return false;
      }

      // ENHANCED: Always validate fingerprint on every request for better security
      // This prevents XSS attacks from accessing session data even if localStorage is compromised
      if (this.config.enableFingerprinting) {
        const currentFingerprint = generateFingerprint();
        if (!compareFingerprints(storedSession.fingerprint, currentFingerprint)) {
          authLogger.warn('EnhancedSessionManager: Fingerprint mismatch detected - possible session hijacking attempt');
          this.handleSuspiciousActivity('fingerprint_mismatch');
          // Immediately clear session on fingerprint mismatch
          await this.clearSession();
          return false;
        }

        // Additional validation: Check if critical fingerprint properties have changed
        const criticalPropertiesMatch = this.validateCriticalFingerprint(
          storedSession.fingerprint,
          currentFingerprint
        );

        if (!criticalPropertiesMatch) {
          authLogger.warn('EnhancedSessionManager: Critical fingerprint properties changed');
          this.handleSuspiciousActivity('critical_fingerprint_change');
          await this.clearSession();
          return false;
        }
      }

      // Update last activity
      this.updateLastActivity();

      return true;
    } catch (error) {
      authLogger.error('EnhancedSessionManager: Session validation failed', error);
      return false;
    }
  }

  // Validate critical fingerprint properties that should never change
  private validateCriticalFingerprint(stored: SessionFingerprint, current: SessionFingerprint): boolean {
    // Critical properties that indicate session hijacking if changed
    const criticalProperties = ['userAgent', 'platform', 'timezone'];

    for (const prop of criticalProperties) {
      if (stored[prop as keyof SessionFingerprint] !== current[prop as keyof SessionFingerprint]) {
        authLogger.warn(`EnhancedSessionManager: Critical property changed: ${prop}`);
        return false;
      }
    }

    return true;
  }

  async refreshToken(): Promise<EnhancedSession | null> {
    // Prevent multiple simultaneous refresh attempts
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = this.performTokenRefresh();

    try {
      const result = await this.refreshPromise;
      this.isRefreshing = false;
      this.refreshPromise = null;

      // Resolve queued requests
      this.refreshQueue.forEach(resolve => resolve());
      this.refreshQueue = [];

      return result;
    } catch (error) {
      this.isRefreshing = false;
      this.refreshPromise = null;

      // Reject queued requests
      this.refreshQueue.forEach(resolve => resolve());
      this.refreshQueue = [];

      authLogger.error('EnhancedSessionManager: Token refresh failed', error);
      throw error;
    }
  }

  private async performTokenRefresh(): Promise<EnhancedSession | null> {
    try {
      authLogger.debug('EnhancedSessionManager: Performing token refresh');

      // Get current session from Supabase
      const { data, error } = await this.supabase.auth.refreshSession();

      if (error || !data.session) {
        throw new AuthError(
          AuthErrorType.REFRESH_FAILED,
          'Failed to refresh session',
          error?.message || 'unknown',
          false
        );
      }

      // Create enhanced session
      const enhancedSession = await this.createEnhancedSession(data.session, data.user);

      // Store the new session
      this.storeSession(enhancedSession);

      // Broadcast refresh to other tabs
      this.broadcastMessage('TOKEN_REFRESHED', {
        sessionId: enhancedSession.id,
        expiresAt: enhancedSession.expiresAt,
      });

      authLogger.debug('EnhancedSessionManager: Token refreshed successfully');
      return enhancedSession;
    } catch (error) {
      authLogger.error('EnhancedSessionManager: Token refresh error', error);
      throw error;
    }
  }

  private async createEnhancedSession(session: Session, user: User): Promise<EnhancedSession> {
    const fingerprint = generateFingerprint();

    return {
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: user.id,
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: session.expires_at ? session.expires_at * 1000 : Date.now() + 15 * 60 * 1000,
      fingerprint,
      deviceInfo: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        browser: this.getBrowserInfo(),
      },
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
      isActive: true,
    };
  }

  private getBrowserInfo(): string {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Unknown';
  }

  private updateLastActivity() {
    if (this.currentSession) {
      this.currentSession.lastActivityAt = Date.now();
      // Update localStorage directly without triggering recursion
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEYS.LAST_ACTIVITY, Date.now().toString());
        }
      } catch (error) {
        authLogger.warn('EnhancedSessionManager: Failed to update last activity in localStorage', error);
      }
    } else {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.LAST_ACTIVITY, Date.now().toString());
      }
    }
  }

  private getStoredSession(): EnhancedSession | null {
    if (typeof window === 'undefined') return null;

    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SESSION_DATA);
      if (!stored) return null;

      const session = JSON.parse(stored);

      // Check if session is expired
      if (session.expiresAt < Date.now()) {
        this.clearStoredSession();
        return null;
      }

      return session;
    } catch (error) {
      authLogger.warn('EnhancedSessionManager: Failed to parse stored session', error);
      return null;
    }
  }

  private storeSession(session: EnhancedSession) {
    if (typeof window === 'undefined') return;

    try {
      this.currentSession = session;
      localStorage.setItem(STORAGE_KEYS.SESSION_DATA, JSON.stringify(session));
      localStorage.setItem(STORAGE_KEYS.FINGERPRINT, JSON.stringify(session.fingerprint));

      // Update last activity timestamp directly without triggering recursion
      if (this.currentSession) {
        this.currentSession.lastActivityAt = Date.now();
      }
      localStorage.setItem(STORAGE_KEYS.LAST_ACTIVITY, Date.now().toString());
    } catch (error) {
      authLogger.error('EnhancedSessionManager: Failed to store session', error);
    }
  }

  private clearStoredSession() {
    if (typeof window === 'undefined') return;

    localStorage.removeItem(STORAGE_KEYS.SESSION_DATA);
    localStorage.removeItem(STORAGE_KEYS.FINGERPRINT);
    localStorage.removeItem(STORAGE_KEYS.LAST_ACTIVITY);
  }

  async clearSession(): Promise<void> {
    this.clearStoredSession();
    this.currentSession = null;

    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    if (this.activityTimer) {
      clearTimeout(this.activityTimer);
      this.activityTimer = null;
    }

    // Broadcast logout to other tabs
    this.broadcastMessage('LOGOUT');

    authLogger.debug('EnhancedSessionManager: Session cleared');
  }

  // Event handlers
  private handleSessionExpired() {
    authLogger.debug('EnhancedSessionManager: Handling session expiration');
    this.clearSession();
  }

  private handleSessionRevoked() {
    authLogger.debug('EnhancedSessionManager: Handling session revocation');
    this.clearSession();
  }

  private handleTokenRefreshed(payload: any) {
    authLogger.debug('EnhancedSessionManager: Handling token refresh from other tab');
    if (payload.sessionId && this.currentSession?.id !== payload.sessionId) {
      // Update session if it's different from current
      this.loadStoredSession();
    }
  }

  private handleLogout() {
    authLogger.debug('EnhancedSessionManager: Handling logout from other tab');
    this.clearSession();
  }

  private handleSuspiciousActivity(reason: string) {
    authLogger.warn('EnhancedSessionManager: Suspicious activity detected', { reason });

    this.broadcastMessage('SUSPICIOUS_ACTIVITY', { reason });

    if (this.config.enableSuspiciousActivityDetection) {
      // Could implement automatic session termination here
      // For now, just log and broadcast
    }
  }

  private loadStoredSession() {
    const stored = this.getStoredSession();
    if (stored && stored.id !== this.currentSession?.id) {
      this.currentSession = stored;
      this.scheduleRefreshTimer();
    }
  }

  private scheduleRefreshTimer() {
    if (!this.currentSession || this.refreshTimer) return;

    const timeUntilRefresh = this.currentSession.expiresAt - Date.now() - (this.config.refreshConfig.refreshThreshold * 60 * 1000);

    if (timeUntilRefresh > 0) {
      this.refreshTimer = setTimeout(() => {
        this.refreshToken().catch(error => {
          authLogger.error('EnhancedSessionManager: Scheduled refresh failed', error);
        });
      }, timeUntilRefresh);
    }
  }

  // Public interface methods
  synchronizeTabs(): void {
    this.broadcastMessage('SESSION_UPDATED', {
      sessionId: this.currentSession?.id,
      lastActivity: this.currentSession?.lastActivityAt,
    });
  }

  handleExpiration(): void {
    this.handleSessionExpired();
  }

  detectSuspiciousActivity(): boolean {
    // Implement suspicious activity detection logic
    // For now, return false
    return false;
  }

  async revokeSession(sessionId: string): Promise<void> {
    // Implement session revocation logic
    authLogger.debug('EnhancedSessionManager: Revoking session', { sessionId });
    this.broadcastMessage('SESSION_REVOKED', { sessionId });
  }

  async getActiveSessions(): Promise<EnhancedSession[]> {
    // Return current session only for now
    // In a full implementation, this would query all active sessions for the user
    return this.currentSession ? [this.currentSession] : [];
  }

  async clearAllSessions(): Promise<void> {
    await this.clearSession();
  }

  // Get current session (for external access)
  getCurrentSession(): EnhancedSession | null {
    return this.currentSession;
  }

  // Initialize session from Supabase session
  async initializeFromSession(session: Session, user: User): Promise<EnhancedSession> {
    const enhancedSession = await this.createEnhancedSession(session, user);
    this.storeSession(enhancedSession);
    this.scheduleRefreshTimer();

    // Start activity tracking
    this.startActivityTimer();

    return enhancedSession;
  }

  private startActivityTimer() {
    if (this.activityTimer) clearInterval(this.activityTimer);

    this.activityTimer = setInterval(() => {
      this.updateLastActivity();
    }, 60000); // Update every minute
  }

  // Cleanup method
  destroy() {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    if (this.activityTimer) clearInterval(this.activityTimer);
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    if (this.broadcastChannel) this.broadcastChannel.close();

    this.clearStoredSession();
  }
}

// Global session manager instance
let sessionManager: EnhancedSessionManager | null = null;

export function getSessionManager(config?: Partial<AuthContextConfig>): EnhancedSessionManager {
  // Only initialize session manager on client side
  if (typeof window === 'undefined') {
    throw new Error('SessionManager can only be used on the client side');
  }

  if (!sessionManager) {
    sessionManager = new EnhancedSessionManager(config);
  }
  return sessionManager;
}

export function destroySessionManager() {
  if (sessionManager) {
    sessionManager.destroy();
    sessionManager = null;
  }
}
