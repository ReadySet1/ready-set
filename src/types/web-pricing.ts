/**
 * Web Development Pricing Types
 * Type definitions for the web pricing tool
 */

// ============================================================================
// PACKAGE TIER TYPES
// ============================================================================

export type WebsiteCategory = 'marketing' | 'ecommerce';

export interface WebsitePricingTier {
  id: string;
  name: string;
  category: WebsiteCategory;
  description: string;
  basePrice: number;
  originalPrice?: number; // For showing discounted pricing
  monthlyFee: number;
  features: string[];
  targetAudience: string;
  pageCount: number | 'unlimited';
  productLimit?: number | 'unlimited';
  popular?: boolean;
  limitedOffer?: boolean; // Show "Limited Offer" badge
}

// ============================================================================
// ADD-ON FEATURE TYPES
// ============================================================================

export type AddOnCategory =
  | 'design'
  | 'development'
  | 'integration'
  | 'hosting'
  | 'maintenance';

export interface AddOnFeature {
  id: string;
  name: string;
  category: AddOnCategory;
  description: string;
  oneTimePrice: number;
  monthlyPrice: number;
  isPopular?: boolean;
  incompatibleWith?: string[];
  requiredTiers?: string[];
}

// ============================================================================
// PRICING INPUT/OUTPUT TYPES
// ============================================================================

export interface WebPricingInput {
  selectedTierId: string;
  selectedAddOnIds: string[];
}

export interface PricingLineItem {
  id: string;
  name: string;
  type: 'package' | 'addon';
  category?: AddOnCategory;
  oneTimeAmount: number;
  monthlyAmount: number;
}

export interface WebPricingBreakdown {
  packageName: string;
  packageCategory: WebsiteCategory;

  // Cost totals
  oneTimeCost: number;
  monthlyCost: number;
  yearOneTotalCost: number;

  // Line items for detailed display
  lineItems: PricingLineItem[];

  // Summary counts
  addOnCount: number;

  // Metadata
  calculatedAt: Date;
}

// ============================================================================
// UI STATE TYPES
// ============================================================================

export interface WebPricingState {
  selectedTier: WebsitePricingTier | null;
  selectedAddOns: AddOnFeature[];
  breakdown: WebPricingBreakdown | null;
}
