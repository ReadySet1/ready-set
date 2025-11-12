/**
 * Delivery Cost Calculator - Implements business rules from pricing documents
 *
 * KEY BUSINESS RULES:
 * 1. Delivery Cost based on LESSER of headcount OR food cost ranges
 * 2. Different rates for "within 10 miles" vs ">10 miles"
 * 3. Mileage Rate: Configurable per client (default $3.00)
 * 4. Daily Drive Discount: Configurable per client
 * 5. Driver Pay includes max cap, base pay, bonuses, and Ready Set fees
 */

import { ClientDeliveryConfiguration, getConfiguration, READY_SET_FOOD_STANDARD } from './client-configurations';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface DeliveryCostInput {
  headcount: number;
  foodCost: number;
  totalMileage: number;
  numberOfDrives?: number; // For daily drive discount (1-4+)
  requiresBridge?: boolean;
  bridgeToll?: number;
  clientConfigId?: string; // Optional: use specific client configuration
}

export interface DeliveryCostBreakdown {
  deliveryCost: number; // Base delivery cost from tier
  totalMileagePay: number; // Mileage × $3.00
  dailyDriveDiscount: number; // Discount based on number of drives
  bridgeToll: number;
  deliveryFee: number; // Total: deliveryCost + mileagePay - discount + bridge
}

export interface DriverPayInput extends DeliveryCostInput {
  bonusQualified: boolean; // Whether driver qualifies for bonus
  readySetFee?: number; // Ready Set fee (default $70)
  readySetAddonFee?: number; // Additional Ready Set fees
}

export interface DriverPayBreakdown {
  driverMaxPayPerDrop: number; // Cap on driver earnings per drop
  driverBasePayPerDrop: number; // Base pay rate (not used in actual calculation)
  driverTotalBasePay: number; // Actual base pay (equals max in practice)
  totalMileage: number; // Total miles driven
  mileageRate: number; // $0.70/mile for driver
  totalMileagePay: number; // Driver mileage pay (min $7)
  bridgeToll: number; // Bridge toll amount
  readySetFee: number; // Ready Set platform fee
  readySetAddonFee: number; // Additional Ready Set fees
  readySetTotalFee: number; // Total Ready Set fees
  driverBonusPay: number; // Bonus if qualified (shown separately)
  totalDriverPay: number; // Final driver payment (includes bridge toll)
  bonusQualifiedPercent: number; // 0-100%
  bonusQualified: boolean; // Whether driver qualifies for bonus
}

export interface VendorPayBreakdown {
  vendorPay: number;
  // Add vendor-specific breakdown fields as needed
}

// ============================================================================
// PRICING TABLES
// ============================================================================

export interface PricingTier {
  headcountMin: number;
  headcountMax: number | null;
  foodCostMin: number;
  foodCostMax: number | null;
  regularRate: number; // >10 miles (dollar amount)
  within10Miles: number; // ≤10 miles (dollar amount)
  // Optional: percentage-based pricing for enterprise tiers
  regularRatePercent?: number; // Percentage of foodCost (e.g., 0.10 for 10%)
  within10MilesPercent?: number; // Percentage of foodCost (e.g., 0.10 for 10%)
}

/**
 * Delivery cost tiers based on LESSER of headcount OR food cost
 * Uses the "more conservative" approach per business rules
 */
const PRICING_TIERS: PricingTier[] = [
  { headcountMin: 0, headcountMax: 24, foodCostMin: 0, foodCostMax: 299.99, regularRate: 60, within10Miles: 30 },
  { headcountMin: 25, headcountMax: 49, foodCostMin: 300, foodCostMax: 599.99, regularRate: 70, within10Miles: 40 },
  { headcountMin: 50, headcountMax: 74, foodCostMin: 600, foodCostMax: 899.99, regularRate: 90, within10Miles: 60 },
  { headcountMin: 75, headcountMax: 99, foodCostMin: 900, foodCostMax: 1199.99, regularRate: 100, within10Miles: 70 },
  { headcountMin: 100, headcountMax: 124, foodCostMin: 1200, foodCostMax: 1499.99, regularRate: 120, within10Miles: 80 },
  { headcountMin: 125, headcountMax: 149, foodCostMin: 1500, foodCostMax: 1699.99, regularRate: 150, within10Miles: 90 },
  { headcountMin: 150, headcountMax: 174, foodCostMin: 1700, foodCostMax: 1899.99, regularRate: 180, within10Miles: 100 },
  { headcountMin: 175, headcountMax: 199, foodCostMin: 1900, foodCostMax: 2099.99, regularRate: 210, within10Miles: 110 },
  { headcountMin: 200, headcountMax: 249, foodCostMin: 2100, foodCostMax: 2299.99, regularRate: 280, within10Miles: 120 },
  { headcountMin: 250, headcountMax: 299, foodCostMin: 2300, foodCostMax: 2499.99, regularRate: 310, within10Miles: 130 },
  { headcountMin: 300, headcountMax: null, foodCostMin: 2500, foodCostMax: null, regularRate: 0, within10Miles: 0 } // TBD
];

// ============================================================================
// CONSTANTS
// ============================================================================

const VENDOR_MILEAGE_RATE = 3.0; // $3.00 per mile (vendor charges)
const DRIVER_MILEAGE_RATE = 0.70; // $0.70 per mile (driver pay)
const DRIVER_MILEAGE_MINIMUM = 7.0; // $7.00 minimum for driver mileage
const DISTANCE_THRESHOLD = 10; // miles

const DAILY_DRIVE_DISCOUNTS: Record<number, number> = {
  1: 0,    // Single drive = no discount
  2: 5,    // 2 drives/day = -$5 per drive
  3: 10,   // 3 drives/day = -$10 per drive
  4: 15,   // 4+ drives/day = -$15 per drive
};

const DEFAULT_READY_SET_FEE = 70;
const DRIVER_MAX_PAY_PER_DROP = 40;
const DRIVER_BASE_PAY_PER_DROP = 23;
const DRIVER_BONUS_PAY = 10;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Determines pricing tier based on LESSER FEE of headcount OR food cost
 * Uses the lower fee amount, not the lower tier index
 */
function determinePricingTier(
  headcount: number,
  foodCost: number,
  tiers: PricingTier[],
  isWithin10Miles: boolean
): PricingTier {
  // Special case: if headcount is 0, use only food cost
  if (headcount === 0) {
    const foodCostTier = tiers.find(tier =>
      isInTier(foodCost, tier.foodCostMin, tier.foodCostMax)
    );
    if (!foodCostTier) {
      throw new Error('No valid pricing tier found for the given food cost');
    }
    return foodCostTier;
  }

  // Special case: if food cost is 0, use only headcount
  if (foodCost === 0) {
    const headcountTier = tiers.find(tier =>
      isInTier(headcount, tier.headcountMin, tier.headcountMax)
    );
    if (!headcountTier) {
      throw new Error('No valid pricing tier found for the given headcount');
    }
    return headcountTier;
  }

  // Find tier by headcount
  const headcountTier = tiers.find(tier =>
    isInTier(headcount, tier.headcountMin, tier.headcountMax)
  );

  // Find tier by food cost
  const foodCostTier = tiers.find(tier =>
    isInTier(foodCost, tier.foodCostMin, tier.foodCostMax)
  );

  // Default to first tier if not found
  if (!headcountTier || !foodCostTier) {
    throw new Error('No valid pricing tier found for the given headcount and food cost');
  }
  const hcTier: PricingTier = headcountTier;
  const fcTier: PricingTier = foodCostTier;

  // Get the actual fee amounts for comparison
  // Handle percentage-based pricing
  let hcFee: number;
  let fcFee: number;

  if (isWithin10Miles) {
    hcFee = hcTier.within10MilesPercent ? foodCost * hcTier.within10MilesPercent : hcTier.within10Miles;
    fcFee = fcTier.within10MilesPercent ? foodCost * fcTier.within10MilesPercent : fcTier.within10Miles;
  } else {
    hcFee = hcTier.regularRatePercent ? foodCost * hcTier.regularRatePercent : hcTier.regularRate;
    fcFee = fcTier.regularRatePercent ? foodCost * fcTier.regularRatePercent : fcTier.regularRate;
  }

  // Handle TBD tiers (fee = 0) - prefer the tier with a non-zero fee
  if (hcFee === 0 && fcFee > 0) {
    return fcTier;
  }
  if (fcFee === 0 && hcFee > 0) {
    return hcTier;
  }

  // Return the tier with the LESSER FEE (more conservative)
  return hcFee <= fcFee ? hcTier : fcTier;
}

/**
 * Checks if a value falls within a tier's min/max boundaries
 * Extracted for better testability and reusability
 */
function isInTier(value: number, min: number, max: number | null): boolean {
  return max === null ? value >= min : value >= min && value <= max;
}

/**
 * Calculates daily drive discount based on number of drives using client config
 * Returns TOTAL discount (discount per drive × number of drives)
 */
function calculateDailyDriveDiscount(numberOfDrives: number, config: ClientDeliveryConfiguration): number {
  let discountPerDrive = 0;

  if (numberOfDrives >= 4) {
    discountPerDrive = config.dailyDriveDiscounts.fourPlusDrivers;
  } else if (numberOfDrives === 3) {
    discountPerDrive = config.dailyDriveDiscounts.threeDrivers;
  } else if (numberOfDrives === 2) {
    discountPerDrive = config.dailyDriveDiscounts.twoDrivers;
  }

  return discountPerDrive * numberOfDrives;
}

/**
 * Checks if an order requires manual review based on client configuration
 * Separated for better single responsibility principle
 */
function checkManualReviewRequired(headcount: number, config: ClientDeliveryConfiguration): void {
  if (config.driverPaySettings.requiresManualReview && headcount >= 100) {
    throw new Error(
      `Order with ${headcount} headcount requires manual review for ${config.clientName}. ` +
      `Please contact support for pricing on orders with 100+ headcount.`
    );
  }
}

/**
 * Determines driver base pay based on headcount using tiered system or flat rate
 * Uses helper functions for tier lookup and validation
 */
function determineDriverBasePay(headcount: number, config: ClientDeliveryConfiguration): number {
  // If config has tiered driver base pay, use it
  if (config.driverPaySettings.driverBasePayTiers && config.driverPaySettings.driverBasePayTiers.length > 0) {
    const tier = config.driverPaySettings.driverBasePayTiers.find(t =>
      isInTier(headcount, t.headcountMin, t.headcountMax)
    );

    if (!tier) {
      throw new Error(`No driver base pay tier found for headcount: ${headcount}`);
    }

    // Validate tier configuration - basePay should not be 0 unless manual review is required
    if (tier.basePay === 0) {
      // Check if this requires manual review (for clients like Try Hungry with 100+ headcount)
      checkManualReviewRequired(headcount, config);

      // If we get here and basePay is still 0, it's a configuration error
      if (!config.driverPaySettings.requiresManualReview) {
        throw new Error(
          `Invalid tier configuration: basePay is 0 for headcount ${headcount} ` +
          `but client ${config.clientName} does not require manual review. ` +
          `This indicates a pricing configuration error.`
        );
      }
    }

    return tier.basePay;
  }

  // Otherwise, use flat base pay
  return config.driverPaySettings.basePayPerDrop;
}

// ============================================================================
// MAIN CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculates delivery cost based on headcount, food cost, and mileage
 *
 * @param input - Delivery parameters
 * @returns Breakdown of delivery costs
 *
 * @example
 * // Example from Image 2 (Food Cost based)
 * const result = calculateDeliveryCost({
 *   headcount: 0,
 *   foodCost: 2300,
 *   totalMileage: 14.5,
 *   numberOfDrives: 3
 * });
 * // Returns: { deliveryCost: 310, totalMileagePay: 13.50, dailyDriveDiscount: 30, deliveryFee: 293.50 }
 */
export function calculateDeliveryCost(input: DeliveryCostInput): DeliveryCostBreakdown {
  const {
    headcount,
    foodCost,
    totalMileage,
    numberOfDrives = 1,
    requiresBridge = false,
    bridgeToll,
    clientConfigId
  } = input;

  // Get client configuration (default to Ready Set Food Standard)
  const config = clientConfigId
    ? getConfiguration(clientConfigId) || READY_SET_FOOD_STANDARD
    : READY_SET_FOOD_STANDARD;

  // Validate inputs
  if (headcount < 0) throw new Error('Headcount cannot be negative');
  if (foodCost < 0) throw new Error('Food cost cannot be negative');
  if (totalMileage < 0) throw new Error('Total mileage cannot be negative');
  if (numberOfDrives < 1) throw new Error('Number of drives must be at least 1');

  // 1. Determine if within 10 miles
  const isWithin10Miles = totalMileage <= config.distanceThreshold;

  // 2. Determine pricing tier (LESSER FEE of headcount or food cost)
  const tier = determinePricingTier(headcount, foodCost, config.pricingTiers, isWithin10Miles);

  // 3. Select delivery cost based on distance
  // Check for percentage-based pricing (for enterprise tiers)
  let deliveryCost: number;
  if (isWithin10Miles) {
    deliveryCost = tier.within10MilesPercent
      ? foodCost * tier.within10MilesPercent
      : tier.within10Miles;
  } else {
    deliveryCost = tier.regularRatePercent
      ? foodCost * tier.regularRatePercent
      : tier.regularRate;
  }

  // 3. Calculate mileage pay (per mile for miles OVER threshold)
  const extraMiles = Math.max(0, totalMileage - config.distanceThreshold);
  const totalMileagePay = extraMiles * config.mileageRate;

  // 4. Calculate daily drive discount using config
  const dailyDriveDiscount = calculateDailyDriveDiscount(numberOfDrives, config);

  // 5. Calculate total delivery fee
  const effectiveMileagePay = totalMileagePay;
  const effectiveBridgeToll = requiresBridge ? (bridgeToll || config.bridgeTollSettings.defaultTollAmount) : 0;

  // IMPORTANT: CaterValley-specific business rule
  // For CaterValley, bridge toll ($8) is driver compensation paid by Ready Set
  // It should NOT be added to the customer's delivery fee
  // Other clients may include bridge toll in their delivery fee
  const bridgeTollForCustomer = config.clientName === 'CaterValley' ? 0 : effectiveBridgeToll;

  const deliveryFee = deliveryCost + effectiveMileagePay - dailyDriveDiscount + bridgeTollForCustomer;

  // CRITICAL: Validate that delivery cost is not zero for non-zero orders
  // This prevents revenue loss from configuration errors
  if (deliveryCost === 0 && (headcount > 0 || foodCost > 0)) {
    // Special case: Check if this requires manual review
    checkManualReviewRequired(headcount, config);

    // If we get here, it's a configuration error (not a manual review case)
    throw new Error(
      `Delivery cost calculation resulted in $0 for non-zero order (headcount: ${headcount}, foodCost: $${foodCost}). ` +
      `This indicates a pricing configuration error (tier with zero rates). clientConfig: ${config.id}`
    );
  }

  return {
    deliveryCost,
    totalMileagePay: effectiveMileagePay,
    dailyDriveDiscount,
    bridgeToll: effectiveBridgeToll,
    deliveryFee
  };
}

/**
 * Calculates mileage pay only (for miles OVER threshold)
 *
 * @param totalMileage - Total miles for delivery
 * @param clientConfigId - Optional client configuration ID
 * @returns Mileage pay amount
 *
 * @example
 * calculateMileagePay(14.5) // Returns 13.50 ((14.5 - 10) × $3.00)
 */
export function calculateMileagePay(totalMileage: number, clientConfigId?: string): number {
  if (totalMileage < 0) throw new Error('Total mileage cannot be negative');

  // Get client configuration
  const config = clientConfigId
    ? getConfiguration(clientConfigId) || READY_SET_FOOD_STANDARD
    : READY_SET_FOOD_STANDARD;

  // Only charge for miles over threshold
  const extraMiles = Math.max(0, totalMileage - config.distanceThreshold);
  return extraMiles * config.mileageRate;
}

/**
 * Calculates driver pay with all components
 * NOTE: Based on actual data, driverTotalBasePay ALWAYS equals driverMaxPayPerDrop
 * The bonus is shown separately and NOT added to totalDriverPay
 *
 * @param input - Driver payment parameters
 * @returns Complete breakdown of driver payments
 *
 * @example
 * // Test 1: Standard Delivery
 * const result = calculateDriverPay({
 *   headcount: 40,
 *   foodCost: 500,
 *   totalMileage: 6.4,
 *   numberOfDrives: 1,
 *   bonusQualified: true
 * });
 * // Expected: totalMileagePay: $7.00 (min), driverTotalBasePay: $40, bonus: $10 (separate)
 */
export function calculateDriverPay(input: DriverPayInput): DriverPayBreakdown {
  const {
    headcount,
    bonusQualified,
    readySetAddonFee = 0,
    totalMileage,
    requiresBridge = false,
    bridgeToll,
    clientConfigId
  } = input;

  // Get client configuration
  const config = clientConfigId
    ? getConfiguration(clientConfigId) || READY_SET_FOOD_STANDARD
    : READY_SET_FOOD_STANDARD;

  // Step 1: Determine driver base pay (tiered or flat)
  const driverBasePay = determineDriverBasePay(headcount, config);

  // Step 2: Calculate driver mileage pay with $7 minimum
  const totalMileagePay = Math.max(
    totalMileage * DRIVER_MILEAGE_RATE,
    DRIVER_MILEAGE_MINIMUM
  );

  // Step 3: Driver bonus
  const driverBonusPay = bonusQualified ? config.driverPaySettings.bonusPay : 0;
  const bonusQualifiedPercent = bonusQualified ? 100 : 0;

  // Step 4: Calculate bridge toll
  const effectiveBridgeToll = requiresBridge ? (bridgeToll || config.bridgeTollSettings.defaultTollAmount) : 0;

  // Step 5: Calculate Driver Total Base Pay
  // Formula: Driver Base Pay + Mileage Pay
  // Note: For some clients (e.g., HY Food Company), base pay is flat $50
  // For others (e.g., Destino, Try Hungry), base pay varies by headcount tier
  const driverTotalBasePay = driverBasePay + totalMileagePay;

  // Step 6: Calculate Driver Total Pay
  // Formula: Total Base Pay + Bonus + Bridge Toll
  const totalDriverPay = driverTotalBasePay + driverBonusPay + effectiveBridgeToll;

  // Step 7: Ready Set fees - from config
  const readySetFee = input.readySetFee || config.driverPaySettings.readySetFee;
  const readySetTotalFee = readySetFee + readySetAddonFee + effectiveBridgeToll;

  return {
    driverMaxPayPerDrop: config.driverPaySettings.maxPayPerDrop,
    driverBasePayPerDrop: driverBasePay, // Now returns actual base pay used (tiered or flat)
    driverTotalBasePay,
    totalMileage,
    mileageRate: DRIVER_MILEAGE_RATE,
    totalMileagePay,
    bridgeToll: effectiveBridgeToll,
    readySetFee,
    readySetAddonFee,
    readySetTotalFee,
    driverBonusPay,
    totalDriverPay,
    bonusQualifiedPercent,
    bonusQualified
  };
}

/**
 * Calculates vendor pay (placeholder for vendor-specific logic)
 *
 * @param input - Vendor payment parameters
 * @returns Vendor payment breakdown
 */
export function calculateVendorPay(input: DeliveryCostInput): VendorPayBreakdown {
  // Vendor pay logic to be implemented based on specific business rules
  // For now, return the delivery cost as vendor pay
  const deliveryCost = calculateDeliveryCost(input);

  return {
    vendorPay: deliveryCost.deliveryFee
  };
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validates input parameters for delivery cost calculation
 */
export function validateDeliveryCostInput(input: DeliveryCostInput): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (input.headcount < 0) errors.push('Headcount cannot be negative');
  if (input.foodCost < 0) errors.push('Food cost cannot be negative');
  if (input.totalMileage < 0) errors.push('Total mileage cannot be negative');
  if (input.numberOfDrives && input.numberOfDrives < 1) errors.push('Number of drives must be at least 1');

  // Check for TBD tiers (300+ headcount or $2500+ food cost)
  if (input.headcount >= 300 || input.foodCost >= 2500) {
    errors.push('Delivery cost for 300+ headcount or $2500+ food cost is TBD - please contact support');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

// Re-export configuration types and functions
export type { ClientDeliveryConfiguration } from './client-configurations';
export { getConfiguration, getActiveConfigurations, getConfigurationOptions } from './client-configurations';

const deliveryCostCalculator = {
  calculateDeliveryCost,
  calculateMileagePay,
  calculateDriverPay,
  calculateVendorPay,
  validateDeliveryCostInput,
  // Export constants for testing
  PRICING_TIERS,
  VENDOR_MILEAGE_RATE,
  DRIVER_MILEAGE_RATE,
  DRIVER_MILEAGE_MINIMUM,
  DISTANCE_THRESHOLD,
  DAILY_DRIVE_DISCOUNTS
};

export default deliveryCostCalculator;
