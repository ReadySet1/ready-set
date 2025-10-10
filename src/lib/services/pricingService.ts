/**
 * Updated Pricing Service for CaterValley Integration
 * Implements the new distance-based and head count-based pricing structure
 * URGENT: Updated to address financial losses on deliveries
 */
import { localTimeToUtc, utcToLocalTime } from '@/lib/utils/timezone';
interface PricingParams {
    pickupAddress: string;
    dropoffAddress: string;
    headCount: number;
    foodCost: number;
    deliveryDate?: string;
    deliveryTime?: string;
    includeTip?: boolean; // New field to handle tip vs no-tip pricing
}
interface PricingResult {
    deliveryPrice: number;
    distance: number;
    tier: string;
    breakdown: {
        basePrice: number;
        distanceTier: string;
        headCountTier: string;
        foodCostTier: string;
        tipIncluded: boolean;
        calculation: string;
    };
}
// Updated pricing structure based on new CaterValley requirements
const PRICING_TIERS = {
    // Standard Delivery (0-10 miles)
    STANDARD: {
        tier1: { headCount: 25, foodCost: 300, withTip: 35.00, withoutTip: 42.50 },
        tier2: { headCount: 49, foodCost: 599, withTip: 45.00, withoutTip: 52.50 },
        tier3: { headCount: 74, foodCost: 899, withTip: 55.00, withoutTip: 62.50 },
        tier4: { headCount: 99, foodCost: 1199, withTip: 65.00, withoutTip: 72.50 },
        tier5: { headCount: 100, foodCost: 1200, withTipPercent: 0.09, withoutTipPercent: 0.10 }
    },
    // Over 10 Miles Delivery (example: >25 headcount = $71.59 with tip)
    OVER_10_MILES: {
        tier1: { headCount: 25, foodCost: 300, withTip: 71.59, withoutTip: 85.00 },
        tier2: { headCount: 49, foodCost: 599, withTip: 90.00, withoutTip: 105.00 },
        tier3: { headCount: 74, foodCost: 899, withTip: 110.00, withoutTip: 125.00 },
        tier4: { headCount: 99, foodCost: 1199, withTip: 130.00, withoutTip: 145.00 },
        tier5: { headCount: 100, foodCost: 1200, withTipPercent: 0.18, withoutTipPercent: 0.20 }
    },
    // Over 30 Miles Delivery (example: >25 headcount = $75.00 delivery fee)
    OVER_30_MILES: {
        tier1: { headCount: 25, foodCost: 300, withTip: 75.00, withoutTip: 90.00 },
        tier2: { headCount: 49, foodCost: 599, withTip: 95.00, withoutTip: 110.00 },
        tier3: { headCount: 74, foodCost: 899, withTip: 115.00, withoutTip: 130.00 },
        tier4: { headCount: 99, foodCost: 1199, withTip: 135.00, withoutTip: 150.00 },
        tier5: { headCount: 100, foodCost: 1200, withTipPercent: 0.20, withoutTipPercent: 0.22 }
    }
};
/**
 * Calculates the delivery price based on new CaterValley pricing structure
 */
export async function calculateDeliveryPrice(params: PricingParams): Promise<PricingResult> {
    try {
        // 1. Calculate actual distance between addresses
        const distance = await calculateDistance(params.pickupAddress, params.dropoffAddress);
        // 2. Determine distance tier
        let distanceTier: 'STANDARD' | 'OVER_10_MILES' | 'OVER_30_MILES';
        let tierName: string;
        if (distance <= 10) {
            distanceTier = 'STANDARD';
            tierName = 'Standard Delivery (0-10 miles)';
        }
        else if (distance <= 30) {
            distanceTier = 'OVER_10_MILES';
            tierName = 'Over 10 Miles Delivery';
        }
        else {
            distanceTier = 'OVER_30_MILES';
            tierName = 'Over 30 Miles Delivery';
        }
        // 3. Get pricing tier configuration
        const pricingTier = PRICING_TIERS[distanceTier];
        // 4. Determine which tier to use based on head count and food cost
        let selectedTier;
        let tierDescription;
        if (params.headCount >= 100 || params.foodCost >= 1200) {
            selectedTier = pricingTier.tier5;
            tierDescription = '100+ headcount or $1200+ food cost';
        }
        else if (params.headCount >= 75 || params.foodCost >= 900) {
            selectedTier = pricingTier.tier4;
            tierDescription = '75-99 headcount or $900-$1199 food cost';
        }
        else if (params.headCount >= 50 || params.foodCost >= 600) {
            selectedTier = pricingTier.tier3;
            tierDescription = '50-74 headcount or $600-$899 food cost';
        }
        else if (params.headCount >= 25 || params.foodCost >= 300) {
            selectedTier = pricingTier.tier2;
            tierDescription = '25-49 headcount or $300-$599 food cost';
        }
        else {
            selectedTier = pricingTier.tier1;
            tierDescription = '>25 headcount or >$300 food cost';
        }
        // 5. Calculate final price
        let finalPrice: number;
        let calculation: string;
        const includeTip = params.includeTip ?? true; // Default to including tip
        if ('withTipPercent' in selectedTier) {
            // For 100+ headcount, use percentage-based pricing
            const percentage = includeTip ? selectedTier.withTipPercent : selectedTier.withoutTipPercent;
            finalPrice = params.foodCost * percentage;
            calculation = `${params.foodCost} × ${(percentage * 100).toFixed(1)}% = ${finalPrice.toFixed(2)}`;
        }
        else {
            // For fixed pricing tiers
            finalPrice = includeTip ? selectedTier.withTip : selectedTier.withoutTip;
            calculation = `Fixed rate: $${finalPrice.toFixed(2)} (${includeTip ? 'with tip' : 'without tip'})`;
        }
        // 6. Round to 2 decimal places
        finalPrice = Math.round(finalPrice * 100) / 100;
        return {
            deliveryPrice: finalPrice,
            distance,
            tier: tierName,
            breakdown: {
                basePrice: finalPrice,
                distanceTier: tierName,
                headCountTier: tierDescription,
                foodCostTier: `$${params.foodCost}`,
                tipIncluded: includeTip,
                calculation
            }
        };
    }
    catch (error) {
        console.error('Error calculating delivery price:', error);
        // Fallback to basic pricing
        return {
            deliveryPrice: 42.50,
            distance: 0,
            tier: 'Standard (fallback)',
            breakdown: {
                basePrice: 42.50,
                distanceTier: 'Unable to calculate distance',
                headCountTier: 'Fallback pricing',
                foodCostTier: `$${params.foodCost}`,
                tipIncluded: params.includeTip ?? true,
                calculation: 'Fallback rate due to calculation error'
            }
        };
    }
}
/**
 * Calculate actual distance between two addresses using Google Maps API
 * This replaces the mock implementation with real distance calculation
 */
async function calculateDistance(pickupAddress: string, dropoffAddress: string): Promise<number> {
    const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
    if (!GOOGLE_MAPS_API_KEY) {
        console.warn('Google Maps API key not configured. Using estimated distance.');
        return estimateDistance(pickupAddress, dropoffAddress);
    }
    try {
        const origins = encodeURIComponent(pickupAddress);
        const destinations = encodeURIComponent(dropoffAddress);
        const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origins}&destinations=${destinations}&units=imperial&key=${GOOGLE_MAPS_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.status === 'OK' && data.rows[0]?.elements[0]?.status === 'OK') {
            const distanceText = data.rows[0].elements[0].distance.text;
            const distanceValue = data.rows[0].elements[0].distance.value; // in meters
            // Convert meters to miles
            const miles = (distanceValue * 0.000621371);
            return Math.round(miles * 100) / 100; // Round to 2 decimal places
        }
        else {
            console.warn('Google Maps API returned error:', data.error_message || data.status);
            return estimateDistance(pickupAddress, dropoffAddress);
        }
    }
    catch (error) {
        console.error('Error calling Google Maps API:', error);
        return estimateDistance(pickupAddress, dropoffAddress);
    }
}
/**
 * Fallback distance estimation when Google Maps API is unavailable
 */
function estimateDistance(pickupAddress: string, dropoffAddress: string): number {
    const pickup = pickupAddress.toLowerCase();
    const dropoff = dropoffAddress.toLowerCase();
    // Extract city information for basic distance estimation
    const pickupCity = extractCity(pickup);
    const dropoffCity = extractCity(dropoff);
    if (pickupCity === dropoffCity) {
        return 8; // Same city - average 8 miles
    }
    // Different cities - estimate based on known city distances
    const cityDistances: Record<string, Record<string, number>> = {
        'san francisco': {
            'oakland': 12,
            'san jose': 45,
            'palo alto': 35,
            'fremont': 35,
            'hayward': 30,
            'concord': 28,
            'richmond': 20
        },
        'oakland': {
            'san francisco': 12,
            'san jose': 40,
            'palo alto': 30,
            'fremont': 20,
            'hayward': 15,
            'concord': 25,
            'richmond': 15
        },
        // Add more city pairs as needed
    };
    const distance = cityDistances[pickupCity]?.[dropoffCity] || cityDistances[dropoffCity]?.[pickupCity];
    if (distance) {
        return distance;
    }
    // Default estimate for unknown city pairs
    return 25;
}
/**
 * Extract city from address string (improved implementation)
 */
function extractCity(address: string): string {
    const parts = address.split(',');
    if (parts.length >= 2 && parts[1]) {
        return parts[1].trim().toLowerCase();
    }
    // Try to extract city from end of address
    const addressParts = address.trim().split(/\s+/);
    const cityKeywords = ['san francisco', 'sf', 'oakland', 'san jose', 'palo alto', 'fremont', 'hayward', 'concord', 'richmond'];
    for (const keyword of cityKeywords) {
        if (address.includes(keyword)) {
            return keyword;
        }
    }
    return '';
}
/**
 * Get estimated pickup time based on delivery time
 * Now properly converts local time to UTC
 */
export function calculatePickupTime(deliveryDate: string, deliveryTime: string, bufferMinutes: number = 45): string {
    // Convert local delivery time to UTC
    const deliveryDateTimeUtc = localTimeToUtc(deliveryDate, deliveryTime);
    const deliveryDateTime = new Date(deliveryDateTimeUtc);
    // Calculate pickup time (subtract buffer)
    const pickupDateTime = new Date(deliveryDateTime.getTime() - bufferMinutes * 60 * 1000);
    // Return as UTC ISO string
    return pickupDateTime.toISOString();
}
/**
 * Validate if a delivery time slot is available
 * Updated to handle timezone properly
 */
export function isDeliveryTimeAvailable(deliveryDate: string, deliveryTime: string): boolean {
    // Convert local delivery time to UTC for comparison
    const deliveryDateTimeUtc = localTimeToUtc(deliveryDate, deliveryTime);
    const deliveryDateTime = new Date(deliveryDateTimeUtc);
    const now = new Date();
    // Must be at least 2 hours in advance
    const minAdvanceTime = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    if (deliveryDateTime <= minAdvanceTime) {
        return false;
    }
    // Check business hours (7 AM - 10 PM in local time)
    const { time } = utcToLocalTime(deliveryDateTime);
    const timeParts = time.split(':');
    const hoursStr = timeParts[0];
    if (!hoursStr) {
        return false; // Invalid time format
    }
    const hours = parseInt(hoursStr, 10);
    if (isNaN(hours)) {
        return false; // Invalid time format
    }
    return hours >= 7 && hours < 22;
}
