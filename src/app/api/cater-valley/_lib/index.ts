/**
 * CaterValley Shared Utilities
 * Re-exports all shared utilities for convenient importing
 */

// Authentication utilities
export { validateCaterValleyAuth } from './auth-utils';

// Address utilities
export { extractZipFromAddress, ensureAddress } from './address-utils';
export type { LocationData } from './address-utils';

// Order utilities
export {
  normalizeOrderNumber,
  ensureCaterValleySystemUser,
  isOrderEditable,
  isCaterValleyOrder,
} from './order-utils';

// Pricing utilities (already existed)
export { calculateCaterValleyPricing } from './pricing-helper';
export type { PricingCalculationResult } from './pricing-helper';
