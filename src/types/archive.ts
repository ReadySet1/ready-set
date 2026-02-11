/**
 * Archive Types (REA-313)
 *
 * TypeScript interfaces for the data archiving feature.
 * These types correspond to the backend API responses.
 */

/**
 * Archive batch tracking record
 */
export interface ArchiveBatch {
  id: string;
  archiveType: 'driver_locations' | 'driver_shifts' | 'orders';
  status: 'in_progress' | 'completed' | 'failed';
  recordsProcessed: number;
  recordsArchived: number;
  recordsFailed: number;
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  retentionDays: number;
  dryRun: boolean;
  errorMessage: string | null;
  metadata: Record<string, unknown> | null;
  startedAt: string;
  completedAt: string | null;
}

/**
 * Metrics for a specific archive type
 */
export interface ArchiveTypeMetrics {
  eligibleCount: number;
  oldestDate: string | null;
  activeCount: number;
  archivedCount: number;
}

/**
 * Order-specific metrics
 */
export interface OrderArchiveMetrics {
  eligibleCateringCount: number;
  eligibleOnDemandCount: number;
  totalEligibleCount: number;
  oldestCateringDate: string | null;
  oldestOnDemandDate: string | null;
  archivedCateringCount: number;
  archivedOnDemandCount: number;
  totalArchivedCount: number;
}

/**
 * Weekly summaries metrics
 */
export interface WeeklySummariesMetrics {
  count: number;
}

/**
 * Archive configuration
 */
export interface ArchiveConfiguration {
  locationsRetentionDays: number;
  ordersRetentionDays: number;
  shiftsRetentionWeeks: number;
  batchSize: number;
  dryRunEnabled: boolean;
}

/**
 * Full archive status response from GET /api/admin/archive-status
 */
export interface ArchiveStatusResponse {
  timestamp: string;
  metrics: {
    driverLocations: ArchiveTypeMetrics;
    driverShifts: ArchiveTypeMetrics;
    orders: OrderArchiveMetrics;
    weeklySummaries: WeeklySummariesMetrics;
  };
  recentBatches: ArchiveBatch[];
  configuration: ArchiveConfiguration;
}

/**
 * Result of a single archive operation
 */
export interface ArchiveResult {
  type: 'driver_locations' | 'driver_shifts' | 'orders';
  processed: number;
  archived: number;
  failed: number;
  batchId: string | null;
  dryRun: boolean;
  errors?: string[];
}

/**
 * Response from POST /api/admin/data-archiving
 */
export interface ArchiveTriggerResponse {
  success: boolean;
  dryRun: boolean;
  timestamp: string;
  results: ArchiveResult[];
  summary: {
    totalProcessed: number;
    totalArchived: number;
    totalFailed: number;
  };
  error?: string;
}

/**
 * Request body for triggering archive
 */
export interface ArchiveTriggerRequest {
  dryRun?: boolean;
  locationsRetentionDays?: number;
  ordersRetentionDays?: number;
  shiftsRetentionWeeks?: number;
  batchSize?: number;
}

// ============================================================
// Driver History Types
// ============================================================

/**
 * Driver info in history response
 */
export interface DriverHistoryInfo {
  id: string;
  name: string | null;
  email: string | null;
  employeeId: string | null;
  vehicleNumber: string | null;
}

/**
 * Period summary totals
 */
export interface PeriodSummary {
  totalShifts: number;
  completedShifts: number;
  totalHours: number;
  totalDeliveries: number;
  totalMiles: number;
  gpsMiles: number;
}

/**
 * Weekly breakdown data
 */
export interface WeeklySummary {
  weekStart: string;
  weekEnd: string;
  year: number;
  weekNumber: number;
  totalShifts: number;
  completedShifts: number;
  totalShiftHours: number;
  totalDeliveries: number;
  completedDeliveries: number;
  totalMiles: number;
  gpsMiles: number;
}

/**
 * Recent shift record
 */
export interface RecentShift {
  id: string;
  shiftStart: string | null;
  shiftEnd: string | null;
  status: string;
  totalDistanceMiles: number | null;
  gpsDistanceMiles: number | null;
  deliveryCount: number;
}

/**
 * Archived shift record
 */
export interface ArchivedShift extends RecentShift {
  archivedAt: string | null;
}

/**
 * Full driver history response from GET /api/drivers/[driverId]/history
 */
export interface DriverHistoryResponse {
  driver: DriverHistoryInfo;
  period: {
    startDate: string;
    endDate: string;
  };
  summary: PeriodSummary;
  weeklySummaries: WeeklySummary[];
  recentShifts: RecentShift[];
  archivedShifts: ArchivedShift[];
  includesArchivedData: boolean;
}

/**
 * Parameters for driver history query
 */
export interface DriverHistoryParams {
  startDate?: string;
  endDate?: string;
  includeArchived?: boolean;
}

/**
 * Export format options
 */
export type ExportFormat = 'pdf' | 'csv';
