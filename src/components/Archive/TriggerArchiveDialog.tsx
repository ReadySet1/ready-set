"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ArchiveIcon,
  AlertTriangleIcon,
  LoaderIcon,
  CheckCircleIcon,
} from "lucide-react";
import type { ArchiveConfiguration, ArchiveTriggerResponse } from "@/types/archive";

interface TriggerArchiveDialogProps {
  configuration: ArchiveConfiguration;
  onTrigger: (dryRun: boolean) => Promise<ArchiveTriggerResponse>;
  isPending: boolean;
}

export function TriggerArchiveDialog({
  configuration,
  onTrigger,
  isPending,
}: TriggerArchiveDialogProps) {
  const [open, setOpen] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [result, setResult] = useState<ArchiveTriggerResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTrigger = async () => {
    setError(null);
    setResult(null);

    try {
      const response = await onTrigger(dryRun);
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to trigger archive");
    }
  };

  const handleClose = () => {
    setOpen(false);
    // Reset state after dialog close animation
    setTimeout(() => {
      setResult(null);
      setError(null);
      setDryRun(true);
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <ArchiveIcon className="h-4 w-4 mr-2" />
          Trigger Archive
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArchiveIcon className="h-5 w-5" />
            Trigger Data Archiving
          </DialogTitle>
          <DialogDescription>
            Archive old records based on configured retention policies.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <>
            <div className="space-y-4 py-4">
              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 space-y-2">
                <h4 className="font-medium text-sm">Current Configuration</h4>
                <div className="grid grid-cols-2 gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <div>Driver Locations:</div>
                  <div>{configuration.locationsRetentionDays} days</div>
                  <div>Orders:</div>
                  <div>{configuration.ordersRetentionDays} days</div>
                  <div>Driver Shifts:</div>
                  <div>{configuration.shiftsRetentionWeeks} weeks</div>
                  <div>Batch Size:</div>
                  <div>{configuration.batchSize.toLocaleString()} records</div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="dryRun"
                  checked={dryRun}
                  onCheckedChange={(checked) => setDryRun(checked === true)}
                />
                <Label
                  htmlFor="dryRun"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Dry run (simulate without making changes)
                </Label>
              </div>

              {!dryRun && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <AlertTriangleIcon className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800 dark:text-amber-200">
                    <strong>Warning:</strong> This will permanently move records to
                    archive tables. This operation cannot be easily undone.
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-800 dark:text-red-200">
                  {error}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleTrigger}
                disabled={isPending}
                variant={dryRun ? "default" : "destructive"}
              >
                {isPending ? (
                  <>
                    <LoaderIcon className="h-4 w-4 mr-2 animate-spin" />
                    Running...
                  </>
                ) : dryRun ? (
                  "Run Dry Test"
                ) : (
                  "Execute Archive"
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircleIcon className="h-5 w-5" />
                <span className="font-medium">
                  Archive {result.dryRun ? "Simulation" : "Operation"} Complete
                </span>
              </div>

              {result.dryRun && (
                <Badge variant="secondary">Dry Run - No changes made</Badge>
              )}

              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 space-y-3">
                <h4 className="font-medium text-sm">Summary</h4>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                      {result.summary.totalProcessed.toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-500">Processed</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {result.summary.totalArchived.toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-500">Archived</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {result.summary.totalFailed.toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-500">Failed</div>
                  </div>
                </div>
              </div>

              {result.results.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">By Type</h4>
                  {result.results.map((r, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-sm p-2 bg-slate-50 dark:bg-slate-900 rounded"
                    >
                      <span className="capitalize">
                        {r.type.replace(/_/g, " ")}
                      </span>
                      <span className="text-slate-600 dark:text-slate-400">
                        {r.archived.toLocaleString()} / {r.processed.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button onClick={handleClose}>Close</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default TriggerArchiveDialog;
