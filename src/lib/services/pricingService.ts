/**
 * Pricing Service for calculating delivery costs
 * Based on Ready Set LLC pricing structure for CaterValley integration
 */

interface PricingParams {
  pickupAddress: string;
  dropoffAddress: string;
  itemCount: number;
  orderTotal: number;
  deliveryDate?: string;
  deliveryTime?: string;
}

interface PricingResult {
  deliveryPrice: number;
  breakdown: {
    basePrice: number;
    itemCountMultiplier?: number;
    orderTotalMultiplier?: number;
    distanceMultiplier?: number;
    peakTimeMultiplier?: number;
  };
}

// Base pricing structure from meeting notes
const PRICING_CONFIG = {
  BASE_PRICE: 42.5,
  PRICE_OVER_25_ITEMS: 50,
  PRICE_OVER_300_TOTAL: 55,
  PEAK_TIME_MULTIPLIER: 1.15, // 15% increase during peak hours
  DISTANCE_BASE_MILES: 15, // Base distance included in price
  DISTANCE_PER_ADDITIONAL_MILE: 2.5,
  WEEKEND_MULTIPLIER: 1.1, // 10% increase for weekend deliveries
};

/**
 * Calculates the delivery price based on order parameters
 */
export async function calculateDeliveryPrice(params: PricingParams): Promise<PricingResult> {
  const breakdown = {
    basePrice: PRICING_CONFIG.BASE_PRICE,
  } as PricingResult['breakdown'];

  let finalPrice = PRICING_CONFIG.BASE_PRICE;

  // Apply item count pricing
  if (params.itemCount > 25) {
    finalPrice = PRICING_CONFIG.PRICE_OVER_25_ITEMS;
    breakdown.basePrice = PRICING_CONFIG.PRICE_OVER_25_ITEMS;
    breakdown.itemCountMultiplier = params.itemCount / 25;
  }

  // Apply order total pricing (takes precedence if higher)
  if (params.orderTotal > 300) {
    const orderTotalPrice = PRICING_CONFIG.PRICE_OVER_300_TOTAL;
    if (orderTotalPrice > finalPrice) {
      finalPrice = orderTotalPrice;
      breakdown.basePrice = orderTotalPrice;
      breakdown.orderTotalMultiplier = params.orderTotal / 300;
    }
  }

  // Calculate distance multiplier (if we have a distance calculation service)
  try {
    const distance = await calculateDistance(params.pickupAddress, params.dropoffAddress);
    if (distance > PRICING_CONFIG.DISTANCE_BASE_MILES) {
      const additionalMiles = distance - PRICING_CONFIG.DISTANCE_BASE_MILES;
      const distanceCharge = additionalMiles * PRICING_CONFIG.DISTANCE_PER_ADDITIONAL_MILE;
      finalPrice += distanceCharge;
      breakdown.distanceMultiplier = distance / PRICING_CONFIG.DISTANCE_BASE_MILES;
    }
  } catch (error) {
    console.warn('Could not calculate distance for pricing:', error);
    // Continue with base pricing if distance calculation fails
  }

  // Apply time-based multipliers
  if (params.deliveryDate && params.deliveryTime) {
    const deliveryDateTime = new Date(`${params.deliveryDate}T${params.deliveryTime}`);
    
    // Weekend multiplier
    const dayOfWeek = deliveryDateTime.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday or Saturday
      finalPrice *= PRICING_CONFIG.WEEKEND_MULTIPLIER;
      breakdown.peakTimeMultiplier = PRICING_CONFIG.WEEKEND_MULTIPLIER;
    }

    // Peak hours multiplier (11:30 AM - 1:30 PM and 5:30 PM - 7:30 PM)
    const hour = deliveryDateTime.getHours();
    const minute = deliveryDateTime.getMinutes();
    const totalMinutes = hour * 60 + minute;
    
    const lunchStart = 11 * 60 + 30; // 11:30 AM
    const lunchEnd = 13 * 60 + 30;   // 1:30 PM
    const dinnerStart = 17 * 60 + 30; // 5:30 PM
    const dinnerEnd = 19 * 60 + 30;   // 7:30 PM

    if ((totalMinutes >= lunchStart && totalMinutes <= lunchEnd) ||
        (totalMinutes >= dinnerStart && totalMinutes <= dinnerEnd)) {
      finalPrice *= PRICING_CONFIG.PEAK_TIME_MULTIPLIER;
      breakdown.peakTimeMultiplier = (breakdown.peakTimeMultiplier || 1) * PRICING_CONFIG.PEAK_TIME_MULTIPLIER;
    }
  }

  // Round to 2 decimal places
  finalPrice = Math.round(finalPrice * 100) / 100;

  return {
    deliveryPrice: finalPrice,
    breakdown,
  };
}

/**
 * Calculate distance between two addresses
 * This is a placeholder implementation - in production, you'd use Google Maps API
 */
async function calculateDistance(pickupAddress: string, dropoffAddress: string): Promise<number> {
  // Placeholder implementation - returns a mock distance
  // In production, integrate with Google Maps Distance Matrix API
  
  // Simple estimation based on address similarity (mock logic)
  const pickup = pickupAddress.toLowerCase();
  const dropoff = dropoffAddress.toLowerCase();
  
  // Extract city information for basic distance estimation
  const pickupCity = extractCity(pickup);
  const dropoffCity = extractCity(dropoff);
  
  if (pickupCity === dropoffCity) {
    return 8; // Same city - average 8 miles
  }
  
  // Different cities - estimate 20+ miles
  return 22;
}

/**
 * Extract city from address string (simple implementation)
 */
function extractCity(address: string): string {
  // This is a simplified implementation
  // In production, you'd use proper address parsing
  const parts = address.split(',');
  if (parts.length >= 2 && parts[1]) {
    return parts[1].trim();
  }
  return '';
}

/**
 * Get estimated pickup time based on delivery time
 */
export function calculatePickupTime(deliveryDate: string, deliveryTime: string, bufferMinutes: number = 30): string {
  const deliveryDateTime = new Date(`${deliveryDate}T${deliveryTime}`);
  const pickupDateTime = new Date(deliveryDateTime.getTime() - bufferMinutes * 60 * 1000);
  return pickupDateTime.toISOString();
}

/**
 * Validate if a delivery time slot is available
 */
export function isDeliveryTimeAvailable(deliveryDate: string, deliveryTime: string): boolean {
  const deliveryDateTime = new Date(`${deliveryDate}T${deliveryTime}`);
  const now = new Date();
  
  // Must be at least 2 hours in advance
  const minAdvanceTime = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  
  if (deliveryDateTime < minAdvanceTime) {
    return false;
  }
  
  // Check business hours (7 AM - 10 PM)
  const hour = deliveryDateTime.getHours();
  if (hour < 7 || hour > 22) {
    return false;
  }
  
  return true;
} 