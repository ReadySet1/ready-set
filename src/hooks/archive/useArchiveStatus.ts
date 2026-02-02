"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import type { ArchiveStatusResponse } from "@/types/archive";

/**
 * Fetch archive status from the API
 */
async function fetchArchiveStatus(): Promise<ArchiveStatusResponse> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Authentication required. Please sign in again.");
  }

  const response = await fetch("/api/admin/archive-status", {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to fetch archive status");
  }

  return response.json();
}

/**
 * Hook options
 */
export interface UseArchiveStatusOptions {
  enabled?: boolean;
  refetchInterval?: number;
}

/**
 * Hook to fetch archive status and metrics
 *
 * @param options - Query options
 * @returns Query result with archive status data
 *
 * @example
 * ```tsx
 * const { data, isLoading, error, refetch } = useArchiveStatus();
 * ```
 */
export function useArchiveStatus(options?: UseArchiveStatusOptions) {
  return useQuery({
    queryKey: ["archive-status"],
    queryFn: fetchArchiveStatus,
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: options?.refetchInterval,
  });
}
