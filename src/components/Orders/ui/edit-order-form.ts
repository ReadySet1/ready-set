import { z } from "zod";
import { Order } from "@/types/order";

/**
 * A number field as react-hook-form delivers it. `<input type="number">`
 * registered without `valueAsNumber` yields the typed text, so "60" becomes 60
 * and a cleared field ("") becomes null. Non-numeric text becomes NaN, which
 * `z.number()` rejects.
 */
const formNumber = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => {
    if (value === "") return null;
    if (typeof value === "string") return Number(value);
    return value;
  }, schema);

// Form schema for the edit dialog - permissive validation, server will validate strictly
export const editOrderSchema = z.object({
  // Schedule
  pickupDateTime: z.date().optional().nullable(),
  arrivalDateTime: z.date().optional().nullable(),

  // Catering specific
  brokerage: z.string().optional().nullable(),
  headcount: formNumber(z.number().int().positive().optional().nullable()),
  needHost: z.enum(["YES", "NO"]).optional(),
  hoursNeeded: formNumber(z.number().positive().optional().nullable()),
  numberOfHosts: formNumber(z.number().int().positive().optional().nullable()),

  // On-demand specific
  itemDelivered: z.string().optional().nullable(),
  vehicleType: z.enum(["CAR", "VAN", "TRUCK"]).optional(),
  length: formNumber(z.number().positive().optional().nullable()),
  width: formNumber(z.number().positive().optional().nullable()),
  height: formNumber(z.number().positive().optional().nullable()),
  weight: formNumber(z.number().positive().optional().nullable()),

  // Pricing
  orderTotal: formNumber(z.number().nonnegative().optional().nullable()),
  tip: formNumber(z.number().nonnegative().optional().nullable()),
  appliedDiscount: formNumber(z.number().nonnegative().optional().nullable()),
  deliveryCost: formNumber(z.number().nonnegative().optional().nullable()),

  // Notes
  clientAttention: z.string().optional().nullable(),
  pickupNotes: z.string().optional().nullable(),
  specialNotes: z.string().optional().nullable(),

  // Addresses - permissive validation, server validates strictly
  pickupAddress: z.object({
    street1: z.string(),
    street2: z.string().optional().nullable(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
    county: z.string().optional().nullable(),
    locationNumber: z.string().optional().nullable(),
    parkingLoading: z.string().optional().nullable(),
  }).optional(),
  deliveryAddress: z.object({
    street1: z.string(),
    street2: z.string().optional().nullable(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
    county: z.string().optional().nullable(),
    locationNumber: z.string().optional().nullable(),
    parkingLoading: z.string().optional().nullable(),
  }).optional(),
});

/** What the form fields hold (number inputs carry raw strings). */
export type EditOrderFormInput = z.input<typeof editOrderSchema>;
/** What the resolver passes to onSubmit, with numbers parsed. */
export type EditOrderFormData = z.output<typeof editOrderSchema>;

// Parse date strings to Date objects
export const parseDateTime = (value: string | Date | null | undefined): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
};

type OrderAddress = Order["pickupAddress"];

const toAddressFormValues = (address: OrderAddress | null | undefined) =>
  address
    ? {
        street1: address.street1 ?? "",
        street2: address.street2 ?? null,
        city: address.city ?? "",
        state: address.state ?? "",
        zip: address.zip ?? "",
        county: address.county ?? null,
        locationNumber: address.locationNumber ?? null,
        parkingLoading: address.parkingLoading ?? null,
      }
    : undefined;

/** The values the edit form starts from for a given order. */
export const toOrderFormValues = (order: Order): EditOrderFormData => ({
  pickupDateTime: parseDateTime(order.pickupDateTime),
  arrivalDateTime: parseDateTime(order.arrivalDateTime),
  brokerage: (order as any).brokerage ?? null,
  headcount: (order as any).headcount ?? null,
  needHost: (order as any).needHost ?? "NO",
  hoursNeeded: (order as any).hoursNeeded ?? null,
  numberOfHosts: (order as any).numberOfHosts ?? null,
  itemDelivered: (order as any).itemDelivered ?? null,
  vehicleType: (order as any).vehicleType ?? "CAR",
  length: (order as any).length ?? null,
  width: (order as any).width ?? null,
  height: (order as any).height ?? null,
  weight: (order as any).weight ?? null,
  orderTotal: order.orderTotal ? Number(order.orderTotal) : null,
  tip: order.tip ? Number(order.tip) : null,
  appliedDiscount: (order as any).appliedDiscount ? Number((order as any).appliedDiscount) : null,
  deliveryCost: (order as any).deliveryCost ? Number((order as any).deliveryCost) : null,
  clientAttention: order.clientAttention ?? null,
  pickupNotes: order.pickupNotes ?? null,
  specialNotes: order.specialNotes ?? null,
  pickupAddress: toAddressFormValues(order.pickupAddress),
  deliveryAddress: toAddressFormValues(order.deliveryAddress),
});

const CATERING_FIELDS = [
  "brokerage",
  "headcount",
  "needHost",
  "hoursNeeded",
  "numberOfHosts",
  "appliedDiscount",
  "deliveryCost",
] as const;

const ON_DEMAND_FIELDS = [
  "itemDelivered",
  "vehicleType",
  "length",
  "width",
  "height",
  "weight",
] as const;

const COMMON_FIELDS = ["orderTotal", "tip", "clientAttention", "pickupNotes", "specialNotes"] as const;

const sameDate = (a: Date | null | undefined, b: Date | null | undefined) =>
  (a?.getTime() ?? null) === (b?.getTime() ?? null);

/**
 * The PATCH body for a submitted edit form - only the fields that changed.
 *
 * Changes are measured against `toOrderFormValues(order)`, the same values the
 * form opened with, so a field the user never touched is never sent. Comparing
 * against the raw order instead made untouched fields look edited whenever the
 * form normalised them (a 0 total opened as empty and went back as null).
 */
export const buildOrderUpdatePayload = (
  data: EditOrderFormData,
  order: Order,
): Record<string, unknown> => {
  const initial = toOrderFormValues(order);
  const updatePayload: Record<string, unknown> = {};

  if (!sameDate(data.pickupDateTime, initial.pickupDateTime)) {
    updatePayload.pickupDateTime = data.pickupDateTime?.toISOString();
  }
  if (!sameDate(data.arrivalDateTime, initial.arrivalDateTime)) {
    updatePayload.arrivalDateTime = data.arrivalDateTime?.toISOString();
  }

  const typeFields = order.order_type === "catering" ? CATERING_FIELDS : ON_DEMAND_FIELDS;
  for (const field of [...typeFields, ...COMMON_FIELDS]) {
    if (data[field] !== initial[field]) updatePayload[field] = data[field];
  }

  // Addresses - always include if form has data
  if (data.pickupAddress) {
    updatePayload.pickupAddress = data.pickupAddress;
  }
  if (data.deliveryAddress) {
    updatePayload.deliveryAddress = data.deliveryAddress;
  }

  return updatePayload;
};
