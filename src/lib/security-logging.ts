// src/lib/security-logging.ts
import { NextRequest, NextResponse } from 'next/server';

// Security event types for logging
export enum SecurityEventType {
  // Authentication events
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILURE = 'login_failure',
  LOGOUT = 'logout',
  PASSWORD_RESET = 'password_reset',
  PASSWORD_CHANGE = 'password_change',
  MFA_ENABLED = 'mfa_enabled',
  MFA_DISABLED = 'mfa_disabled',

  // Authorization events
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  FORBIDDEN_ACCESS = 'forbidden_access',
  ROLE_CHANGED = 'role_changed',

  // API security events
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  CSRF_VIOLATION = 'csrf_violation',
  VALIDATION_ERROR = 'validation_error',
  INJECTION_ATTEMPT = 'injection_attempt',
  SUSPICIOUS_REQUEST = 'suspicious_request',

  // File upload security
  MALICIOUS_FILE_BLOCKED = 'malicious_file_blocked',
  UPLOAD_QUARANTINED = 'upload_quarantined',
  VIRUS_DETECTED = 'virus_detected',

  // Session security
  SESSION_EXPIRED = 'session_expired',
  SESSION_INVALID = 'session_invalid',
  SESSION_HIJACK_ATTEMPT = 'session_hijack_attempt',

  // Data security
  SENSITIVE_DATA_ACCESS = 'sensitive_data_access',
  DATA_EXPORT = 'data_export',
  BULK_OPERATION = 'bulk_operation',

  // System security
  CONFIG_CHANGE = 'config_change',
  SECURITY_BREACH = 'security_breach',
  ANOMALY_DETECTED = 'anomaly_detected'
}

// Security event severity levels
export enum SecurityEventSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Security event data structure
export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  severity: SecurityEventSeverity;
  timestamp: Date;
  userId?: string;
  ipAddress: string;
  userAgent?: string;
  requestPath: string;
  requestMethod: string;
  statusCode?: number;
  message: string;
  details?: Record<string, any>;
  correlationId?: string;
  sessionId?: string;
  riskScore?: number;
  tags?: string[];
  source?: 'api' | 'web' | 'admin' | 'system';
  resolved?: boolean;
  resolution?: string;
}

// Security logging configuration
export interface SecurityLoggingConfig {
  enabled: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  storeEvents: boolean;
  maxEventAge: number; // Days to keep events
  alertThresholds: {
    [key in SecurityEventType]?: number;
  };
  retentionDays: number;
  enableRealTimeAlerts: boolean;
  alertWebhooks?: string[];
}

// Default security logging configuration
const DEFAULT_SECURITY_LOGGING_CONFIG: SecurityLoggingConfig = {
  enabled: true,
  logLevel: 'info',
  storeEvents: true,
  maxEventAge: 90, // 90 days
  alertThresholds: {
    [SecurityEventType.LOGIN_FAILURE]: 5,
    [SecurityEventType.UNAUTHORIZED_ACCESS]: 10,
    [SecurityEventType.CSRF_VIOLATION]: 3,
    [SecurityEventType.RATE_LIMIT_EXCEEDED]: 50,
    [SecurityEventType.INJECTION_ATTEMPT]: 1,
    [SecurityEventType.SECURITY_BREACH]: 1
  },
  retentionDays: 90,
  enableRealTimeAlerts: true
};

// In-memory security event store (use database in production)
class SecurityEventStore {
  private events: SecurityEvent[] = [];
  private maxEvents = 10000;

  addEvent(event: SecurityEvent): void {
    this.events.push(event);

    // Keep only the latest events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
  }

  getEvents(filters?: {
    type?: SecurityEventType;
    severity?: SecurityEventSeverity;
    userId?: string;
    ipAddress?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): SecurityEvent[] {
    let filtered = [...this.events];

    if (filters?.type) {
      filtered = filtered.filter(e => e.type === filters.type);
    }

    if (filters?.severity) {
      filtered = filtered.filter(e => e.severity === filters.severity);
    }

    if (filters?.userId) {
      filtered = filtered.filter(e => e.userId === filters.userId);
    }

    if (filters?.ipAddress) {
      filtered = filtered.filter(e => e.ipAddress === filters.ipAddress);
    }

    if (filters?.startDate) {
      filtered = filtered.filter(e => e.timestamp >= filters.startDate!);
    }

    if (filters?.endDate) {
      filtered = filtered.filter(e => e.timestamp <= filters.endDate!);
    }

    // Sort by timestamp (newest first)
    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (filters?.limit) {
      filtered = filtered.slice(0, filters.limit);
    }

    return filtered;
  }

  getStats(timeRange: { start: Date; end: Date }): {
    totalEvents: number;
    eventsByType: Record<SecurityEventType, number>;
    eventsBySeverity: Record<SecurityEventSeverity, number>;
    eventsBySource: Record<string, number>;
    topIpAddresses: Array<{ ip: string; count: number }>;
    topUserAgents: Array<{ agent: string; count: number }>;
  } {
    const events = this.getEvents({
      startDate: timeRange.start,
      endDate: timeRange.end
    });

    const stats = {
      totalEvents: events.length,
      eventsByType: {} as Record<SecurityEventType, number>,
      eventsBySeverity: {} as Record<SecurityEventSeverity, number>,
      eventsBySource: {} as Record<string, number>,
      topIpAddresses: [] as Array<{ ip: string; count: number }>,
      topUserAgents: [] as Array<{ agent: string; count: number }>
    };

    // Count by type and severity
    events.forEach(event => {
      stats.eventsByType[event.type] = (stats.eventsByType[event.type] || 0) + 1;
      stats.eventsBySeverity[event.severity] = (stats.eventsBySeverity[event.severity] || 0) + 1;
      if (event.source) {
        stats.eventsBySource[event.source] = (stats.eventsBySource[event.source] || 0) + 1;
      }
    });

    // Get top IP addresses and user agents
    const ipCounts = new Map<string, number>();
    const agentCounts = new Map<string, number>();

    events.forEach(event => {
      if (event.ipAddress) {
        ipCounts.set(event.ipAddress, (ipCounts.get(event.ipAddress) || 0) + 1);
      }
      if (event.userAgent) {
        agentCounts.set(event.userAgent, (agentCounts.get(event.userAgent) || 0) + 1);
      }
    });

    stats.topIpAddresses = Array.from(ipCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([ip, count]) => ({ ip, count }));

    stats.topUserAgents = Array.from(agentCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([agent, count]) => ({ agent, count }));

    return stats;
  }

  cleanup(maxAge: number): number {
    const cutoffDate = new Date(Date.now() - maxAge * 24 * 60 * 60 * 1000);
    const initialLength = this.events.length;
    this.events = this.events.filter(event => event.timestamp > cutoffDate);
    return initialLength - this.events.length;
  }
}

// Security event store instance
const securityEventStore = new SecurityEventStore();

// Security logging class
export class SecurityLogger {
  private config: SecurityLoggingConfig;

  constructor(config: Partial<SecurityLoggingConfig> = {}) {
    this.config = { ...DEFAULT_SECURITY_LOGGING_CONFIG, ...config };
  }

  /**
   * Log a security event
   */
  log(
    type: SecurityEventType,
    severity: SecurityEventSeverity,
    message: string,
    request: NextRequest,
    details?: Record<string, any>,
    userId?: string
  ): SecurityEvent {
    const event: SecurityEvent = {
      id: crypto.randomUUID(),
      type,
      severity,
      timestamp: new Date(),
      userId,
      ipAddress: this.getClientIP(request),
      userAgent: request.headers.get('user-agent') || undefined,
      requestPath: request.nextUrl.pathname,
      requestMethod: request.method,
      statusCode: undefined, // Will be set by caller if needed
      message,
      details,
      correlationId: request.headers.get('x-correlation-id') || undefined,
      sessionId: request.headers.get('x-session-id') || undefined,
      riskScore: this.calculateRiskScore(type, severity, details),
      source: this.determineSource(request),
      tags: this.generateTags(type, severity, request)
    };

    // Store the event
    if (this.config.storeEvents) {
      securityEventStore.addEvent(event);
    }

    // Console logging based on severity
    const logLevel = this.getLogLevel(severity);
    const logData = {
      event: event.id,
      type: event.type,
      severity: event.severity,
      userId: event.userId,
      ip: event.ipAddress,
      path: event.requestPath,
      message: event.message,
      riskScore: event.riskScore
    };

    switch (logLevel) {
      case 'error':
        console.error('🚨 [SECURITY]', logData, details);
        break;
      case 'warn':
        console.warn('⚠️ [SECURITY]', logData, details);
        break;
      case 'info':
        console.info('ℹ️ [SECURITY]', logData);
        break;
      case 'debug':
        console.debug('🔍 [SECURITY]', logData, details);
        break;
    }

    // Check for alert thresholds
    this.checkAlertThresholds(event);

    // Send real-time alerts if enabled
    if (this.config.enableRealTimeAlerts && this.shouldAlert(event)) {
      this.sendAlert(event);
    }

    return event;
  }

  /**
   * Log authentication events
   */
  logAuthEvent(
    type: SecurityEventType.LOGIN_SUCCESS | SecurityEventType.LOGIN_FAILURE,
    request: NextRequest,
    userId?: string,
    details?: Record<string, any>
  ): SecurityEvent {
    const severity = type === SecurityEventType.LOGIN_SUCCESS
      ? SecurityEventSeverity.LOW
      : SecurityEventSeverity.MEDIUM;

    return this.log(
      type,
      severity,
      type === SecurityEventType.LOGIN_SUCCESS ? 'User logged in successfully' : 'Login attempt failed',
      request,
      details,
      userId
    );
  }

  /**
   * Log authorization events
   */
  logAuthzEvent(
    type: SecurityEventType.UNAUTHORIZED_ACCESS | SecurityEventType.FORBIDDEN_ACCESS,
    request: NextRequest,
    userId?: string,
    details?: Record<string, any>
  ): SecurityEvent {
    return this.log(
      type,
      SecurityEventSeverity.HIGH,
      type === SecurityEventType.UNAUTHORIZED_ACCESS
        ? 'Unauthorized access attempt'
        : 'Forbidden access attempt',
      request,
      details,
      userId
    );
  }

  /**
   * Log rate limiting events
   */
  logRateLimitEvent(
    request: NextRequest,
    limitType: string,
    currentCount: number,
    maxRequests: number,
    userId?: string
  ): SecurityEvent {
    return this.log(
      SecurityEventType.RATE_LIMIT_EXCEEDED,
      SecurityEventSeverity.MEDIUM,
      `Rate limit exceeded for ${limitType}: ${currentCount}/${maxRequests}`,
      request,
      { limitType, currentCount, maxRequests },
      userId
    );
  }

  /**
   * Log CSRF violation events
   */
  logCSRFEvent(
    request: NextRequest,
    reason: string,
    userId?: string
  ): SecurityEvent {
    return this.log(
      SecurityEventType.CSRF_VIOLATION,
      SecurityEventSeverity.HIGH,
      `CSRF violation: ${reason}`,
      request,
      { reason },
      userId
    );
  }

  /**
   * Log validation error events
   */
  logValidationEvent(
    request: NextRequest,
    errors: string[],
    userId?: string
  ): SecurityEvent {
    return this.log(
      SecurityEventType.VALIDATION_ERROR,
      SecurityEventSeverity.LOW,
      `Validation errors: ${errors.join(', ')}`,
      request,
      { errors },
      userId
    );
  }

  /**
   * Log injection attempt events
   */
  logInjectionEvent(
    request: NextRequest,
    patterns: string[],
    userId?: string
  ): SecurityEvent {
    return this.log(
      SecurityEventType.INJECTION_ATTEMPT,
      SecurityEventSeverity.CRITICAL,
      `Potential injection attack detected`,
      request,
      { patterns },
      userId
    );
  }

  /**
   * Get security events with filtering
   */
  getEvents(filters?: Parameters<typeof securityEventStore.getEvents>[0]): SecurityEvent[] {
    return securityEventStore.getEvents(filters);
  }

  /**
   * Get security statistics
   */
  getStats(timeRange?: { start: Date; end: Date }): ReturnType<typeof securityEventStore.getStats> {
    const range = timeRange || {
      start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      end: new Date()
    };

    return securityEventStore.getStats(range);
  }

  /**
   * Cleanup old security events
   */
  cleanup(maxAgeDays: number = 90): number {
    return securityEventStore.cleanup(maxAgeDays);
  }

  // Private helper methods
  private getClientIP(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const clientIp = request.headers.get('x-client-ip');

    return forwarded?.split(',')[0]?.trim() ||
           realIp ||
           clientIp ||
           request.headers.get('cf-connecting-ip') || // Cloudflare
           'unknown';
  }

  private calculateRiskScore(type: SecurityEventType, severity: SecurityEventSeverity, details?: Record<string, any>): number {
    let score = 0;

    // Base score by severity
    switch (severity) {
      case SecurityEventSeverity.LOW:
        score = 1;
        break;
      case SecurityEventSeverity.MEDIUM:
        score = 3;
        break;
      case SecurityEventSeverity.HIGH:
        score = 7;
        break;
      case SecurityEventSeverity.CRITICAL:
        score = 10;
        break;
    }

    // Additional scoring based on event type
    switch (type) {
      case SecurityEventType.INJECTION_ATTEMPT:
        score += 5;
        break;
      case SecurityEventType.SECURITY_BREACH:
        score += 8;
        break;
      case SecurityEventType.LOGIN_FAILURE:
        score += 2;
        break;
      case SecurityEventType.UNAUTHORIZED_ACCESS:
        score += 4;
        break;
      case SecurityEventType.CSRF_VIOLATION:
        score += 3;
        break;
    }

    // Additional scoring based on details
    if (details && details.patterns && details.patterns.length > 0) {
      score += details.patterns.length;
    }

    if (details && details.errors && details.errors.length > 5) {
      score += 2;
    }

    return Math.min(score, 10); // Cap at 10
  }

  private determineSource(request: NextRequest): 'api' | 'web' | 'admin' | 'system' {
    const pathname = request.nextUrl.pathname;

    if (pathname.startsWith('/api/')) {
      if (pathname.startsWith('/api/admin/')) {
        return 'admin';
      }
      return 'api';
    }

    if (pathname.startsWith('/admin/')) {
      return 'admin';
    }

    return 'web';
  }

  private generateTags(type: SecurityEventType, severity: SecurityEventSeverity, request: NextRequest): string[] {
    const tags: string[] = [type, severity];

    if (request.nextUrl.pathname.startsWith('/admin/')) {
      tags.push('admin');
    }

    if (request.nextUrl.pathname.startsWith('/api/')) {
      tags.push('api');
    }

    if (severity === SecurityEventSeverity.CRITICAL || severity === SecurityEventSeverity.HIGH) {
      tags.push('alert');
    }

    return tags;
  }

  private getLogLevel(severity: SecurityEventSeverity): 'error' | 'warn' | 'info' | 'debug' {
    switch (severity) {
      case SecurityEventSeverity.CRITICAL:
        return 'error';
      case SecurityEventSeverity.HIGH:
        return 'error';
      case SecurityEventSeverity.MEDIUM:
        return 'warn';
      case SecurityEventSeverity.LOW:
        return 'info';
      default:
        return 'debug';
    }
  }

  private checkAlertThresholds(event: SecurityEvent): void {
    const threshold = this.config.alertThresholds[event.type];
    if (threshold) {
      const recentEvents = securityEventStore.getEvents({
        type: event.type,
        startDate: new Date(Date.now() - 60 * 60 * 1000) // Last hour
      });

      if (recentEvents.length >= threshold) {
        console.warn(`🚨 [ALERT] Threshold exceeded for ${event.type}: ${recentEvents.length} events in last hour`);
      }
    }
  }

  private shouldAlert(event: SecurityEvent): boolean {
    // Alert for high and critical severity events
    return event.severity === SecurityEventSeverity.HIGH ||
           event.severity === SecurityEventSeverity.CRITICAL;
  }

  private async sendAlert(event: SecurityEvent): Promise<void> {
    if (!this.config.alertWebhooks?.length) {
      return;
    }

    try {
      const alertPayload = {
        event: event.id,
        type: event.type,
        severity: event.severity,
        message: event.message,
        timestamp: event.timestamp.toISOString(),
        userId: event.userId,
        ipAddress: event.ipAddress,
        requestPath: event.requestPath,
        riskScore: event.riskScore
      };

      // Send alerts to configured webhooks
      await Promise.allSettled(
        this.config.alertWebhooks!.map(async (webhook) => {
          await fetch(webhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(alertPayload)
          });
        })
      );
    } catch (error) {
      console.error('Failed to send security alert:', error);
    }
  }
}

// Export singleton instance
export const securityLogger = new SecurityLogger();

// Security monitoring utilities
export const SecurityMonitoring = {
  /**
   * Check for suspicious activity patterns
   */
  detectAnomalies(events: SecurityEvent[]): {
    suspiciousIPs: Array<{ ip: string; events: SecurityEvent[]; risk: number }>;
    suspiciousUsers: Array<{ userId: string; events: SecurityEvent[]; risk: number }>;
    attackPatterns: Array<{ pattern: string; events: SecurityEvent[]; risk: number }>;
  } {
    const suspiciousIPs: Array<{ ip: string; events: SecurityEvent[]; risk: number }> = [];
    const suspiciousUsers: Array<{ userId: string; events: SecurityEvent[]; risk: number }> = [];
    const attackPatterns: Array<{ pattern: string; events: SecurityEvent[]; risk: number }> = [];

    // Group events by IP
    const eventsByIP = new Map<string, SecurityEvent[]>();
    const eventsByUser = new Map<string, SecurityEvent[]>();

    events.forEach(event => {
      // Group by IP
      if (!eventsByIP.has(event.ipAddress)) {
        eventsByIP.set(event.ipAddress, []);
      }
      eventsByIP.get(event.ipAddress)!.push(event);

      // Group by user
      if (event.userId) {
        if (!eventsByUser.has(event.userId)) {
          eventsByUser.set(event.userId, []);
        }
        eventsByUser.get(event.userId)!.push(event);
      }
    });

    // Analyze IP patterns
    eventsByIP.forEach((ipEvents, ip) => {
      if (ipEvents.length >= 10) {
        const highSeverityEvents = ipEvents.filter(e => e.severity === SecurityEventSeverity.HIGH || e.severity === SecurityEventSeverity.CRITICAL);
        const risk = highSeverityEvents.length * 2 + Math.min(ipEvents.length / 10, 5);

        if (risk >= 5) {
          suspiciousIPs.push({ ip, events: ipEvents, risk });
        }
      }
    });

    // Analyze user patterns
    eventsByUser.forEach((userEvents, userId) => {
      if (userEvents.length >= 5) {
        const recentFailures = userEvents.filter(e =>
          e.type === SecurityEventType.LOGIN_FAILURE &&
          e.timestamp > new Date(Date.now() - 60 * 60 * 1000) // Last hour
        );

        const risk = recentFailures.length * 3 + (userEvents.length / 5);

        if (risk >= 8) {
          suspiciousUsers.push({ userId, events: userEvents, risk });
        }
      }
    });

    // Detect attack patterns
    const injectionAttempts = events.filter(e => e.type === SecurityEventType.INJECTION_ATTEMPT);
    if (injectionAttempts.length >= 3) {
      attackPatterns.push({
        pattern: 'Multiple injection attempts',
        events: injectionAttempts,
        risk: injectionAttempts.length * 2
      });
    }

    const csrfViolations = events.filter(e => e.type === SecurityEventType.CSRF_VIOLATION);
    if (csrfViolations.length >= 5) {
      attackPatterns.push({
        pattern: 'CSRF attack pattern',
        events: csrfViolations,
        risk: csrfViolations.length
      });
    }

    return { suspiciousIPs, suspiciousUsers, attackPatterns };
  },

  /**
   * Generate security report
   */
  generateReport(timeRange: { start: Date; end: Date }): {
    summary: {
      totalEvents: number;
      criticalEvents: number;
      highRiskEvents: number;
      averageRiskScore: number;
    };
    trends: {
      eventsByHour: Array<{ hour: string; count: number }>;
      eventsByType: Record<SecurityEventType, number>;
      topThreats: Array<{ type: SecurityEventType; count: number; risk: number }>;
    };
    recommendations: string[];
  } {
    const events = securityEventStore.getEvents({
      startDate: timeRange.start,
      endDate: timeRange.end
    });

    const summary = {
      totalEvents: events.length,
      criticalEvents: events.filter(e => e.severity === SecurityEventSeverity.CRITICAL).length,
      highRiskEvents: events.filter(e => e.riskScore && e.riskScore >= 7).length,
      averageRiskScore: events.length > 0 ? events.reduce((sum, e) => sum + (e.riskScore || 0), 0) / events.length : 0
    };

    // Events by hour for trend analysis
    const eventsByHour = new Map<string, number>();
    events.forEach(event => {
      const hour = event.timestamp.toISOString().substring(0, 13); // YYYY-MM-DDTHH
      eventsByHour.set(hour, (eventsByHour.get(hour) || 0) + 1);
    });

    const trends = {
      eventsByHour: Array.from(eventsByHour.entries())
        .sort()
        .map(([hour, count]) => ({ hour, count })),
      eventsByType: {} as Record<SecurityEventType, number>,
      topThreats: [] as Array<{ type: SecurityEventType; count: number; risk: number }>
    };

    // Count by type
    events.forEach(event => {
      trends.eventsByType[event.type] = (trends.eventsByType[event.type] || 0) + 1;
    });

    // Top threats by risk score
    const threatScores = new Map<SecurityEventType, { count: number; totalRisk: number }>();
    events.forEach(event => {
      const current = threatScores.get(event.type) || { count: 0, totalRisk: 0 };
      threatScores.set(event.type, {
        count: current.count + 1,
        totalRisk: current.totalRisk + (event.riskScore || 0)
      });
    });

    trends.topThreats = Array.from(threatScores.entries())
      .map(([type, data]) => ({
        type,
        count: data.count,
        risk: data.totalRisk / data.count
      }))
      .sort((a, b) => b.risk - a.risk)
      .slice(0, 10);

    // Generate recommendations
    const recommendations: string[] = [];

    if (summary.criticalEvents > 0) {
      recommendations.push('Immediate attention required for critical security events');
    }

    if (summary.averageRiskScore > 5) {
      recommendations.push('High risk score indicates potential security threats');
    }

    const injectionAttempts = events.filter(e => e.type === SecurityEventType.INJECTION_ATTEMPT).length;
    if (injectionAttempts > 0) {
      recommendations.push(`${injectionAttempts} injection attempts detected - review input validation`);
    }

    const loginFailures = events.filter(e => e.type === SecurityEventType.LOGIN_FAILURE).length;
    if (loginFailures > 10) {
      recommendations.push(`High number of login failures (${loginFailures}) - consider implementing CAPTCHA`);
    }

    return { summary, trends, recommendations };
  }
};
