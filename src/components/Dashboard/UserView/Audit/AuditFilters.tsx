"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Download, X, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AuditAction,
  AuditLogFilters,
  AUDIT_ACTION_LABELS,
} from "@/types/audit";

interface AuditFiltersProps {
  filters: AuditLogFilters;
  availableActions: AuditAction[];
  onFiltersChange: (filters: AuditLogFilters) => void;
  onExport: () => void;
  isExporting?: boolean;
  className?: string;
}

/**
 * Filter controls for audit history
 */
export function AuditFilters({
  filters,
  availableActions,
  onFiltersChange,
  onExport,
  isExporting,
  className,
}: AuditFiltersProps) {
  const [startDate, setStartDate] = useState<Date | undefined>(
    filters.startDate ? new Date(filters.startDate) : undefined
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    filters.endDate ? new Date(filters.endDate) : undefined
  );

  // Handle start date change
  const handleStartDateChange = (date: Date | undefined) => {
    setStartDate(date);
    onFiltersChange({
      ...filters,
      startDate: date?.toISOString(),
    });
  };

  // Handle end date change
  const handleEndDateChange = (date: Date | undefined) => {
    setEndDate(date);
    onFiltersChange({
      ...filters,
      endDate: date?.toISOString(),
    });
  };

  // Handle action filter change
  const handleActionChange = (value: string) => {
    if (value === "all") {
      onFiltersChange({
        ...filters,
        actions: undefined,
      });
    } else {
      onFiltersChange({
        ...filters,
        actions: [value as AuditAction],
      });
    }
  };

  // Clear all filters
  const handleClearFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    onFiltersChange({});
  };

  // Check if any filters are active
  const hasActiveFilters =
    filters.startDate ||
    filters.endDate ||
    (filters.actions && filters.actions.length > 0);

  const selectedAction = filters.actions?.[0];

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-center gap-3">
        {/* Action type filter */}
        <Select
          value={selectedAction || "all"}
          onValueChange={handleActionChange}
        >
          <SelectTrigger className="w-[180px] bg-white">
            <Filter className="h-4 w-4 mr-2 text-gray-400" />
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {availableActions.map((action) => (
              <SelectItem key={action} value={action}>
                {AUDIT_ACTION_LABELS[action] || action}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Start date picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-[180px] justify-start text-left font-normal bg-white",
                !startDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {startDate ? format(startDate, "MMM d, yyyy") : "Start date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={startDate}
              onSelect={handleStartDateChange}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {/* End date picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-[180px] justify-start text-left font-normal bg-white",
                !endDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {endDate ? format(endDate, "MMM d, yyyy") : "End date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={endDate}
              onSelect={handleEndDateChange}
              disabled={(date) => (startDate ? date < startDate : false)}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {/* Clear filters button */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}

        {/* Export button - pushed to the right */}
        <div className="flex-1" />
        <Button
          variant="outline"
          onClick={onExport}
          disabled={isExporting}
          className="bg-white"
        >
          <Download className="h-4 w-4 mr-2" />
          {isExporting ? "Exporting..." : "Export CSV"}
        </Button>
      </div>

      {/* Active filters display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-500">Active filters:</span>
          {selectedAction && (
            <Badge variant="secondary" className="font-normal">
              {AUDIT_ACTION_LABELS[selectedAction] || selectedAction}
              <button
                onClick={() => handleActionChange("all")}
                className="ml-1 hover:text-gray-700"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {startDate && (
            <Badge variant="secondary" className="font-normal">
              From: {format(startDate, "MMM d, yyyy")}
              <button
                onClick={() => handleStartDateChange(undefined)}
                className="ml-1 hover:text-gray-700"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {endDate && (
            <Badge variant="secondary" className="font-normal">
              To: {format(endDate, "MMM d, yyyy")}
              <button
                onClick={() => handleEndDateChange(undefined)}
                className="ml-1 hover:text-gray-700"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

export default AuditFilters;
