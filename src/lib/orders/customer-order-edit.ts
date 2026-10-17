import { z } from "zod";

import {
  TERMINAL_STATUSES,
  leavesCateringPairEmpty,
  CATERING_PAIR_MESSAGE,
} from "@/app/api/orders/[order_number]/schemas";

// Re-export so consumers get everything from one place
export { TERMINAL_STATUSES, leavesCateringPairEmpty, CATERING_PAIR_MESSAGE };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const CUSTOMER_EDIT_ROLES = ["VENDOR", "CLIENT"] as const;
export const CUSTOMER_EDITABLE_FIELDS = ["headcount", "orderTotal"] as const;

export const MAX_HEADCOUNT = 2_147_483_647; // INT4 ceiling
export const MAX_ORDER_TOTAL = 99_999_999.99; // Decimal(10,2) ceiling

/**
 * Order statuses that allow customer editing. These are the three statuses
 * that precede ASSIGNED in ORDER_TRANSITIONS. Declared locally (not imported
 * from src/lib/state-machine) to keep this module client-safe; a drift-guard
 * test pins the list to ORDER_TRANSITIONS.
 */
export const CUSTOMER_EDITABLE_ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "ACTIVE",
] as const;

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const hasAtMostTwoDecimals = (value: number): boolean =>
  Number(value.toFixed(2)) === value;

export const customerOrderEditSchema = z
  .strictObject({
    headcount: z
      .number()
      .int()
      .positive()
      .max(MAX_HEADCOUNT)
      .nullable()
      .optional(),
    orderTotal: z
      .number()
      .positive()
      .max(MAX_ORDER_TOTAL)
      .refine(hasAtMostTwoDecimals, "Order total can have at most 2 decimals")
      .nullable()
      .optional(),
  })
  .refine((v) => v.headcount !== undefined || v.orderTotal !== undefined, {
    message: "Provide headcount, orderTotal, or both",
  });

export type CustomerOrderEdit = z.infer<typeof customerOrderEditSchema>;

// ---------------------------------------------------------------------------
// Editability check
// ---------------------------------------------------------------------------

export type CustomerEditBlockReason =
  | "NOT_CATERING"
  | "NOT_OWNER"
  | "STATUS_NOT_EDITABLE"
  | "DRIVER_ASSIGNED";

export interface CustomerEditableOrder {
  order_type: "catering" | "on_demand";
  userId: string | null | undefined;
  status: string;
  driverStatus?: string | null;
}

/** Returns `null` when the order is editable by this user. */
export function getCustomerEditBlockReason(
  order: CustomerEditableOrder,
  userId: string,
): CustomerEditBlockReason | null {
  if (order.order_type !== "catering") return "NOT_CATERING";

  if (!order.userId || order.userId !== userId) return "NOT_OWNER";

  const upperStatus = order.status.toUpperCase();
  if (
    !CUSTOMER_EDITABLE_ORDER_STATUSES.includes(
      upperStatus as (typeof CUSTOMER_EDITABLE_ORDER_STATUSES)[number],
    )
  ) {
    return "STATUS_NOT_EDITABLE";
  }

  if (order.driverStatus != null) {
    return "DRIVER_ASSIGNED";
  }

  return null;
}
