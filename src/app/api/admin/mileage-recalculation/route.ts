// src/app/api/admin/mileage-recalculation/route.ts
// Vercel Cron endpoint for periodic recalculation of driver mileage
// Configured in vercel.json to run every 6 hours

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createClient } from '@/utils/supabase/server';
import { runDriverMileageRecalculation } from '@/jobs/driverMileageRecalculation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Define proper type for Supabase app_metadata
interface AppMetadata {
  role?: string;
}

export async function GET(request: NextRequest) {
  try {
    // Fail fast in production if CRON_SECRET is not configured
    const cronSecret = process.env.CRON_SECRET;
    if (process.env.NODE_ENV === 'production' && !cronSecret) {
      Sentry.captureMessage('CRON_SECRET not set in production - cron jobs require admin authentication', 'warning');
    }

    // Get authorization header and user session
    const authHeader = request.headers.get('authorization');
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Authorization: Allow if (1) Valid cron secret OR (2) Admin user
    const isValidCronRequest = cronSecret && authHeader === `Bearer ${cronSecret}`;
    const isAdminUser = user && (user.app_metadata as AppMetadata)?.role === 'admin';
    const isSuperAdmin = user && (user.app_metadata as AppMetadata)?.role === 'super_admin';
    const isAuthorized = isValidCronRequest || isAdminUser || isSuperAdmin;

    if (!isAuthorized) {
      Sentry.captureMessage('Unauthorized mileage recalculation attempt', {
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

    // Run mileage recalculation
    const startTime = Date.now();

    const result = await runDriverMileageRecalculation({
      batchSize: 50,
      lookbackHours: 24,
    });

    const duration = Date.now() - startTime;

    const response = {
      success: result.success,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
      processed: result.processed,
      errorCount: result.errors.length,
      errors: result.errors.length > 0 ? result.errors : undefined,
      message: `Recalculated mileage for ${result.processed} shifts${result.errors.length > 0 ? ` with ${result.errors.length} errors` : ''}`
    };

    return NextResponse.json(response, { status: result.success ? 200 : 207 });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { operation: 'mileage-recalculation' },
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggering via admin dashboard
export async function POST(request: NextRequest) {
  return GET(request);
}
