"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Check } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { withBearerAuth } from "@/lib/auth/bearer-session";
import { useDriverTheme } from "./DriverThemeProvider";
import { DriverButton } from "./index";

/** Driver-facing return reasons. ADMIN_UNASSIGNED exists server-side for the
 *  admin panel only and is intentionally not offered here. */
const RETURN_REASONS = [
  { id: "CANNOT_MAKE_PICKUP", label: "Can't make the pickup" },
  { id: "VEHICLE_ISSUE", label: "Vehicle issue" },
  { id: "EMERGENCY", label: "Emergency" },
  { id: "STALE_ORDER", label: "Old or expired assignment" },
  { id: "OTHER", label: "Other" },
] as const;
type ReturnReason = (typeof RETURN_REASONS)[number]["id"];

interface DriverReturnSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNumber: string;
  /** Called once the request is filed (pending: true — the delivery is still
   *  the driver's while dispatch reviews) or, for privileged callers, once
   *  the delivery is back with dispatch (pending: false). */
  onComplete: (result: { pending: boolean }) => void;
}

/** Bottom-sheet flow for requesting a return to dispatch (issue #508 +
 *  helpdesk approval). Driver requests land as PENDING (HTTP 202) for
 *  dispatch review; the driver keeps working the delivery meanwhile.
 *  Mirrors the DriverPodSheet chrome and the NavigationAppSheet option list. */
export function DriverReturnSheet({
  open,
  onOpenChange,
  orderNumber,
  onComplete,
}: DriverReturnSheetProps) {
  const { resolved } = useDriverTheme();
  const [reason, setReason] = useState<ReturnReason | null>(null);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!reason || submitting) return;
    setSubmitting(true);
    try {
      const trimmed = details.trim();
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderNumber)}/return`,
        {
          method: "POST",
          credentials: "include",
          headers: await withBearerAuth({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            reason,
            ...(trimmed ? { details: trimmed } : {}),
          }),
        },
      );
      if (!res.ok) {
        let detail = "";
        try {
          const body = await res.json();
          detail = body.error || body.message || "";
        } catch {
          /* ignore */
        }
        throw new Error(detail || "Failed to request the return. Please try again.");
      }
      // 202 = a PENDING request was filed (driver path); 200 = the delivery
      // was returned immediately (privileged caller).
      const pending = res.status === 202;
      toast.success(
        pending
          ? "Return requested — dispatch will review it"
          : "Delivery returned to dispatch",
      );
      onComplete({ pending });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to request the return. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          "driver-theme max-h-[90dvh] overflow-auto rounded-t-3xl border-driver-border bg-driver-surface",
          resolved === "dark" && "dark",
        )}
      >
        <div className="mx-auto w-full max-w-md">
          <SheetHeader className="items-start">
            <SheetTitle className="text-[18px] font-semibold text-driver-text">
              Request a return
            </SheetTitle>
          </SheetHeader>
          <p className="mt-1 text-[13px] font-medium text-driver-muted">
            Request to return this delivery — a dispatcher will review it. You
            can keep working the delivery while the request is pending.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            {RETURN_REASONS.map((option) => {
              const active = option.id === reason;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setReason(option.id)}
                  aria-pressed={active}
                  className={cn(
                    "flex min-h-driver-control items-center justify-between rounded-2xl border-[1.5px] px-4 text-[15px] font-semibold text-driver-text transition-all active:translate-y-px",
                    active
                      ? "border-driver-brand bg-driver-surface-alt"
                      : "border-driver-border bg-driver-surface-alt",
                  )}
                >
                  {option.label}
                  {active ? (
                    <Check className="h-4 w-4 text-driver-success" strokeWidth={3} />
                  ) : null}
                </button>
              );
            })}
          </div>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Add details (optional)"
            className="mt-3 w-full rounded-2xl border-[1.5px] border-driver-border bg-driver-surface-alt px-4 py-3 text-[14px] font-medium text-driver-text placeholder:text-driver-subtle focus:border-driver-brand focus:outline-none"
          />
          <div className="mt-4 pb-2">
            <DriverButton
              variant="danger"
              full
              size="lg"
              onClick={() => void submit()}
              disabled={!reason}
              loading={submitting}
            >
              Request return
            </DriverButton>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
