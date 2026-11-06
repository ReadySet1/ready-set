import { z } from "zod";

/**
 * Allowlist for POST /api/orders.
 *
 * Only columns a customer legitimately fills in on an order form are accepted.
 * Every object is strict: any other key (status, userId, orderNumber, pricing
 * columns such as deliveryCost / appliedDiscount / pricingTierId, driver
 * state, soft-delete / archive columns, or nested relation writes such as
 * `dispatches: { create: ... }`) is rejected with a 400 instead of being
 * written to the row. Server-owned values are set by the route itself.
 *
 * orderTotal and tip stay client-entered, matching POST /api/catering-requests
 * and the order PATCH schema: they are the customer's food total and tip, not
 * the delivery price. Delivery pricing is never settable through this route.
 */

/** Roles allowed to create orders through this route. Drivers never place orders. */
export const ORDER_CREATE_ALLOWED_ROLES = [
  "CLIENT",
  "VENDOR",
  "ADMIN",
  "SUPER_ADMIN",
  "HELPDESK",
] as const;

// Decimal(10,2) and INT4 column ceilings.
const MAX_DECIMAL_10_2 = 99_999_999.99;
const MAX_INT4 = 2_147_483_647;
const MAX_TEXT = 2000;

const text = z.string().max(MAX_TEXT).nullish();
const isoDateTime = z.iso.datetime({ offset: true }).transform((value) => new Date(value));
const positiveAmount = z.number().positive().max(MAX_DECIMAL_10_2);
const nonNegativeAmount = z.number().nonnegative().max(MAX_DECIMAL_10_2);
const positiveInt = z.number().int().positive().max(MAX_INT4);
const positiveNumber = z.number().positive();

const sharedFields = {
  pickupAddressId: z.uuid(),
  deliveryAddressId: z.uuid(),
  completeDateTime: isoDateTime.nullish(),
  hoursNeeded: positiveNumber.nullish(),
  pickupNotes: text,
  specialNotes: text,
  orderTotal: positiveAmount.nullish(),
  tip: nonNegativeAmount.nullish(),
};

const cateringCreateSchema = z.strictObject({
  type: z.literal("catering"),
  ...sharedFields,
  pickupDateTime: isoDateTime.nullish(),
  arrivalDateTime: isoDateTime.nullish(),
  brokerage: z.string().max(255).nullish(),
  headcount: positiveInt.nullish(),
  needHost: z.enum(["YES", "NO"]).optional(),
  numberOfHosts: positiveInt.nullish(),
  clientAttention: text,
});

const onDemandCreateSchema = z.strictObject({
  type: z.literal("ondemand"),
  ...sharedFields,
  // NOT NULL columns on on_demand_requests.
  pickupDateTime: isoDateTime,
  arrivalDateTime: isoDateTime,
  clientAttention: z.string().trim().min(1).max(MAX_TEXT),
  itemDelivered: z.string().max(255).nullish(),
  vehicleType: z.enum(["CAR", "VAN", "TRUCK"]).optional(),
  length: positiveNumber.nullish(),
  width: positiveNumber.nullish(),
  height: positiveNumber.nullish(),
  weight: positiveNumber.nullish(),
});

export const createOrderSchema = z.discriminatedUnion("type", [
  cateringCreateSchema,
  onDemandCreateSchema,
]);

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

type ParsedOrder =
  | { type: "catering"; data: Omit<z.infer<typeof cateringCreateSchema>, "type"> }
  | { type: "ondemand"; data: Omit<z.infer<typeof onDemandCreateSchema>, "type"> };

export type ParseCreateOrderResult =
  | ({ success: true } & ParsedOrder)
  | { success: false; error: string; issues: Array<{ path: string; message: string }> };

/** Validates a POST /api/orders body against the per-type allowlist. */
export function parseCreateOrderBody(body: unknown): ParseCreateOrderResult {
  const parsed = createOrderSchema.safeParse(body);

  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => {
      const keys = issue.code === "unrecognized_keys" ? issue.keys.join(", ") : "";
      const path = issue.path.map(String).join(".");
      return {
        path: keys || path,
        message: issue.message,
      };
    });
    return {
      success: false,
      error: `Invalid order: ${issues
        .map((issue) => (issue.path ? `${issue.path}: ${issue.message}` : issue.message))
        .join("; ")}`,
      issues,
    };
  }

  const { type, ...data } = parsed.data;
  return type === "catering"
    ? { success: true, type, data: data as Omit<z.infer<typeof cateringCreateSchema>, "type"> }
    : { success: true, type, data: data as Omit<z.infer<typeof onDemandCreateSchema>, "type"> };
}
