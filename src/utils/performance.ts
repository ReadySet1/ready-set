/**
 * Performance monitoring utilities for tracking API response times
 * and identifying performance bottlenecks
 */

interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

interface PerformanceThresholds {
  warning: number; // milliseconds
  error: number; // milliseconds
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private timers: Map<string, number> = new Map();
  private thresholds: PerformanceThresholds = {
    warning: 2000, // 2 seconds
    error: 5000, // 5 seconds
  };

  /**
   * Start timing an operation
   */
  startTimer(name: string): void {
    this.timers.set(name, performance.now());
  }

  /**
   * End timing an operation and record the metric
   */
  endTimer(name: string, metadata?: Record<string, any>): number {
    const startTime = this.timers.get(name);
    if (!startTime) {
      console.warn(`Timer '${name}' was not started`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.timers.delete(name);

    const metric: PerformanceMetric = {
      name,
      duration,
      timestamp: Date.now(),
      metadata,
    };

    this.metrics.push(metric);
    this.logPerformance(metric);

    return duration;
  }

  /**
   * Measure the duration of an async operation
   */
  async measure<T>(
    name: string,
    operation: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    this.startTimer(name);
    try {
      const result = await operation();
      this.endTimer(name, metadata);
      return result;
    } catch (error) {
      this.endTimer(name, { ...metadata, error: true });
      throw error;
    }
  }

  /**
   * Log performance metrics with appropriate log levels
   */
  private logPerformance(metric: PerformanceMetric): void {
    const { name, duration, metadata } = metric;
    const formattedDuration = `${duration.toFixed(2)}ms`;

    if (duration >= this.thresholds.error) {
      console.error(`🔴 SLOW OPERATION: ${name} took ${formattedDuration}`, metadata);
    } else if (duration >= this.thresholds.warning) {
      console.warn(`🟡 SLOW OPERATION: ${name} took ${formattedDuration}`, metadata);
    } else if (process.env.NODE_ENV === 'development') {
      console.log(`⚡ ${name}: ${formattedDuration}`, metadata);
    }
  }

  /**
   * Get performance statistics for a specific operation
   */
  getStats(name: string): {
    count: number;
    average: number;
    min: number;
    max: number;
    recent: PerformanceMetric[];
  } | null {
    const operationMetrics = this.metrics.filter(m => m.name === name);
    if (operationMetrics.length === 0) return null;

    const durations = operationMetrics.map(m => m.duration);
    const recent = operationMetrics.slice(-10); // Last 10 operations

    return {
      count: operationMetrics.length,
      average: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      recent,
    };
  }

  /**
   * Get all performance metrics
   */
  getAllMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * Clear old metrics (keep only last 100)
   */
  cleanup(): void {
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }
  }

  /**
   * Set performance thresholds
   */
  setThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Decorator for measuring API route performance
 */
export function withPerformanceMonitoring<T extends any[], R>(
  name: string,
  fn: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    return performanceMonitor.measure(name, () => fn(...args));
  };
}

/**
 * Utility for measuring database query performance
 */
export async function measureQuery<T>(
  queryName: string,
  query: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  return performanceMonitor.measure(`DB: ${queryName}`, query, metadata);
}

/**
 * Utility for measuring API call performance
 */
export async function measureApiCall<T>(
  endpoint: string,
  apiCall: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  return performanceMonitor.measure(`API: ${endpoint}`, apiCall, metadata);
}

/**
 * React hook for measuring component render performance
 */
export function usePerformanceMonitoring(componentName: string) {
  const startRender = () => {
    performanceMonitor.startTimer(`Render: ${componentName}`);
  };

  const endRender = () => {
    performanceMonitor.endTimer(`Render: ${componentName}`);
  };

  return { startRender, endRender };
}

// Cleanup metrics periodically
if (typeof window !== 'undefined') {
  setInterval(() => {
    performanceMonitor.cleanup();
  }, 60000); // Every minute
} 