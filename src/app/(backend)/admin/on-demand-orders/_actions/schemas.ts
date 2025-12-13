import { z } from 'zod';

// Define a simple type for the client list
export interface ClientListItem {
  id: string;
  name: string;
}

// Define potential error types
export interface ActionError {
  error: string;
}

// Vehicle type enum matching Prisma schema
const VehicleTypeEnum = z.enum(['CAR', 'VAN', 'TRUCK']);

// Base address schema
export const addressSchema = z.object({
  street1: z.string().min(1, "Street address is required"),
  street2: z.string().optional().nullable(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(2, "State is required").max(2, "State must be 2 characters"),
  zip: z.string().min(5, "Zip code is required").regex(/^\d{5}(-\d{4})?$/, "Invalid zip code format"),
  county: z.string().optional().nullable(),
});

// Schema for the create on-demand order form
export const createOnDemandOrderSchema = z.object({
  // Required fields
  userId: z.preprocess(
    (val) => (val === undefined || val === null || val === '') ? '' : String(val),
    z.string().min(1, "Client is required").uuid("Invalid client ID")
  ),
  clientAttention: z.string().min(1, "Client attention/contact name is required"),
  pickupDateTime: z.date({ message: "Pickup date and time are required" }),
  arrivalDateTime: z.date({ message: "Arrival date and time are required" }),
  vehicleType: VehicleTypeEnum,
  pickupAddress: addressSchema,
  deliveryAddress: addressSchema,

  // Optional fields
  orderNumber: z.string().optional(),
  tempEntityId: z.string().optional(),
  completeDateTime: z.date().optional().nullable(),
  hoursNeeded: z.preprocess(
    (val) => (val === '' || val === null || val === undefined || Number.isNaN(Number(val)) ? null : Number(val)),
    z.union([
      z.number().positive("Hours must be positive"),
      z.null()
    ])
  ),
  itemDelivered: z.string().optional().nullable(),
  pickupNotes: z.string().optional().nullable(),
  specialNotes: z.string().optional().nullable(),
  orderTotal: z.preprocess(
    (val) => {
      if (val === '' || val === null || val === undefined || Number.isNaN(Number(val))) {
        return null;
      }
      return Number(val);
    },
    z.number().positive("Order total must be positive").nullable()
  ),
  tip: z.preprocess(
    (val) => {
      if (val === '' || val === null || val === undefined || Number.isNaN(Number(val))) {
        return null;
      }
      return Number(val);
    },
    z.number().nonnegative("Tip cannot be negative").nullable()
  ),

  // Package dimensions (all optional)
  length: z.preprocess(
    (val) => (val === '' || val === null || val === undefined || Number.isNaN(Number(val)) ? null : Number(val)),
    z.union([
      z.number().positive("Length must be positive"),
      z.null()
    ])
  ),
  width: z.preprocess(
    (val) => (val === '' || val === null || val === undefined || Number.isNaN(Number(val)) ? null : Number(val)),
    z.union([
      z.number().positive("Width must be positive"),
      z.null()
    ])
  ),
  height: z.preprocess(
    (val) => (val === '' || val === null || val === undefined || Number.isNaN(Number(val)) ? null : Number(val)),
    z.union([
      z.number().positive("Height must be positive"),
      z.null()
    ])
  ),
  weight: z.preprocess(
    (val) => (val === '' || val === null || val === undefined || Number.isNaN(Number(val)) ? null : Number(val)),
    z.union([
      z.number().positive("Weight must be positive"),
      z.null()
    ])
  ),
});

// Type inferred from the schema - use z.output to properly handle preprocessor types
export type CreateOnDemandOrderInput = z.output<typeof createOnDemandOrderSchema>;

// Define success/error return type for the action
export interface CreateOrderResult {
  success: boolean;
  orderId?: string;
  orderNumber?: string;
  error?: string;
  fieldErrors?: z.ZodFormattedError<CreateOnDemandOrderInput>;
}
