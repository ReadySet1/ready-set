/**
 * Archive Status API Route (REA-313)
 *
 * Provides metrics and status information about data archiving.
 * Used by admin dashboard to monitor archive health and storage.
 */

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createClient } from '@/utils/supabase/server';
import { getArchiveMetrics } from '@/jobs/dataArchiving';
import { prisma } from '@/utils/prismaDB';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface AppMetadata {
  role?: string;
}

/**
 * GET - Get archive metrics and status
 */
export async function GET(request: NextRequest) {
  try {
    // Authorize admin users only
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const isAdminUser = user && (user.app_metadata as AppMetadata)?.role === 'admin';
    const isSuperAdmin = user && (user.app_metadata as AppMetadata)?.role === 'super_admin';
    const isAuthorized = isAdminUser || isSuperAdmin;

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized - admin access required' },
        { status: 401 }
      );
    }

    // Get archive metrics
    const metrics = await getArchiveMetrics();

    // Get additional storage statistics
    const [
      archivedLocationsCount,
      archivedShiftsCount,
      archivedCateringCount,
      archivedOnDemandCount,
      activeLocationsCount,
      activeShiftsCount,
      weeklySummariesCount,
    ] = await Promise.all([
      // Archived counts
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count FROM driver_locations_archive
      `.then(r => Number(r[0]?.count ?? 0)),

      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count FROM driver_shifts_archive
      `.then(r => Number(r[0]?.count ?? 0)),

      prisma.cateringRequest.count({ where: { archivedAt: { not: null } } }),
      prisma.onDemand.count({ where: { archivedAt: { not: null } } }),

      // Active counts
      prisma.driverLocation.count({ where: { deletedAt: null } }),
      prisma.driverShift.count({ where: { deletedAt: null } }),

      // Weekly summaries
      prisma.driverWeeklySummary.count(),
    ]);

    const response = {
      timestamp: new Date().toISOString(),
      metrics: {
        driverLocations: {
          ...metrics.driverLocations,
          activeCount: activeLocationsCount,
          archivedCount: archivedLocationsCount,
        },
        driverShifts: {
          ...metrics.driverShifts,
          activeCount: activeShiftsCount,
          archivedCount: archivedShiftsCount,
        },
        orders: {
          ...metrics.orders,
          archivedCateringCount,
          archivedOnDemandCount,
          totalArchivedCount: archivedCateringCount + archivedOnDemandCount,
        },
        weeklySummaries: {
          count: weeklySummariesCount,
        },
      },
      recentBatches: metrics.recentBatches.map(batch => ({
        ...batch,
        startedAt: batch.startedAt.toISOString(),
      })),
      configuration: {
        locationsRetentionDays: parseInt(process.env.ARCHIVE_LOCATIONS_RETENTION_DAYS || '30'),
        ordersRetentionDays: parseInt(process.env.ARCHIVE_ORDERS_RETENTION_DAYS || '30'),
        shiftsRetentionWeeks: parseInt(process.env.ARCHIVE_SHIFTS_RETENTION_WEEKS || '5'),
        batchSize: parseInt(process.env.ARCHIVE_BATCH_SIZE || '1000'),
        dryRunEnabled: process.env.ARCHIVE_DRY_RUN === 'true',
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { operation: 'archive-status' },
    });

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
