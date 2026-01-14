import { z } from 'zod';

// Terminal statuses that block editing
export const TERMINAL_STATUSES = ['COMPLETED', 'DELIVERED', 'CANCELLED'] as const;

// Significant fields that trigger customer notification when changed
export const SIGNIFICANT_CHANGE_FIELDS = [
  'pickupDateTime',
  'arrivalDateTime',
  'pickupAddress',
  'deliveryAddress',
  'orderTotal',
] as const;

// Enum definitions mirroring Prisma schema
const CateringNeedHostEnum = z.enum(['YES', 'NO']);
const VehicleTypeEnum = z.enum(['CAR', 'VAN', 'TRUCK']);

// Helper to coerce date strings to Date objects
const optionalDateSchema = z.preprocess(
  (val) => {
    if (val === null || val === undefined || val === '') return undefined;
    if (val instanceof Date) return val;
    if (typeof val === 'string' && val.length > 0) {
      const parsed = new Date(val);
      return isNaN(parsed.getTime()) ? undefined : parsed;
    }
    return undefined;
  },
  z.date().optional()
);

// Helper for optional numbers
const optionalNumberSchema = z.preprocess(
  (val) => {
    if (val === '' || val === null || val === undefined || Number.isNaN(Number(val))) {
      return undefined;
    }
    return Number(val);
  },
  z.number().optional()
);

const optionalPositiveNumberSchema = z.preprocess(
  (val) => {
    if (val === '' || val === null || val === undefined || Number.isNaN(Number(val))) {
      return undefined;
    }
    return Number(val);
  },
  z.number().positive("Value must be positive").optional()
);

const optionalNonNegativeNumberSchema = z.preprocess(
  (val) => {
    if (val === '' || val === null || val === undefined || Number.isNaN(Number(val))) {
      return undefined;
    }
    return Number(val);
  },
  z.number().nonnegative("Value cannot be negative").optional()
);

const optionalPositiveIntSchema = z.preprocess(
  (val) => {
    if (val === '' || val === null || val === undefined || Number.isNaN(Number(val))) {
      return undefined;
    }
    return Math.floor(Number(val));
  },
  z.number().int().positive("Value must be a positive integer").optional()
);

// Address update schema - for inline address updates
export const addressUpdateSchema = z.object({
  id: z.string().uuid().optional(), // Optional - if provided, update existing; otherwise create new
  street1: z.string().min(1, "Street address is required"),
  street2: z.string().optional().nullable(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(2, "State is required").max(2, "State must be 2 characters"),
  zip: z.string().min(5, "Zip code is required").regex(/^\d{5}(-\d{4})?$/, "Invalid zip code format"),
  county: z.string().optional().nullable(),
  locationNumber: z.string().optional().nullable(),
  parkingLoading: z.string().optional().nullable(),
  name: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
});

// Schema for updating catering orders
export const cateringUpdateSchema = z.object({
  // Schedule fields
  pickupDateTime: optionalDateSchema,
  arrivalDateTime: optionalDateSchema,

  // Catering-specific fields
  brokerage: z.string().optional().nullable(),
  headcount: optionalPositiveIntSchema.nullable(),
  needHost: CateringNeedHostEnum.optional(),
  hoursNeeded: optionalPositiveNumberSchema.nullable(),
  numberOfHosts: optionalPositiveIntSchema.nullable(),

  // Pricing fields
  orderTotal: optionalNonNegativeNumberSchema.nullable(),
  tip: optionalNonNegativeNumberSchema.nullable(),
  appliedDiscount: optionalNonNegativeNumberSchema.nullable(),
  deliveryCost: optionalNonNegativeNumberSchema.nullable(),

  // Notes fields
  clientAttention: z.string().optional().nullable(),
  pickupNotes: z.string().optional().nullable(),
  specialNotes: z.string().optional().nullable(),

  // Address updates - can be either an ID reference or inline update
  pickupAddressId: z.string().uuid().optional(),
  deliveryAddressId: z.string().uuid().optional(),
  pickupAddress: addressUpdateSchema.optional(),
  deliveryAddress: addressUpdateSchema.optional(),
});

// Schema for updating on-demand orders
export const onDemandUpdateSchema = z.object({
  // Schedule fields
  pickupDateTime: optionalDateSchema,
  arrivalDateTime: optionalDateSchema,

  // On-demand specific fields
  itemDelivered: z.string().optional().nullable(),
  vehicleType: VehicleTypeEnum.optional(),
  hoursNeeded: optionalPositiveNumberSchema.nullable(),

  // Package dimensions
  length: optionalPositiveNumberSchema.nullable(),
  width: optionalPositiveNumberSchema.nullable(),
  height: optionalPositiveNumberSchema.nullable(),
  weight: optionalPositiveNumberSchema.nullable(),

  // Pricing fields
  orderTotal: optionalNonNegativeNumberSchema.nullable(),
  tip: optionalNonNegativeNumberSchema.nullable(),

  // Notes fields
  clientAttention: z.string().optional().nullable(),
  pickupNotes: z.string().optional().nullable(),
  specialNotes: z.string().optional().nullable(),

  // Address updates - can be either an ID reference or inline update
  pickupAddressId: z.string().uuid().optional(),
  deliveryAddressId: z.string().uuid().optional(),
  pickupAddress: addressUpdateSchema.optional(),
  deliveryAddress: addressUpdateSchema.optional(),
});

// Combined update schema that also allows status updates (existing functionality)
export const orderUpdateSchema = z.object({
  // Existing status fields
  status: z.string().optional(),
  driverStatus: z.string().optional(),

  // New update fields - use discriminated union based on order type
  ...cateringUpdateSchema.shape,
  ...onDemandUpdateSchema.shape,
}).partial();

// Types
export type AddressUpdate = z.infer<typeof addressUpdateSchema>;
export type CateringUpdate = z.infer<typeof cateringUpdateSchema>;
export type OnDemandUpdate = z.infer<typeof onDemandUpdateSchema>;
export type OrderUpdate = z.infer<typeof orderUpdateSchema>;

// Helper type for tracking field changes
export interface FieldChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  isSignificant: boolean;
}

// Helper function to check if a status is terminal
export function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.includes(status.toUpperCase() as typeof TERMINAL_STATUSES[number]);
}

// Helper function to detect significant changes
export function detectSignificantChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): FieldChange[] {
  const changes: FieldChange[] = [];

  for (const [key, newValue] of Object.entries(after)) {
    if (newValue === undefined) continue; // Skip undefined values (not being updated)

    const oldValue = before[key];
    const isSignificant = SIGNIFICANT_CHANGE_FIELDS.includes(key as typeof SIGNIFICANT_CHANGE_FIELDS[number]);

    // Check if value actually changed
    let hasChanged = false;

    if (key.endsWith('Address') && typeof newValue === 'object' && typeof oldValue === 'object') {
      // For address objects, do deep comparison
      hasChanged = JSON.stringify(newValue) !== JSON.stringify(oldValue);
    } else if (newValue instanceof Date && oldValue instanceof Date) {
      hasChanged = newValue.getTime() !== oldValue.getTime();
    } else if (newValue instanceof Date && typeof oldValue === 'string') {
      hasChanged = newValue.getTime() !== new Date(oldValue).getTime();
    } else {
      hasChanged = newValue !== oldValue;
    }

    if (hasChanged) {
      changes.push({
        field: key,
        oldValue,
        newValue,
        isSignificant,
      });
    }
  }

  return changes;
}

// Check if any changes are significant
export function hasSignificantChanges(changes: FieldChange[]): boolean {
  return changes.some(change => change.isSignificant);
}
