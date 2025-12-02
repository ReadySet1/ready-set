/**
 * Audit History Types
 *
 * TypeScript types and enums for the User Audit History feature.
 * Used for tracking and displaying all changes made to user profiles.
 */

// ============================================================================
// Enums
// ============================================================================

/**
 * Audit action types representing different kinds of user modifications
 */
export enum AuditAction {
  CREATE = "CREATE",
  UPDATE = "UPDATE",
  SOFT_DELETE = "SOFT_DELETE",
  RESTORE = "RESTORE",
  PERMANENT_DELETE = "PERMANENT_DELETE",
  ROLE_CHANGE = "ROLE_CHANGE",
  STATUS_CHANGE = "STATUS_CHANGE",
  PASSWORD_RESET = "PASSWORD_RESET",
  FILE_UPLOAD = "FILE_UPLOAD",
  FILE_DELETE = "FILE_DELETE",
}

// ============================================================================
// UI Color Mapping
// ============================================================================

/**
 * Color configuration for each audit action type
 * Used for visual differentiation in the UI
 */
export const AUDIT_ACTION_COLORS: Record<
  AuditAction,
  {
    bg: string;
    text: string;
    border: string;
    icon: string;
  }
> = {
  [AuditAction.CREATE]: {
    bg: "bg-green-100",
    text: "text-green-800",
    border: "border-green-200",
    icon: "text-green-600",
  },
  [AuditAction.UPDATE]: {
    bg: "bg-blue-100",
    text: "text-blue-800",
    border: "border-blue-200",
    icon: "text-blue-600",
  },
  [AuditAction.SOFT_DELETE]: {
    bg: "bg-red-100",
    text: "text-red-800",
    border: "border-red-200",
    icon: "text-red-600",
  },
  [AuditAction.RESTORE]: {
    bg: "bg-emerald-100",
    text: "text-emerald-800",
    border: "border-emerald-200",
    icon: "text-emerald-600",
  },
  [AuditAction.PERMANENT_DELETE]: {
    bg: "bg-red-200",
    text: "text-red-900",
    border: "border-red-300",
    icon: "text-red-700",
  },
  [AuditAction.ROLE_CHANGE]: {
    bg: "bg-purple-100",
    text: "text-purple-800",
    border: "border-purple-200",
    icon: "text-purple-600",
  },
  [AuditAction.STATUS_CHANGE]: {
    bg: "bg-amber-100",
    text: "text-amber-800",
    border: "border-amber-200",
    icon: "text-amber-600",
  },
  [AuditAction.PASSWORD_RESET]: {
    bg: "bg-slate-100",
    text: "text-slate-800",
    border: "border-slate-200",
    icon: "text-slate-600",
  },
  [AuditAction.FILE_UPLOAD]: {
    bg: "bg-cyan-100",
    text: "text-cyan-800",
    border: "border-cyan-200",
    icon: "text-cyan-600",
  },
  [AuditAction.FILE_DELETE]: {
    bg: "bg-orange-100",
    text: "text-orange-800",
    border: "border-orange-200",
    icon: "text-orange-600",
  },
};

/**
 * Human-readable labels for audit actions
 */
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  [AuditAction.CREATE]: "Created",
  [AuditAction.UPDATE]: "Updated",
  [AuditAction.SOFT_DELETE]: "Deleted",
  [AuditAction.RESTORE]: "Restored",
  [AuditAction.PERMANENT_DELETE]: "Permanently Deleted",
  [AuditAction.ROLE_CHANGE]: "Role Changed",
  [AuditAction.STATUS_CHANGE]: "Status Changed",
  [AuditAction.PASSWORD_RESET]: "Password Reset",
  [AuditAction.FILE_UPLOAD]: "File Uploaded",
  [AuditAction.FILE_DELETE]: "File Deleted",
};

// ============================================================================
// API Types
// ============================================================================

/**
 * Represents the before/after values for a change
 */
export interface AuditChanges {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

/**
 * A single audit log entry
 */
export interface AuditLogEntry {
  id: string;
  userId: string;
  action: AuditAction;
  performedBy: string | null;
  performerName: string | null;
  performerEmail: string | null;
  performerImage: string | null;
  changes: AuditChanges | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

/**
 * Filters for querying audit logs
 */
export interface AuditLogFilters {
  actions?: AuditAction[];
  startDate?: string;
  endDate?: string;
  performedBy?: string;
}

/**
 * Pagination information for audit log responses
 */
export interface AuditPagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/**
 * API response for fetching audit logs
 */
export interface AuditLogsResponse {
  logs: AuditLogEntry[];
  pagination: AuditPagination;
  filters: {
    availableActions: AuditAction[];
  };
}

// ============================================================================
// Service Types
// ============================================================================

/**
 * Parameters for creating a new audit entry
 */
export interface CreateAuditEntryParams {
  userId: string;
  action: AuditAction;
  performedBy: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Query parameters for fetching audit logs
 */
export interface AuditLogQueryParams {
  userId: string;
  page?: number;
  limit?: number;
  actions?: AuditAction[];
  startDate?: Date;
  endDate?: Date;
  performedBy?: string;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Field change representation for diff viewer
 */
export interface FieldChange {
  field: string;
  label: string;
  before: unknown;
  after: unknown;
  type: "added" | "removed" | "modified";
}

/**
 * Human-readable field name mappings for common profile fields
 */
export const FIELD_LABELS: Record<string, string> = {
  name: "Display Name",
  email: "Email Address",
  contactName: "Contact Name",
  contactNumber: "Phone Number",
  companyName: "Company Name",
  website: "Website",
  street1: "Street Address 1",
  street2: "Street Address 2",
  city: "City",
  state: "State",
  zip: "ZIP Code",
  locationNumber: "Location Number",
  parkingLoading: "Parking/Loading Notes",
  type: "User Type",
  status: "Status",
  counties: "Counties Served",
  timeNeeded: "Time Needed",
  cateringBrokerage: "Catering Brokerage",
  provide: "Provisions",
  frequency: "Frequency",
  headCount: "Head Count",
  sideNotes: "Side Notes",
  deletedAt: "Deleted At",
  deletedBy: "Deleted By",
  deletionReason: "Deletion Reason",
};

/**
 * Get human-readable label for a field
 */
export function getFieldLabel(field: string): string {
  return FIELD_LABELS[field] || formatFieldName(field);
}

/**
 * Format a camelCase field name to Title Case
 */
function formatFieldName(field: string): string {
  return field
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

/**
 * Parse changes object to get list of field changes
 */
export function parseChanges(changes: AuditChanges | null): FieldChange[] {
  if (!changes) return [];

  const fieldChanges: FieldChange[] = [];
  const before = changes.before || {};
  const after = changes.after || {};

  // Get all unique keys
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of allKeys) {
    const beforeValue = before[key];
    const afterValue = after[key];

    // Skip if values are the same
    if (JSON.stringify(beforeValue) === JSON.stringify(afterValue)) {
      continue;
    }

    let type: FieldChange["type"];
    if (beforeValue === undefined || beforeValue === null) {
      type = "added";
    } else if (afterValue === undefined || afterValue === null) {
      type = "removed";
    } else {
      type = "modified";
    }

    fieldChanges.push({
      field: key,
      label: getFieldLabel(key),
      before: beforeValue,
      after: afterValue,
      type,
    });
  }

  return fieldChanges;
}
