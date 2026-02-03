"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ClockIcon,
  TruckIcon,
  MapPinIcon,
  NavigationIcon,
} from "lucide-react";
import type { PeriodSummary, DriverHistoryInfo } from "@/types/archive";

interface DriverHistorySummaryProps {
  driver: DriverHistoryInfo;
  summary: PeriodSummary;
  period: {
    startDate: string;
    endDate: string;
  };
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
}

function StatCard({ icon, label, value, subValue }: StatCardProps) {
  return (
    <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 text-center">
      <div className="flex justify-center mb-2">{icon}</div>
      <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
      {subValue && (
        <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
          {subValue}
        </div>
      )}
    </div>
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatHours(hours: number): string {
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  if (minutes === 0) {
    return `${wholeHours}h`;
  }
  return `${wholeHours}h ${minutes}m`;
}

export function DriverHistorySummary({
  driver,
  summary,
  period,
}: DriverHistorySummaryProps) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">
              {driver.name || "Driver"}'s History
            </CardTitle>
            <CardDescription>
              {formatDate(period.startDate)} - {formatDate(period.endDate)}
            </CardDescription>
          </div>
          {driver.employeeId && (
            <div className="text-sm text-slate-500 dark:text-slate-400">
              ID: {driver.employeeId}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<ClockIcon className="h-6 w-6 text-blue-600" />}
            label="Total Shifts"
            value={summary.totalShifts}
            subValue={`${summary.completedShifts} completed`}
          />
          <StatCard
            icon={<TruckIcon className="h-6 w-6 text-green-600" />}
            label="Deliveries"
            value={summary.totalDeliveries}
          />
          <StatCard
            icon={<MapPinIcon className="h-6 w-6 text-purple-600" />}
            label="Total Miles"
            value={summary.totalMiles.toFixed(1)}
            subValue={`${summary.gpsMiles.toFixed(1)} GPS tracked`}
          />
          <StatCard
            icon={<NavigationIcon className="h-6 w-6 text-orange-600" />}
            label="Hours Worked"
            value={formatHours(summary.totalHours)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default DriverHistorySummary;
