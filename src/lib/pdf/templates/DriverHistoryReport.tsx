/**
 * Driver History Report PDF Template (REA-313)
 *
 * React-PDF template for generating driver history reports.
 * Includes:
 * - Driver information header
 * - Period summary (total shifts, deliveries, miles, hours)
 * - Weekly breakdown table
 * - Generated timestamp and company branding
 */

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import { format } from 'date-fns';
import type { Decimal } from 'decimal.js';

// ============================================================================
// Types
// ============================================================================

export interface DriverInfo {
  id: string;
  name: string;
  email: string;
  employeeId?: string;
  vehicleNumber?: string;
  phoneNumber?: string;
}

export interface WeeklySummaryRow {
  weekStart: Date;
  weekEnd: Date;
  year: number;
  weekNumber: number;
  totalShifts: number;
  completedShifts: number;
  totalShiftHours: Decimal | number;
  totalDeliveries: number;
  completedDeliveries: number;
  totalMiles: Decimal | number;
  gpsMiles: Decimal | number;
}

export interface PeriodSummary {
  startDate: Date;
  endDate: Date;
  totalWeeks: number;
  totalShifts: number;
  completedShifts: number;
  cancelledShifts: number;
  totalHours: number;
  totalDeliveries: number;
  completedDeliveries: number;
  totalMiles: number;
  gpsMiles: number;
}

export interface DriverHistoryReportProps {
  driver: DriverInfo;
  periodSummary: PeriodSummary;
  weeklySummaries: WeeklySummaryRow[];
  generatedAt: Date;
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    borderBottom: '1 solid #333',
    paddingBottom: 15,
  },
  companyName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a365d',
    marginBottom: 5,
  },
  reportTitle: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1a365d',
    marginBottom: 10,
    borderBottom: '1 solid #ddd',
    paddingBottom: 5,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  label: {
    width: 120,
    color: '#666',
  },
  value: {
    flex: 1,
    fontWeight: 'bold',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  summaryItem: {
    width: '33%',
    marginBottom: 15,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a365d',
  },
  summaryLabel: {
    fontSize: 8,
    color: '#666',
    marginTop: 2,
  },
  table: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderBottom: '1 solid #ddd',
    paddingVertical: 8,
    paddingHorizontal: 5,
  },
  tableHeaderCell: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#333',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1 solid #eee',
    paddingVertical: 6,
    paddingHorizontal: 5,
  },
  tableRowAlt: {
    backgroundColor: '#fafafa',
  },
  tableCell: {
    fontSize: 9,
  },
  colWeek: { width: '18%' },
  colShifts: { width: '10%', textAlign: 'center' },
  colHours: { width: '12%', textAlign: 'right' },
  colDeliveries: { width: '12%', textAlign: 'center' },
  colMiles: { width: '12%', textAlign: 'right' },
  colGpsMiles: { width: '12%', textAlign: 'right' },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTop: '1 solid #ddd',
    paddingTop: 10,
  },
  footerText: {
    fontSize: 8,
    color: '#999',
  },
  pageNumber: {
    fontSize: 8,
    color: '#999',
  },
  noData: {
    textAlign: 'center',
    color: '#999',
    padding: 20,
    fontStyle: 'italic',
  },
});

// ============================================================================
// Helper Functions
// ============================================================================

function formatNumber(value: Decimal | number | undefined | null): string {
  if (value === undefined || value === null) return '0';
  const num = typeof value === 'number' ? value : Number(value);
  return num.toFixed(1);
}

function formatInteger(value: number | undefined | null): string {
  if (value === undefined || value === null) return '0';
  return value.toString();
}

function formatDateRange(start: Date, end: Date): string {
  return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
}

function formatWeekLabel(row: WeeklySummaryRow): string {
  return `Week ${row.weekNumber}, ${row.year}`;
}

// ============================================================================
// Components
// ============================================================================

function Header({ driver, periodSummary }: { driver: DriverInfo; periodSummary: PeriodSummary }) {
  return (
    <View style={styles.header}>
      <Text style={styles.companyName}>Ready Set</Text>
      <Text style={styles.reportTitle}>Driver History Report</Text>
      <View style={{ flexDirection: 'row', marginTop: 10 }}>
        <View style={{ flex: 1 }}>
          <View style={styles.row}>
            <Text style={styles.label}>Driver Name:</Text>
            <Text style={styles.value}>{driver.name || 'N/A'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Email:</Text>
            <Text style={styles.value}>{driver.email}</Text>
          </View>
          {driver.employeeId && (
            <View style={styles.row}>
              <Text style={styles.label}>Employee ID:</Text>
              <Text style={styles.value}>{driver.employeeId}</Text>
            </View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.row}>
            <Text style={styles.label}>Report Period:</Text>
            <Text style={styles.value}>
              {format(periodSummary.startDate, 'MMM d, yyyy')} -{' '}
              {format(periodSummary.endDate, 'MMM d, yyyy')}
            </Text>
          </View>
          {driver.vehicleNumber && (
            <View style={styles.row}>
              <Text style={styles.label}>Vehicle:</Text>
              <Text style={styles.value}>{driver.vehicleNumber}</Text>
            </View>
          )}
          {driver.phoneNumber && (
            <View style={styles.row}>
              <Text style={styles.label}>Phone:</Text>
              <Text style={styles.value}>{driver.phoneNumber}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

function PeriodSummarySection({ summary }: { summary: PeriodSummary }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Period Summary</Text>
      <View style={styles.summaryGrid}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{formatInteger(summary.totalShifts)}</Text>
          <Text style={styles.summaryLabel}>TOTAL SHIFTS</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{formatInteger(summary.completedShifts)}</Text>
          <Text style={styles.summaryLabel}>COMPLETED SHIFTS</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{formatNumber(summary.totalHours)}</Text>
          <Text style={styles.summaryLabel}>TOTAL HOURS</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{formatInteger(summary.totalDeliveries)}</Text>
          <Text style={styles.summaryLabel}>TOTAL DELIVERIES</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{formatInteger(summary.completedDeliveries)}</Text>
          <Text style={styles.summaryLabel}>COMPLETED DELIVERIES</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{formatNumber(summary.totalMiles)}</Text>
          <Text style={styles.summaryLabel}>TOTAL MILES</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{formatNumber(summary.gpsMiles)}</Text>
          <Text style={styles.summaryLabel}>GPS MILES</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{formatInteger(summary.totalWeeks)}</Text>
          <Text style={styles.summaryLabel}>WEEKS IN PERIOD</Text>
        </View>
      </View>
    </View>
  );
}

function WeeklyBreakdownTable({ summaries }: { summaries: WeeklySummaryRow[] }) {
  if (summaries.length === 0) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Weekly Breakdown</Text>
        <Text style={styles.noData}>No weekly data available for this period.</Text>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Weekly Breakdown</Text>
      <View style={styles.table}>
        {/* Table Header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, styles.colWeek]}>Week</Text>
          <Text style={[styles.tableHeaderCell, styles.colShifts]}>Shifts</Text>
          <Text style={[styles.tableHeaderCell, styles.colHours]}>Hours</Text>
          <Text style={[styles.tableHeaderCell, styles.colDeliveries]}>Deliveries</Text>
          <Text style={[styles.tableHeaderCell, styles.colMiles]}>Total Mi</Text>
          <Text style={[styles.tableHeaderCell, styles.colGpsMiles]}>GPS Mi</Text>
        </View>

        {/* Table Rows */}
        {summaries.map((row, index) => (
          <View
            key={`${row.year}-${row.weekNumber}`}
            style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}
          >
            <View style={styles.colWeek}>
              <Text style={styles.tableCell}>{formatWeekLabel(row)}</Text>
              <Text style={[styles.tableCell, { fontSize: 7, color: '#999' }]}>
                {formatDateRange(row.weekStart, row.weekEnd)}
              </Text>
            </View>
            <Text style={[styles.tableCell, styles.colShifts]}>
              {formatInteger(row.completedShifts)}/{formatInteger(row.totalShifts)}
            </Text>
            <Text style={[styles.tableCell, styles.colHours]}>
              {formatNumber(row.totalShiftHours)}
            </Text>
            <Text style={[styles.tableCell, styles.colDeliveries]}>
              {formatInteger(row.completedDeliveries)}/{formatInteger(row.totalDeliveries)}
            </Text>
            <Text style={[styles.tableCell, styles.colMiles]}>
              {formatNumber(row.totalMiles)}
            </Text>
            <Text style={[styles.tableCell, styles.colGpsMiles]}>
              {formatNumber(row.gpsMiles)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Footer({ generatedAt }: { generatedAt: Date }) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>
        Generated: {format(generatedAt, 'MMM d, yyyy h:mm a')}
      </Text>
      <Text style={styles.footerText}>
        Ready Set Delivery Services | Confidential
      </Text>
      <Text
        style={styles.pageNumber}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
      />
    </View>
  );
}

// ============================================================================
// Main Document Component
// ============================================================================

export function DriverHistoryReport({
  driver,
  periodSummary,
  weeklySummaries,
  generatedAt,
}: DriverHistoryReportProps) {
  return (
    <Document
      title={`Driver History Report - ${driver.name || driver.email}`}
      author="Ready Set"
      subject="Driver History Report"
      creator="Ready Set Delivery Management System"
    >
      <Page size="LETTER" style={styles.page}>
        <Header driver={driver} periodSummary={periodSummary} />
        <PeriodSummarySection summary={periodSummary} />
        <WeeklyBreakdownTable summaries={weeklySummaries} />
        <Footer generatedAt={generatedAt} />
      </Page>
    </Document>
  );
}

export default DriverHistoryReport;
