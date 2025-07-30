// src/app/api/health/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prismaPooled } from '@/lib/db/prisma-pooled';
import { addSecurityHeaders } from '@/lib/auth-middleware';
import { getErrorMetrics } from '@/lib/error-logging';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  environment: string;
  uptime: number;
  services: {
    database: ServiceHealth;
    auth: ServiceHealth;
    storage: ServiceHealth;
    externalAPIs: ServiceHealth;
    errorTracking: ServiceHealth;
  };
  performance: {
    responseTime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage?: number;
  };
  errors: {
    recentErrorCount: number;
    criticalErrorCount: number;
    errorRate: number;
  };
}

interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  message?: string;
  details?: Record<string, any>;
}

/**
 * Test database connectivity and performance
 */
async function checkDatabaseHealth(): Promise<ServiceHealth> {
  const start = performance.now();
  
  try {
    // Test basic connectivity
    await prismaPooled.$queryRaw`SELECT 1 as test`;
    
    // Test a more complex query
    const userCount = await prismaPooled.profile.count();
    
    const responseTime = performance.now() - start;
    
    return {
      status: responseTime < 100 ? 'healthy' : responseTime < 500 ? 'degraded' : 'unhealthy',
      responseTime,
      message: 'Database connection successful',
      details: {
        connectionTime: `${responseTime.toFixed(2)}ms`,
        userCount,
        poolingEnabled: true
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: performance.now() - start,
      message: 'Database connection failed',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

/**
 * Test authentication service health
 */
async function checkAuthHealth(): Promise<ServiceHealth> {
  const start = performance.now();
  
  try {
    // Check if required environment variables are set
    const requiredEnvVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      return {
        status: 'unhealthy',
        message: 'Missing authentication configuration',
        details: {
          missingEnvironmentVariables: missingVars
        }
      };
    }

    const responseTime = performance.now() - start;
    
    return {
      status: 'healthy',
      responseTime,
      message: 'Authentication service configured',
      details: {
        supabaseConfigured: true,
        responseTime: `${responseTime.toFixed(2)}ms`
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: 'Authentication service check failed',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

/**
 * Test storage/file upload health
 */
async function checkStorageHealth(): Promise<ServiceHealth> {
  const start = performance.now();
  
  try {
    // Check if storage configuration is present
    const hasStorageConfig = !!(
      process.env.NEXT_PUBLIC_SUPABASE_URL && 
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    if (!hasStorageConfig) {
      return {
        status: 'degraded',
        message: 'Storage configuration incomplete',
        details: {
          configured: false
        }
      };
    }

    const responseTime = performance.now() - start;
    
    return {
      status: 'healthy',
      responseTime,
      message: 'Storage service configured',
      details: {
        supabaseStorageConfigured: true,
        responseTime: `${responseTime.toFixed(2)}ms`
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: 'Storage service check failed',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

/**
 * Test external API health
 */
async function checkExternalAPIsHealth(): Promise<ServiceHealth> {
  const start = performance.now();
  
  try {
    const externalServices = {
      googleMapsConfigured: !!process.env.GOOGLE_MAPS_API_KEY,
      mapboxConfigured: !!process.env.MAPBOX_ACCESS_TOKEN,
      stripeConfigured: !!(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY && process.env.STRIPE_SECRET_KEY),
    };

    const configuredServices = Object.values(externalServices).filter(Boolean).length;
    const totalServices = Object.keys(externalServices).length;
    
    const responseTime = performance.now() - start;
    
    let status: ServiceHealth['status'] = 'healthy';
    if (configuredServices === 0) {
      status = 'unhealthy';
    } else if (configuredServices < totalServices) {
      status = 'degraded';
    }
    
    return {
      status,
      responseTime,
      message: `${configuredServices}/${totalServices} external services configured`,
      details: {
        ...externalServices,
        responseTime: `${responseTime.toFixed(2)}ms`
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: 'External APIs check failed',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

/**
 * Check error tracking health
 */
async function checkErrorTrackingHealth(): Promise<ServiceHealth> {
  const start = performance.now();
  
  try {
    const errorMetrics = getErrorMetrics();
    const responseTime = performance.now() - start;
    
    // Calculate error rate based on recent errors
    const recentErrors = errorMetrics.recentErrors.length;
    const criticalErrors = errorMetrics.errorsBySeverity.critical || 0;
    
    let status: ServiceHealth['status'] = 'healthy';
    if (criticalErrors > 5) {
      status = 'unhealthy';
    } else if (recentErrors > 10) {
      status = 'degraded';
    }
    
    return {
      status,
      responseTime,
      message: 'Error tracking operational',
      details: {
        totalErrors: errorMetrics.totalErrors,
        recentErrors,
        criticalErrors,
        responseTime: `${responseTime.toFixed(2)}ms`
      }
    };
  } catch (error) {
    return {
      status: 'degraded',
      message: 'Error tracking check failed',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

/**
 * Calculate overall system status
 */
function calculateOverallStatus(services: HealthStatus['services']): HealthStatus['status'] {
  const serviceStatuses = Object.values(services);
  
  if (serviceStatuses.some(service => service.status === 'unhealthy')) {
    return 'unhealthy';
  }
  
  if (serviceStatuses.some(service => service.status === 'degraded')) {
    return 'degraded';
  }
  
  return 'healthy';
}

/**
 * GET - System health check
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = performance.now();
  
  try {
    // Run all health checks in parallel for better performance
    const [
      databaseHealth,
      authHealth,
      storageHealth,
      externalAPIsHealth,
      errorTrackingHealth
    ] = await Promise.all([
      checkDatabaseHealth(),
      checkAuthHealth(),
      checkStorageHealth(),
      checkExternalAPIsHealth(),
      checkErrorTrackingHealth()
    ]);

    const services = {
      database: databaseHealth,
      auth: authHealth,
      storage: storageHealth,
      externalAPIs: externalAPIsHealth,
      errorTracking: errorTrackingHealth
    };

    // Get error metrics
    const errorMetrics = getErrorMetrics();
    
    // Calculate system uptime (simplified - would be better stored in a persistent way)
    const uptime = process.uptime();
    
    // Get memory usage
    const memoryUsage = process.memoryUsage();
    
    const responseTime = performance.now() - startTime;
    
    const healthStatus: HealthStatus = {
      status: calculateOverallStatus(services),
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime,
      services,
      performance: {
        responseTime,
        memoryUsage
      },
      errors: {
        recentErrorCount: errorMetrics.recentErrors.length,
        criticalErrorCount: errorMetrics.errorsBySeverity.critical || 0,
        errorRate: errorMetrics.totalErrors > 0 ? (errorMetrics.recentErrors.length / errorMetrics.totalErrors) * 100 : 0
      }
    };

    // Determine HTTP status code based on health
    const httpStatus = healthStatus.status === 'healthy' ? 200 : 
                      healthStatus.status === 'degraded' ? 200 : 503;

    const response = NextResponse.json(healthStatus, {
      status: httpStatus,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Response-Time': `${responseTime.toFixed(2)}ms`,
        'X-Health-Status': healthStatus.status
      }
    });

    return addSecurityHeaders(response);

  } catch (error) {
    const responseTime = performance.now() - startTime;
    
    const errorResponse = {
      status: 'unhealthy' as const,
      timestamp: new Date().toISOString(),
      message: 'Health check failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime
    };

    const response = NextResponse.json(errorResponse, {
      status: 503,
      headers: {
        'X-Response-Time': `${responseTime.toFixed(2)}ms`,
        'X-Health-Status': 'unhealthy'
      }
    });

    return addSecurityHeaders(response);
  }
}

/**
 * HEAD - Quick health check for load balancers
 */
export async function HEAD(request: NextRequest): Promise<NextResponse> {
  try {
    // Quick database connectivity test
    await prismaPooled.$queryRaw`SELECT 1`;
    
    return new NextResponse(null, {
      status: 200,
      headers: {
        'X-Health-Status': 'healthy',
        'Cache-Control': 'no-cache'
      }
    });
  } catch (error) {
    return new NextResponse(null, {
      status: 503,
      headers: {
        'X-Health-Status': 'unhealthy',
        'Cache-Control': 'no-cache'
      }
    });
  }
} 