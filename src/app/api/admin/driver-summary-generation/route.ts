/**
 * Driver Summary Generation API Route (REA-313)
 *
 * Weekly cron endpoint for generating pre-computed driver summaries.
 * Configured in vercel.json to run weekly on Sunday at 4 AM UTC.
 *
 * Generates weekly aggregates for:
 * - Shift metrics (total, completed, hours)
 * - Delivery metrics (total, completed)
 * - Distance metrics (GPS miles, reported miles)
 * - Location data density
 */

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createClient } from '@/utils/supabase/server';
import { runDriverSummaryGeneration, SummaryGenerationConfig } from '@/jobs/driverSummaryGeneration';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max for summary generation

interface AppMetadata {
  role?: string;
}

/**
 * GET - Vercel Cron trigger or manual admin invocation
 */
export async function GET(request: NextRequest) {
  return handleGeneration(request);
}

/**
 * POST - Manual trigger with optional configuration
 */
export async function POST(request: NextRequest) {
  return handleGeneration(request);
}

async function handleGeneration(request: NextRequest) {
  try {
    // Fail fast in production if CRON_SECRET is not configured
    const cronSecret = process.env.CRON_SECRET;
    if (process.env.NODE_ENV === 'production' && !cronSecret) {
      Sentry.captureMessage(
        'CRON_SECRET not set in production - driver summary generation requires admin authentication',
        'warning'
      );
    }

    // Get authorization header and user session
    const authHeader = request.headers.get('authorization');
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Authorization: Allow if (1) Valid cron secret OR (2) Admin/Super Admin user
    const isValidCronRequest = cronSecret && authHeader === `Bearer ${cronSecret}`;
    const isAdminUser = user && (user.app_metadata as AppMetadata)?.role === 'admin';
    const isSuperAdmin = user && (user.app_metadata as AppMetadata)?.role === 'super_admin';
    const isAuthorized = isValidCronRequest || isAdminUser || isSuperAdmin;

    if (!isAuthorized) {
      Sentry.captureMessage('Unauthorized driver summary generation attempt', {
        level: 'warning',
        extra: {
          hasAuthHeader: !!authHeader,
          hasUser: !!user,
          userRole: user ? (user.app_metadata as AppMetadata)?.role : 'none',
        },
      });

      return NextResponse.json(
        { error: 'Unauthorized - admin access or valid cron secret required' },
        { status: 401 }
      );
    }

    // Parse optional configuration from POST body
    let config: SummaryGenerationConfig = {};

    if (request.method === 'POST') {
      try {
        const body = await request.json();
        config = {
          dryRun: body.dryRun ?? false,
          driverIds: body.driverIds,
          weekStart: body.weekStart,
          forceRegenerate: body.forceRegenerate ?? false,
          weeksToBackfill: body.weeksToBackfill,
          batchSize: body.batchSize,
        };
      } catch {
        // Ignore JSON parse errors, use defaults
      }
    }

    // Run summary generation
    const result = await runDriverSummaryGeneration(config);

    const response = {
      success: result.success,
      timestamp: result.timestamp,
      duration: `${result.durationMs}ms`,
      dryRun: result.dryRun,
      driversProcessed: result.driversProcessed,
      summariesGenerated: result.summariesGenerated,
      summariesUpdated: result.summariesUpdated,
      errorCount: result.errors.length,
      errors: result.errors.length > 0 ? result.errors : undefined,
      message: result.success
        ? `Generated ${result.summariesGenerated} summaries, updated ${result.summariesUpdated} for ${result.driversProcessed} drivers`
        : `Generation completed with ${result.errors.length} errors`,
    };

    return NextResponse.json(response, { status: result.success ? 200 : 207 });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { operation: 'driver-summary-generation' },
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
