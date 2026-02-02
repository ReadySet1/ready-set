"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MapPinIcon,
  ClockIcon,
  PackageIcon,
  CalendarIcon,
} from "lucide-react";
import type { ArchiveStatusResponse } from "@/types/archive";

interface ArchiveMetricsCardProps {
  metrics: ArchiveStatusResponse["metrics"];
  configuration: ArchiveStatusResponse["configuration"];
}

interface MetricItemProps {
  icon: React.ReactNode;
  title: string;
  activeCount: number;
  archivedCount: number;
  eligibleCount?: number;
  oldestDate?: string | null;
  retentionLabel: string;
}

function MetricItem({
  icon,
  title,
  activeCount,
  archivedCount,
  eligibleCount,
  oldestDate,
  retentionLabel,
}: MetricItemProps) {
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
      <div className="flex items-center gap-2">
        {icon}
        <h4 className="font-medium text-slate-900 dark:text-slate-100">
          {title}
        </h4>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-slate-500 dark:text-slate-400">Active:</span>
          <span className="ml-2 font-semibold text-slate-900 dark:text-slate-100">
            {activeCount.toLocaleString()}
          </span>
        </div>
        <div>
          <span className="text-slate-500 dark:text-slate-400">Archived:</span>
          <span className="ml-2 font-semibold text-slate-900 dark:text-slate-100">
            {archivedCount.toLocaleString()}
          </span>
        </div>
      </div>

      {eligibleCount !== undefined && eligibleCount > 0 && (
        <div className="text-sm">
          <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
            {eligibleCount.toLocaleString()} eligible for archive
          </Badge>
        </div>
      )}

      <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
        {oldestDate && (
          <div>Oldest: {formatDate(oldestDate)}</div>
        )}
        <div>Retention: {retentionLabel}</div>
      </div>
    </div>
  );
}

export function ArchiveMetricsCard({
  metrics,
  configuration,
}: ArchiveMetricsCardProps) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-xl">Archive Metrics</CardTitle>
        <CardDescription>
          Overview of active and archived data across all record types
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricItem
            icon={<MapPinIcon className="h-5 w-5 text-blue-600" />}
            title="Driver Locations"
            activeCount={metrics.driverLocations.activeCount}
            archivedCount={metrics.driverLocations.archivedCount}
            eligibleCount={metrics.driverLocations.eligibleCount}
            oldestDate={metrics.driverLocations.oldestDate}
            retentionLabel={`${configuration.locationsRetentionDays} days`}
          />

          <MetricItem
            icon={<ClockIcon className="h-5 w-5 text-green-600" />}
            title="Driver Shifts"
            activeCount={metrics.driverShifts.activeCount}
            archivedCount={metrics.driverShifts.archivedCount}
            eligibleCount={metrics.driverShifts.eligibleCount}
            oldestDate={metrics.driverShifts.oldestDate}
            retentionLabel={`${configuration.shiftsRetentionWeeks} weeks`}
          />

          <MetricItem
            icon={<PackageIcon className="h-5 w-5 text-purple-600" />}
            title="Orders"
            activeCount={
              metrics.orders.totalEligibleCount > 0
                ? metrics.orders.totalEligibleCount
                : 0
            }
            archivedCount={metrics.orders.totalArchivedCount}
            eligibleCount={metrics.orders.totalEligibleCount}
            oldestDate={
              metrics.orders.oldestCateringDate ||
              metrics.orders.oldestOnDemandDate
            }
            retentionLabel={`${configuration.ordersRetentionDays} days`}
          />

          <MetricItem
            icon={<CalendarIcon className="h-5 w-5 text-orange-600" />}
            title="Weekly Summaries"
            activeCount={metrics.weeklySummaries.count}
            archivedCount={0}
            retentionLabel="Permanent"
          />
        </div>

        {configuration.dryRunEnabled && (
          <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <span className="text-sm text-yellow-800 dark:text-yellow-200">
              Dry-run mode is enabled. Archives will be simulated but not executed.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ArchiveMetricsCard;
