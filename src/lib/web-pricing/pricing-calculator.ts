/**
 * Web Development Pricing Calculator
 * Calculates total costs based on selected tier and add-ons
 */

import type {
  WebPricingInput,
  WebPricingBreakdown,
  PricingLineItem,
} from '@/types/web-pricing';

import {
  getTierById,
  getAddOnById,
  isAddOnCompatibleWithTier,
  areAddOnsCompatible,
} from './pricing-configurations';

// ============================================================================
// CALCULATOR FUNCTION
// ============================================================================

/**
 * Calculate web pricing breakdown based on selected tier and add-ons
 */
export function calculateWebPricing(
  input: WebPricingInput
): WebPricingBreakdown {
  const { selectedTierId, selectedAddOnIds } = input;

  // Get the selected tier
  const tier = getTierById(selectedTierId);
  if (!tier) {
    throw new Error(`Invalid tier ID: ${selectedTierId}`);
  }

  // Initialize line items array
  const lineItems: PricingLineItem[] = [];

  // Add package as first line item
  lineItems.push({
    id: tier.id,
    name: tier.name,
    type: 'package',
    oneTimeAmount: tier.basePrice,
    monthlyAmount: tier.monthlyFee,
  });

  // Process add-ons
  const validAddOnIds: string[] = [];

  for (const addOnId of selectedAddOnIds) {
    const addon = getAddOnById(addOnId);
    if (!addon) {
      console.warn(`Add-on not found: ${addOnId}`);
      continue;
    }

    // Check tier compatibility
    if (!isAddOnCompatibleWithTier(addOnId, selectedTierId)) {
      console.warn(
        `Add-on ${addOnId} is not compatible with tier ${selectedTierId}`
      );
      continue;
    }

    // Check compatibility with other selected add-ons
    let isCompatible = true;
    for (const otherAddOnId of validAddOnIds) {
      if (!areAddOnsCompatible(addOnId, otherAddOnId)) {
        console.warn(
          `Add-on ${addOnId} is not compatible with ${otherAddOnId}`
        );
        isCompatible = false;
        break;
      }
    }

    if (!isCompatible) continue;

    validAddOnIds.push(addOnId);

    lineItems.push({
      id: addon.id,
      name: addon.name,
      type: 'addon',
      category: addon.category,
      oneTimeAmount: addon.oneTimePrice,
      monthlyAmount: addon.monthlyPrice,
    });
  }

  // Calculate totals
  const oneTimeCost = lineItems.reduce(
    (sum, item) => sum + item.oneTimeAmount,
    0
  );
  const monthlyCost = lineItems.reduce(
    (sum, item) => sum + item.monthlyAmount,
    0
  );

  // Year one total = one-time cost + (monthly cost * 12)
  const yearOneTotalCost = oneTimeCost + monthlyCost * 12;

  return {
    packageName: tier.name,
    packageCategory: tier.category,
    oneTimeCost,
    monthlyCost,
    yearOneTotalCost,
    lineItems,
    addOnCount: validAddOnIds.length,
    calculatedAt: new Date(),
  };
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate that a selection is valid before calculating
 * Returns an array of error messages (empty if valid)
 */
export function validateWebPricingInput(input: WebPricingInput): string[] {
  const errors: string[] = [];
  const { selectedTierId, selectedAddOnIds } = input;

  // Validate tier
  const tier = getTierById(selectedTierId);
  if (!tier) {
    errors.push(`Invalid package tier: ${selectedTierId}`);
    return errors; // Can't continue validation without valid tier
  }

  // Validate add-ons
  const validatedAddOnIds: string[] = [];

  for (const addOnId of selectedAddOnIds) {
    const addon = getAddOnById(addOnId);
    if (!addon) {
      errors.push(`Invalid add-on: ${addOnId}`);
      continue;
    }

    // Check tier compatibility
    if (!isAddOnCompatibleWithTier(addOnId, selectedTierId)) {
      errors.push(
        `"${addon.name}" is only available for specific packages and cannot be added to "${tier.name}"`
      );
      continue;
    }

    // Check compatibility with other add-ons
    for (const otherAddOnId of validatedAddOnIds) {
      if (!areAddOnsCompatible(addOnId, otherAddOnId)) {
        const otherAddon = getAddOnById(otherAddOnId);
        errors.push(
          `"${addon.name}" cannot be combined with "${otherAddon?.name}"`
        );
      }
    }

    validatedAddOnIds.push(addOnId);
  }

  return errors;
}

/**
 * Get incompatible add-ons for a given selection
 */
export function getIncompatibleAddOns(
  selectedTierId: string,
  selectedAddOnIds: string[]
): Set<string> {
  const incompatible = new Set<string>();

  // Import all add-ons to check against
  const { WEB_ADDON_FEATURES } = require('./pricing-configurations');

  for (const addon of WEB_ADDON_FEATURES) {
    // Check tier compatibility
    if (!isAddOnCompatibleWithTier(addon.id, selectedTierId)) {
      incompatible.add(addon.id);
      continue;
    }

    // Check compatibility with selected add-ons
    for (const selectedId of selectedAddOnIds) {
      if (!areAddOnsCompatible(addon.id, selectedId)) {
        incompatible.add(addon.id);
        break;
      }
    }
  }

  return incompatible;
}

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format monthly amount with "/mo" suffix
 */
export function formatMonthly(amount: number): string {
  if (amount === 0) return '$0';
  return `${formatCurrency(amount)}/mo`;
}

// ============================================================================
// EXPORTS
// ============================================================================

const webPricingCalculator = {
  calculateWebPricing,
  validateWebPricingInput,
  getIncompatibleAddOns,
  formatCurrency,
  formatMonthly,
};

export default webPricingCalculator;
