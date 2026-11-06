"use client";

import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Loader2Icon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ADMIN_END_SHIFT_REASON_MAX,
  ADMIN_END_SHIFT_REASON_MIN,
  type AdminEndShiftPreview,
} from "@/types/admin-end-shift";
import { RETURN_REASON_LABELS } from "./ReturnRequestsPanel";

/**
 * Confirmation step for ending a driver's shift from /admin/tracking.
 * Shows what happens before anything changes: the shift closes now, orders
 * stay assigned (nothing is cancelled; orders already under way are marked
 * because they will block the driver's next End Shift), and this shift's pending return
 * requests stay in the review queue unless the admin opts in to void them.
 * A reason is required; it lands in the audit trail and the shift notes.
 */

interface AdminEndShiftDialogProps {
  shiftId: string;
  driverName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEnded?: () => void;
}

function formatStatus(status: string): string {
  return status.replace(/_/g, " ").toLowerCase();
}

export default function AdminEndShiftDialog({
  shiftId,
  driverName,
  open,
  onOpenChange,
  onEnded,
}: AdminEndShiftDialogProps) {
  const endpoint = `/api/tracking/shifts/${shiftId}/admin-end`;
  const [preview, setPreview] = useState<AdminEndShiftPreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [voidReturnRequests, setVoidReturnRequests] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPreview(null);
    setLoadError(null);
    setSubmitError(null);
    setReason("");
    setVoidReturnRequests(false);

    (async () => {
      try {
        const res = await fetch(endpoint, { credentials: "include" });
        const body = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !body?.success) {
          setLoadError(
            body?.error ?? `Could not load the shift (${res.status})`,
          );
          return;
        }
        setPreview(body.data as AdminEndShiftPreview);
      } catch {
        if (!cancelled)
          setLoadError("Could not load the shift. Check your connection.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, endpoint]);

  const trimmedReason = reason.trim();
  const canSubmit =
    preview !== null &&
    preview.shift.isOpen &&
    trimmedReason.length >= ADMIN_END_SHIFT_REASON_MIN &&
    !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: trimmedReason, voidReturnRequests }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        setSubmitError(
          body?.error ?? `Could not end the shift (${res.status})`,
        );
        return;
      }
      if (body.warning) toast.error(body.warning);
      toast.success(`${driverName}'s shift has ended.`);
      onEnded?.();
      onOpenChange(false);
    } catch {
      setSubmitError("Could not end the shift. Check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openOrders = preview?.openOrders ?? [];
  const blockingCount = openOrders.filter((o) => o.blocksNextEndShift).length;
  const returnRequests = preview?.pendingReturnRequests ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>End {driverName}&apos;s shift?</DialogTitle>
          <DialogDescription>
            The shift closes now and the driver goes off duty. Use this when a
            shift is stuck and the driver can&apos;t end it from their phone.
          </DialogDescription>
        </DialogHeader>

        {!preview && !loadError && (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2Icon className="h-4 w-4 animate-spin" />
            Loading shift details…
          </div>
        )}

        {loadError && (
          <p role="alert" className="py-2 text-sm text-red-600">
            {loadError}
          </p>
        )}

        {preview && !preview.shift.isOpen && (
          <p role="alert" className="py-2 text-sm text-red-600">
            This shift has already ended.
          </p>
        )}

        {preview && preview.shift.isOpen && (
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              Started {new Date(preview.shift.shiftStart).toLocaleString()}.
            </p>

            <section className="space-y-2">
              <h4 className="font-medium">
                Orders still assigned to {driverName}
              </h4>
              {openOrders.length === 0 ? (
                <p className="text-muted-foreground">No open orders.</p>
              ) : (
                <>
                  <ul className="space-y-1 rounded-md border p-2">
                    {openOrders.map((order) => (
                      <li
                        key={order.orderNumber}
                        className="flex justify-between gap-2"
                      >
                        <span className="flex items-center gap-2">
                          <span className="font-mono">{order.orderNumber}</span>
                          {order.blocksNextEndShift && (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                              Blocks next End Shift
                            </span>
                          )}
                        </span>
                        <span className="text-muted-foreground">
                          {formatStatus(order.status)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {blockingCount > 0 && (
                    <p
                      role="status"
                      className="rounded-md border border-amber-300 bg-amber-50 p-2 text-amber-900"
                    >
                      {blockingCount === 1
                        ? "The marked order is already under way. It will block"
                        : "The marked orders are already under way. They will block"}{" "}
                      {driverName} from ending their next shift until{" "}
                      {blockingCount === 1 ? "it is" : "they are"} reassigned,
                      completed, or cancelled from dispatch.
                    </p>
                  )}
                  <p className="text-muted-foreground">
                    These orders stay assigned to {driverName}; nothing is
                    cancelled. Reassign them from dispatch if someone else
                    should finish them.
                  </p>
                </>
              )}
            </section>

            {returnRequests.length > 0 && (
              <section className="space-y-2">
                <h4 className="font-medium">Pending return requests</h4>
                <ul className="space-y-1 rounded-md border p-2">
                  {returnRequests.map((request) => (
                    <li key={request.id} className="flex justify-between gap-2">
                      <span className="font-mono">{request.orderNumber}</span>
                      <span className="text-muted-foreground">
                        {RETURN_REASON_LABELS[request.reason] ?? request.reason}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="admin-end-shift-void"
                    checked={voidReturnRequests}
                    onCheckedChange={(value) =>
                      setVoidReturnRequests(value === true)
                    }
                    aria-label={`Void ${returnRequests.length} pending return request${returnRequests.length === 1 ? "" : "s"}`}
                  />
                  <Label
                    htmlFor="admin-end-shift-void"
                    className="font-normal leading-snug"
                  >
                    Void{" "}
                    {returnRequests.length === 1
                      ? "this request"
                      : "these requests"}
                    . Left unchecked, they stay in the return-requests queue for
                    review. Voiding keeps the order assigned to {driverName}.
                  </Label>
                </div>
              </section>
            )}

            <div className="space-y-1">
              <Label htmlFor="admin-end-shift-reason">Reason (required)</Label>
              <Textarea
                id="admin-end-shift-reason"
                value={reason}
                maxLength={ADMIN_END_SHIFT_REASON_MAX}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Driver's phone died; they can't end the shift"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Saved to the audit log with your name and the time.
              </p>
            </div>

            {submitError && (
              <p role="alert" className="text-sm text-red-600">
                {submitError}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {isSubmitting && (
              <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
            )}
            End shift
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
