/**
 * Order purge API route.
 *
 * Cron endpoint that hard-deletes orders soft-deleted for longer than the
 * retention window and removes their files from storage
 * (src/jobs/orderPurge.ts). NOT scheduled yet — see
 * docs/deployment/CRON_JOBS.md.
 *
 * GET  ?dryRun=1            — run (or preview) with the defaults
 * POST { dryRun, retentionDays, batchSize } — run with overrides
 */

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createClient } from '@/utils/supabase/server';
import { getUserRole } from '@/lib/auth';
import { isAdminRole } from '@/lib/auth/admin-role';
import { runOrderPurge, type OrderPurgeConfig } from '@/jobs/orderPurge';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes: one batch of orders plus storage removals

/**
 * GET - Cron trigger or manual admin invocation
 */
export async function GET(request: NextRequest) {
  return handlePurge(request);
}

/**
 * POST - Manual trigger with optional configuration
 */
export async function POST(request: NextRequest) {
  return handlePurge(request);
}

const TRUTHY = new Set(['1', 'true', 'yes']);

function asFlag(value: unknown): boolean {
  return typeof value === 'boolean' ? value : TRUTHY.has(String(value ?? '').toLowerCase());
}

function asPositiveInt(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : Number.NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
}

async function readConfig(request: NextRequest): Promise<OrderPurgeConfig> {
  const config: OrderPurgeConfig = {
    dryRun: asFlag(new URL(request.url).searchParams.get('dryRun')),
  };

  if (request.method === 'POST') {
    try {
      const body = await request.json();
      if (body && typeof body === 'object') {
        if ('dryRun' in body) config.dryRun = asFlag(body.dryRun);
        const retentionDays = asPositiveInt(body.retentionDays);
        const batchSize = asPositiveInt(body.batchSize);
        if (retentionDays !== undefined) config.retentionDays = retentionDays;
        if (batchSize !== undefined) config.batchSize = batchSize;
      }
    } catch {
      // Ignore JSON parse errors, use defaults
    }
  }

  return config;
}

async function handlePurge(request: NextRequest) {
  try {
    // Fail fast in production if CRON_SECRET is not configured
    const cronSecret = process.env.CRON_SECRET;
    if (process.env.NODE_ENV === 'production' && !cronSecret) {
      Sentry.captureMessage(
        'CRON_SECRET not set in production - order purge requires admin authentication',
        'warning',
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
    const userRole = !isValidCronRequest && user ? await getUserRole(user.id) : null;
    const isAuthorized = isValidCronRequest || isAdminRole(userRole);

    if (!isAuthorized) {
      Sentry.captureMessage('Unauthorized order purge attempt', {
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

    const result = await runOrderPurge(await readConfig(request));

    const verb = result.dryRun ? 'Would purge' : 'Purged';
    const response = {
      success: result.success,
      timestamp: new Date().toISOString(),
      duration: `${result.durationMs}ms`,
      dryRun: result.dryRun,
      retentionDays: result.retentionDays,
      cutoff: result.cutoff.toISOString(),
      scanned: result.scanned,
      purged: result.purged,
      failed: result.failed,
      orphanedFiles: result.orphanedFiles,
      orders: result.orders.map((order) => ({
        ...order,
        deletedAt: order.deletedAt.toISOString(),
      })),
      message: result.dryRun
        ? `${verb} ${result.scanned} orders deleted before ${result.cutoff.toISOString()}`
        : `${verb} ${result.purged} of ${result.scanned} orders, ${result.failed} failed` +
          (result.orphanedFiles > 0 ? `, ${result.orphanedFiles} files left in storage` : ''),
    };

    return NextResponse.json(response, { status: result.success ? 200 : 207 });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { operation: 'purge-deleted-orders' },
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
