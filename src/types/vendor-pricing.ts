import { z } from 'zod';

// ============================================================================
// Pricing Tier Schema
// ============================================================================

const PricingTierSchema = z.object({
  headcountMin: z.number().min(0, 'Headcount min must be >= 0'),
  headcountMax: z.number().min(0).nullable(),
  foodCostMin: z.number().min(0, 'Food cost min must be >= 0'),
  foodCostMax: z.number().min(0).nullable(),
  regularRate: z.number().min(0, 'Regular rate must be >= 0'),
  within10Miles: z.number().min(0, 'Within 10 miles rate must be >= 0'),
  regularRatePercent: z.number().min(0).max(1).optional(),
  within10MilesPercent: z.number().min(0).max(1).optional(),
});

// ============================================================================
// Driver Base Pay Tier Schema
// ============================================================================

const DriverBasePayTierSchema = z.object({
  headcountMin: z.number().min(0),
  headcountMax: z.number().min(0).nullable(),
  basePay: z.number().min(0, 'Base pay must be >= 0'),
  basePayWithinThreshold: z.number().min(0).optional(),
});

// ============================================================================
// Driver Food Cost Pay Tier Schema
// ============================================================================

const DriverFoodCostPayTierSchema = z.object({
  foodCostMin: z.number().min(0),
  foodCostMax: z.number().min(0).nullable(),
  basePay: z.number().min(0, 'Base pay must be >= 0'),
  basePayWithinThreshold: z.number().min(0).optional(),
});

// ============================================================================
// Driver Mileage Settings Schema
// ============================================================================

const DriverMileageSettingsSchema = z.object({
  flatAmountWithinThreshold: z.number().min(0),
  perMileRateOverThreshold: z.number().min(0),
  threshold: z.number().min(0).optional(),
});

// ============================================================================
// Driver Pay Settings Schema
// ============================================================================

const DriverPaySettingsSchema = z.object({
  maxPayPerDrop: z.number().min(0).nullable(),
  basePayPerDrop: z.number().min(0),
  bonusPay: z.number().min(0, 'Bonus pay must be >= 0'),
  readySetFee: z.number().min(0, 'Ready Set fee must be >= 0'),
  driverMileageRate: z.number().min(0).optional(),
  driverBasePayTiers: z.array(DriverBasePayTierSchema).optional(),
  driverFoodCostPayTiers: z.array(DriverFoodCostPayTierSchema).optional(),
  requiresManualReview: z.boolean().optional(),
  driverMileageSettings: DriverMileageSettingsSchema.optional(),
  readySetFeeMatchesDeliveryFee: z.boolean().optional(),
  includeDirectTipInReadySetTotal: z.boolean().optional(),
}).refine(
  (data) => {
    if (data.maxPayPerDrop !== null && data.maxPayPerDrop < data.basePayPerDrop) {
      return false;
    }
    return true;
  },
  { message: 'Max pay per drop must be >= base pay per drop when set' }
);

// ============================================================================
// Zero Order Settings Schema
// ============================================================================

const ZeroOrderSettingsSchema = z.object({
  enabled: z.boolean(),
  readySetFee: z.number().min(0),
  customerDeliveryFee: z.number().min(0),
  driverBasePay: z.number().min(0),
  driverMileagePay: z.number().min(0),
  driverBonusPay: z.number().min(0),
  maxMileage: z.number().min(0).optional(),
});

// ============================================================================
// Bridge Toll Settings Schema
// ============================================================================

const BridgeTollSettingsSchema = z.object({
  defaultTollAmount: z.number().min(0, 'Default toll amount must be >= 0'),
  autoApplyForAreas: z.array(z.string()).optional(),
});

// ============================================================================
// Daily Drive Discounts Schema
// ============================================================================

const DailyDriveDiscountsSchema = z.object({
  twoDrivers: z.number().min(0, 'Discount must be >= 0'),
  threeDrivers: z.number().min(0, 'Discount must be >= 0'),
  fourPlusDrivers: z.number().min(0, 'Discount must be >= 0'),
});

// ============================================================================
// Main Vendor Pricing Schema
// ============================================================================

export const VendorPricingSchema = z.object({
  id: z.string(),
  clientName: z.string().min(1, 'Client name is required'),
  vendorName: z.string().min(1, 'Vendor name is required'),
  description: z.string().optional(),
  isActive: z.boolean(),
  pricingTiers: z.array(PricingTierSchema).min(1, 'At least one pricing tier is required'),
  mileageRate: z.number().min(0, 'Mileage rate must be >= 0'),
  distanceThreshold: z.number().min(0, 'Distance threshold must be >= 0'),
  dailyDriveDiscounts: DailyDriveDiscountsSchema,
  driverPaySettings: DriverPaySettingsSchema,
  zeroOrderSettings: ZeroOrderSettingsSchema.optional(),
  bridgeTollSettings: BridgeTollSettingsSchema,
  customSettings: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  createdBy: z.string().optional(),
  notes: z.string().optional(),
});

export type VendorPricingFormData = z.infer<typeof VendorPricingSchema>;
