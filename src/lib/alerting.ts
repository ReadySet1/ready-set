// src/lib/alerting.ts
import { ErrorSeverity, ErrorCategory, StructuredError, getErrorMetrics } from './error-logging';

// Alert types and severities
export enum AlertType {
  ERROR_THRESHOLD = 'error_threshold',
  PERFORMANCE_DEGRADATION = 'performance_degradation',
  SERVICE_DOWN = 'service_down',
  SECURITY_INCIDENT = 'security_incident',
  RESOURCE_EXHAUSTION = 'resource_exhaustion'
}

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
  EMERGENCY = 'emergency'
}

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  timestamp: string;
  data: Record<string, any>;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  source: string;
  fingerprint: string; // For deduplication
}

// Alert thresholds configuration
interface AlertThresholds {
  criticalErrorsPerHour: number;
  highErrorsPerHour: number;
  errorRatePercentage: number;
  responseTimeMs: number;
  memoryUsagePercentage: number;
  authFailuresPerMinute: number;
  databaseConnectionFailures: number;
}

const DEFAULT_THRESHOLDS: AlertThresholds = {
  criticalErrorsPerHour: 5,
  highErrorsPerHour: 20,
  errorRatePercentage: 10,
  responseTimeMs: 2000,
  memoryUsagePercentage: 85,
  authFailuresPerMinute: 10,
  databaseConnectionFailures: 3
};

// Alert storage (in production, this would be a database or external service)
class AlertStore {
  private alerts: Alert[] = [];
  private readonly maxAlerts = 1000;

  add(alert: Alert): void {
    // Check for existing unresolved alert with same fingerprint
    const existingAlert = this.alerts.find(
      a => a.fingerprint === alert.fingerprint && !a.resolved
    );

    if (existingAlert) {
      // Update existing alert instead of creating duplicate
      existingAlert.timestamp = alert.timestamp;
      existingAlert.data = { ...existingAlert.data, ...alert.data };
      return;
    }

    this.alerts.unshift(alert);
    
    // Keep only the most recent alerts
    if (this.alerts.length > this.maxAlerts) {
      this.alerts = this.alerts.slice(0, this.maxAlerts);
    }
  }

  getActiveAlerts(): Alert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }

  getRecentAlerts(limit: number = 50): Alert[] {
    return this.alerts.slice(0, limit);
  }

  resolveAlert(alertId: string, resolvedBy: string = 'system'): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date().toISOString();
      alert.resolvedBy = resolvedBy;
      return true;
    }
    return false;
  }

  getAlertsByType(type: AlertType): Alert[] {
    return this.alerts.filter(alert => alert.type === type);
  }

  getAlertsBySeverity(severity: AlertSeverity): Alert[] {
    return this.alerts.filter(alert => alert.severity === severity);
  }
}

// Global alert store
const alertStore = new AlertStore();

/**
 * Generate a fingerprint for alert deduplication
 */
function generateAlertFingerprint(type: AlertType, source: string, data: any): string {
  const key = `${type}-${source}-${JSON.stringify(data).substring(0, 100)}`;
  return Buffer.from(key).toString('base64').substring(0, 16);
}

/**
 * Create and store an alert
 */
export function createAlert(
  type: AlertType,
  severity: AlertSeverity,
  title: string,
  description: string,
  source: string,
  data: Record<string, any> = {}
): Alert {
  const alertId = `alert_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const fingerprint = generateAlertFingerprint(type, source, data);

  const alert: Alert = {
    id: alertId,
    type,
    severity,
    title,
    description,
    timestamp: new Date().toISOString(),
    data,
    resolved: false,
    source,
    fingerprint
  };

  alertStore.add(alert);

  // Log alert to console
  const logLevel = severity === AlertSeverity.CRITICAL || severity === AlertSeverity.EMERGENCY ? 'error' : 'warn';
  console[logLevel](`🚨 ALERT [${severity.toUpperCase()}] ${title}`, {
    alertId,
    type,
    description,
    data
  });

  // In production, you would send alerts to external services here
  // await sendToSlack(alert);
  // await sendToPagerDuty(alert);
  // await sendToEmail(alert);

  return alert;
}

/**
 * Monitor error thresholds and create alerts
 */
export function monitorErrorThresholds(thresholds: Partial<AlertThresholds> = {}): void {
  const config = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const errorMetrics = getErrorMetrics();

  // Check critical error threshold
  const criticalErrors = errorMetrics.errorsBySeverity.critical || 0;
  if (criticalErrors >= config.criticalErrorsPerHour) {
    createAlert(
      AlertType.ERROR_THRESHOLD,
      AlertSeverity.CRITICAL,
      'Critical Error Threshold Exceeded',
      `${criticalErrors} critical errors detected in the last hour (threshold: ${config.criticalErrorsPerHour})`,
      'error-monitoring',
      {
        criticalErrorCount: criticalErrors,
        threshold: config.criticalErrorsPerHour,
        recentErrors: errorMetrics.recentErrors.slice(0, 5)
      }
    );
  }

  // Check high error threshold
  const highErrors = errorMetrics.errorsBySeverity.high || 0;
  if (highErrors >= config.highErrorsPerHour) {
    createAlert(
      AlertType.ERROR_THRESHOLD,
      AlertSeverity.WARNING,
      'High Error Threshold Exceeded',
      `${highErrors} high-severity errors detected in the last hour (threshold: ${config.highErrorsPerHour})`,
      'error-monitoring',
      {
        highErrorCount: highErrors,
        threshold: config.highErrorsPerHour,
        errorCategories: errorMetrics.errorsByCategory
      }
    );
  }

  // Check error rate
  const errorRate = errorMetrics.totalErrors > 0 ? 
    (errorMetrics.recentErrors.length / errorMetrics.totalErrors) * 100 : 0;
  
  if (errorRate >= config.errorRatePercentage) {
    createAlert(
      AlertType.PERFORMANCE_DEGRADATION,
      AlertSeverity.WARNING,
      'High Error Rate Detected',
      `Error rate is ${errorRate.toFixed(2)}% (threshold: ${config.errorRatePercentage}%)`,
      'error-monitoring',
      {
        errorRate,
        threshold: config.errorRatePercentage,
        totalErrors: errorMetrics.totalErrors,
        recentErrors: errorMetrics.recentErrors.length
      }
    );
  }
}

/**
 * Monitor authentication failures
 */
export function monitorAuthFailures(failures: number, timeWindowMinutes: number = 1): void {
  const threshold = DEFAULT_THRESHOLDS.authFailuresPerMinute;
  
  if (failures >= threshold) {
    createAlert(
      AlertType.SECURITY_INCIDENT,
      AlertSeverity.CRITICAL,
      'Authentication Failure Spike',
      `${failures} authentication failures in ${timeWindowMinutes} minute(s) (threshold: ${threshold})`,
      'auth-monitoring',
      {
        failureCount: failures,
        timeWindow: timeWindowMinutes,
        threshold,
        possibleAttack: failures > threshold * 2
      }
    );
  }
}

/**
 * Monitor database connection issues
 */
export function monitorDatabaseHealth(connectionFailures: number): void {
  const threshold = DEFAULT_THRESHOLDS.databaseConnectionFailures;
  
  if (connectionFailures >= threshold) {
    createAlert(
      AlertType.SERVICE_DOWN,
      AlertSeverity.EMERGENCY,
      'Database Connection Failures',
      `${connectionFailures} database connection failures detected (threshold: ${threshold})`,
      'database-monitoring',
      {
        failureCount: connectionFailures,
        threshold,
        recommendation: 'Check database server health and connection pool settings'
      }
    );
  }
}

/**
 * Monitor API performance
 */
export function monitorApiPerformance(endpoint: string, responseTime: number): void {
  const threshold = DEFAULT_THRESHOLDS.responseTimeMs;
  
  if (responseTime >= threshold) {
    createAlert(
      AlertType.PERFORMANCE_DEGRADATION,
      responseTime >= threshold * 2 ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
      'API Performance Degradation',
      `${endpoint} responded in ${responseTime}ms (threshold: ${threshold}ms)`,
      'performance-monitoring',
      {
        endpoint,
        responseTime,
        threshold,
        slowResponse: responseTime >= threshold * 2
      }
    );
  }
}

/**
 * Monitor memory usage
 */
export function monitorMemoryUsage(): void {
  const memoryUsage = process.memoryUsage();
  const totalMemory = memoryUsage.heapTotal;
  const usedMemory = memoryUsage.heapUsed;
  const usagePercentage = (usedMemory / totalMemory) * 100;
  const threshold = DEFAULT_THRESHOLDS.memoryUsagePercentage;
  
  if (usagePercentage >= threshold) {
    createAlert(
      AlertType.RESOURCE_EXHAUSTION,
      usagePercentage >= 95 ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
      'High Memory Usage',
      `Memory usage is ${usagePercentage.toFixed(2)}% (threshold: ${threshold}%)`,
      'resource-monitoring',
      {
        usagePercentage,
        threshold,
        memoryUsage: {
          used: `${(usedMemory / 1024 / 1024).toFixed(2)} MB`,
          total: `${(totalMemory / 1024 / 1024).toFixed(2)} MB`,
          external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)} MB`
        }
      }
    );
  }
}

/**
 * Monitor specific error patterns
 */
export function monitorErrorPatterns(error: StructuredError): void {
  // Monitor for potential security issues
  if (error.category === ErrorCategory.AUTH) {
    if (error.message.includes('brute force') || 
        error.message.includes('multiple failed attempts')) {
      createAlert(
        AlertType.SECURITY_INCIDENT,
        AlertSeverity.CRITICAL,
        'Potential Brute Force Attack',
        `Authentication security incident detected: ${error.message}`,
        'security-monitoring',
        {
          errorId: error.id,
          endpoint: error.context.endpoint,
          ip: error.context.ip,
          userAgent: error.context.userAgent
        }
      );
    }
  }

  // Monitor for database issues
  if (error.category === ErrorCategory.DATABASE && error.severity === ErrorSeverity.CRITICAL) {
    createAlert(
      AlertType.SERVICE_DOWN,
      AlertSeverity.CRITICAL,
      'Database Service Issue',
      `Critical database error: ${error.message}`,
      'database-monitoring',
      {
        errorId: error.id,
        endpoint: error.context.request?.endpoint,
        operation: error.context.custom?.databaseOperation
      }
    );
  }

  // Monitor for payment issues
  if (error.category === ErrorCategory.PAYMENT) {
    createAlert(
      AlertType.ERROR_THRESHOLD,
      AlertSeverity.CRITICAL,
      'Payment Processing Error',
      `Payment system error: ${error.message}`,
      'payment-monitoring',
      {
        errorId: error.id,
        endpoint: error.context.request?.endpoint,
        userId: error.context.user?.id
      }
    );
  }
}

/**
 * Run comprehensive monitoring checks
 */
export function runMonitoringChecks(): void {
  try {
    monitorErrorThresholds();
    monitorMemoryUsage();
    
    // Log monitoring run
      } catch (error) {
    console.error('Error running monitoring checks:', error);
  }
}

/**
 * Get current alerts
 */
export function getActiveAlerts(): Alert[] {
  return alertStore.getActiveAlerts();
}

/**
 * Get recent alerts
 */
export function getRecentAlerts(limit: number = 50): Alert[] {
  return alertStore.getRecentAlerts(limit);
}

/**
 * Resolve an alert
 */
export function resolveAlert(alertId: string, resolvedBy: string = 'system'): boolean {
  return alertStore.resolveAlert(alertId, resolvedBy);
}

/**
 * Get alerts by type
 */
export function getAlertsByType(type: AlertType): Alert[] {
  return alertStore.getAlertsByType(type);
}

/**
 * Get alerts by severity
 */
export function getAlertsBySeverity(severity: AlertSeverity): Alert[] {
  return alertStore.getAlertsBySeverity(severity);
}

/**
 * Get alert statistics
 */
export function getAlertStatistics(): {
  total: number;
  active: number;
  resolved: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
} {
  const allAlerts = alertStore.getRecentAlerts(1000);
  const activeAlerts = alertStore.getActiveAlerts();
  
  const byType: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  
  allAlerts.forEach(alert => {
    byType[alert.type] = (byType[alert.type] || 0) + 1;
    bySeverity[alert.severity] = (bySeverity[alert.severity] || 0) + 1;
  });
  
  return {
    total: allAlerts.length,
    active: activeAlerts.length,
    resolved: allAlerts.length - activeAlerts.length,
    byType,
    bySeverity
  };
}

// Initialize periodic monitoring (run every 5 minutes)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    runMonitoringChecks();
  }, 5 * 60 * 1000); // 5 minutes
} 