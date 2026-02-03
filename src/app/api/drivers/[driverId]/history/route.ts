/**
 * Driver History API Route (REA-313)
 *
 * Provides historical data for a driver including shifts, deliveries, and mileage.
 * Returns data in JSON or CSV format, combining active and archived data.
 *
 * Authorization:
 * - Drivers can access their own history
 * - Admins can access any driver's history
 */

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/utils/prismaDB';
import { format, parseISO, subWeeks, startOfWeek } from 'date-fns';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface AppMetadata {
  role?: string;
}

interface RouteParams {
  params: Promise<{ driverId: string }>;
}

/**
 * GET - Get driver history data
 *
 * Query params:
 * - startDate: ISO date string (optional, defaults to 12 weeks ago)
 * - endDate: ISO date string (optional, defaults to now)
 * - format: 'json' | 'csv' (optional, defaults to 'json')
 * - includeArchived: 'true' | 'false' (optional, defaults to 'true')
 */
export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const { driverId } = await context.params;

    // Authorize user
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdminUser = (user.app_metadata as AppMetadata)?.role === 'admin';
    const isSuperAdmin = (user.app_metadata as AppMetadata)?.role === 'super_admin';

    // Check if user can access this driver's data
    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      include: {
        profile: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!driver) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
    }

    // Drivers can only access their own history
    const isOwnData = driver.profile?.id === user.id;
    const isAuthorized = isOwnData || isAdminUser || isSuperAdmin;

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized - you can only access your own history' },
        { status: 403 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const endDate = searchParams.get('endDate')
      ? parseISO(searchParams.get('endDate')!)
      : new Date();
    const startDate = searchParams.get('startDate')
      ? parseISO(searchParams.get('startDate')!)
      : startOfWeek(subWeeks(endDate, 12), { weekStartsOn: 1 });
    const responseFormat = searchParams.get('format') || 'json';
    const includeArchived = searchParams.get('includeArchived') !== 'false';

    // Fetch weekly summaries
    const summaries = await prisma.driverWeeklySummary.findMany({
      where: {
        driverId,
        weekStart: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { weekStart: 'desc' },
    });

    // Fetch recent shifts (for more detailed data)
    const shifts = await prisma.driverShift.findMany({
      where: {
        driverId,
        shiftStart: {
          gte: startDate,
          lte: endDate,
        },
        deletedAt: null,
      },
      orderBy: { shiftStart: 'desc' },
      select: {
        id: true,
        shiftStart: true,
        shiftEnd: true,
        status: true,
        totalDistanceMiles: true,
        gpsDistanceMiles: true,
        deliveryCount: true,
      },
    });

    // Fetch archived shift data if requested
    let archivedShifts: any[] = [];
    if (includeArchived) {
      archivedShifts = await prisma.$queryRaw<any[]>`
        SELECT
          id,
          shift_start as "shiftStart",
          shift_end as "shiftEnd",
          status,
          total_distance_miles as "totalDistanceMiles",
          gps_distance_miles as "gpsDistanceMiles",
          delivery_count as "deliveryCount",
          archived_at as "archivedAt"
        FROM driver_shifts_archive
        WHERE driver_id = ${driverId}::uuid
          AND shift_start >= ${startDate}
          AND shift_start <= ${endDate}
        ORDER BY shift_start DESC
      `;
    }

    // Compute period totals
    const periodSummary = {
      totalShifts: 0,
      completedShifts: 0,
      totalHours: 0,
      totalDeliveries: 0,
      totalMiles: 0,
      gpsMiles: 0,
    };

    for (const summary of summaries) {
      periodSummary.totalShifts += summary.totalShifts;
      periodSummary.completedShifts += summary.completedShifts;
      periodSummary.totalHours += Number(summary.totalShiftHours);
      periodSummary.totalDeliveries += summary.totalDeliveries;
      periodSummary.totalMiles += Number(summary.totalMiles);
      periodSummary.gpsMiles += Number(summary.gpsMiles);
    }

    // Return CSV format
    if (responseFormat === 'csv') {
      const headers = [
        'Week',
        'Week Start',
        'Week End',
        'Total Shifts',
        'Completed Shifts',
        'Total Hours',
        'Total Deliveries',
        'Total Miles',
        'GPS Miles',
      ];

      const rows = summaries.map((s: typeof summaries[number]) => [
        `Week ${s.weekNumber} ${s.year}`,
        format(s.weekStart, 'yyyy-MM-dd'),
        format(s.weekEnd, 'yyyy-MM-dd'),
        s.totalShifts,
        s.completedShifts,
        Number(s.totalShiftHours).toFixed(1),
        s.totalDeliveries,
        Number(s.totalMiles).toFixed(1),
        Number(s.gpsMiles).toFixed(1),
      ]);

      const csv = [
        `Driver History - ${driver.profile?.name || 'Unknown'}`,
        `Period: ${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')}`,
        '',
        headers.join(','),
        ...rows.map((r: (string | number)[]) => r.join(',')),
      ].join('\n');

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="driver-history-${driverId}.csv"`,
        },
      });
    }

    // Return JSON format
    return NextResponse.json({
      driver: {
        id: driver.id,
        name: driver.profile?.name,
        email: driver.profile?.email,
        employeeId: driver.employeeId,
        vehicleNumber: driver.vehicleNumber,
      },
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      summary: periodSummary,
      weeklySummaries: summaries.map((s: typeof summaries[number]) => ({
        weekStart: s.weekStart.toISOString(),
        weekEnd: s.weekEnd.toISOString(),
        year: s.year,
        weekNumber: s.weekNumber,
        totalShifts: s.totalShifts,
        completedShifts: s.completedShifts,
        totalShiftHours: Number(s.totalShiftHours),
        totalDeliveries: s.totalDeliveries,
        completedDeliveries: s.completedDeliveries,
        totalMiles: Number(s.totalMiles),
        gpsMiles: Number(s.gpsMiles),
      })),
      recentShifts: shifts.map(s => ({
        id: s.id,
        shiftStart: s.shiftStart?.toISOString(),
        shiftEnd: s.shiftEnd?.toISOString(),
        status: s.status,
        totalDistanceMiles: s.totalDistanceMiles,
        gpsDistanceMiles: s.gpsDistanceMiles,
        deliveryCount: s.deliveryCount,
      })),
      archivedShifts: archivedShifts.map((s: {
        shiftStart?: Date | null;
        shiftEnd?: Date | null;
        archivedAt?: Date | null;
        [key: string]: unknown;
      }) => ({
        ...s,
        shiftStart: s.shiftStart?.toISOString(),
        shiftEnd: s.shiftEnd?.toISOString(),
        archivedAt: s.archivedAt?.toISOString(),
      })),
      includesArchivedData: includeArchived && archivedShifts.length > 0,
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { operation: 'driver-history' },
    });

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
