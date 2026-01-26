import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import type {
  BulkOperationResult,
  BulkOperationApiResponse,
  BulkStatusChangeRequest,
  BulkDeleteRequest,
  BulkRestoreRequest,
  BulkExportParams,
} from "@/types/bulk-operations";
import { UserStatus } from "@/types/prisma";

// Query keys for cache invalidation
export const USERS_QUERY_KEY = "users";
export const DELETED_USERS_QUERY_KEY = "deletedUsers";

/**
 * Error class for bulk operation failures
 */
export class BulkOperationError extends Error {
  results?: BulkOperationResult;

  constructor(message: string, results?: BulkOperationResult) {
    super(message);
    this.name = "BulkOperationError";
    this.results = results;
  }
}

/**
 * Helper to get auth headers
 */
async function getAuthHeaders(): Promise<HeadersInit> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("No active session - please log in again");
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  };
}

/**
 * Bulk status change mutation function
 */
async function bulkStatusChange(
  request: BulkStatusChangeRequest
): Promise<BulkOperationApiResponse> {
  const headers = await getAuthHeaders();

  const response = await fetch("/api/users/bulk/status", {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify(request),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new BulkOperationError(
      data.error || "Failed to change status",
      data.results
    );
  }

  return data;
}

/**
 * Bulk delete mutation function
 */
async function bulkDelete(
  request: BulkDeleteRequest
): Promise<BulkOperationApiResponse> {
  const headers = await getAuthHeaders();

  const response = await fetch("/api/users/bulk/delete", {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify(request),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new BulkOperationError(
      data.error || "Failed to delete users",
      data.results
    );
  }

  return data;
}

/**
 * Bulk restore mutation function
 */
async function bulkRestore(
  request: BulkRestoreRequest
): Promise<BulkOperationApiResponse> {
  const headers = await getAuthHeaders();

  const response = await fetch("/api/users/bulk/restore", {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify(request),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new BulkOperationError(
      data.error || "Failed to restore users",
      data.results
    );
  }

  return data;
}

/**
 * Bulk export function (returns CSV data)
 */
async function bulkExport(params: BulkExportParams): Promise<Blob> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("No active session - please log in again");
  }

  const searchParams = new URLSearchParams();

  if (params.userIds && params.userIds.length > 0) {
    searchParams.set("userIds", params.userIds.join(","));
  }

  if (params.status) {
    searchParams.set("status", params.status);
  }

  if (params.type) {
    searchParams.set("type", params.type);
  }

  if (params.includeDeleted) {
    searchParams.set("includeDeleted", "true");
  }

  const response = await fetch(
    `/api/users/bulk/export?${searchParams.toString()}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      credentials: "include",
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to export users");
  }

  return response.blob();
}

/**
 * Download a blob as a file
 */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Hook options
 */
interface UseBulkUserOperationsOptions {
  onStatusChangeSuccess?: (data: BulkOperationApiResponse) => void;
  onStatusChangeError?: (error: BulkOperationError) => void;
  onDeleteSuccess?: (data: BulkOperationApiResponse) => void;
  onDeleteError?: (error: BulkOperationError) => void;
  onRestoreSuccess?: (data: BulkOperationApiResponse) => void;
  onRestoreError?: (error: BulkOperationError) => void;
  onExportSuccess?: () => void;
  onExportError?: (error: Error) => void;
}

/**
 * Hook for bulk user operations
 *
 * @example
 * ```tsx
 * const {
 *   bulkStatusChangeMutation,
 *   bulkDeleteMutation,
 *   bulkRestoreMutation,
 *   bulkExportMutation,
 * } = useBulkUserOperations({
 *   onDeleteSuccess: (data) => {
 *     toast({ title: `${data.results.totalSuccess} users deleted` });
 *     clearSelection();
 *   },
 * });
 *
 * // Change status
 * bulkStatusChangeMutation.mutate({
 *   userIds: Array.from(selectedIds),
 *   status: 'PENDING',
 * });
 *
 * // Delete
 * bulkDeleteMutation.mutate({
 *   userIds: Array.from(selectedIds),
 *   reason: 'Account cleanup',
 * });
 * ```
 */
export function useBulkUserOperations(options: UseBulkUserOperationsOptions = {}) {
  const queryClient = useQueryClient();

  // Bulk status change mutation
  const bulkStatusChangeMutation = useMutation({
    mutationFn: bulkStatusChange,
    onSuccess: (data) => {
      // Invalidate user queries to refresh the list
      queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY] });
      options.onStatusChangeSuccess?.(data);
    },
    onError: (error: BulkOperationError) => {
      options.onStatusChangeError?.(error);
    },
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: bulkDelete,
    onSuccess: (data) => {
      // Invalidate both active and deleted user queries
      queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [DELETED_USERS_QUERY_KEY] });
      options.onDeleteSuccess?.(data);
    },
    onError: (error: BulkOperationError) => {
      options.onDeleteError?.(error);
    },
  });

  // Bulk restore mutation
  const bulkRestoreMutation = useMutation({
    mutationFn: bulkRestore,
    onSuccess: (data) => {
      // Invalidate both active and deleted user queries
      queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [DELETED_USERS_QUERY_KEY] });
      options.onRestoreSuccess?.(data);
    },
    onError: (error: BulkOperationError) => {
      options.onRestoreError?.(error);
    },
  });

  // Bulk export mutation
  const bulkExportMutation = useMutation({
    mutationFn: async (params: BulkExportParams) => {
      const blob = await bulkExport(params);
      const timestamp = new Date().toISOString().split("T")[0];
      const filename = `users-export-${timestamp}.csv`;
      downloadBlob(blob, filename);
    },
    onSuccess: () => {
      options.onExportSuccess?.();
    },
    onError: (error: Error) => {
      options.onExportError?.(error);
    },
  });

  return {
    bulkStatusChangeMutation,
    bulkDeleteMutation,
    bulkRestoreMutation,
    bulkExportMutation,
    isAnyLoading:
      bulkStatusChangeMutation.isPending ||
      bulkDeleteMutation.isPending ||
      bulkRestoreMutation.isPending ||
      bulkExportMutation.isPending,
  };
}
