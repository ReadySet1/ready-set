"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { FileTextIcon, FileSpreadsheetIcon, LoaderIcon } from "lucide-react";
import type { ExportFormat, DriverHistoryParams } from "@/types/archive";

interface HistoryExportButtonsProps {
  onExport: (format: ExportFormat) => void;
  isPending: boolean;
  pendingFormat?: ExportFormat | null;
  disabled?: boolean;
}

export function HistoryExportButtons({
  onExport,
  isPending,
  pendingFormat,
  disabled = false,
}: HistoryExportButtonsProps) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onExport("pdf")}
        disabled={disabled || isPending}
      >
        {isPending && pendingFormat === "pdf" ? (
          <LoaderIcon className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <FileTextIcon className="h-4 w-4 mr-2" />
        )}
        Export PDF
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onExport("csv")}
        disabled={disabled || isPending}
      >
        {isPending && pendingFormat === "csv" ? (
          <LoaderIcon className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <FileSpreadsheetIcon className="h-4 w-4 mr-2" />
        )}
        Export CSV
      </Button>
    </div>
  );
}

export default HistoryExportButtons;
