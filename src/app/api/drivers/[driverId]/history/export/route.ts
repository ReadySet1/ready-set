/**
 * Driver History Export API Route (REA-313)
 *
 * Downloads driver history as PDF or CSV file.
 * Generates comprehensive report with period summary and weekly breakdown.
 *
 * Authorization:
 * - Drivers can export their own history
 * - Admins can export any driver's history
 */

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { z } from 'zod';
import { withAuth } from '@/lib/auth-middleware';
import { getDriverForUser } from '@/lib/auth/driver-ownership';
import { prisma } from '@/utils/prismaDB';
import { parseISO, subWeeks, startOfWeek } from 'date-fns';
import {
  generateDriverHistoryPDF,
  generateDriverHistoryCSV,
} from '@/lib/pdf/driver-history-pdf';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60; // PDF generation can take time

const paramsSchema = z.object({
  driverId: z.string().uuid('Invalid driver ID format'),
});

interface RouteParams {
  params: Promise<{ driverId: string }>;
}

/**
 * GET - Export driver history as PDF or CSV
 *
 * Query params:
 * - startDate: ISO date string (optional, defaults to 12 weeks ago)
 * - endDate: ISO date string (optional, defaults to now)
 * - format: 'pdf' | 'csv' (optional, defaults to 'pdf')
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

    // Drivers can only export their own history; ownership goes through the
    // driver-ownership module (accepts either profile_id or legacy user_id).
    if (authContext.user.type === 'DRIVER') {
      const ownDriver = await getDriverForUser(authContext.user.id);
      if (!ownDriver || ownDriver.id !== driverId) {
        return NextResponse.json(
          { error: 'Unauthorized - you can only export your own history' },
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
    const exportFormat = searchParams.get('format') || 'pdf';

    // Generate export based on format
    if (exportFormat === 'csv') {
      const result = await generateDriverHistoryCSV({
        driverId,
        startDate,
        endDate,
      });

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to generate CSV' },
          { status: 500 }
        );
      }

      return new NextResponse(result.csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${result.filename}"`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }

    // Default: Generate PDF
    const result = await generateDriverHistoryPDF({
      driverId,
      startDate,
      endDate,
    });

    if (!result.success || !result.buffer) {
      return NextResponse.json(
        { error: result.error || 'Failed to generate PDF' },
        { status: 500 }
      );
    }

    return new NextResponse(new Uint8Array(result.buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${result.filename}"`,
        'Content-Length': result.buffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { operation: 'driver-history-export' },
    });

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
