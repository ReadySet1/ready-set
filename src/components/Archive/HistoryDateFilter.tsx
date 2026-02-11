"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarIcon, RotateCcwIcon } from "lucide-react";

interface HistoryDateFilterProps {
  startDate: string;
  endDate: string;
  includeArchived: boolean;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onIncludeArchivedChange: (include: boolean) => void;
  onReset: () => void;
}

export function HistoryDateFilter({
  startDate,
  endDate,
  includeArchived,
  onStartDateChange,
  onEndDateChange,
  onIncludeArchivedChange,
  onReset,
}: HistoryDateFilterProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex-1 space-y-2">
            <Label htmlFor="startDate" className="flex items-center gap-1">
              <CalendarIcon className="h-4 w-4" />
              Start Date
            </Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="w-full"
            />
          </div>

          <div className="flex-1 space-y-2">
            <Label htmlFor="endDate">End Date</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="w-full"
            />
          </div>

          <div className="flex items-center space-x-2 pb-2">
            <Checkbox
              id="includeArchived"
              checked={includeArchived}
              onCheckedChange={(checked) =>
                onIncludeArchivedChange(checked === true)
              }
            />
            <Label
              htmlFor="includeArchived"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 whitespace-nowrap"
            >
              Include archived
            </Label>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="shrink-0"
          >
            <RotateCcwIcon className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default HistoryDateFilter;
