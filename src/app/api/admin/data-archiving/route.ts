/**
 * Data Archiving API Route (REA-313)
 *
 * Daily cron endpoint for automatic data archiving.
 * Configured in vercel.json to run daily at 3 AM UTC.
 *
 * Archives:
 * - Driver locations older than 30 days (moved to archive table)
 * - Driver shifts older than 5 weeks (moved to archive table)
 * - Orders older than 30 days (soft-archived with timestamp)
 */

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createClient } from '@/utils/supabase/server';
import { runDataArchiving, ArchivingConfig } from '@/jobs/dataArchiving';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max for archiving

interface AppMetadata {
  role?: string;
}

/**
 * GET - Vercel Cron trigger or manual admin invocation
 */
export async function GET(request: NextRequest) {
  return handleArchiving(request);
}

/**
 * POST - Manual trigger with optional configuration
 */
export async function POST(request: NextRequest) {
  return handleArchiving(request);
}

async function handleArchiving(request: NextRequest) {
  try {
    // Fail fast in production if CRON_SECRET is not configured
    const cronSecret = process.env.CRON_SECRET;
    if (process.env.NODE_ENV === 'production' && !cronSecret) {
      Sentry.captureMessage(
        'CRON_SECRET not set in production - data archiving requires admin authentication',
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
      Sentry.captureMessage('Unauthorized data archiving attempt', {
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
    let config: ArchivingConfig = {};

    if (request.method === 'POST') {
      try {
        const body = await request.json();
        config = {
          dryRun: body.dryRun ?? false,
          driverLocationsRetentionDays: body.driverLocationsRetentionDays,
          orderRetentionDays: body.orderRetentionDays,
          shiftRetentionWeeks: body.shiftRetentionWeeks,
          batchSize: body.batchSize,
          archiveTypes: body.archiveTypes,
        };
      } catch {
        // Ignore JSON parse errors, use defaults
      }
    }

    // Run archiving
    const result = await runDataArchiving(config);

    const response = {
      success: result.success,
      timestamp: result.timestamp,
      duration: `${result.durationMs}ms`,
      dryRun: result.dryRun,
      totalRecordsArchived: result.totalRecordsArchived,
      totalErrors: result.totalErrors,
      results: result.results.map(r => ({
        archiveType: r.archiveType,
        batchId: r.batchId,
        recordsArchived: r.recordsArchived,
        recordsFailed: r.recordsFailed,
        dateRange: r.dateRangeStart && r.dateRangeEnd
          ? {
              start: r.dateRangeStart.toISOString(),
              end: r.dateRangeEnd.toISOString(),
            }
          : null,
        errors: r.errors.length > 0 ? r.errors : undefined,
      })),
      message: result.success
        ? `Successfully archived ${result.totalRecordsArchived} records`
        : `Archiving completed with ${result.totalErrors} errors`,
    };

    return NextResponse.json(response, { status: result.success ? 200 : 207 });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { operation: 'data-archiving' },
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
