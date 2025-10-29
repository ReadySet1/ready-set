// src/app/api/admin/quarantine-cleanup/route.ts
// Vercel Cron endpoint for periodic cleanup of quarantined files and rate limits
// Configured in vercel.json to run daily at 2 AM UTC

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { UploadSecurityManager } from '@/lib/upload-security';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Verify request is from Vercel Cron
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // In production, verify cron secret for security
    // Allow requests without secret in development for manual testing
    if (process.env.NODE_ENV === 'production' && cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    // Optionally verify admin role for manual triggering
    // This allows admins to manually trigger cleanup via browser/API
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Allow if: (1) Cron secret matches OR (2) User is admin
    const isAuthorized = (
      (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
      (user && (user.raw_app_meta_data as any)?.role === 'admin')
    );

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized - admin access or valid cron secret required' },
        { status: 401 }
      );
    }

    // Run cleanup operations
    const startTime = Date.now();

    // Cleanup quarantined files older than 30 days
    const filesCleanedCount = await UploadSecurityManager.cleanupQuarantinedFiles(30);

    // Cleanup expired rate limit entries
    const rateLimitsCleanedCount = UploadSecurityManager.cleanupExpiredRateLimits();

    const duration = Date.now() - startTime;

    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
      filesCleanedCount,
      rateLimitsCleanedCount,
      message: `Cleaned up ${filesCleanedCount} quarantined files and ${rateLimitsCleanedCount} expired rate limit entries`
    };

    console.log('✅ Quarantine cleanup completed:', result);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('❌ Quarantine cleanup failed:', error);

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
