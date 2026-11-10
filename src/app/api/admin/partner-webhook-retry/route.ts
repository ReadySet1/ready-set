/**
 * Partner webhook retry API route.
 *
 * Cron endpoint that resends failed partner status webhooks from the durable
 * `partner_webhook_deliveries` queue (src/jobs/partnerWebhookRetry.ts).
 * Scheduled every minute from the VPS — see docs/deployment/CRON_JOBS.md.
 *
 * GET / POST — run one batch. Auth: `Authorization: Bearer $CRON_SECRET`,
 * or an ADMIN / SUPER_ADMIN session.
 */

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createClient } from '@/utils/supabase/server';
import { getUserRole } from '@/lib/auth';
import { isAdminRole } from '@/lib/auth/admin-role';
import { runPartnerWebhookRetry } from '@/jobs/partnerWebhookRetry';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120; // one batch: 25 rows, 5 at a time, 10s timeout each

/**
 * GET - Cron trigger or manual admin invocation
 */
export async function GET(request: NextRequest) {
  return handleRetry(request);
}

/**
 * POST - Manual trigger
 */
export async function POST(request: NextRequest) {
  return handleRetry(request);
}

async function handleRetry(request: NextRequest) {
  try {
    // Fail fast in production if CRON_SECRET is not configured
    const cronSecret = process.env.CRON_SECRET;
    if (process.env.NODE_ENV === 'production' && !cronSecret) {
      Sentry.captureMessage(
        'CRON_SECRET not set in production - partner webhook retry requires admin authentication',
        'warning',
      );
    }

    const authHeader = request.headers.get('authorization');
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Authorization: Allow if (1) Valid cron secret OR (2) Admin/Super Admin user
    const isValidCronRequest = !!cronSecret && authHeader === `Bearer ${cronSecret}`;
    const userRole = !isValidCronRequest && user ? await getUserRole(user.id) : null;
    const isAuthorized = isValidCronRequest || isAdminRole(userRole);

    if (!isAuthorized) {
      Sentry.captureMessage('Unauthorized partner webhook retry attempt', {
        level: 'warning',
        extra: {
          hasAuthHeader: !!authHeader,
          hasUser: !!user,
          userRole: userRole ?? 'none',
        },
      });

      return NextResponse.json(
        { error: 'Unauthorized - admin access or valid cron secret required' },
        { status: 401 },
      );
    }

    const result = await runPartnerWebhookRetry();

    return NextResponse.json(
      {
        success: result.success,
        timestamp: new Date().toISOString(),
        duration: `${result.durationMs}ms`,
        claimed: result.claimed,
        succeeded: result.succeeded,
        retrying: result.retrying,
        failed: result.failed,
        stale: result.stale,
        errors: result.errors,
      },
      { status: result.success ? 200 : 207 },
    );
  } catch (error) {
    Sentry.captureException(error, {
      tags: { operation: 'partner-webhook-retry' },
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
