"use client";

import { useState, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuditLogFilters } from "@/types/audit";
import {
  useAuditHistory,
  useExportAuditHistory,
  DEFAULT_AUDIT_PAGINATION,
} from "@/hooks/useAuditHistory";
import { AuditFilters } from "../Audit/AuditFilters";
import { AuditLogList } from "../Audit/AuditLogList";

interface AuditHistoryTabProps {
  userId: string;
}

/**
 * Tab component for displaying user audit history
 */
export function AuditHistoryTab({ userId }: AuditHistoryTabProps) {
  // Pagination state
  const [page, setPage] = useState<number>(DEFAULT_AUDIT_PAGINATION.page);
  const [limit] = useState<number>(DEFAULT_AUDIT_PAGINATION.limit);

  // Filter state
  const [filters, setFilters] = useState<AuditLogFilters>({});

  // Fetch audit history
  const {
    data,
    isLoading,
    error,
  } = useAuditHistory(userId, { page, limit, filters });

  // Export mutation
  const exportMutation = useExportAuditHistory(userId);

  // Handle filter changes
  const handleFiltersChange = useCallback((newFilters: AuditLogFilters) => {
    setFilters(newFilters);
    setPage(1); // Reset to first page when filters change
  }, []);

  // Handle export
  const handleExport = useCallback(() => {
    exportMutation.mutate(filters);
  }, [exportMutation, filters]);

  // Pagination handlers
  const handlePreviousPage = useCallback(() => {
    setPage((p) => Math.max(1, p - 1));
  }, []);

  const handleNextPage = useCallback(() => {
    if (data?.pagination.hasNextPage) {
      setPage((p) => p + 1);
    }
  }, [data?.pagination.hasNextPage]);

  // Available actions for filter dropdown
  const availableActions = data?.filters.availableActions || [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Audit History</h3>
        <p className="text-sm text-gray-500 mt-1">
          View all changes made to this user profile
        </p>
      </div>

      {/* Filters */}
      <AuditFilters
        filters={filters}
        availableActions={availableActions}
        onFiltersChange={handleFiltersChange}
        onExport={handleExport}
        isExporting={exportMutation.isPending}
      />

      {/* Audit log list */}
      <AuditLogList
        logs={data?.logs || []}
        isLoading={isLoading}
        error={error as Error | null}
      />

      {/* Pagination */}
      {data && data.pagination.totalCount > 0 && (
        <div className="flex items-center justify-between border-t pt-4">
          <div className="text-sm text-gray-500">
            Showing{" "}
            <span className="font-medium">
              {(page - 1) * limit + 1}
            </span>{" "}
            to{" "}
            <span className="font-medium">
              {Math.min(page * limit, data.pagination.totalCount)}
            </span>{" "}
            of{" "}
            <span className="font-medium">{data.pagination.totalCount}</span>{" "}
            entries
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviousPage}
              disabled={!data.pagination.hasPrevPage}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>

            <span className="text-sm text-gray-600 px-2">
              Page {page} of {data.pagination.totalPages}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={!data.pagination.hasNextPage}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AuditHistoryTab;
