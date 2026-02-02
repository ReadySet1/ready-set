/**
 * Driver History PDF Generation Service (REA-313)
 *
 * Generates PDF reports for driver historical data using React-PDF.
 * Combines data from active tables and archives for complete history.
 */

import { renderToBuffer } from '@react-pdf/renderer';
import { prisma } from '@/utils/prismaDB';
import { prismaLogger } from '@/utils/logger';
import {
  startOfWeek,
  endOfWeek,
  subWeeks,
  eachWeekOfInterval,
  format,
} from 'date-fns';
import { Decimal } from 'decimal.js';
import {
  DriverHistoryReport,
  type DriverInfo,
  type WeeklySummaryRow,
  type PeriodSummary,
} from './templates/DriverHistoryReport';
import React from 'react';

// ============================================================================
// Types
// ============================================================================

export interface GeneratePDFOptions {
  driverId: string;
  startDate?: Date;
  endDate?: Date;
  weeksBack?: number; // Default: 12 weeks
}

export interface PDFGenerationResult {
  success: boolean;
  buffer: Buffer | null;
  filename: string;
  error?: string;
}

// ============================================================================
// PDF Generation Service
// ============================================================================

/**
 * Generate a driver history PDF report
 */
export async function generateDriverHistoryPDF(
  options: GeneratePDFOptions
): Promise<PDFGenerationResult> {
  const { driverId, startDate, endDate, weeksBack = 12 } = options;

  try {
    // Calculate date range
    const periodEnd = endDate || new Date();
    const periodStart = startDate || startOfWeek(subWeeks(periodEnd, weeksBack), { weekStartsOn: 1 });

    prismaLogger.info('Generating driver history PDF', {
      driverId,
      periodStart,
      periodEnd,
    });

    // Fetch driver info
    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      include: {
        profile: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!driver) {
      return {
        success: false,
        buffer: null,
        filename: '',
        error: 'Driver not found',
      };
    }

    const driverInfo: DriverInfo = {
      id: driver.id,
      name: driver.profile?.name || 'Unknown',
      email: driver.profile?.email || 'N/A',
      employeeId: driver.employeeId || undefined,
      vehicleNumber: driver.vehicleNumber || undefined,
      phoneNumber: driver.phoneNumber || undefined,
    };

    // Fetch weekly summaries (from pre-computed table if available)
    const weeklySummaries = await getWeeklySummaries(driverId, periodStart, periodEnd);

    // Compute period summary from weekly data
    const periodSummary = computePeriodSummary(weeklySummaries, periodStart, periodEnd);

    // Generate PDF
    const element = React.createElement(DriverHistoryReport, {
      driver: driverInfo,
      periodSummary,
      weeklySummaries,
      generatedAt: new Date(),
    });
    const pdfBuffer = await renderToBuffer(element as any);

    const filename = `driver-history-${driver.employeeId || driverId}-${format(periodStart, 'yyyyMMdd')}-${format(periodEnd, 'yyyyMMdd')}.pdf`;

    prismaLogger.info('Driver history PDF generated successfully', {
      driverId,
      filename,
      bufferSize: pdfBuffer.length,
    });

    return {
      success: true,
      buffer: Buffer.from(pdfBuffer),
      filename,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    prismaLogger.error('Failed to generate driver history PDF', {
      driverId,
      error,
    });

    return {
      success: false,
      buffer: null,
      filename: '',
      error: errorMessage,
    };
  }
}

/**
 * Get weekly summaries for a driver, combining pre-computed and on-demand data
 */
async function getWeeklySummaries(
  driverId: string,
  startDate: Date,
  endDate: Date
): Promise<WeeklySummaryRow[]> {
  // Get pre-computed summaries
  const existingSummaries = await prisma.driverWeeklySummary.findMany({
    where: {
      driverId,
      weekStart: {
        gte: startOfWeek(startDate, { weekStartsOn: 1 }),
        lte: endOfWeek(endDate, { weekStartsOn: 1 }),
      },
    },
    orderBy: { weekStart: 'desc' },
  });

  // Create a map of existing summaries by week
  const summaryMap = new Map<string, WeeklySummaryRow>();
  for (const summary of existingSummaries) {
    const key = `${summary.year}-${summary.weekNumber}`;
    summaryMap.set(key, {
      weekStart: summary.weekStart,
      weekEnd: summary.weekEnd,
      year: summary.year,
      weekNumber: summary.weekNumber,
      totalShifts: summary.totalShifts,
      completedShifts: summary.completedShifts,
      totalShiftHours: summary.totalShiftHours,
      totalDeliveries: summary.totalDeliveries,
      completedDeliveries: summary.completedDeliveries,
      totalMiles: summary.totalMiles,
      gpsMiles: summary.gpsMiles,
    });
  }

  // Get all weeks in the period
  const allWeeks = eachWeekOfInterval(
    { start: startDate, end: endDate },
    { weekStartsOn: 1 }
  );

  // Fill in missing weeks with on-demand computation
  const results: WeeklySummaryRow[] = [];

  for (const weekStart of allWeeks) {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const year = parseInt(format(weekStart, 'yyyy'), 10);
    const weekNumber = parseInt(format(weekStart, 'I'), 10);
    const key = `${year}-${weekNumber}`;

    if (summaryMap.has(key)) {
      results.push(summaryMap.get(key)!);
    } else {
      // Compute on-demand for missing weeks
      const computed = await computeWeekSummaryOnDemand(driverId, weekStart, weekEnd);
      results.push({
        weekStart,
        weekEnd,
        year,
        weekNumber,
        ...computed,
      });
    }
  }

  // Sort by week descending (most recent first)
  results.sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime());

  return results;
}

/**
 * Compute weekly summary on-demand (when pre-computed data not available)
 */
async function computeWeekSummaryOnDemand(
  driverId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<{
  totalShifts: number;
  completedShifts: number;
  totalShiftHours: Decimal;
  totalDeliveries: number;
  completedDeliveries: number;
  totalMiles: Decimal;
  gpsMiles: Decimal;
}> {
  // Query shifts
  const shifts = await prisma.driverShift.findMany({
    where: {
      driverId,
      shiftStart: { gte: weekStart, lte: weekEnd },
      deletedAt: null,
    },
    select: {
      status: true,
      shiftStart: true,
      shiftEnd: true,
      totalDistanceMiles: true,
      gpsDistanceMiles: true,
    },
  });

  // Query deliveries
  const deliveries = await prisma.delivery.findMany({
    where: {
      driverId,
      assignedAt: { gte: weekStart, lte: weekEnd },
      deletedAt: null,
    },
    select: { status: true },
  });

  // Compute metrics
  const totalShifts = shifts.length;
  const completedShifts = shifts.filter(s => s.status === 'completed').length;

  let totalShiftHours = new Decimal(0);
  let totalMiles = new Decimal(0);
  let gpsMiles = new Decimal(0);

  for (const shift of shifts) {
    if (shift.shiftStart && shift.shiftEnd) {
      const hours = (shift.shiftEnd.getTime() - shift.shiftStart.getTime()) / (1000 * 60 * 60);
      totalShiftHours = totalShiftHours.plus(hours);
    }
    if (shift.totalDistanceMiles) {
      totalMiles = totalMiles.plus(shift.totalDistanceMiles);
    }
    if (shift.gpsDistanceMiles) {
      gpsMiles = gpsMiles.plus(shift.gpsDistanceMiles);
    }
  }

  const totalDeliveries = deliveries.length;
  const completedDeliveries = deliveries.filter(d => d.status === 'delivered').length;

  return {
    totalShifts,
    completedShifts,
    totalShiftHours,
    totalDeliveries,
    completedDeliveries,
    totalMiles,
    gpsMiles,
  };
}

/**
 * Compute period summary from weekly data
 */
function computePeriodSummary(
  weeklySummaries: WeeklySummaryRow[],
  startDate: Date,
  endDate: Date
): PeriodSummary {
  let totalShifts = 0;
  let completedShifts = 0;
  let cancelledShifts = 0;
  let totalHours = 0;
  let totalDeliveries = 0;
  let completedDeliveries = 0;
  let totalMiles = 0;
  let gpsMiles = 0;

  for (const week of weeklySummaries) {
    totalShifts += week.totalShifts;
    completedShifts += week.completedShifts;
    totalHours += typeof week.totalShiftHours === 'number'
      ? week.totalShiftHours
      : Number(week.totalShiftHours);
    totalDeliveries += week.totalDeliveries;
    completedDeliveries += week.completedDeliveries;
    totalMiles += typeof week.totalMiles === 'number'
      ? week.totalMiles
      : Number(week.totalMiles);
    gpsMiles += typeof week.gpsMiles === 'number'
      ? week.gpsMiles
      : Number(week.gpsMiles);
  }

  return {
    startDate,
    endDate,
    totalWeeks: weeklySummaries.length,
    totalShifts,
    completedShifts,
    cancelledShifts,
    totalHours,
    totalDeliveries,
    completedDeliveries,
    totalMiles,
    gpsMiles,
  };
}

/**
 * Generate CSV export of driver history
 */
export async function generateDriverHistoryCSV(
  options: GeneratePDFOptions
): Promise<{ success: boolean; csv: string; filename: string; error?: string }> {
  const { driverId, startDate, endDate, weeksBack = 12 } = options;

  try {
    const periodEnd = endDate || new Date();
    const periodStart = startDate || startOfWeek(subWeeks(periodEnd, weeksBack), { weekStartsOn: 1 });

    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      include: {
        profile: { select: { name: true, email: true } },
      },
    });

    if (!driver) {
      return { success: false, csv: '', filename: '', error: 'Driver not found' };
    }

    const weeklySummaries = await getWeeklySummaries(driverId, periodStart, periodEnd);

    // Build CSV
    const headers = [
      'Week',
      'Week Start',
      'Week End',
      'Total Shifts',
      'Completed Shifts',
      'Total Hours',
      'Total Deliveries',
      'Completed Deliveries',
      'Total Miles',
      'GPS Miles',
    ];

    const rows = weeklySummaries.map(w => [
      `Week ${w.weekNumber}, ${w.year}`,
      format(w.weekStart, 'yyyy-MM-dd'),
      format(w.weekEnd, 'yyyy-MM-dd'),
      w.totalShifts,
      w.completedShifts,
      typeof w.totalShiftHours === 'number' ? w.totalShiftHours.toFixed(1) : Number(w.totalShiftHours).toFixed(1),
      w.totalDeliveries,
      w.completedDeliveries,
      typeof w.totalMiles === 'number' ? w.totalMiles.toFixed(1) : Number(w.totalMiles).toFixed(1),
      typeof w.gpsMiles === 'number' ? w.gpsMiles.toFixed(1) : Number(w.gpsMiles).toFixed(1),
    ]);

    const csv = [
      `Driver History Report - ${driver.profile?.name || 'Unknown'}`,
      `Email: ${driver.profile?.email || 'N/A'}`,
      `Period: ${format(periodStart, 'MMM d, yyyy')} - ${format(periodEnd, 'MMM d, yyyy')}`,
      `Generated: ${format(new Date(), 'MMM d, yyyy h:mm a')}`,
      '',
      headers.join(','),
      ...rows.map(r => r.join(',')),
    ].join('\n');

    const filename = `driver-history-${driver.employeeId || driverId}-${format(periodStart, 'yyyyMMdd')}-${format(periodEnd, 'yyyyMMdd')}.csv`;

    return { success: true, csv, filename };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, csv: '', filename: '', error: errorMessage };
  }
}
