import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/utils/prismaDB';
import {
  getDriverStats,
  type StatsPeriod,
  type AggregatedDriverStats,
} from '@/services/tracking/driver-stats';
import { driverStatsCache } from '@/lib/cache/driver-stats-cache';

// Query parameter validation
const querySchema = z.object({
  period: z.enum(['today', 'week', 'month', 'all']).default('today'),
});

// Route params validation
const paramsSchema = z.object({
  driverId: z.string().uuid('Invalid driver ID format'),
});

interface RouteContext {
  params: Promise<{ driverId: string }>;
}

/**
 * GET /api/drivers/[driverId]/stats
 *
 * Get aggregated statistics for a specific driver.
 *
 * Query Parameters:
 * - period: 'today' | 'week' | 'month' | 'all' (default: 'today')
 *
 * Response:
 * - 200: Aggregated driver stats
 * - 400: Invalid parameters
 * - 401: Unauthorized
 * - 403: Forbidden (not own stats and not admin)
 * - 404: Driver not found
 * - 500: Server error
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Authenticate request
    const authResult = await withAuth(request, {
      allowedRoles: ['DRIVER', 'ADMIN', 'SUPER_ADMIN', 'HELPDESK'],
      requireAuth: true,
    });

    if (!authResult.success) {
      return authResult.response!;
    }

    const { context: authContext } = authResult;

    // Validate route params
    const params = await context.params;
    const paramsValidation = paramsSchema.safeParse(params);
    if (!paramsValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid driver ID',
          details: paramsValidation.error.issues,
        },
        { status: 400 }
      );
    }

    const { driverId } = paramsValidation.data;

    // Validate query params
    const { searchParams } = new URL(request.url);
    const queryValidation = querySchema.safeParse({
      period: searchParams.get('period') ?? 'today',
    });

    if (!queryValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid query parameters',
          details: queryValidation.error.issues,
        },
        { status: 400 }
      );
    }

    const { period } = queryValidation.data;

    // Check if driver exists
    const driverExists = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM drivers WHERE id = $1::uuid AND deleted_at IS NULL`,
      driverId
    );

    if (driverExists.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Driver not found' },
        { status: 404 }
      );
    }

    // Authorization check: Drivers can only view their own stats
    if (authContext.user.type === 'DRIVER') {
      const ownDriver = await prisma.$queryRawUnsafe<{ id: string }[]>(
        `SELECT id FROM drivers WHERE user_id = $1::uuid AND deleted_at IS NULL`,
        authContext.user.id
      );

      if (ownDriver.length === 0 || ownDriver[0]?.id !== driverId) {
        return NextResponse.json(
          { success: false, error: 'Access denied: Can only view your own stats' },
          { status: 403 }
        );
      }
    }

    // Check cache first
    const cached = driverStatsCache.getDriverStats(driverId, period);
    if (cached) {
      return NextResponse.json({
        success: true,
        data: cached.data,
        meta: {
          cachedAt: cached.cachedAt.toISOString(),
          freshUntil: cached.freshUntil.toISOString(),
        },
      });
    }

    // Fetch fresh stats
    const stats: AggregatedDriverStats = await getDriverStats({
      driverId,
      period: period as StatsPeriod,
    });

    // Cache the result
    driverStatsCache.setDriverStats(driverId, period, stats);

    return NextResponse.json({
      success: true,
      data: stats,
      meta: {
        cachedAt: null,
        freshUntil: null,
      },
    });
  } catch (error) {
    console.error('Error fetching driver stats:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch driver stats',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
