/**
 * POST /api/routes/optimize
 *
 * Calculates the optimal driving route between pickup and drop-off locations,
 * with optional intermediate waypoints. Returns distance in miles, duration,
 * turn-by-turn directions, and an encoded polyline for map rendering.
 *
 * Body: RouteRequest (see @/types/routing)
 * Returns: RouteApiResponse<RouteResult>
 */

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { z } from 'zod';
import { RouteRequestSchema } from '@/types/routing';
import type { RouteApiResponse, RouteResult } from '@/types/routing';
import { getDirections } from '@/services/routing/google-directions';
import { createClient } from '@/utils/supabase/server';

export async function POST(
  request: NextRequest,
): Promise<NextResponse<RouteApiResponse<RouteResult>>> {
  try {
    // Auth check
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', timestamp: new Date().toISOString() },
        { status: 401 },
      );
    }

    // Validate request body
    const body = await request.json();
    const parsed = RouteRequestSchema.safeParse(body);

    if (!parsed.success) {
      const errors = parsed.error.issues.map((i: z.ZodIssue) => i.message).join(', ');
      return NextResponse.json(
        { success: false, error: `Validation error: ${errors}`, timestamp: new Date().toISOString() },
        { status: 400 },
      );
    }

    // Call Google Directions API
    const result = await getDirections(parsed.data);

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { operation: 'route-optimize' },
    });

    const message =
      error instanceof Error ? error.message : 'Failed to calculate route';

    return NextResponse.json(
      { success: false, error: message, timestamp: new Date().toISOString() },
      { status: 500 },
    );
  }
}
