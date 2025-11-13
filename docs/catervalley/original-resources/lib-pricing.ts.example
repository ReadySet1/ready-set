// lib/catervalley/pricing.ts
import { PricingBreakdown } from "@/types/catervalley";
import { isPeakTime } from "./time";
import { calculateDistance } from "./utils";

interface PricingInput {
  priceTotal: number;
  deliveryTime: string;
  headCount?: number;
  pickupLocation: {
    address: string;
    city: string;
    state: string;
  };
  deliveryAddress: {
    address: string;
    city: string;
    state: string;
  };
}

interface PricingResult {
  success: boolean;
  deliveryPrice: number;
  breakdown: PricingBreakdown;
  error?: string;
}

// Pricing configuration based on CaterValley agreement
const PRICING_CONFIG = {
  minimumFee: 42.5,
  peakTimeMultiplier: 1.15,

  // Head count tiers (from email image)
  headCountTiers: [
    { min: 1, max: 25, pricing: 35.0, tip: 35.0 },
    { min: 26, max: 49, pricing: 45.0, tip: 52.5 },
    { min: 50, max: 74, pricing: 55.0, tip: 62.5 },
    { min: 75, max: 99, pricing: 65.0, tip: 72.5 },
    { min: 100, max: Infinity, pricing: 0, tip: 0, percentBased: true }, // 9% food cost, 10% food cost tip
  ],

  // Food cost tiers (from email image)
  foodCostTiers: [
    { min: 0, max: 299.99, pricing: 35.0, tip: 35.0 },
    { min: 300, max: 599.99, pricing: 45.0, tip: 52.5 },
    { min: 600, max: 899.99, pricing: 55.0, tip: 62.5 },
    { min: 900, max: 1199.99, pricing: 65.0, tip: 72.5 },
    { min: 1200, max: Infinity, pricing: 0, tip: 0, percentBased: true }, // 9% food cost, 10% food cost tip
  ],

  // Discount tiers based on delivery count
  discountTiers: [
    { minDeliveries: 10, discountPercentage: 5 },
    { minDeliveries: 25, discountPercentage: 10 },
    { minDeliveries: 50, discountPercentage: 15 },
    { minDeliveries: 100, discountPercentage: 20 },
  ],
};

/**
 * Get pricing tier based on head count
 */
function getHeadCountTier(headCount: number) {
  return PRICING_CONFIG.headCountTiers.find(
    (tier) => headCount >= tier.min && headCount <= tier.max
  );
}

/**
 * Get pricing tier based on food cost
 */
function getFoodCostTier(foodCost: number) {
  return PRICING_CONFIG.foodCostTiers.find(
    (tier) => foodCost >= tier.min && foodCost <= tier.max
  );
}

/**
 * Calculate delivery price based on food cost
 */
function calculateByFoodCost(foodCost: number): {
  basePrice: number;
  tier: string;
} {
  const tier = getFoodCostTier(foodCost);

  if (!tier) {
    return {
      basePrice: PRICING_CONFIG.minimumFee,
      tier: "default",
    };
  }

  let basePrice: number;

  if (tier.percentBased) {
    // For $1200+: 9% of food cost + 10% tip
    basePrice = foodCost * 0.09 + foodCost * 0.1;
  } else {
    // Fixed pricing + tip
    basePrice = tier.pricing + tier.tip;
  }

  return {
    basePrice,
    tier: `$${tier.min}-${tier.max === Infinity ? "+" : tier.max}`,
  };
}

/**
 * Calculate delivery price based on head count
 */
function calculateByHeadCount(headCount: number, foodCost: number): {
  basePrice: number;
  tier: string;
} {
  const tier = getHeadCountTier(headCount);

  if (!tier) {
    return calculateByFoodCost(foodCost);
  }

  let basePrice: number;

  if (tier.percentBased) {
    // For 100+: 9% of food cost + 10% tip
    basePrice = foodCost * 0.09 + foodCost * 0.1;
  } else {
    // Fixed pricing + tip
    basePrice = tier.pricing + tier.tip;
  }

  return {
    basePrice,
    tier: `${tier.min}-${tier.max === Infinity ? "+" : tier.max} people`,
  };
}

/**
 * Get applicable discount based on delivery count
 */
async function getDiscount(
  orderCode: string
): Promise<{ percentage: number; count: number } | null> {
  // TODO: Implement actual delivery count lookup from database
  // For now, return null (no discount)
  const deliveryCount = 0; // await getDeliveryCountForCustomer(orderCode);

  const applicableDiscount = PRICING_CONFIG.discountTiers
    .filter((tier) => deliveryCount >= tier.minDeliveries)
    .sort((a, b) => b.discountPercentage - a.discountPercentage)[0];

  if (applicableDiscount) {
    return {
      percentage: applicableDiscount.discountPercentage,
      count: deliveryCount,
    };
  }

  return null;
}

/**
 * Calculate pricing for CaterValley order
 * CRITICAL: Must enforce minimum delivery fee of $42.50
 */
export async function calculatePricing(
  input: PricingInput
): Promise<PricingResult> {
  try {
    // 1. Calculate base price using food cost OR head count
    // Use head count if provided, otherwise use food cost
    let baseCalculation;

    if (input.headCount && input.headCount > 0) {
      baseCalculation = calculateByHeadCount(
        input.headCount,
        input.priceTotal
      );
    } else {
      baseCalculation = calculateByFoodCost(input.priceTotal);
    }

    let deliveryPrice = baseCalculation.basePrice;

    // 2. Apply peak time multiplier if applicable
    let peakTimeMultiplier: number | undefined;
    if (isPeakTime(input.deliveryTime)) {
      peakTimeMultiplier = PRICING_CONFIG.peakTimeMultiplier;
      deliveryPrice *= peakTimeMultiplier;
    }

    // 3. Calculate distance (optional adjustment)
    // const distance = await calculateDistance(
    //   input.pickupLocation,
    //   input.deliveryAddress
    // );
    // Add distance-based adjustments if needed

    // 4. Apply any applicable discounts
    // const discount = await getDiscount(orderCode);
    // if (discount) {
    //   deliveryPrice *= (1 - discount.percentage / 100);
    // }

    // 5. Round to 2 decimal places
    deliveryPrice = Math.round(deliveryPrice * 100) / 100;

    // 6. Create pricing breakdown
    const breakdown: PricingBreakdown = {
      basePrice: baseCalculation.basePrice,
      peakTimeMultiplier,
      foodCostTier: !input.headCount
        ? baseCalculation.tier
        : undefined,
      headCountTier: input.headCount
        ? baseCalculation.tier
        : undefined,
      tipIncluded: true,
      calculation: input.headCount
        ? `Head count tier: ${baseCalculation.tier}`
        : `Food cost tier: ${baseCalculation.tier}`,
    };

    console.log("[Pricing Calculation]", {
      input: {
        priceTotal: input.priceTotal,
        headCount: input.headCount,
        deliveryTime: input.deliveryTime,
      },
      calculated: {
        basePrice: baseCalculation.basePrice,
        tier: baseCalculation.tier,
        deliveryPrice,
        peakTime: !!peakTimeMultiplier,
      },
    });

    return {
      success: true,
      deliveryPrice, // NOTE: Caller must enforce minimum of $42.50
      breakdown,
    };
  } catch (error) {
    console.error("[Pricing Calculation Error]", error);

    return {
      success: false,
      deliveryPrice: PRICING_CONFIG.minimumFee,
      breakdown: {
        basePrice: PRICING_CONFIG.minimumFee,
        calculation: "Error during calculation - using minimum fee",
      },
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Validate pricing meets minimum requirements
 */
export function validatePricing(deliveryPrice: number): {
  valid: boolean;
  adjustedPrice: number;
  message?: string;
} {
  if (deliveryPrice < PRICING_CONFIG.minimumFee) {
    return {
      valid: false,
      adjustedPrice: PRICING_CONFIG.minimumFee,
      message: `Delivery price of $${deliveryPrice.toFixed(2)} is below minimum fee of $${PRICING_CONFIG.minimumFee.toFixed(2)}`,
    };
  }

  return {
    valid: true,
    adjustedPrice: deliveryPrice,
  };
}
