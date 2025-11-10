/**
 * Shared pricing calculation logic for CaterValley webhooks
 * Extracts common functionality to avoid code duplication
 */

import { calculateDistance, extractCity } from '@/lib/services/pricingService';
import { calculateDeliveryCost } from '@/lib/calculator/delivery-cost-calculator';
import { captureException, captureMessage } from '@/lib/monitoring/sentry';
import { getConfiguration } from '@/lib/calculator/client-configurations';

interface LocationData {
  address: string;
  city: string;
  state: string;
}

interface PricingCalculationInput {
  orderCode: string;
  pickupLocation: LocationData;
  dropOffLocation: LocationData;
  totalItem: number;
  priceTotal: number;
  feature: 'catervalley_webhook_draft' | 'catervalley_webhook_update';
}

interface PricingCalculationResult {
  distance: number;
  usedFallbackDistance: boolean;
  numberOfBridges: number;
  pricingResult: {
    deliveryFee: number;
    deliveryCost: number;
    totalMileagePay: number;
    dailyDriveDiscount: number;
    bridgeToll: number;
  };
}

const FALLBACK_DISTANCE_MILES = 10.1; // Conservative fallback: over 10-mile threshold

/**
 * Calculate pricing for a CaterValley order
 * Handles distance calculation, bridge toll detection, and pricing calculation
 *
 * @throws Error if pricing calculation results in zero delivery fee
 */
export async function calculateCaterValleyPricing(
  input: PricingCalculationInput
): Promise<PricingCalculationResult> {
  const {
    orderCode,
    pickupLocation,
    dropOffLocation,
    totalItem,
    priceTotal,
    feature
  } = input;

  // 1. Calculate distance between pickup and dropoff
  const pickupAddress = `${pickupLocation.address}, ${pickupLocation.city}, ${pickupLocation.state}`;
  const dropoffAddress = `${dropOffLocation.address}, ${dropOffLocation.city}, ${dropOffLocation.state}`;

  let distance: number;
  let usedFallbackDistance = false;

  try {
    distance = await calculateDistance(pickupAddress, dropoffAddress);
  } catch (error) {
    // Track distance calculation failure in Sentry for operational visibility
    captureException(error as Error, {
      action: 'calculate_distance',
      feature: feature,
      metadata: {
        orderCode: orderCode,
        pickupAddress: pickupAddress,
        dropoffAddress: dropoffAddress
      }
    });

    // Use conservative fallback distance (10.1 miles = over 10-mile threshold)
    distance = FALLBACK_DISTANCE_MILES;
    usedFallbackDistance = true;

    // Track fallback usage in Sentry (no console.warn for security)
    captureMessage(
      `Using fallback distance of ${distance} miles for CaterValley order ${orderCode}`,
      'warning',
      {
        action: 'fallback_distance_used',
        feature: feature,
        metadata: { orderCode: orderCode, fallbackDistance: distance }
      }
    );
  }

  // 2. Detect bridge toll requirement
  const pickupCity = extractCity(pickupAddress);
  const dropoffCity = extractCity(dropoffAddress);
  const caterValleyConfig = getConfiguration('cater-valley');

  // Check if route crosses bridge (both cities in autoApplyForAreas but different cities)
  let numberOfBridges = 0;
  if (caterValleyConfig?.bridgeTollSettings.autoApplyForAreas) {
    const tollAreas = caterValleyConfig.bridgeTollSettings.autoApplyForAreas;
    const pickupInTollArea = tollAreas.includes(pickupCity);
    const dropoffInTollArea = tollAreas.includes(dropoffCity);

    // If both are in toll areas and are different cities, bridge crossing likely
    if (pickupInTollArea && dropoffInTollArea && pickupCity !== dropoffCity) {
      numberOfBridges = 1;
    }
  }

  // 3. Calculate pricing using CaterValley configuration
  const pricingResult = calculateDeliveryCost({
    headcount: totalItem,
    foodCost: priceTotal,
    totalMileage: distance,
    numberOfDrives: 1, // CaterValley orders are standalone (no daily drive discounts)
    requiresBridge: numberOfBridges > 0,
    clientConfigId: 'cater-valley' // Use CaterValley-specific configuration
  });

  // 4. CRITICAL: Validate that pricing is not zero (prevent revenue loss)
  if (pricingResult.deliveryFee <= 0) {
    throw new Error('Pricing calculation error - delivery fee cannot be zero. Please contact support.');
  }

  return {
    distance,
    usedFallbackDistance,
    numberOfBridges,
    pricingResult
  };
}
