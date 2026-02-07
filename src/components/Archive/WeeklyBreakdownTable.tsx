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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CalendarIcon } from "lucide-react";
import type { WeeklySummary } from "@/types/archive";

interface WeeklyBreakdownTableProps {
  summaries: WeeklySummary[];
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
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

export function WeeklyBreakdownTable({ summaries }: WeeklyBreakdownTableProps) {
  if (summaries.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-xl flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Weekly Breakdown
          </CardTitle>
          <CardDescription>
            No weekly summary data available for the selected period
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Calculate totals
  const totals = summaries.reduce(
    (acc, s) => ({
      shifts: acc.shifts + s.totalShifts,
      completedShifts: acc.completedShifts + s.completedShifts,
      deliveries: acc.deliveries + s.totalDeliveries,
      miles: acc.miles + s.totalMiles,
      hours: acc.hours + s.totalShiftHours,
    }),
    { shifts: 0, completedShifts: 0, deliveries: 0, miles: 0, hours: 0 }
  );

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-xl flex items-center gap-2">
          <CalendarIcon className="h-5 w-5" />
          Weekly Breakdown
        </CardTitle>
        <CardDescription>
          Performance data broken down by week
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Week</TableHead>
              <TableHead className="text-right">Shifts</TableHead>
              <TableHead className="text-right">Deliveries</TableHead>
              <TableHead className="text-right">Miles</TableHead>
              <TableHead className="text-right">Hours</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summaries.map((summary, idx) => (
              <TableRow key={idx}>
                <TableCell>
                  <div className="font-medium">
                    Week {summary.weekNumber}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {formatDate(summary.weekStart)} - {formatDate(summary.weekEnd)}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-medium">{summary.totalShifts}</span>
                  <span className="text-slate-500 dark:text-slate-400 text-sm">
                    {" "}
                    ({summary.completedShifts})
                  </span>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {summary.totalDeliveries}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {summary.totalMiles.toFixed(1)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatHours(summary.totalShiftHours)}
                </TableCell>
              </TableRow>
            ))}
            {/* Totals row */}
            <TableRow className="bg-slate-50 dark:bg-slate-900 font-semibold">
              <TableCell>Total</TableCell>
              <TableCell className="text-right">
                {totals.shifts}
                <span className="text-slate-500 dark:text-slate-400 text-sm font-normal">
                  {" "}
                  ({totals.completedShifts})
                </span>
              </TableCell>
              <TableCell className="text-right">{totals.deliveries}</TableCell>
              <TableCell className="text-right">{totals.miles.toFixed(1)}</TableCell>
              <TableCell className="text-right">{formatHours(totals.hours)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default WeeklyBreakdownTable;
