/**
 * Partner Order API shared utilities.
 *
 * Path retained as `cater-valley/_lib` for git history continuity, but
 * the helpers are partner-agnostic — `/api/partners/*` and
 * `/api/cater-valley/*` both import from here.
 */

// Authentication utilities
export {
  validateCaterValleyAuth,
  authenticatePartnerRequest,
  type ResolvedPartner,
} from './auth-utils';

// Address utilities
export { extractZipFromAddress, ensureAddress } from './address-utils';
export type { LocationData } from './address-utils';

// Order utilities — partner-aware
export {
  buildOrderNumber,
  buildOrderGuid,
  ensurePartnerSystemUser,
  isPartnerOrder,
  partnerSystemUserEmail,
  isOrderEditable,
  // Legacy wrappers (CaterValley-pinned) kept for backward compat:
  normalizeOrderNumber,
  ensureCaterValleySystemUser,
  isCaterValleyOrder,
} from './order-utils';

// Pricing utilities (already existed)
export { calculateCaterValleyPricing } from './pricing-helper';
export type { PricingCalculationResult } from './pricing-helper';
