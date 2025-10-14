/**
 * Admin Cleanup API Endpoints
 * 
 * Provides endpoints for:
 * - Getting cleanup metrics
 * - Running manual cleanup (with dry-run option)
 * - Getting cleanup reports
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/utils/prismaDB';
import { UserType } from '@/types/prisma';
import { 
  SoftDeleteCleanupService, 
  runSoftDeleteCleanup, 
  getSoftDeleteMetrics 
} from '@/jobs/cleanupSoftDeleted';

/**
 * GET: Get cleanup metrics and status
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    // Check if user is SUPER_ADMIN (only they can access cleanup functions)
    const requesterProfile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { type: true }
    });

    if (!requesterProfile || requesterProfile.type !== UserType.SUPER_ADMIN) {
      return NextResponse.json(
        { error: 'Forbidden: Only Super Admin can access cleanup functions' },
        { status: 403 }
      );
    }

    // Get query parameters
    const url = new URL(request.url);
    const includeReport = url.searchParams.get('includeReport') === 'true';

    // Get basic metrics
    const metrics = await getSoftDeleteMetrics();

    let response: any = {
      metrics,
      timestamp: new Date().toISOString(),
    };

    // Optionally include detailed report
    if (includeReport) {
      const cleanupService = new SoftDeleteCleanupService();
      const report = await cleanupService.generateCleanupReport();
      response.report = report;
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Cleanup metrics API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get cleanup metrics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST: Run manual cleanup or dry-run
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    // Check if user is SUPER_ADMIN
    const requesterProfile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { type: true, email: true }
    });

    if (!requesterProfile || requesterProfile.type !== UserType.SUPER_ADMIN) {
      return NextResponse.json(
        { error: 'Forbidden: Only Super Admin can run cleanup operations' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const {
      dryRun = true, // Default to dry run for safety
      retentionDays,
      batchSize,
      maxDailyDeletions,
      includeUserTypes,
      excludeUserTypes,
      force = false, // Override safety checks
    } = body;

    // Safety check: require explicit confirmation for non-dry-run
    if (!dryRun && !force) {
      return NextResponse.json(
        { 
          error: 'Non-dry-run cleanup requires explicit force=true confirmation',
          message: 'Set force: true in request body to confirm permanent deletion operation'
        },
        { status: 400 }
      );
    }

    // Log the manual cleanup initiation
    console.log('Manual cleanup initiated', {
      userId: user.id,
      userEmail: requesterProfile.email,
      dryRun,
      retentionDays,
      force,
      timestamp: new Date().toISOString(),
    });

    // Create audit log for manual cleanup
    await prisma.userAudit.create({
      data: {
        userId: user.id,
        action: 'MANUAL_CLEANUP_INITIATED',
        performedBy: user.id,
        changes: {
          operation: 'manual_cleanup',
          parameters: {
            dryRun,
            retentionDays,
            batchSize,
            maxDailyDeletions,
            includeUserTypes,
            excludeUserTypes,
            force,
          },
        },
        reason: 'Manual cleanup operation initiated by Super Admin',
        metadata: {
          operation: 'manual_cleanup',
          timestamp: new Date().toISOString(),
          userEmail: requesterProfile.email,
        },
      },
    });

    // Run the cleanup
    const result = await runSoftDeleteCleanup({
      dryRun,
      retentionDays,
      batchSize,
      maxDailyDeletions,
      includeUserTypes,
      excludeUserTypes,
    });

    // Log completion
    await prisma.userAudit.create({
      data: {
        userId: user.id,
        action: dryRun ? 'MANUAL_CLEANUP_DRY_RUN_COMPLETED' : 'MANUAL_CLEANUP_COMPLETED',
        performedBy: user.id,
        changes: {
          operation: 'manual_cleanup',
          result: JSON.parse(JSON.stringify(result)),
        },
        reason: `Manual cleanup ${dryRun ? 'dry-run' : 'operation'} completed`,
        metadata: {
          operation: 'manual_cleanup',
          timestamp: new Date().toISOString(),
          userEmail: requesterProfile.email,
          success: result.success,
        },
      },
    });

    return NextResponse.json({
      message: `Manual cleanup ${dryRun ? 'dry-run' : 'operation'} completed`,
      result,
      performedBy: {
        id: user.id,
        email: requesterProfile.email,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Manual cleanup API error:', error);
    return NextResponse.json(
      { 
        error: 'Manual cleanup failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
