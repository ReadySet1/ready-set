"use client";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, FileText } from "lucide-react";
import { AuditLogEntry } from "@/types/audit";
import { AuditLogItem } from "./AuditLogItem";

interface AuditLogListProps {
  logs: AuditLogEntry[];
  isLoading?: boolean;
  error?: Error | null;
  className?: string;
}

/**
 * Loading skeleton for audit log entries
 */
function AuditLogSkeleton() {
  return (
    <div className="border rounded-lg bg-white p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-3 w-40" />
        </div>
      </div>
    </div>
  );
}

/**
 * Empty state when no audit logs are found
 */
function EmptyState({ hasFilters }: { hasFilters?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="rounded-full bg-gray-100 p-4 mb-4">
        <FileText className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-1">
        No audit history found
      </h3>
      <p className="text-sm text-gray-500 max-w-sm">
        {hasFilters
          ? "Try adjusting your filters to see more results."
          : "Changes to this user profile will appear here."}
      </p>
    </div>
  );
}

/**
 * Error state when fetching audit logs fails
 */
function ErrorState({ error }: { error: Error }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="rounded-full bg-red-100 p-4 mb-4">
        <AlertCircle className="h-8 w-8 text-red-500" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-1">
        Failed to load audit history
      </h3>
      <p className="text-sm text-gray-500 max-w-sm">
        {error.message || "An error occurred while loading the audit history."}
      </p>
    </div>
  );
}

/**
 * Container for displaying a list of audit log entries
 */
export function AuditLogList({
  logs,
  isLoading,
  error,
  className,
}: AuditLogListProps) {
  // Error state
  if (error) {
    return <ErrorState error={error} />;
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={cn("space-y-3", className)}>
        {Array.from({ length: 5 }).map((_, i) => (
          <AuditLogSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Empty state
  if (!logs || logs.length === 0) {
    return <EmptyState />;
  }

  // List of audit logs
  return (
    <div className={cn("space-y-3", className)}>
      {logs.map((log) => (
        <AuditLogItem key={log.id} log={log} />
      ))}
    </div>
  );
}

export default AuditLogList;
