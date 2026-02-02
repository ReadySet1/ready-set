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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowLeftIcon,
  RefreshCwIcon,
  LoaderIcon,
  AlertCircleIcon,
  ArchiveIcon,
  UserIcon,
  MailIcon,
  HashIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import type { ExportFormat } from "@/types/archive";
import { format, subWeeks, startOfWeek } from "date-fns";

interface AdminHistoryClientProps {
  driverId: string;
  driverName: string;
  driverEmail?: string;
  employeeId?: string;
}

function getDefaultDateRange() {
  const endDate = new Date();
  const startDate = startOfWeek(subWeeks(endDate, 12), { weekStartsOn: 1 });
  return {
    startDate: format(startDate, "yyyy-MM-dd"),
    endDate: format(endDate, "yyyy-MM-dd"),
  };
}

export default function AdminHistoryClient({
  driverId,
  driverName,
  driverEmail,
  employeeId,
}: AdminHistoryClientProps) {
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
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
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
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Link href="/admin/users">
              <Button variant="ghost" size="sm">
                <ArrowLeftIcon className="h-4 w-4 mr-2" />
                Back to Users
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                Driver History
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Viewing history for {driverName}
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

        {/* Driver Info Card */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <UserIcon className="h-5 w-5" />
              Driver Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-6 text-sm">
              <div className="flex items-center gap-2">
                <UserIcon className="h-4 w-4 text-slate-400" />
                <span className="font-medium">{driverName}</span>
              </div>
              {driverEmail && (
                <div className="flex items-center gap-2">
                  <MailIcon className="h-4 w-4 text-slate-400" />
                  <span>{driverEmail}</span>
                </div>
              )}
              {employeeId && (
                <div className="flex items-center gap-2">
                  <HashIcon className="h-4 w-4 text-slate-400" />
                  <span>ID: {employeeId}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

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
