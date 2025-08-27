import { useEffect, useRef, useCallback } from 'react';

interface PerformanceMetrics {
  apiCalls: number;
  totalResponseTime: number;
  averageResponseTime: number;
  lastCallTime: number;
  suspiciousPatterns: number;
  errors: number;
}

interface ApiCallLog {
  timestamp: number;
  url: string;
  method: string;
  responseTime: number;
  status: number;
  success: boolean;
}

export function usePerformanceMonitor() {
  const metricsRef = useRef<PerformanceMetrics>({
    apiCalls: 0,
    totalResponseTime: 0,
    averageResponseTime: 0,
    lastCallTime: 0,
    suspiciousPatterns: 0,
    errors: 0,
  });

  const callLogRef = useRef<ApiCallLog[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Detect suspicious patterns (calls every 400-600ms)
  const detectSuspiciousPatterns = useCallback((newCall: ApiCallLog) => {
    const recentCalls = callLogRef.current.filter(
      call => newCall.timestamp - call.timestamp < 10000 // Last 10 seconds
    );

    if (recentCalls.length >= 3) {
      const intervals = [];
      for (let i = 1; i < recentCalls.length; i++) {
        const currentCall = recentCalls[i];
        const previousCall = recentCalls[i - 1];
        if (currentCall && previousCall) {
          intervals.push(currentCall.timestamp - previousCall.timestamp);
        }
      }

      const suspiciousIntervals = intervals.filter(
        interval => interval >= 400 && interval <= 600
      );

      if (suspiciousIntervals.length >= 2) {
        metricsRef.current.suspiciousPatterns++;
        console.warn('🚨 Suspicious API call pattern detected:', {
          intervals: suspiciousIntervals,
          count: suspiciousIntervals.length,
          total: metricsRef.current.suspiciousPatterns
        });
      }
    }
  }, []);

  // Log API call
  const logApiCall = useCallback((call: Omit<ApiCallLog, 'timestamp'>) => {
    const timestamp = Date.now();
    const apiCall: ApiCallLog = { ...call, timestamp };

    // Update metrics
    metricsRef.current.apiCalls++;
    metricsRef.current.totalResponseTime += apiCall.responseTime;
    metricsRef.current.averageResponseTime = 
      metricsRef.current.totalResponseTime / metricsRef.current.apiCalls;
    metricsRef.current.lastCallTime = timestamp;

    if (!apiCall.success) {
      metricsRef.current.errors++;
    }

    // Add to call log
    callLogRef.current.push(apiCall);

    // Keep only last 100 calls to prevent memory issues
    if (callLogRef.current.length > 100) {
      callLogRef.current = callLogRef.current.slice(-100);
    }

    // Detect suspicious patterns
    detectSuspiciousPatterns(apiCall);

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 API Call Logged:', {
        url: apiCall.url,
        method: apiCall.method,
        responseTime: `${apiCall.responseTime}ms`,
        status: apiCall.status,
        success: apiCall.success,
        totalCalls: metricsRef.current.apiCalls,
        suspiciousPatterns: metricsRef.current.suspiciousPatterns
      });
    }
  }, [detectSuspiciousPatterns]);

  // Get current metrics
  const getMetrics = useCallback(() => {
    return { ...metricsRef.current };
  }, []);

  // Get call history
  const getCallHistory = useCallback(() => {
    return [...callLogRef.current];
  }, []);

  // Reset metrics
  const resetMetrics = useCallback(() => {
    metricsRef.current = {
      apiCalls: 0,
      totalResponseTime: 0,
      averageResponseTime: 0,
      lastCallTime: 0,
      suspiciousPatterns: 0,
      errors: 0,
    };
    callLogRef.current = [];
  }, []);

  // Monitor for infinite loops
  const checkForInfiniteLoops = useCallback(() => {
    const recentCalls = callLogRef.current.filter(
      call => Date.now() - call.timestamp < 5000 // Last 5 seconds
    );

    if (recentCalls.length > 10) {
      console.error('🚨 Potential infinite loop detected:', {
        callsInLast5Seconds: recentCalls.length,
        totalCalls: metricsRef.current.apiCalls,
        suspiciousPatterns: metricsRef.current.suspiciousPatterns
      });
      return true;
    }

    return false;
  }, []);

  // Set up monitoring interval
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      checkForInfiniteLoops();
    }, 5000); // Check every 5 seconds

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [checkForInfiniteLoops]);

  // Expose monitoring methods
  const monitorFetch = useCallback(async (
    url: string,
    options: RequestInit = {}
  ): Promise<Response> => {
    const startTime = Date.now();
    const method = options.method || 'GET';

    try {
      const response = await fetch(url, options);
      const responseTime = Date.now() - startTime;

      logApiCall({
        url,
        method,
        responseTime,
        status: response.status,
        success: response.ok,
      });

      return response;
    } catch (error) {
      const responseTime = Date.now() - startTime;

      logApiCall({
        url,
        method,
        responseTime,
        status: 0,
        success: false,
      });

      throw error;
    }
  }, [logApiCall]);

  // Performance report
  const getPerformanceReport = useCallback(() => {
    const metrics = getMetrics();
    const history = getCallHistory();
    
    const recentCalls = history.filter(
      call => Date.now() - call.timestamp < 60000 // Last minute
    );

    const callsPerMinute = recentCalls.length;
    const errorRate = metrics.apiCalls > 0 ? (metrics.errors / metrics.apiCalls) * 100 : 0;

    return {
      ...metrics,
      callsPerMinute,
      errorRate: `${errorRate.toFixed(2)}%`,
      isHealthy: callsPerMinute < 20 && errorRate < 10 && metrics.suspiciousPatterns === 0,
      recommendations: []
    };
  }, [getMetrics, getCallHistory]);

  return {
    logApiCall,
    monitorFetch,
    getMetrics,
    getCallHistory,
    getPerformanceReport,
    resetMetrics,
    checkForInfiniteLoops,
  };
}

// Hook for monitoring specific API endpoints
export function useApiEndpointMonitor(endpoint: string) {
  const { logApiCall, getMetrics } = usePerformanceMonitor();

  const monitorEndpoint = useCallback(async (
    url: string,
    options: RequestInit = {}
  ): Promise<Response> => {
    const startTime = Date.now();
    const method = options.method || 'GET';

    try {
      const response = await fetch(url, options);
      const responseTime = Date.now() - startTime;

      // Only log if it matches our endpoint
      if (url.includes(endpoint)) {
        logApiCall({
          url,
          method,
          responseTime,
          status: response.status,
          success: response.ok,
        });
      }

      return response;
    } catch (error) {
      const responseTime = Date.now() - startTime;

      if (url.includes(endpoint)) {
        logApiCall({
          url,
          method,
          responseTime,
          status: 0,
          success: false,
        });
      }

      throw error;
    }
  }, [endpoint, logApiCall]);

  const getEndpointMetrics = useCallback(() => {
    const metrics = getMetrics();
    return {
      ...metrics,
      endpoint,
      isHealthy: metrics.suspiciousPatterns === 0 && metrics.errors < 5,
    };
  }, [endpoint, getMetrics]);

  return {
    monitorEndpoint,
    getEndpointMetrics,
  };
}
