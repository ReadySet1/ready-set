/**
 * Circuit Breaker Monitoring Endpoint
 *
 * Provides real-time visibility into circuit breaker states, metrics, and health.
 * Part of REA-92: Add Circuit Breaker Monitoring and Alerts
 *
 * AUTHENTICATION:
 * - GET endpoint: Requires authenticated user (any role)
 * - POST endpoint: Requires admin role (ADMIN, SUPER_ADMIN)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { caterValleyCircuitBreaker } from '@/utils/api-resilience';
import { apiResilienceLogger } from '@/utils/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Define proper type for Supabase app_metadata
interface AppMetadata {
  role?: string;
}

/**
 * GET /api/monitoring/circuit-breakers
 *
 * Returns comprehensive monitoring data for all circuit breakers in the system.
 * Requires authentication.
 *
 * Response format:
 * {
 *   "circuitBreakers": [
 *     {
 *       "name": "CaterValley",
 *       "state": "closed",
 *       "failureCount": 0,
 *       "successCount": 0,
 *       "metrics": { ... },
 *       "health": { "status": "healthy", "message": "..." }
 *     }
 *   ],
 *   "summary": {
 *     "total": 1,
 *     "healthy": 1,
 *     "degraded": 0,
 *     "critical": 0
 *   },
 *   "timestamp": "2025-10-31T..."
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication: Verify user is authenticated
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      apiResilienceLogger.warn('[Circuit Breaker Monitoring] Unauthorized access attempt', {
        hasUser: !!user,
        timestamp: new Date().toISOString(),
      });

      return NextResponse.json(
        { error: 'Unauthorized - authentication required' },
        { status: 401 }
      );
    }

    // Collect monitoring data from all circuit breakers
    const circuitBreakers = [
      caterValleyCircuitBreaker.getMonitoringData(),
      // Add more circuit breakers here as they're created
    ];

    // Calculate summary statistics
    const summary = {
      total: circuitBreakers.length,
      healthy: circuitBreakers.filter(cb => cb.health.status === 'healthy').length,
      degraded: circuitBreakers.filter(cb => cb.health.status === 'degraded').length,
      critical: circuitBreakers.filter(cb => cb.health.status === 'critical').length,
    };

    // Check if a specific circuit breaker is requested
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');

    if (name) {
      const circuitBreaker = circuitBreakers.find(cb => cb.name.toLowerCase() === name.toLowerCase());

      if (!circuitBreaker) {
        return NextResponse.json(
          { error: 'Circuit breaker not found', availableCircuitBreakers: circuitBreakers.map(cb => cb.name) },
          { status: 404 }
        );
      }

      return NextResponse.json({
        circuitBreaker,
        timestamp: new Date().toISOString(),
      });
    }

    // Return all circuit breakers
    return NextResponse.json({
      circuitBreakers,
      summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    apiResilienceLogger.error('[Circuit Breaker Monitoring] Error fetching monitoring data', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        error: 'Failed to fetch circuit breaker monitoring data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/monitoring/circuit-breakers
 *
 * Manually reset a circuit breaker (for emergency recovery or testing).
 * Requires admin role (ADMIN or SUPER_ADMIN).
 *
 * Body: { "name": "CaterValley" }
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication: Verify admin user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      apiResilienceLogger.warn('[Circuit Breaker Monitoring] Unauthorized reset attempt', {
        hasUser: !!user,
        timestamp: new Date().toISOString(),
      });

      return NextResponse.json(
        { error: 'Unauthorized - authentication required' },
        { status: 401 }
      );
    }

    // Authorization: Verify admin role
    const userRole = (user.app_metadata as AppMetadata)?.role;
    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';

    if (!isAdmin) {
      apiResilienceLogger.warn('[Circuit Breaker Monitoring] Forbidden reset attempt', {
        userId: user.id,
        userRole,
        timestamp: new Date().toISOString(),
      });

      return NextResponse.json(
        { error: 'Forbidden - admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Missing required field: name' },
        { status: 400 }
      );
    }

    // Find and reset the circuit breaker
    let resetCircuitBreaker = null;

    if (name.toLowerCase() === 'catervalley') {
      caterValleyCircuitBreaker.reset();
      resetCircuitBreaker = caterValleyCircuitBreaker.getMonitoringData();
    }
    // Add more circuit breakers here

    if (!resetCircuitBreaker) {
      return NextResponse.json(
        { error: 'Circuit breaker not found', availableCircuitBreakers: ['CaterValley'] },
        { status: 404 }
      );
    }

    apiResilienceLogger.info('[Circuit Breaker Monitoring] Circuit breaker reset', {
      name,
      resetBy: user.id,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      message: `Circuit breaker "${name}" has been reset`,
      circuitBreaker: resetCircuitBreaker,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    apiResilienceLogger.error('[Circuit Breaker Monitoring] Error resetting circuit breaker', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        error: 'Failed to reset circuit breaker',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
