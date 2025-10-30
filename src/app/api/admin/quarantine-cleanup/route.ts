// src/app/api/admin/quarantine-cleanup/route.ts
// Vercel Cron endpoint for periodic cleanup of quarantined files and rate limits
// Configured in vercel.json to run daily at 2 AM UTC

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { UploadSecurityManager } from '@/lib/upload-security';

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
      console.warn('⚠️ CRON_SECRET not set in production - cron jobs require admin authentication');
    }

    // Get authorization header and user session
    const authHeader = request.headers.get('authorization');
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Authorization: Allow if (1) Valid cron secret OR (2) Admin user
    const isValidCronRequest = cronSecret && authHeader === `Bearer ${cronSecret}`;
    const isAdminUser = user && (user.app_metadata as AppMetadata)?.role === 'admin';
    const isAuthorized = isValidCronRequest || isAdminUser;

    if (!isAuthorized) {
      console.warn('⚠️ Unauthorized quarantine cleanup attempt:', {
        hasAuthHeader: !!authHeader,
        hasUser: !!user,
        userRole: user ? (user.app_metadata as AppMetadata)?.role : 'none',
        timestamp: new Date().toISOString()
      });

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
