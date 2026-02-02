"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import type {
  DriverHistoryResponse,
  DriverHistoryParams,
  ExportFormat,
} from "@/types/archive";

/**
 * Build query string from params
 */
function buildQueryString(params?: DriverHistoryParams): string {
  const searchParams = new URLSearchParams();

  if (params?.startDate) {
    searchParams.set("startDate", params.startDate);
  }
  if (params?.endDate) {
    searchParams.set("endDate", params.endDate);
  }
  if (params?.includeArchived !== undefined) {
    searchParams.set("includeArchived", String(params.includeArchived));
  }

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
}

/**
 * Fetch driver history from the API
 */
async function fetchDriverHistory(
  driverId: string,
  params?: DriverHistoryParams
): Promise<DriverHistoryResponse> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Authentication required. Please sign in again.");
  }

  const queryString = buildQueryString(params);
  const response = await fetch(`/api/drivers/${driverId}/history${queryString}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to fetch driver history");
  }

  return response.json();
}

/**
 * Hook options
 */
export interface UseDriverHistoryOptions {
  enabled?: boolean;
  params?: DriverHistoryParams;
}

/**
 * Hook to fetch driver history data
 *
 * @param driverId - Driver ID to fetch history for
 * @param options - Query options including date range and archive toggle
 * @returns Query result with driver history data
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useDriverHistory(driverId, {
 *   params: {
 *     startDate: '2024-01-01',
 *     endDate: '2024-03-01',
 *     includeArchived: true,
 *   },
 * });
 * ```
 */
export function useDriverHistory(
  driverId: string,
  options?: UseDriverHistoryOptions
) {
  return useQuery({
    queryKey: [
      "driver-history",
      driverId,
      options?.params?.startDate,
      options?.params?.endDate,
      options?.params?.includeArchived,
    ],
    queryFn: () => fetchDriverHistory(driverId, options?.params),
    enabled: (options?.enabled ?? true) && !!driverId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Export driver history as PDF or CSV
 */
async function exportDriverHistory(
  driverId: string,
  format: ExportFormat,
  params?: DriverHistoryParams
): Promise<{ success: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Authentication required. Please sign in again.");
  }

  const searchParams = new URLSearchParams();
  searchParams.set("format", format);

  if (params?.startDate) {
    searchParams.set("startDate", params.startDate);
  }
  if (params?.endDate) {
    searchParams.set("endDate", params.endDate);
  }
  if (params?.includeArchived !== undefined) {
    searchParams.set("includeArchived", String(params.includeArchived));
  }

  const response = await fetch(
    `/api/drivers/${driverId}/history/export?${searchParams.toString()}`,
    { credentials: "include" }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to export ${format.toUpperCase()}`);
  }

  // Get the blob and trigger download
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;

  // Determine filename
  const contentDisposition = response.headers.get("content-disposition");
  let filename = `driver-history-${driverId.slice(0, 8)}.${format}`;
  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
    if (filenameMatch && filenameMatch[1]) {
      filename = filenameMatch[1];
    }
  }

  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  a.remove();

  return { success: true };
}

/**
 * Hook options for export mutation
 */
export interface UseExportDriverHistoryOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Hook to export driver history as PDF or CSV
 *
 * @param driverId - Driver ID to export history for
 * @param options - Mutation callbacks
 * @returns Mutation object with mutate function
 *
 * @example
 * ```tsx
 * const { mutate: exportHistory, isPending } = useExportDriverHistory(driverId, {
 *   onSuccess: () => toast.success('Export downloaded!'),
 *   onError: (error) => toast.error(error.message),
 * });
 *
 * // Export as PDF
 * exportHistory({ format: 'pdf', params: { startDate, endDate } });
 * ```
 */
export function useExportDriverHistory(
  driverId: string,
  options?: UseExportDriverHistoryOptions
) {
  return useMutation({
    mutationFn: ({
      format,
      params,
    }: {
      format: ExportFormat;
      params?: DriverHistoryParams;
    }) => exportDriverHistory(driverId, format, params),
    onSuccess: () => {
      options?.onSuccess?.();
    },
    onError: (error: Error) => {
      options?.onError?.(error);
    },
  });
}
