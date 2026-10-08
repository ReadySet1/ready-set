"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { createClient } from "@/utils/supabase/client";
import { Order, isCateringRequest } from "@/types/order";
import { CONTACT_EMAIL } from "@/config/contact";
import {
  customerOrderEditSchema,
  leavesCateringPairEmpty,
  CATERING_PAIR_MESSAGE,
  type CustomerOrderEdit,
} from "@/lib/orders/customer-order-edit";

// ---------------------------------------------------------------------------
// Form schema — mirrors the API schema but accepts strings from inputs and
// converts them to numbers (or null for empty). The API schema rejects
// strings, so the conversion happens here in the form layer.
// ---------------------------------------------------------------------------

const formSchema = z.object({
  headcount: z.string(),
  orderTotal: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

function toApiPayload(
  values: FormValues,
  order: Order,
): CustomerOrderEdit | null {
  const payload: Record<string, number | null> = {};
  let hasChange = false;

  // headcount (only exists on catering orders)
  const hcText = values.headcount.trim();
  const currentHc = isCateringRequest(order) ? (order.headcount ?? null) : null;
  if (hcText === "") {
    if (currentHc !== null) {
      payload.headcount = null;
      hasChange = true;
    }
  } else {
    const hcNum = Number(hcText);
    if (hcNum !== currentHc) {
      payload.headcount = hcNum;
      hasChange = true;
    }
  }

  // orderTotal
  const otText = values.orderTotal.trim();
  const currentOt =
    order.orderTotal != null ? Number(order.orderTotal) : null;
  if (otText === "") {
    if (currentOt !== null) {
      payload.orderTotal = null;
      hasChange = true;
    }
  } else {
    const otNum = Number(otText);
    if (otNum !== currentOt) {
      payload.orderTotal = otNum;
      hasChange = true;
    }
  }

  if (!hasChange) return null;
  return payload as CustomerOrderEdit;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CustomerEditOrderDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order;
  onSaveSuccess: () => void;
}

const CustomerEditOrderDialog: React.FC<CustomerEditOrderDialogProps> = ({
  isOpen,
  onOpenChange,
  order,
  onSaveSuccess,
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setError,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      headcount: isCateringRequest(order) && order.headcount != null ? String(order.headcount) : "",
      orderTotal:
        order.orderTotal != null ? String(Number(order.orderTotal)) : "",
    },
  });

  // Reset form values when the dialog opens (order may have changed).
  React.useEffect(() => {
    if (isOpen) {
      reset({
        headcount: isCateringRequest(order) && order.headcount != null ? String(order.headcount) : "",
        orderTotal:
          order.orderTotal != null ? String(Number(order.orderTotal)) : "",
      });
    }
  }, [isOpen, order, reset]);

  const onSubmit = async (values: FormValues) => {
    const payload = toApiPayload(values, order);

    if (!payload) {
      toast("No changes to save");
      onOpenChange(false);
      return;
    }

    // Client-side validation against the API schema
    const validation = customerOrderEditSchema.safeParse(payload);
    if (!validation.success) {
      const flat = validation.error.flatten();
      const fieldErrors = flat.fieldErrors;
      if (fieldErrors.headcount) {
        setError("headcount", { message: fieldErrors.headcount[0] });
      }
      if (fieldErrors.orderTotal) {
        setError("orderTotal", { message: fieldErrors.orderTotal[0] });
      }
      if (flat.formErrors.length > 0 && flat.formErrors[0]) {
        toast.error(flat.formErrors[0]);
      }
      return;
    }

    // Pair rule: the order must still have a headcount or a positive order total
    const existing = {
      headcount: isCateringRequest(order) ? order.headcount : null,
      orderTotal: order.orderTotal,
    };
    if (leavesCateringPairEmpty(existing, payload)) {
      toast.error(CATERING_PAIR_MESSAGE);
      return;
    }

    setIsSaving(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch(
        `/api/user-orders/${encodeURIComponent(order.orderNumber)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(session?.access_token
              ? { Authorization: `Bearer ${session.access_token}` }
              : {}),
          },
          body: JSON.stringify(payload),
        },
      );

      const body = await res.json();

      if (res.status === 409) {
        toast.error(body.message ?? "This order can no longer be edited");
        onSaveSuccess(); // refresh the page to reflect the real state
        onOpenChange(false);
        return;
      }

      if (!res.ok) {
        toast.error(body.message ?? "Failed to save changes");
        return;
      }

      toast.success("Order updated");
      onSaveSuccess();
      onOpenChange(false);
    } catch {
      toast.error("Network error — please try again");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="customer-edit-order-dialog">
        <DialogHeader>
          <DialogTitle>Edit Order</DialogTitle>
          <DialogDescription>
            Only headcount and order total can be changed here. For anything
            else, contact Ready Set at{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
              {CONTACT_EMAIL}
            </a>
            .
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="customer-edit-headcount">Headcount</Label>
            <Input
              id="customer-edit-headcount"
              type="number"
              step="1"
              min="1"
              placeholder="e.g. 25"
              {...register("headcount")}
            />
            {errors.headcount && (
              <p className="text-sm text-destructive">
                {errors.headcount.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-edit-order-total">Order Total ($)</Label>
            <Input
              id="customer-edit-order-total"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="e.g. 1250.50"
              {...register("orderTotal")}
            />
            {errors.orderTotal && (
              <p className="text-sm text-destructive">
                {errors.orderTotal.message}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerEditOrderDialog;
