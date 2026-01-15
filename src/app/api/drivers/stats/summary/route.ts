import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/auth-middleware';
import {
  getAllDriversStatsSummary,
  type StatsPeriod,
  type DriverStatsSummary,
} from '@/services/tracking/driver-stats';
import { driverStatsCache } from '@/lib/cache/driver-stats-cache';

// Query parameter validation
const querySchema = z.object({
  period: z.enum(['today', 'week', 'month', 'all']).default('today'),
  includeInactive: z.enum(['true', 'false']).default('false'),
});

/**
 * GET /api/drivers/stats/summary
 *
 * Get aggregated statistics summary for all drivers.
 * Admin-only endpoint for dashboard overview.
 *
 * Query Parameters:
 * - period: 'today' | 'week' | 'month' | 'all' (default: 'today')
 * - includeInactive: 'true' | 'false' (default: 'false')
 *
 * Response:
 * - 200: Summary stats
 * - 400: Invalid parameters
 * - 401: Unauthorized
 * - 403: Forbidden (not admin)
 * - 500: Server error
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate request - admin only
    const authResult = await withAuth(request, {
      allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'HELPDESK'],
      requireAuth: true,
    });

    if (!authResult.success) {
      return authResult.response!;
    }

    // Validate query params
    const { searchParams } = new URL(request.url);
    const queryValidation = querySchema.safeParse({
      period: searchParams.get('period') ?? 'today',
      includeInactive: searchParams.get('includeInactive') ?? 'false',
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

    const { period, includeInactive } = queryValidation.data;
    const includeInactiveBool = includeInactive === 'true';

    // Check cache first
    const cached = driverStatsCache.getSummary(period, includeInactiveBool);
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

    // Fetch fresh summary stats
    const summary: DriverStatsSummary = await getAllDriversStatsSummary(
      period as StatsPeriod,
      includeInactiveBool
    );

    // Cache the result
    driverStatsCache.setSummary(period, includeInactiveBool, summary);

    return NextResponse.json({
      success: true,
      data: summary,
      meta: {
        cachedAt: null,
        freshUntil: null,
      },
    });
  } catch (error) {
    console.error('Error fetching driver stats summary:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch driver stats summary',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
