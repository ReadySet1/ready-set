/**
 * Dashboard Performance Monitoring
 *
 * Tracks and analyzes dashboard metrics API performance, cache effectiveness,
 * and provides insights for optimization.
 */

interface PerformanceMetric {
  timestamp: number;
  endpoint: string;
  method: string;
  userType?: string;
  userId?: string;
  duration: number;
  cacheHit: boolean;
  queryCount?: number;
  error?: string;
  statusCode?: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalRequests: number;
  averageResponseTime: number;
  cacheSize: number;
}

class DashboardPerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private maxMetrics = 1000; // Keep last 1000 metrics
  private cacheStats: Map<string, { hits: number; misses: number; totalTime: number; requestCount: number }> = new Map();

  recordMetric(metric: Omit<PerformanceMetric, 'timestamp'>): void {
    const fullMetric: PerformanceMetric = {
      ...metric,
      timestamp: Date.now()
    };

    this.metrics.push(fullMetric);

    // Keep only the last maxMetrics entries
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Update cache stats
    this.updateCacheStats(metric);
  }

  private updateCacheStats(metric: Omit<PerformanceMetric, 'timestamp'>): void {
    const cacheKey = `${metric.endpoint}:${metric.cacheHit ? 'hit' : 'miss'}`;

    if (!this.cacheStats.has(cacheKey)) {
      this.cacheStats.set(cacheKey, { hits: 0, misses: 0, totalTime: 0, requestCount: 0 });
    }

    const stats = this.cacheStats.get(cacheKey)!;

    if (metric.cacheHit) {
      stats.hits++;
    } else {
      stats.misses++;
    }

    stats.totalTime += metric.duration;
    stats.requestCount++;
  }

  getCacheStats(): CacheStats {
    const totalHits = Array.from(this.cacheStats.values()).reduce((sum, stat) => sum + stat.hits, 0);
    const totalMisses = Array.from(this.cacheStats.values()).reduce((sum, stat) => sum + stat.misses, 0);
    const totalRequests = totalHits + totalMisses;
    const totalTime = Array.from(this.cacheStats.values()).reduce((sum, stat) => sum + stat.totalTime, 0);

    return {
      hits: totalHits,
      misses: totalMisses,
      hitRate: totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0,
      totalRequests,
      averageResponseTime: totalRequests > 0 ? totalTime / totalRequests : 0,
      cacheSize: this.cacheStats.size
    };
  }

  getSlowQueries(thresholdMs = 1000): PerformanceMetric[] {
    return this.metrics.filter(metric => metric.duration > thresholdMs);
  }

  getErrorMetrics(): PerformanceMetric[] {
    return this.metrics.filter(metric => metric.error || (metric.statusCode && metric.statusCode >= 500));
  }

  getMetricsByUserType(userType?: string): PerformanceMetric[] {
    if (!userType) {
      return this.metrics;
    }
    return this.metrics.filter(metric => metric.userType === userType);
  }

  getAverageResponseTime(timeWindowMinutes = 60): number {
    const cutoffTime = Date.now() - (timeWindowMinutes * 60 * 1000);
    const recentMetrics = this.metrics.filter(metric => metric.timestamp > cutoffTime);

    if (recentMetrics.length === 0) {
      return 0;
    }

    const totalTime = recentMetrics.reduce((sum, metric) => sum + metric.duration, 0);
    return totalTime / recentMetrics.length;
  }

  getMetricsSummary(): {
    totalRequests: number;
    averageResponseTime: number;
    slowQueriesCount: number;
    errorCount: number;
    cacheStats: CacheStats;
    topEndpoints: Array<{ endpoint: string; count: number }>;
  } {
    const totalRequests = this.metrics.length;
    const averageResponseTime = totalRequests > 0
      ? this.metrics.reduce((sum, metric) => sum + metric.duration, 0) / totalRequests
      : 0;

    const slowQueriesCount = this.getSlowQueries().length;
    const errorCount = this.getErrorMetrics().length;

    // Group by endpoint
    const endpointCounts = this.metrics.reduce((acc, metric) => {
      acc[metric.endpoint] = (acc[metric.endpoint] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topEndpoints = Object.entries(endpointCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([endpoint, count]) => ({ endpoint, count }));

    return {
      totalRequests,
      averageResponseTime,
      slowQueriesCount,
      errorCount,
      cacheStats: this.getCacheStats(),
      topEndpoints
    };
  }

  clearMetrics(): void {
    this.metrics = [];
    this.cacheStats.clear();
  }

  exportMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }
}

// Global instance
export const dashboardPerformanceMonitor = new DashboardPerformanceMonitor();

// Utility functions for API routes
export function recordApiPerformance(
  endpoint: string,
  method: string,
  duration: number,
  options: {
    userType?: string;
    userId?: string;
    cacheHit: boolean;
    queryCount?: number;
    error?: string;
    statusCode?: number;
  }
): void {
  dashboardPerformanceMonitor.recordMetric({
    endpoint,
    method,
    duration,
    ...options
  });
}

export function getDashboardPerformanceReport() {
  return dashboardPerformanceMonitor.getMetricsSummary();
}

export function getCachePerformanceReport() {
  return dashboardPerformanceMonitor.getCacheStats();
}

