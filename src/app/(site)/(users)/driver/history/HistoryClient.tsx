"use client";

import { useMemo, useState } from "react";
import { RefreshCcw, TriangleAlert } from "lucide-react";
import { useDriverHistory, useExportDriverHistory } from "@/hooks/archive";
import {
  DriverHistorySummary,
  WeeklyBreakdownTable,
  HistoryExportButtons,
  HistoryDateFilter,
} from "@/components/Archive";
import { Badge } from "@/components/ui/badge";
import toast from "react-hot-toast";
import type { ExportFormat } from "@/types/archive";
import { format, subWeeks, startOfWeek } from "date-fns";
import {
  DriverButton,
  DriverScreen,
  Spinner,
  StateBlock,
} from "@/components/Driver/ui";

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

export default function HistoryClient({ driverId }: HistoryClientProps) {
  const defaultRange = useMemo(() => getDefaultDateRange(), []);

  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);
  const [includeArchived, setIncludeArchived] = useState(true);
  const [pendingExportFormat, setPendingExportFormat] =
    useState<ExportFormat | null>(null);

  const {
    data: historyData,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useDriverHistory(driverId, {
    params: { startDate, endDate, includeArchived },
  });

  const { mutate: exportHistory, isPending: isExporting } =
    useExportDriverHistory(driverId, {
      onSuccess: () => {
        toast.success("Export downloaded successfully");
        setPendingExportFormat(null);
      },
      onError: (err) => {
        toast.error(err.message);
        setPendingExportFormat(null);
      },
    });

  const handleExport = (fmt: ExportFormat) => {
    setPendingExportFormat(fmt);
    exportHistory({ format: fmt, params: { startDate, endDate, includeArchived } });
  };

  const handleReset = () => {
    const range = getDefaultDateRange();
    setStartDate(range.startDate);
    setEndDate(range.endDate);
    setIncludeArchived(true);
  };

  const headerRight = (
    <DriverButton
      variant="ghost"
      size="sm"
      onClick={() => refetch()}
      disabled={isRefetching}
    >
      {isRefetching ? <Spinner size={16} /> : <RefreshCcw className="h-4 w-4" />}
      Refresh
    </DriverButton>
  );

  return (
    <DriverScreen title="Your history" subtitle="View and export your deliveries" right={headerRight}>
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner size={28} />
        </div>
      ) : error ? (
        <StateBlock
          icon={TriangleAlert}
          title="Couldn't load history"
          body={error.message}
          action={
            <DriverButton variant="outline" onClick={() => refetch()}>
              <RefreshCcw className="h-4 w-4" />
              Retry
            </DriverButton>
          }
        />
      ) : (
        <div className="space-y-4">
          <HistoryDateFilter
            startDate={startDate}
            endDate={endDate}
            includeArchived={includeArchived}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            onIncludeArchivedChange={setIncludeArchived}
            onReset={handleReset}
          />

          <HistoryExportButtons
            onExport={handleExport}
            isPending={isExporting}
            pendingFormat={pendingExportFormat}
            disabled={!historyData}
          />

          {historyData?.includesArchivedData ? (
            <Badge variant="secondary" className="flex w-fit items-center gap-1">
              📦 Includes archived data
            </Badge>
          ) : null}

          {historyData ? (
            <DriverHistorySummary
              driver={historyData.driver}
              summary={historyData.summary}
              period={historyData.period}
            />
          ) : null}

          {historyData ? (
            <WeeklyBreakdownTable summaries={historyData.weeklySummaries} />
          ) : null}
        </div>
      )}
    </DriverScreen>
  );
}
