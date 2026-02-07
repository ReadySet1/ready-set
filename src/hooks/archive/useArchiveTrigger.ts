"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import type {
  ArchiveTriggerRequest,
  ArchiveTriggerResponse,
} from "@/types/archive";

/**
 * Trigger archive operation via API
 */
async function triggerArchive(
  request?: ArchiveTriggerRequest
): Promise<ArchiveTriggerResponse> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Authentication required. Please sign in again.");
  }

  const response = await fetch("/api/admin/data-archiving", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request || {}),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to trigger archive");
  }

  return response.json();
}

/**
 * Hook options for archive trigger mutation
 */
export interface UseArchiveTriggerOptions {
  onSuccess?: (data: ArchiveTriggerResponse) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook to trigger manual archive operation
 *
 * @param options - Mutation callbacks
 * @returns Mutation object with mutate function
 *
 * @example
 * ```tsx
 * const { mutate, isPending, error } = useArchiveTrigger({
 *   onSuccess: (data) => toast.success(`Archived ${data.summary.totalArchived} records`),
 *   onError: (error) => toast.error(error.message),
 * });
 *
 * // Trigger archive
 * mutate({ dryRun: false });
 * ```
 */
export function useArchiveTrigger(options?: UseArchiveTriggerOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: triggerArchive,
    onSuccess: (data) => {
      // Invalidate archive status to refresh metrics
      queryClient.invalidateQueries({ queryKey: ["archive-status"] });
      options?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      options?.onError?.(error);
    },
  });
}
