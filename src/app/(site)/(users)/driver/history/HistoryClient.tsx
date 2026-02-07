"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useDriverHistory, useExportDriverHistory } from "@/hooks/archive";
import {
  DriverHistorySummary,
  WeeklyBreakdownTable,
  HistoryExportButtons,
  HistoryDateFilter,
} from "@/components/Archive";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeftIcon,
  RefreshCwIcon,
  LoaderIcon,
  AlertCircleIcon,
  ArchiveIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import type { ExportFormat } from "@/types/archive";
import { format, subWeeks, startOfWeek } from "date-fns";

interface HistoryClientProps {
  driverId: string;
  driverName: string;
}

function getDefaultDateRange() {
  const endDate = new Date();
  const startDate = startOfWeek(subWeeks(endDate, 12), { weekStartsOn: 1 });
  return {
    startDate: format(startDate, "yyyy-MM-dd"),
    endDate: format(endDate, "yyyy-MM-dd"),
  };
}

export default function HistoryClient({
  driverId,
  driverName,
}: HistoryClientProps) {
  const defaultRange = useMemo(() => getDefaultDateRange(), []);

  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);
  const [includeArchived, setIncludeArchived] = useState(true);
  const [pendingExportFormat, setPendingExportFormat] = useState<ExportFormat | null>(null);

  const {
    data: historyData,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useDriverHistory(driverId, {
    params: {
      startDate,
      endDate,
      includeArchived,
    },
  });

  const { mutate: exportHistory, isPending: isExporting } =
    useExportDriverHistory(driverId, {
      onSuccess: () => {
        toast.success("Export downloaded successfully");
        setPendingExportFormat(null);
      },
      onError: (error) => {
        toast.error(error.message);
        setPendingExportFormat(null);
      },
    });

  const handleExport = (format: ExportFormat) => {
    setPendingExportFormat(format);
    exportHistory({
      format,
      params: {
        startDate,
        endDate,
        includeArchived,
      },
    });
  };

  const handleReset = () => {
    const range = getDefaultDateRange();
    setStartDate(range.startDate);
    setEndDate(range.endDate);
    setIncludeArchived(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <LoaderIcon className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-6">
        <div className="max-w-5xl mx-auto">
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Link href="/driver">
              <Button variant="ghost" size="sm">
                <ArrowLeftIcon className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                Your History
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                View and export your delivery history
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
            <HistoryExportButtons
              onExport={handleExport}
              isPending={isExporting}
              pendingFormat={pendingExportFormat}
              disabled={!historyData}
            />
          </div>
        </div>

        {/* Date Filter */}
        <HistoryDateFilter
          startDate={startDate}
          endDate={endDate}
          includeArchived={includeArchived}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          onIncludeArchivedChange={setIncludeArchived}
          onReset={handleReset}
        />

        {/* Archived data indicator */}
        {historyData?.includesArchivedData && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="flex items-center gap-1">
              <ArchiveIcon className="h-3 w-3" />
              Includes archived data
            </Badge>
          </div>
        )}

        {/* Summary Card */}
        {historyData && (
          <DriverHistorySummary
            driver={historyData.driver}
            summary={historyData.summary}
            period={historyData.period}
          />
        )}

        {/* Weekly Breakdown */}
        {historyData && (
          <WeeklyBreakdownTable summaries={historyData.weeklySummaries} />
        )}
      </div>
    </div>
  );
}
