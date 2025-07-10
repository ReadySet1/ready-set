import { Decimal } from '@prisma/client/runtime/library';

export interface PricingTier {
  id: string;
  minHeadCount: number;
  maxHeadCount: number | null;
  minFoodCost: number | Decimal;
  maxFoodCost: number | Decimal | null;
  priceWithTip: number | Decimal | null;
  priceWithoutTip: number | Decimal | null;
  percentageWithTip: number | Decimal | null;
  percentageWithoutTip: number | Decimal | null;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface PricingCalculation {
  basePrice: number;
  discount: number;
  finalPrice: number;
  appliedTier: PricingTier | null;
  hasTip: boolean;
  calculationDetails?: {
    isPercentageBased: boolean;
    appliedRate?: number;
    tierName?: string;
  };
}

export interface PricingCalculationRequest {
  headCount: number;
  foodCost: number;
  hasTip: boolean;
}

export interface PricingTierCreateInput {
  minHeadCount: number;
  maxHeadCount?: number | null;
  minFoodCost: number;
  maxFoodCost?: number | null;
  priceWithTip?: number | null;
  priceWithoutTip?: number | null;
  percentageWithTip?: number | null;
  percentageWithoutTip?: number | null;
  isActive?: boolean;
}

export interface PricingTierUpdateInput extends Partial<PricingTierCreateInput> {
  id: string;
}

// Helper type for API responses
export interface PricingApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Pricing tier configuration constants
export const PRICING_TIER_CONSTANTS = {
  DEFAULT_TIERS: [
    {
      minHeadCount: 1,
      maxHeadCount: 24,
      minFoodCost: 0,
      maxFoodCost: 299.99,
      priceWithTip: 35.00,
      priceWithoutTip: 42.50,
    },
    {
      minHeadCount: 25,
      maxHeadCount: 49,
      minFoodCost: 300,
      maxFoodCost: 599.99,
      priceWithTip: 45.00,
      priceWithoutTip: 52.50,
    },
    {
      minHeadCount: 50,
      maxHeadCount: 74,
      minFoodCost: 600,
      maxFoodCost: 899.99,
      priceWithTip: 55.00,
      priceWithoutTip: 62.50,
    },
    {
      minHeadCount: 75,
      maxHeadCount: 99,
      minFoodCost: 900,
      maxFoodCost: 1199.99,
      priceWithTip: 65.00,
      priceWithoutTip: 72.50,
    },
    {
      minHeadCount: 100,
      maxHeadCount: null,
      minFoodCost: 1200,
      maxFoodCost: null,
      priceWithTip: null,
      priceWithoutTip: null,
      percentageWithTip: 9,
      percentageWithoutTip: 10,
    },
  ],
} as const; 