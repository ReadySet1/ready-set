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
import { z } from 'zod';
import { withAuth } from '@/lib/auth-middleware';
import { getDriverForUser } from '@/lib/auth/driver-ownership';
import { prisma } from '@/utils/prismaDB';
import { format, parseISO, subWeeks, startOfWeek } from 'date-fns';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const paramsSchema = z.object({
  driverId: z.string().uuid('Invalid driver ID format'),
});

interface RouteParams {
  params: Promise<{ driverId: string }>;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

interface PeriodTotals {
  totalShifts: number;
  completedShifts: number;
  totalHours: number;
  totalDeliveries: number;
  totalMiles: number;
  gpsMiles: number;
}

/** Live or archived shift row; archived rows come from raw SQL. */
interface HistoryShift {
  shiftStart: Date | string | null;
  shiftEnd?: Date | string | null;
  status?: string | null;
  totalDistanceMiles?: number | null;
  gpsDistanceMiles?: number | null;
  deliveryCount?: number | null;
  updatedAt?: Date | string | null;
}

function emptyTotals(): PeriodTotals {
  return {
    totalShifts: 0,
    completedShifts: 0,
    totalHours: 0,
    totalDeliveries: 0,
    totalMiles: 0,
    gpsMiles: 0,
  };
}

function toDate(value: Date | string | null | undefined): Date {
  return value instanceof Date ? value : new Date(value ?? 0);
}

/** yyyy-MM-dd of a date in UTC. */
function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * UTC Monday (yyyy-MM-dd) of the week containing `d`. Matches the `@db.Date`
 * weekStart the summary job writes (Monday-start weeks, server runs in UTC).
 */
function utcWeekKey(d: Date): string {
  const daysSinceMonday = (d.getUTCDay() + 6) % 7;
  return dateKey(
    new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - daysSinceMonday))
  );
}

/** Miles are stored as miles on the shift rows, so no unit conversion here. */
function addShift(totals: PeriodTotals, shift: HistoryShift): void {
  totals.totalShifts += 1;
  if (shift.status?.toLowerCase() === 'completed') {
    totals.completedShifts += 1;
  }
  if (shift.shiftStart && shift.shiftEnd) {
    totals.totalHours +=
      (toDate(shift.shiftEnd).getTime() - toDate(shift.shiftStart).getTime()) / (1000 * 60 * 60);
  }
  totals.totalDeliveries += Number(shift.deliveryCount || 0);
  totals.totalMiles += Number(shift.totalDistanceMiles || 0);
  totals.gpsMiles += Number(shift.gpsDistanceMiles || 0);
}

/**
 * A weekly summary is fresh when it already accounts for every shift we can
 * see in its week: it knows about at least as many shifts, and none of the
 * live shifts changed after the summary was last written. Anything else
 * (e.g. a zero row written before the week's shifts existed) is stale and
 * that week is computed from the live rows instead.
 */
function isSummaryFresh(
  summary: { totalShifts: number; updatedAt: Date },
  weekShifts: HistoryShift[]
): boolean {
  if (summary.totalShifts < weekShifts.length) return false;
  const writtenAt = summary.updatedAt.getTime();
  return weekShifts.every(
    shift => !shift.updatedAt || toDate(shift.updatedAt).getTime() <= writtenAt
  );
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
    // Authenticate request
    const authResult = await withAuth(request, {
      allowedRoles: ['DRIVER', 'ADMIN', 'SUPER_ADMIN', 'HELPDESK'],
      requireAuth: true,
    });

    if (!authResult.success) {
      return authResult.response!;
    }

    const { context: authContext } = authResult;

    // Validate route params before they reach Prisma (non-UUID ids throw)
    const paramsValidation = paramsSchema.safeParse(await context.params);
    if (!paramsValidation.success) {
      return NextResponse.json(
        { error: 'Invalid driver ID', details: paramsValidation.error.issues },
        { status: 400 }
      );
    }
    const { driverId } = paramsValidation.data;

    const driver = await prisma.driver.findFirst({
      where: { id: driverId, deletedAt: null },
      include: {
        profile: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!driver) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
    }

    // Drivers can only access their own history; ownership goes through the
    // driver-ownership module (accepts either profile_id or legacy user_id).
    if (authContext.user.type === 'DRIVER') {
      const ownDriver = await getDriverForUser(authContext.user.id);
      if (!ownDriver || ownDriver.id !== driverId) {
        return NextResponse.json(
          { error: 'Unauthorized - you can only access your own history' },
          { status: 403 }
        );
      }
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
      take: 200,
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
      take: 200,
      select: {
        id: true,
        shiftStart: true,
        shiftEnd: true,
        status: true,
        totalDistanceMiles: true,
        gpsDistanceMiles: true,
        deliveryCount: true,
        updatedAt: true,
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

    // Period totals use per-week coverage: a week with a fresh summary takes
    // the summary; every other week is computed from the live shift rows.
    const allShifts: HistoryShift[] = [...shifts, ...archivedShifts];
    const shiftsByWeek = new Map<string, HistoryShift[]>();
    for (const shift of allShifts) {
      const key = utcWeekKey(toDate(shift.shiftStart));
      const bucket = shiftsByWeek.get(key);
      if (bucket) bucket.push(shift);
      else shiftsByWeek.set(key, [shift]);
    }

    const freshSummaries = summaries.filter((s: typeof summaries[number]) =>
      isSummaryFresh(s, shiftsByWeek.get(dateKey(s.weekStart)) ?? [])
    );
    const coveredWeeks = new Set(
      freshSummaries.map((s: typeof summaries[number]) => dateKey(s.weekStart))
    );

    const periodSummary = emptyTotals();
    for (const summary of freshSummaries) {
      periodSummary.totalShifts += summary.totalShifts;
      periodSummary.completedShifts += summary.completedShifts;
      periodSummary.totalHours += Number(summary.totalShiftHours);
      periodSummary.totalDeliveries += summary.totalDeliveries;
      periodSummary.totalMiles += Number(summary.totalMiles);
      periodSummary.gpsMiles += Number(summary.gpsMiles);
    }

    const liveTotals = emptyTotals();
    const liveWeeks = new Map<string, PeriodTotals>();
    for (const [key, weekShifts] of shiftsByWeek) {
      if (coveredWeeks.has(key)) continue;
      const weekTotals = emptyTotals();
      for (const shift of weekShifts) {
        addShift(weekTotals, shift);
        addShift(liveTotals, shift);
      }
      liveWeeks.set(key, weekTotals);
    }

    // Shift deliveryCount may not be populated: count delivery rows for the
    // part of the range not already covered by a fresh summary.
    if (liveTotals.totalDeliveries === 0) {
      const coveredRanges = [...coveredWeeks].map(key => {
        const weekStart = new Date(`${key}T00:00:00.000Z`);
        return {
          createdAt: { gte: weekStart, lt: new Date(weekStart.getTime() + WEEK_MS) },
        };
      });
      liveTotals.totalDeliveries = await prisma.delivery.count({
        where: {
          driverId,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
          deletedAt: null,
          ...(coveredRanges.length > 0 ? { NOT: coveredRanges } : {}),
        },
      });
    }

    periodSummary.totalShifts += liveTotals.totalShifts;
    periodSummary.completedShifts += liveTotals.completedShifts;
    periodSummary.totalHours += liveTotals.totalHours;
    periodSummary.totalDeliveries += liveTotals.totalDeliveries;
    periodSummary.totalMiles += liveTotals.totalMiles;
    periodSummary.gpsMiles += liveTotals.gpsMiles;

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

      let rows: (string | number)[][];

      if (freshSummaries.length > 0) {
        const weekRows: Array<{ key: string; row: (string | number)[] }> = [
          ...freshSummaries.map((s: typeof summaries[number]) => ({
            key: dateKey(s.weekStart),
            row: [
              `Week ${s.weekNumber} ${s.year}`,
              format(s.weekStart, 'yyyy-MM-dd'),
              format(s.weekEnd, 'yyyy-MM-dd'),
              s.totalShifts,
              s.completedShifts,
              Number(s.totalShiftHours).toFixed(1),
              s.totalDeliveries,
              Number(s.totalMiles).toFixed(1),
              Number(s.gpsMiles).toFixed(1),
            ],
          })),
          ...[...liveWeeks].map(([key, t]) => ({
            key,
            row: [
              `Week of ${key}`,
              key,
              dateKey(new Date(new Date(`${key}T00:00:00.000Z`).getTime() + 6 * DAY_MS)),
              t.totalShifts,
              t.completedShifts,
              t.totalHours.toFixed(1),
              t.totalDeliveries,
              t.totalMiles.toFixed(1),
              t.gpsMiles.toFixed(1),
            ],
          })),
        ];
        rows = weekRows
          .sort((a, b) => b.key.localeCompare(a.key))
          .map(r => r.row);
      } else {
        // Fallback: generate a single summary row from computed period totals
        rows = [[
          `${format(startDate, 'yyyy-MM-dd')} to ${format(endDate, 'yyyy-MM-dd')}`,
          format(startDate, 'yyyy-MM-dd'),
          format(endDate, 'yyyy-MM-dd'),
          periodSummary.totalShifts,
          periodSummary.completedShifts,
          periodSummary.totalHours.toFixed(1),
          periodSummary.totalDeliveries,
          periodSummary.totalMiles.toFixed(1),
          periodSummary.gpsMiles.toFixed(1),
        ]];
      }

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
      weeklySummaries: freshSummaries.map((s: typeof summaries[number]) => ({
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
