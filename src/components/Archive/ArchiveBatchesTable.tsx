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
import { Badge } from "@/components/ui/badge";
import {
  CheckCircleIcon,
  XCircleIcon,
  LoaderIcon,
  AlertCircleIcon,
} from "lucide-react";
import type { ArchiveBatch } from "@/types/archive";

interface ArchiveBatchesTableProps {
  batches: ArchiveBatch[];
}

function StatusBadge({ status }: { status: ArchiveBatch["status"] }) {
  switch (status) {
    case "completed":
      return (
        <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
          <CheckCircleIcon className="h-3 w-3 mr-1" />
          Completed
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive">
          <XCircleIcon className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      );
    case "in_progress":
      return (
        <Badge variant="secondary">
          <LoaderIcon className="h-3 w-3 mr-1 animate-spin" />
          In Progress
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function TypeBadge({ type }: { type: ArchiveBatch["archiveType"] }) {
  const colors: Record<string, string> = {
    driver_locations: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    driver_shifts: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    orders: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  };

  const labels: Record<string, string> = {
    driver_locations: "Locations",
    driver_shifts: "Shifts",
    orders: "Orders",
  };

  return (
    <Badge variant="outline" className={colors[type] || ""}>
      {labels[type] || type}
    </Badge>
  );
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "N/A";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ArchiveBatchesTable({ batches }: ArchiveBatchesTableProps) {
  if (batches.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-xl">Recent Archive Batches</CardTitle>
          <CardDescription>
            History of archive operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            <AlertCircleIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No archive batches have been executed yet.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-xl">Recent Archive Batches</CardTitle>
        <CardDescription>
          History of the last {batches.length} archive operations
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Processed</TableHead>
              <TableHead className="text-right">Archived</TableHead>
              <TableHead className="text-right">Failed</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>Date Range</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {batches.map((batch) => (
              <TableRow key={batch.id}>
                <TableCell>
                  <TypeBadge type={batch.archiveType} />
                  {batch.dryRun && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      Dry Run
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge status={batch.status} />
                </TableCell>
                <TableCell className="text-right font-medium">
                  {batch.recordsProcessed.toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-medium text-green-600 dark:text-green-400">
                  {batch.recordsArchived.toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-medium text-red-600 dark:text-red-400">
                  {batch.recordsFailed > 0 ? batch.recordsFailed.toLocaleString() : "-"}
                </TableCell>
                <TableCell className="text-sm text-slate-500 dark:text-slate-400">
                  {formatDate(batch.startedAt)}
                </TableCell>
                <TableCell className="text-sm text-slate-500 dark:text-slate-400">
                  {batch.dateRangeStart && batch.dateRangeEnd ? (
                    <>
                      {new Date(batch.dateRangeStart).toLocaleDateString()} -{" "}
                      {new Date(batch.dateRangeEnd).toLocaleDateString()}
                    </>
                  ) : (
                    "N/A"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default ArchiveBatchesTable;
