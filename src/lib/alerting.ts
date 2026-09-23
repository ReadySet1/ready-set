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

// Process-wide alert store. Next.js evaluates this module once per bundle
// layer; keeping the store on globalThis means /api/health/alerts reads the
// same alerts the monitoring interval writes.
const ALERT_STORE_KEY = Symbol.for('readyset.alerting.alertStore');

function getProcessAlertStore(): AlertStore {
  const g = globalThis as Record<symbol, unknown>;
  const existing = g[ALERT_STORE_KEY];
  if (existing instanceof AlertStore) return existing;
  // A store created by another module copy is a different class instance;
  // it still has the same shape, so reuse it rather than orphaning it.
  if (existing && typeof (existing as AlertStore).add === 'function') return existing as AlertStore;
  const store = new AlertStore();
  g[ALERT_STORE_KEY] = store;
  return store;
}

const alertStore = getProcessAlertStore();

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

export interface MemorySnapshot {
  heapUsed: number;
  heapTotal: number;
  /** V8 heap ceiling (`heap_size_limit`, honours --max-old-space-size). */
  heapLimit: number | null;
  rss: number;
  external: number;
  /** Container memory limit from cgroups, or null when unlimited/unreadable. */
  cgroupLimit: number | null;
}

const CGROUP_LIMIT_PATHS = [
  '/sys/fs/cgroup/memory.max', // cgroup v2
  '/sys/fs/cgroup/memory/memory.limit_in_bytes', // cgroup v1
];

// cgroup v1 reports "no limit" as a page-aligned value near 2^63.
const CGROUP_UNLIMITED_THRESHOLD = 2 ** 60;

type NodeBuiltinLoader = (id: string) => any;

/**
 * Load a Node builtin without a static import, so client/edge bundles that
 * transitively include this module never try to resolve `fs` / `v8`.
 */
function loadNodeBuiltin(id: string): any | null {
  if (typeof process === 'undefined') return null;
  const loader = (process as unknown as { getBuiltinModule?: NodeBuiltinLoader }).getBuiltinModule;
  if (typeof loader !== 'function') return null;
  try {
    return loader(id) ?? null;
  } catch {
    return null;
  }
}

function defaultReadFile(path: string): string {
  const fs = loadNodeBuiltin('fs');
  if (!fs) throw new Error('fs unavailable');
  return fs.readFileSync(path, 'utf8');
}

/**
 * Read the container memory limit (cgroup v2, then v1). Returns null when the
 * limit is "max", the v1 unlimited sentinel, or the files are unreadable.
 */
export function readCgroupMemoryLimit(
  readFile: (path: string) => string = defaultReadFile
): number | null {
  for (const path of CGROUP_LIMIT_PATHS) {
    let raw: string;
    try {
      raw = readFile(path).trim();
    } catch {
      continue;
    }
    if (raw === '' || raw === 'max') return null;
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0 || value >= CGROUP_UNLIMITED_THRESHOLD) return null;
    return value;
  }
  return null;
}

/**
 * Snapshot current process memory against its real ceilings. Returns null
 * outside Node (browser / edge runtime).
 */
export function getMemorySnapshot(): MemorySnapshot | null {
  if (typeof process === 'undefined' || typeof process.memoryUsage !== 'function') return null;
  const usage = process.memoryUsage();
  const v8 = loadNodeBuiltin('v8');
  let heapLimit: number | null = null;
  try {
    heapLimit = v8 ? v8.getHeapStatistics().heap_size_limit : null;
  } catch {
    heapLimit = null;
  }
  return {
    heapUsed: usage.heapUsed,
    heapTotal: usage.heapTotal,
    heapLimit,
    rss: usage.rss,
    external: usage.external,
    cgroupLimit: readCgroupMemoryLimit(),
  };
}

const MEMORY_NO_LIMIT_WARNED_KEY = Symbol.for('readyset.alerting.memoryNoLimitWarned');

const toMb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

/**
 * Monitor memory usage.
 *
 * Compares heapUsed against the V8 heap size limit and RSS against the cgroup
 * memory limit. heapUsed / heapTotal is deliberately NOT used: V8 keeps
 * heapTotal just above heapUsed, so that ratio sits at 85-96% on a healthy
 * process.
 */
export function monitorMemoryUsage(snapshot: MemorySnapshot | null = getMemorySnapshot()): void {
  if (!snapshot) return;
  const threshold = DEFAULT_THRESHOLDS.memoryUsagePercentage;

  if (!snapshot.heapLimit && !snapshot.cgroupLimit) {
    const g = globalThis as Record<symbol, unknown>;
    if (!g[MEMORY_NO_LIMIT_WARNED_KEY]) {
      g[MEMORY_NO_LIMIT_WARNED_KEY] = true;
      console.warn('memory monitoring disabled: no heap or cgroup limit available');
    }
    return;
  }

  const heapUsagePercentage =
    snapshot.heapLimit && snapshot.heapLimit > 0 ? (snapshot.heapUsed / snapshot.heapLimit) * 100 : null;
  const rssUsagePercentage =
    snapshot.cgroupLimit && snapshot.cgroupLimit > 0 ? (snapshot.rss / snapshot.cgroupLimit) * 100 : null;

  const usagePercentage = Math.max(heapUsagePercentage ?? 0, rssUsagePercentage ?? 0);
  if (usagePercentage < threshold) return;

  const parts: string[] = [];
  if (heapUsagePercentage !== null) parts.push(`heap ${heapUsagePercentage.toFixed(2)}% of V8 limit`);
  if (rssUsagePercentage !== null) parts.push(`RSS ${rssUsagePercentage.toFixed(2)}% of container limit`);

  createAlert(
    AlertType.RESOURCE_EXHAUSTION,
    usagePercentage >= 95 ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
    'High Memory Usage',
    `Memory usage is ${usagePercentage.toFixed(2)}% (${parts.join(', ')}; threshold: ${threshold}%)`,
    'resource-monitoring',
    {
      usagePercentage,
      heapUsagePercentage,
      rssUsagePercentage,
      threshold,
      memoryUsage: {
        used: toMb(snapshot.heapUsed),
        total: snapshot.heapLimit ? toMb(snapshot.heapLimit) : null,
        heapTotal: toMb(snapshot.heapTotal),
        external: toMb(snapshot.external),
        rss: toMb(snapshot.rss),
        cgroupLimit: snapshot.cgroupLimit ? toMb(snapshot.cgroupLimit) : null,
      },
    }
  );
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

// Initialize periodic monitoring (run every 5 minutes).
// Next.js evaluates this module once per bundle layer/chunk that includes it,
// all inside the same Node process. A process-wide guard on globalThis keeps it
// to a single interval; without it each copy scheduled its own and every tick
// logged the memory alert more than once.
const MONITORING_INTERVAL_KEY = Symbol.for('readyset.alerting.monitoringInterval');

function scheduleMonitoring(): void {
  if (typeof window !== 'undefined' || typeof setInterval === 'undefined') return;
  const g = globalThis as Record<symbol, unknown>;
  if (g[MONITORING_INTERVAL_KEY]) return;
  const handle = setInterval(() => {
    runMonitoringChecks();
  }, 5 * 60 * 1000);
  (handle as { unref?: () => void }).unref?.();
  g[MONITORING_INTERVAL_KEY] = handle;
}

scheduleMonitoring();
