"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import {
  AuditAction,
  AuditLogEntry,
  AuditLogFilters,
  AuditPagination,
} from "@/types/audit";

/**
 * API response shape (snake_case from API)
 */
interface AuditLogApiEntry {
  id: string;
  user_id: string;
  action: AuditAction;
  performed_by: string | null;
  performer_name: string | null;
  performer_email: string | null;
  performer_image: string | null;
  changes: {
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
  } | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface AuditLogsApiResponse {
  logs: AuditLogApiEntry[];
  pagination: {
    page: number;
    limit: number;
    total_count: number;
    total_pages: number;
    has_next_page: boolean;
    has_prev_page: boolean;
  };
  filters: {
    available_actions: AuditAction[];
  };
}

/**
 * Internal response shape (camelCase for frontend)
 */
export interface AuditLogsResponse {
  logs: AuditLogEntry[];
  pagination: AuditPagination;
  filters: {
    availableActions: AuditAction[];
  };
}

/**
 * Parameters for the useAuditHistory hook
 */
export interface AuditHistoryParams {
  page: number;
  limit: number;
  filters?: AuditLogFilters;
}

/**
 * Transform API response (snake_case) to frontend format (camelCase)
 */
function transformApiResponse(data: AuditLogsApiResponse): AuditLogsResponse {
  return {
    logs: data.logs.map((log) => ({
      id: log.id,
      userId: log.user_id,
      action: log.action,
      performedBy: log.performed_by,
      performerName: log.performer_name,
      performerEmail: log.performer_email,
      performerImage: log.performer_image,
      changes: log.changes,
      reason: log.reason,
      metadata: log.metadata,
      createdAt: log.created_at,
    })),
    pagination: {
      page: data.pagination.page,
      limit: data.pagination.limit,
      totalCount: data.pagination.total_count,
      totalPages: data.pagination.total_pages,
      hasNextPage: data.pagination.has_next_page,
      hasPrevPage: data.pagination.has_prev_page,
    },
    filters: {
      availableActions: data.filters.available_actions,
    },
  };
}

/**
 * Fetch audit logs from the API
 */
async function fetchAuditLogs(
  userId: string,
  params: AuditHistoryParams
): Promise<AuditLogsResponse> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Authentication required. Please sign in again.");
  }

  // Build query params
  const searchParams = new URLSearchParams({
    page: params.page.toString(),
    limit: params.limit.toString(),
  });

  if (params.filters?.startDate) {
    searchParams.set("startDate", params.filters.startDate);
  }
  if (params.filters?.endDate) {
    searchParams.set("endDate", params.filters.endDate);
  }
  if (params.filters?.actions?.length) {
    params.filters.actions.forEach((action) =>
      searchParams.append("action", action)
    );
  }
  if (params.filters?.performedBy) {
    searchParams.set("performedBy", params.filters.performedBy);
  }

  const response = await fetch(
    `/api/users/${userId}/audit?${searchParams.toString()}`,
    {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to fetch audit history");
  }

  const data: AuditLogsApiResponse = await response.json();
  return transformApiResponse(data);
}

/**
 * Hook to fetch audit history for a user
 *
 * @param userId - The user ID to fetch audit history for
 * @param params - Pagination and filter parameters
 * @param options - Additional query options
 */
export function useAuditHistory(
  userId: string,
  params: AuditHistoryParams,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: [
      "audit-history",
      userId,
      params.page,
      params.limit,
      params.filters?.actions,
      params.filters?.startDate,
      params.filters?.endDate,
      params.filters?.performedBy,
    ],
    queryFn: () => fetchAuditLogs(userId, params),
    enabled: options?.enabled ?? !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook to export audit history as CSV
 *
 * @param userId - The user ID to export audit history for
 */
export function useExportAuditHistory(userId: string) {
  return useMutation({
    mutationFn: async (filters?: AuditLogFilters) => {
      const supabase = await createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Authentication required. Please sign in again.");
      }

      // Build query params
      const searchParams = new URLSearchParams();
      if (filters?.startDate) {
        searchParams.set("startDate", filters.startDate);
      }
      if (filters?.endDate) {
        searchParams.set("endDate", filters.endDate);
      }
      if (filters?.actions?.length) {
        filters.actions.forEach((action) =>
          searchParams.append("action", action)
        );
      }
      if (filters?.performedBy) {
        searchParams.set("performedBy", filters.performedBy);
      }

      const response = await fetch(
        `/api/users/${userId}/audit/export?${searchParams.toString()}`,
        { credentials: "include" }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to export audit history");
      }

      // Get the blob and trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-history-${userId.slice(0, 8)}-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      return { success: true };
    },
  });
}

/**
 * Default pagination values
 */
export const DEFAULT_AUDIT_PAGINATION = {
  page: 1,
  limit: 20,
} as const;
