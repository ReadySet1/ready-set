"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Trash2,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  Users,
} from "lucide-react";
import type { BulkOperationType, BulkOperationConfig } from "@/types/bulk-operations";
import { BULK_OPERATION_CONFIGS } from "@/types/bulk-operations";
import { UserStatus } from "@/types/prisma";

interface BulkConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operationType: BulkOperationType;
  selectedCount: number;
  onConfirm: (reason?: string) => void;
  isLoading?: boolean;
  /** For status change operations */
  targetStatus?: UserStatus;
}

/**
 * Icon mapping for operation types
 */
const operationIcons: Record<BulkOperationType, React.ReactNode> = {
  status_change: <CheckCircle className="h-5 w-5 text-blue-500" />,
  soft_delete: <Trash2 className="h-5 w-5 text-orange-500" />,
  restore: <RotateCcw className="h-5 w-5 text-green-500" />,
  export: <Users className="h-5 w-5 text-slate-500" />,
};

/**
 * Button variant mapping for operation types
 */
const buttonVariants: Record<BulkOperationConfig["variant"], string> = {
  default: "bg-slate-900 hover:bg-slate-800",
  destructive: "bg-orange-600 hover:bg-orange-700",
  warning: "bg-amber-600 hover:bg-amber-700",
};

/**
 * Confirmation dialog for bulk operations
 * Shows operation details, optional reason input, and confirm/cancel buttons
 */
export function BulkConfirmDialog({
  open,
  onOpenChange,
  operationType,
  selectedCount,
  onConfirm,
  isLoading = false,
  targetStatus,
}: BulkConfirmDialogProps) {
  const [reason, setReason] = useState("");

  const config = BULK_OPERATION_CONFIGS[operationType];
  const Icon = operationIcons[operationType];

  // Build description with count
  const description =
    operationType === "status_change" && targetStatus
      ? `Change the status of ${selectedCount} ${selectedCount === 1 ? "user" : "users"} to "${targetStatus}".`
      : config.description.replace(
          "selected users",
          `${selectedCount} ${selectedCount === 1 ? "user" : "users"}`
        );

  const handleConfirm = () => {
    onConfirm(config.requiresReason ? reason : undefined);
    setReason("");
  };

  const handleCancel = () => {
    onOpenChange(false);
    setReason("");
  };

  const isReasonValid =
    !config.requiresReason ||
    !config.minReasonLength ||
    reason.length >= config.minReasonLength;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {Icon}
            {config.title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning for destructive operations */}
          {config.variant === "destructive" && (
            <Alert className="border-orange-200 bg-orange-50">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                This action will affect {selectedCount}{" "}
                {selectedCount === 1 ? "user" : "users"}. Please review before
                confirming.
              </AlertDescription>
            </Alert>
          )}

          {/* Summary */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-medium text-slate-700">
                {selectedCount} {selectedCount === 1 ? "user" : "users"} will be
                affected
              </span>
            </div>
          </div>

          {/* Reason input */}
          {config.requiresReason && (
            <div className="space-y-2">
              <Label htmlFor="bulk-reason">{config.reasonLabel}</Label>
              <Textarea
                id="bulk-reason"
                placeholder={config.reasonPlaceholder}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
              {config.minReasonLength && config.minReasonLength > 0 && (
                <p className="text-xs text-slate-500">
                  {reason.length}/{config.minReasonLength} characters minimum
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
          >
            {config.cancelLabel || "Cancel"}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading || !isReasonValid}
            className={buttonVariants[config.variant]}
          >
            {isLoading ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Processing...
              </>
            ) : (
              config.confirmLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
