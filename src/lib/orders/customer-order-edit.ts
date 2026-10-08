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
 * Driver statuses from pickup onward. Mirrors POST_PICKUP_DRIVER_STATUSES
 * from `@/lib/services/return-requests` (server-only module — do not import
 * it here). A drift-guard test asserts the two lists stay in sync.
 */
export const CUSTOMER_EDIT_LOCKED_DRIVER_STATUSES = [
  "PICKED_UP",
  "EN_ROUTE_TO_CLIENT",
  "ARRIVED_TO_CLIENT",
  "COMPLETED",
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
  | "TERMINAL_STATUS"
  | "ALREADY_PICKED_UP";

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

  if (
    TERMINAL_STATUSES.includes(
      order.status.toUpperCase() as (typeof TERMINAL_STATUSES)[number],
    )
  ) {
    return "TERMINAL_STATUS";
  }

  if (
    order.driverStatus &&
    CUSTOMER_EDIT_LOCKED_DRIVER_STATUSES.includes(
      order.driverStatus as (typeof CUSTOMER_EDIT_LOCKED_DRIVER_STATUSES)[number],
    )
  ) {
    return "ALREADY_PICKED_UP";
  }

  return null;
}
