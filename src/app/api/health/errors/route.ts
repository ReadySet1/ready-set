// src/app/api/health/errors/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { 
  getErrorMetrics, 
  getRecentErrors, 
  getErrorsByCategory, 
  getErrorsBySeverity,
  ErrorCategory,
  ErrorSeverity 
} from '@/lib/error-logging';
import { addSecurityHeaders } from '@/lib/auth-middleware';
import { createClient } from '@/utils/supabase/server';

interface ErrorAnalytics {
  summary: {
    totalErrors: number;
    recentErrors: number;
    criticalErrors: number;
    errorRate: number;
    mostCommonCategory: string;
    mostCommonSeverity: string;
  };
  trends: {
    hourlyErrorCount: Array<{ hour: string; count: number }>;
    categoryDistribution: Array<{ category: string; count: number; percentage: number }>;
    severityDistribution: Array<{ severity: string; count: number; percentage: number }>;
  };
  recentErrors: Array<{
    id: string;
    timestamp: string;
    severity: string;
    category: string;
    message: string;
    endpoint?: string;
    method?: string;
    statusCode?: number;
    fingerprint: string;
  }>;
  topErrors: Array<{
    fingerprint: string;
    count: number;
    lastSeen: string;
    sample: {
      message: string;
      category: string;
      severity: string;
    };
  }>;
  systemHealth: {
    errorThresholds: {
      critical: { current: number; threshold: number; status: 'ok' | 'warning' | 'critical' };
      high: { current: number; threshold: number; status: 'ok' | 'warning' | 'critical' };
      recentRate: { current: number; threshold: number; status: 'ok' | 'warning' | 'critical' };
    };
    recommendations: string[];
  };
}

/**
 * Generate hourly error trends for the last 24 hours
 */
function generateHourlyTrends(errors: any[]): Array<{ hour: string; count: number }> {
  const now = new Date();
  const hourlyData: Array<{ hour: string; count: number }> = [];
  
  // Generate last 24 hours
  for (let i = 23; i >= 0; i--) {
    const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
    const hourString = hour.toISOString().substring(0, 13) + ':00:00.000Z'; // Round to hour
    
    const errorsInHour = errors.filter(error => {
      const errorHour = new Date(error.timestamp).toISOString().substring(0, 13) + ':00:00.000Z';
      return errorHour === hourString;
    }).length;
    
    hourlyData.push({
      hour: hour.toISOString(),
      count: errorsInHour
    });
  }
  
  return hourlyData;
}

/**
 * Generate category distribution
 */
function generateCategoryDistribution(errorMetrics: any): Array<{ category: string; count: number; percentage: number }> {
  const total = errorMetrics.totalErrors || 1; // Avoid division by zero
  
  return Object.entries(errorMetrics.errorsByCategory).map(([category, count]) => ({
    category,
    count: count as number,
    percentage: Math.round(((count as number) / total) * 100)
  })).sort((a, b) => b.count - a.count);
}

/**
 * Generate severity distribution
 */
function generateSeverityDistribution(errorMetrics: any): Array<{ severity: string; count: number; percentage: number }> {
  const total = errorMetrics.totalErrors || 1; // Avoid division by zero
  
  return Object.entries(errorMetrics.errorsBySeverity).map(([severity, count]) => ({
    severity,
    count: count as number,
    percentage: Math.round(((count as number) / total) * 100)
  })).sort((a, b) => b.count - a.count);
}

/**
 * Generate system health assessment
 */
function generateSystemHealth(errorMetrics: any): ErrorAnalytics['systemHealth'] {
  const criticalCount = errorMetrics.errorsBySeverity.critical || 0;
  const highCount = errorMetrics.errorsBySeverity.high || 0;
  const recentCount = errorMetrics.recentErrors.length;
  
  const recommendations: string[] = [];
  
  // Critical error threshold
  const criticalStatus = criticalCount > 10 ? 'critical' : criticalCount > 5 ? 'warning' : 'ok';
  
  // High severity error threshold
  const highStatus = highCount > 20 ? 'critical' : highCount > 10 ? 'warning' : 'ok';
  
  // Recent error rate (errors in last hour)
  const recentRate = recentCount;
  const recentStatus = recentRate > 15 ? 'critical' : recentRate > 8 ? 'warning' : 'ok';
  
  // Generate recommendations
  if (criticalStatus === 'critical') {
    recommendations.push('URGENT: High number of critical errors detected. Investigate database connections and authentication systems.');
  }
  
  if (highStatus === 'critical') {
    recommendations.push('High number of high-severity errors. Review API endpoint error handling and validation logic.');
  }
  
  if (recentStatus === 'critical') {
    recommendations.push('High recent error rate detected. Monitor system performance and consider scaling if needed.');
  }
  
  if (errorMetrics.totalErrors === 0) {
    recommendations.push('No errors detected. System appears to be running smoothly.');
  } else if (recommendations.length === 0) {
    recommendations.push('Error levels are within acceptable thresholds. Continue monitoring.');
  }
  
  return {
    errorThresholds: {
      critical: { current: criticalCount, threshold: 10, status: criticalStatus },
      high: { current: highCount, threshold: 20, status: highStatus },
      recentRate: { current: recentRate, threshold: 15, status: recentStatus }
    },
    recommendations
  };
}

/**
 * GET - Error analytics and monitoring dashboard
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = performance.now();
  
  try {
    // Check authentication and admin access
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user?.id) {
      const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      return addSecurityHeaders(response);
    }

    // Check if user has admin privileges
    const { data: profile } = await supabase
      .from('profiles')
      .select('type')
      .eq('id', user.id)
      .single();

    if (!profile?.type || !['ADMIN', 'SUPER_ADMIN'].includes(profile.type)) {
      const response = NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
      return addSecurityHeaders(response);
    }

    // Get error metrics and data
    const errorMetrics = getErrorMetrics();
    const recentErrors = getRecentErrors(50); // Get last 50 errors
    
    // Generate analytics
    const categoryDistribution = generateCategoryDistribution(errorMetrics);
    const severityDistribution = generateSeverityDistribution(errorMetrics);
    const hourlyTrends = generateHourlyTrends(recentErrors);
    const systemHealth = generateSystemHealth(errorMetrics);
    
    // Process recent errors for display
    const processedRecentErrors = recentErrors.slice(0, 20).map(error => ({
      id: error.id,
      timestamp: error.timestamp,
      severity: error.severity,
      category: error.category,
      message: error.message,
      endpoint: error.context.request?.endpoint,
      method: error.context.request?.method,
      statusCode: error.context.request?.statusCode,
      fingerprint: error.fingerprint
    }));
    
    // Process top errors
    const processedTopErrors = errorMetrics.topErrors.map(topError => {
      const sampleError = recentErrors.find(error => error.fingerprint === topError.fingerprint);
      return {
        fingerprint: topError.fingerprint,
        count: topError.count,
        lastSeen: topError.lastSeen,
        sample: {
          message: sampleError?.message || 'Unknown error',
          category: sampleError?.category || 'unknown',
          severity: sampleError?.severity || 'unknown'
        }
      };
    });

    const analytics: ErrorAnalytics = {
      summary: {
        totalErrors: errorMetrics.totalErrors,
        recentErrors: errorMetrics.recentErrors.length,
        criticalErrors: errorMetrics.errorsBySeverity.critical || 0,
        errorRate: errorMetrics.totalErrors > 0 ? 
          (errorMetrics.recentErrors.length / errorMetrics.totalErrors) * 100 : 0,
        mostCommonCategory: categoryDistribution[0]?.category || 'none',
        mostCommonSeverity: severityDistribution[0]?.severity || 'none'
      },
      trends: {
        hourlyErrorCount: hourlyTrends,
        categoryDistribution,
        severityDistribution
      },
      recentErrors: processedRecentErrors,
      topErrors: processedTopErrors,
      systemHealth
    };

    const responseTime = performance.now() - startTime;

    const response = NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime.toFixed(2)}ms`,
      analytics
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Response-Time': `${responseTime.toFixed(2)}ms`
      }
    });

    return addSecurityHeaders(response);

  } catch (error) {
    const responseTime = performance.now() - startTime;
    
    const response = NextResponse.json({
      success: false,
      error: 'Failed to retrieve error analytics',
      details: error instanceof Error ? error.message : 'Unknown error',
      responseTime: `${responseTime.toFixed(2)}ms`
    }, { status: 500 });

    return addSecurityHeaders(response);
  }
}

/**
 * POST - Get filtered error data
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = performance.now();
  
  try {
    // Check authentication and admin access
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user?.id) {
      const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      return addSecurityHeaders(response);
    }

    // Check if user has admin privileges
    const { data: profile } = await supabase
      .from('profiles')
      .select('type')
      .eq('id', user.id)
      .single();

    if (!profile?.type || !['ADMIN', 'SUPER_ADMIN'].includes(profile.type)) {
      const response = NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
      return addSecurityHeaders(response);
    }

    // Parse request body
    const body = await request.json();
    const { category, severity, limit = 50 } = body;

    let errors: any[] = [];

    if (category && Object.values(ErrorCategory).includes(category)) {
      errors = getErrorsByCategory(category);
    } else if (severity && Object.values(ErrorSeverity).includes(severity)) {
      errors = getErrorsBySeverity(severity);
    } else {
      errors = getRecentErrors(limit);
    }

    // Limit results
    errors = errors.slice(0, limit);

    const responseTime = performance.now() - startTime;

    const response = NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime.toFixed(2)}ms`,
      filters: { category, severity, limit },
      count: errors.length,
      errors: errors.map(error => ({
        id: error.id,
        timestamp: error.timestamp,
        severity: error.severity,
        category: error.category,
        message: error.message,
        fingerprint: error.fingerprint,
        context: {
          endpoint: error.context.request?.endpoint,
          method: error.context.request?.method,
          statusCode: error.context.request?.statusCode,
          userId: error.context.user?.id
        }
      }))
    });

    return addSecurityHeaders(response);

  } catch (error) {
    const responseTime = performance.now() - startTime;
    
    const response = NextResponse.json({
      success: false,
      error: 'Failed to retrieve filtered errors',
      details: error instanceof Error ? error.message : 'Unknown error',
      responseTime: `${responseTime.toFixed(2)}ms`
    }, { status: 500 });

    return addSecurityHeaders(response);
  }
} 