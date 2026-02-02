"use client";

import React from "react";
import Link from "next/link";
import { useArchiveStatus, useArchiveTrigger } from "@/hooks/archive";
import {
  ArchiveMetricsCard,
  ArchiveBatchesTable,
  TriggerArchiveDialog,
} from "@/components/Archive";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeftIcon,
  RefreshCwIcon,
  LoaderIcon,
  AlertCircleIcon,
} from "lucide-react";
import toast from "react-hot-toast";

export default function ArchiveClient() {
  const {
    data: archiveStatus,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useArchiveStatus();

  const { mutateAsync: triggerArchive, isPending } = useArchiveTrigger({
    onSuccess: (data) => {
      if (data.dryRun) {
        toast.success(
          `Dry run complete: ${data.summary.totalArchived} records would be archived`
        );
      } else {
        toast.success(
          `Archive complete: ${data.summary.totalArchived} records archived`
        );
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleTriggerArchive = async (dryRun: boolean) => {
    return await triggerArchive({ dryRun });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <LoaderIcon className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <AlertCircleIcon className="h-12 w-12 text-red-500" />
            <p className="text-lg text-slate-600 dark:text-slate-400">
              {error.message}
            </p>
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCwIcon className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!archiveStatus) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="sm">
                <ArrowLeftIcon className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                Data Archive Dashboard
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Manage and monitor data archiving operations
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
            >
              {isRefetching ? (
                <LoaderIcon className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCwIcon className="h-4 w-4 mr-2" />
              )}
              Refresh
            </Button>
            <TriggerArchiveDialog
              configuration={archiveStatus.configuration}
              onTrigger={handleTriggerArchive}
              isPending={isPending}
            />
          </div>
        </div>

        {/* Last updated timestamp */}
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <span>Last updated:</span>
          <Badge variant="outline">
            {new Date(archiveStatus.timestamp).toLocaleString()}
          </Badge>
        </div>

        {/* Metrics Card */}
        <ArchiveMetricsCard
          metrics={archiveStatus.metrics}
          configuration={archiveStatus.configuration}
        />

        {/* Recent Batches Table */}
        <ArchiveBatchesTable batches={archiveStatus.recentBatches} />
      </div>
    </div>
  );
}
