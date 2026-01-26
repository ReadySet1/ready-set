/**
 * Bulk Operations Types
 *
 * TypeScript types for bulk user operations including
 * status changes, soft delete, restore, and export.
 */

import { UserStatus, UserType } from "./prisma";

// ============================================================================
// Result Types
// ============================================================================

/**
 * Result of a single item in a bulk operation
 */
export interface BulkOperationItemResult {
  id: string;
  success: boolean;
  error?: string;
}

/**
 * Overall result of a bulk operation
 */
export interface BulkOperationResult {
  success: string[];
  failed: Array<{ id: string; reason: string }>;
  totalProcessed: number;
  totalSuccess: number;
  totalFailed: number;
}

// ============================================================================
// Request Types
// ============================================================================

/**
 * Request payload for bulk status change
 */
export interface BulkStatusChangeRequest {
  userIds: string[];
  status: UserStatus;
  reason?: string;
}

/**
 * Request payload for bulk soft delete
 */
export interface BulkDeleteRequest {
  userIds: string[];
  reason?: string;
}

/**
 * Request payload for bulk restore
 */
export interface BulkRestoreRequest {
  userIds: string[];
}

/**
 * Query parameters for bulk export
 */
export interface BulkExportParams {
  userIds?: string[];
  status?: UserStatus;
  type?: UserType;
  includeDeleted?: boolean;
}

// ============================================================================
// Operation Types
// ============================================================================

/**
 * Type of bulk operation
 */
export type BulkOperationType =
  | "status_change"
  | "soft_delete"
  | "restore"
  | "export";

/**
 * Configuration for a bulk operation confirmation dialog
 */
export interface BulkOperationConfig {
  type: BulkOperationType;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  variant: "default" | "destructive" | "warning";
  requiresReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  minReasonLength?: number;
}

/**
 * Bulk operation configurations by type
 */
export const BULK_OPERATION_CONFIGS: Record<
  BulkOperationType,
  BulkOperationConfig
> = {
  status_change: {
    type: "status_change",
    title: "Change User Status",
    description: "Change the status of the selected users.",
    confirmLabel: "Change Status",
    variant: "default",
    requiresReason: false,
  },
  soft_delete: {
    type: "soft_delete",
    title: "Move Users to Trash",
    description:
      "Move the selected users to trash. They can be restored later if needed.",
    confirmLabel: "Move to Trash",
    variant: "destructive",
    requiresReason: true,
    reasonLabel: "Reason for deletion (optional)",
    reasonPlaceholder:
      "e.g., Account violation, User request, Duplicate account...",
    minReasonLength: 0,
  },
  restore: {
    type: "restore",
    title: "Restore Users",
    description:
      "Restore the selected users. They will regain access to the system.",
    confirmLabel: "Restore Users",
    variant: "default",
    requiresReason: false,
  },
  export: {
    type: "export",
    title: "Export Users",
    description: "Export the selected users to a CSV file.",
    confirmLabel: "Export",
    variant: "default",
    requiresReason: false,
  },
};

// ============================================================================
// Selection Types
// ============================================================================

/**
 * State for bulk selection
 */
export interface BulkSelectionState {
  selectedIds: Set<string>;
  selectedCount: number;
  isAllOnPageSelected: boolean;
}

/**
 * Actions for bulk selection
 */
export interface BulkSelectionActions {
  toggle: (id: string) => void;
  selectAll: (ids: string[]) => void;
  deselectAll: (ids: string[]) => void;
  clearAll: () => void;
  isSelected: (id: string) => boolean;
}

/**
 * Complete bulk selection hook return type
 */
export type UseBulkSelectionReturn = BulkSelectionState & BulkSelectionActions;

// ============================================================================
// User Types for Bulk Operations
// ============================================================================

/**
 * Minimal user data needed for bulk operations
 */
export interface BulkOperationUser {
  id: string;
  name?: string | null;
  email: string | null;
  type: UserType;
  status: UserStatus;
}

/**
 * User with deletion info for restore operations
 */
export interface DeletedBulkOperationUser extends BulkOperationUser {
  deletedAt: string;
  deletedBy?: string | null;
  deletionReason?: string | null;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * API response for bulk operations
 */
export interface BulkOperationApiResponse {
  message: string;
  results: BulkOperationResult;
}

/**
 * API response for bulk export
 */
export interface BulkExportApiResponse {
  data: string; // CSV content
  filename: string;
  contentType: string;
}
