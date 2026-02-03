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
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/utils/prismaDB';
import { parseISO, subWeeks, startOfWeek } from 'date-fns';
import {
  generateDriverHistoryPDF,
  generateDriverHistoryCSV,
} from '@/lib/pdf/driver-history-pdf';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60; // PDF generation can take time

interface AppMetadata {
  role?: string;
}

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
        { error: 'Unauthorized - you can only export your own history' },
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
