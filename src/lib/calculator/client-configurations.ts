/**
 * Client Configuration System for Delivery Calculator
 * Allows different clients to have customized pricing rates and settings
 */

import { PricingTier } from './delivery-cost-calculator';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ClientDeliveryConfiguration {
  id: string;
  clientName: string;
  vendorName: string; // The vendor/partner name (e.g., "Destino")
  description?: string;
  isActive: boolean;

  // Pricing Settings
  pricingTiers: PricingTier[];
  mileageRate: number; // $/mile for miles over threshold
  distanceThreshold: number; // miles (typically 10)

  // Daily Drive Discounts
  dailyDriveDiscounts: {
    twoDrivers: number;
    threeDrivers: number;
    fourPlusDrivers: number;
  };

  // Driver Pay Settings
  driverPaySettings: {
    maxPayPerDrop: number | null; // null = no cap (CaterValley uses sum of components)
    basePayPerDrop: number; // Flat rate for clients like HY Food Company
    bonusPay: number;
    readySetFee: number;
    // Optional: Client-specific driver mileage rate (defaults to $0.35/mi if not set)
    driverMileageRate?: number;
    // Optional: Tiered driver base pay based on headcount (for Destino, Try Hungry)
    driverBasePayTiers?: Array<{
      headcountMin: number;
      headcountMax: number | null;
      basePay: number;
    }>;
    requiresManualReview?: boolean; // Flag for "case by case" scenarios
  };

  // Bridge Toll Settings
  bridgeTollSettings: {
    defaultTollAmount: number;
    autoApplyForAreas?: string[]; // Area names that automatically get bridge toll
  };

  // Custom Settings (flexible for future additions)
  customSettings?: Record<string, any>;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  notes?: string;
}

// ============================================================================
// PREDEFINED CLIENT CONFIGURATIONS
// ============================================================================

/**
 * Ready Set Food - Standard Configuration
 * Vendor: Destino
 * Based on pricing documents provided (Image 2)
 */
export const READY_SET_FOOD_STANDARD: ClientDeliveryConfiguration = {
  id: 'ready-set-food-standard',
  clientName: 'Ready Set Food - Standard',
  vendorName: 'Destino',
  description: 'Standard delivery pricing for Ready Set Food (vendor: Destino) with tiered compensation rules',
  isActive: true,

  pricingTiers: [
    // Flat fee pricing per PDF "Direct Client Pricing" - same rate regardless of distance
    // Mileage ($3/mi) only applies AFTER 10 miles
    { headcountMin: 0, headcountMax: 24, foodCostMin: 0, foodCostMax: 299.99, regularRate: 60, within10Miles: 60 },
    { headcountMin: 25, headcountMax: 49, foodCostMin: 300, foodCostMax: 599.99, regularRate: 70, within10Miles: 70 },
    { headcountMin: 50, headcountMax: 74, foodCostMin: 600, foodCostMax: 899.99, regularRate: 90, within10Miles: 90 },
    { headcountMin: 75, headcountMax: 99, foodCostMin: 900, foodCostMax: 1199.99, regularRate: 100, within10Miles: 100 },
    { headcountMin: 100, headcountMax: 124, foodCostMin: 1200, foodCostMax: 1499.99, regularRate: 120, within10Miles: 120 },
    { headcountMin: 125, headcountMax: 149, foodCostMin: 1500, foodCostMax: 1699.99, regularRate: 150, within10Miles: 150 },
    { headcountMin: 150, headcountMax: 174, foodCostMin: 1700, foodCostMax: 1899.99, regularRate: 180, within10Miles: 180 },
    { headcountMin: 175, headcountMax: 199, foodCostMin: 1900, foodCostMax: 2099.99, regularRate: 210, within10Miles: 210 },
    { headcountMin: 200, headcountMax: 249, foodCostMin: 2100, foodCostMax: 2299.99, regularRate: 280, within10Miles: 280 },
    { headcountMin: 250, headcountMax: 299, foodCostMin: 2300, foodCostMax: 2499.99, regularRate: 310, within10Miles: 310 },
    { headcountMin: 300, headcountMax: null, foodCostMin: 2500, foodCostMax: null, regularRate: 0, within10Miles: 0 }
  ],

  mileageRate: 3.0,
  distanceThreshold: 10,

  dailyDriveDiscounts: {
    twoDrivers: 5,
    threeDrivers: 10,
    fourPlusDrivers: 15
  },

  driverPaySettings: {
    maxPayPerDrop: 40,
    basePayPerDrop: 23, // Default fallback (not used when tiers are present)
    bonusPay: 10,
    readySetFee: 70,
    // Tiered driver base pay based on headcount (from REA-41 comments)
    driverBasePayTiers: [
      { headcountMin: 0, headcountMax: 24, basePay: 18 },
      { headcountMin: 25, headcountMax: 49, basePay: 23 },
      { headcountMin: 50, headcountMax: 74, basePay: 33 },
      { headcountMin: 75, headcountMax: 99, basePay: 43 },
      { headcountMin: 100, headcountMax: null, basePay: 53 }
    ]
  },

  bridgeTollSettings: {
    defaultTollAmount: 8.00,
    autoApplyForAreas: ['San Francisco', 'Oakland', 'Marin County']
  },

  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  notes: 'Standard Ready Set Food pricing based on official documents'
};

/**
 * Ready Set Food - Premium Configuration
 * Vendor: Destino
 * Higher rates for premium service (if needed)
 */
export const READY_SET_FOOD_PREMIUM: ClientDeliveryConfiguration = {
  id: 'ready-set-food-premium',
  clientName: 'Ready Set Food - Premium',
  vendorName: 'Destino',
  description: 'Premium delivery pricing with enhanced driver compensation',
  isActive: false, // Disabled by default - enable if this tier is needed

  pricingTiers: [
    { headcountMin: 0, headcountMax: 24, foodCostMin: 0, foodCostMax: 299.99, regularRate: 70, within10Miles: 40 },
    { headcountMin: 25, headcountMax: 49, foodCostMin: 300, foodCostMax: 599.99, regularRate: 85, within10Miles: 50 },
    { headcountMin: 50, headcountMax: 74, foodCostMin: 600, foodCostMax: 899.99, regularRate: 105, within10Miles: 70 },
    { headcountMin: 75, headcountMax: 99, foodCostMin: 900, foodCostMax: 1199.99, regularRate: 120, within10Miles: 85 },
    { headcountMin: 100, headcountMax: 124, foodCostMin: 1200, foodCostMax: 1499.99, regularRate: 140, within10Miles: 95 },
    { headcountMin: 125, headcountMax: 149, foodCostMin: 1500, foodCostMax: 1699.99, regularRate: 170, within10Miles: 105 },
    { headcountMin: 150, headcountMax: 174, foodCostMin: 1700, foodCostMax: 1899.99, regularRate: 200, within10Miles: 115 },
    { headcountMin: 175, headcountMax: 199, foodCostMin: 1900, foodCostMax: 2099.99, regularRate: 230, within10Miles: 125 },
    { headcountMin: 200, headcountMax: 249, foodCostMin: 2100, foodCostMax: 2299.99, regularRate: 300, within10Miles: 140 },
    { headcountMin: 250, headcountMax: 299, foodCostMin: 2300, foodCostMax: 2499.99, regularRate: 340, within10Miles: 150 },
    { headcountMin: 300, headcountMax: null, foodCostMin: 2500, foodCostMax: null, regularRate: 0, within10Miles: 0 }
  ],

  mileageRate: 3.5,
  distanceThreshold: 10,

  dailyDriveDiscounts: {
    twoDrivers: 7,
    threeDrivers: 12,
    fourPlusDrivers: 18
  },

  driverPaySettings: {
    maxPayPerDrop: 50,
    basePayPerDrop: 28,
    bonusPay: 15,
    readySetFee: 85
  },

  bridgeTollSettings: {
    defaultTollAmount: 10.00,
    autoApplyForAreas: ['San Francisco', 'Oakland', 'Marin County', 'Berkeley']
  },

  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  notes: 'Premium service with higher driver compensation and customer charges'
};

/**
 * Kasa Client Configuration
 * Based on "New Kasa Pricing" table (Image 3)
 * Has distinct pricing for within 10 miles vs beyond 10 miles
 */
export const KASA: ClientDeliveryConfiguration = {
  id: 'kasa',
  clientName: 'Kasa',
  vendorName: 'Kasa',
  description: 'Kasa delivery pricing with within/beyond 10 miles rate structure',
  isActive: true,

  pricingTiers: [
    // Based on "New Kasa Pricing" table from Image 3
    { headcountMin: 0, headcountMax: 24, foodCostMin: 0, foodCostMax: 300, regularRate: 60, within10Miles: 30 },
    { headcountMin: 25, headcountMax: 49, foodCostMin: 300, foodCostMax: 599.99, regularRate: 70, within10Miles: 40 },
    { headcountMin: 50, headcountMax: 74, foodCostMin: 600, foodCostMax: 899.99, regularRate: 90, within10Miles: 60 },
    { headcountMin: 75, headcountMax: 99, foodCostMin: 900, foodCostMax: 1199.99, regularRate: 100, within10Miles: 70 },
    { headcountMin: 100, headcountMax: 124, foodCostMin: 1200, foodCostMax: 1499.99, regularRate: 120, within10Miles: 80 },
    { headcountMin: 125, headcountMax: 149, foodCostMin: 1500, foodCostMax: 1799.99, regularRate: 140, within10Miles: 90 },
    { headcountMin: 150, headcountMax: 174, foodCostMin: 1800, foodCostMax: 2099.99, regularRate: 160, within10Miles: 100 },
    { headcountMin: 175, headcountMax: 199, foodCostMin: 2100, foodCostMax: 2399.99, regularRate: 180, within10Miles: 110 },
    { headcountMin: 200, headcountMax: 249, foodCostMin: 2400, foodCostMax: 2999.99, regularRate: 200, within10Miles: 120 },
    { headcountMin: 250, headcountMax: 299, foodCostMin: 3000, foodCostMax: 3499.99, regularRate: 220, within10Miles: 130 },
    { headcountMin: 300, headcountMax: null, foodCostMin: 3500, foodCostMax: null, regularRate: 0, within10Miles: 0 } // TBD
  ],

  mileageRate: 3.0,
  distanceThreshold: 10,

  dailyDriveDiscounts: {
    twoDrivers: 5,
    threeDrivers: 10,
    fourPlusDrivers: 15
  },

  driverPaySettings: {
    maxPayPerDrop: 98.69,
    basePayPerDrop: 63.00,
    bonusPay: 10,
    readySetFee: 135.00
  },

  bridgeTollSettings: {
    defaultTollAmount: 8.00,
    autoApplyForAreas: ['San Francisco', 'Oakland', 'Marin County']
  },

  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  notes: 'Kasa pricing based on New Kasa Pricing table (Image 3)'
};

/**
 * CaterValley Client Configuration
 * Vendor: CaterValley
 * Minimum delivery fee: $42.50 as per agreement between ReadySet and CaterValley
 */
export const CATER_VALLEY: ClientDeliveryConfiguration = {
  id: 'cater-valley',
  clientName: 'CaterValley',
  vendorName: 'CaterValley',
  description: 'CaterValley delivery pricing with $42.50 minimum delivery fee',
  isActive: true,

  pricingTiers: [
    // Tier 1: Small orders (≤25 headcount OR ≤$300 food cost)
    { headcountMin: 0, headcountMax: 25, foodCostMin: 0, foodCostMax: 300, regularRate: 85, within10Miles: 42.50 },
    // Tier 2: 26-49 headcount OR $300.01-599 food cost
    { headcountMin: 26, headcountMax: 49, foodCostMin: 300.01, foodCostMax: 599.99, regularRate: 90, within10Miles: 52.50 },
    // Tier 3: 50-74 headcount OR $600-899 food cost
    { headcountMin: 50, headcountMax: 74, foodCostMin: 600, foodCostMax: 899.99, regularRate: 110, within10Miles: 62.50 },
    // Tier 4: 75-99 headcount OR $900-1199 food cost
    { headcountMin: 75, headcountMax: 99, foodCostMin: 900, foodCostMax: 1199.99, regularRate: 120, within10Miles: 72.50 },
    // Tier 5: 100+ headcount OR $1200+ food cost (10% percentage-based pricing)
    { headcountMin: 100, headcountMax: null, foodCostMin: 1200, foodCostMax: null, regularRate: 0, within10Miles: 0, regularRatePercent: 0.10, within10MilesPercent: 0.10 }
  ],

  // CRITICAL: CaterValley mileage rate is $3.00 per mile after 10 miles
  // Applied to miles OVER the distanceThreshold (10 miles)
  // Per official Terms & Pricing Chart from CaterValley (see OFFICIAL_PRICING_CHART.md)
  mileageRate: 3.0,
  distanceThreshold: 10,

  dailyDriveDiscounts: {
    twoDrivers: 5,
    threeDrivers: 10,
    fourPlusDrivers: 15
  },

  driverPaySettings: {
    maxPayPerDrop: null, // CaterValley: No cap, driver pay is sum of components
    basePayPerDrop: 18, // $18 flat rate (confirmed from spreadsheet)
    bonusPay: 10,
    readySetFee: 70,
    driverMileageRate: 0.70 // $0.70/mile for ALL miles (CaterValley-specific)
  },

  bridgeTollSettings: {
    defaultTollAmount: 8.00,
    autoApplyForAreas: ['San Francisco', 'Oakland', 'Marin County']
  },

  createdAt: new Date('2025-11-10'),
  updatedAt: new Date('2026-01-14'),
  notes: 'CaterValley pricing: $42.50 minimum fee, $18 driver base, $0.70/mi driver mileage'
};

/**
 * Try Hungry Client Configuration
 * Vendor: Try Hungry
 * Custom mileage rate: $2.50 after 10 miles (lower than standard $3.00)
 * Orders with 100+ headcount require manual review ("case by case")
 */
export const TRY_HUNGRY: ClientDeliveryConfiguration = {
  id: 'try-hungry',
  clientName: 'Try Hungry',
  vendorName: 'Try Hungry',
  description: 'Try Hungry delivery pricing with custom $2.50 mileage rate and manual review for 100+ headcount',
  isActive: true,

  pricingTiers: [
    // Based on headcount since food cost is not typically shared by Try Hungry
    { headcountMin: 0, headcountMax: 24, foodCostMin: 0, foodCostMax: 299.99, regularRate: 40, within10Miles: 40 },
    { headcountMin: 25, headcountMax: 49, foodCostMin: 300, foodCostMax: 599.99, regularRate: 50, within10Miles: 50 },
    { headcountMin: 50, headcountMax: 74, foodCostMin: 600, foodCostMax: 899.99, regularRate: 60, within10Miles: 60 },
    { headcountMin: 75, headcountMax: 99, foodCostMin: 900, foodCostMax: 1199.99, regularRate: 70, within10Miles: 70 },
    // 100+ headcount requires manual review
    { headcountMin: 100, headcountMax: null, foodCostMin: 1200, foodCostMax: null, regularRate: 0, within10Miles: 0 }
  ],

  mileageRate: 2.5, // Custom rate: $2.50 per mile (lower than standard $3.00)
  distanceThreshold: 10,

  dailyDriveDiscounts: {
    twoDrivers: 5,
    threeDrivers: 10,
    fourPlusDrivers: 15
  },

  driverPaySettings: {
    maxPayPerDrop: 40,
    basePayPerDrop: 18, // Default fallback (not used when tiers are present)
    bonusPay: 10,
    readySetFee: 70,
    // Tiered driver base pay based on headcount
    driverBasePayTiers: [
      { headcountMin: 0, headcountMax: 24, basePay: 18 },
      { headcountMin: 25, headcountMax: 49, basePay: 23 },
      { headcountMin: 50, headcountMax: 74, basePay: 33 },
      { headcountMin: 75, headcountMax: 99, basePay: 43 },
      // 100+ requires manual review - will throw error in calculation
      { headcountMin: 100, headcountMax: null, basePay: 0 }
    ],
    requiresManualReview: true // Flag for 100+ headcount orders
  },

  bridgeTollSettings: {
    defaultTollAmount: 8.00,
    autoApplyForAreas: ['San Francisco', 'Oakland', 'Marin County']
  },

  createdAt: new Date('2025-11-12'),
  updatedAt: new Date('2025-11-12'),
  notes: 'Try Hungry pricing from REA-41 comments. Note: 100+ headcount requires manual review (case by case).'
};

/**
 * HY Food Company Direct Configuration
 * Vendor: HY Food Company
 * Flat $50 driver base pay (unique to this client)
 * Uses same Ready Set payment tiers as Destino
 */
export const HY_FOOD_COMPANY_DIRECT: ClientDeliveryConfiguration = {
  id: 'hy-food-company-direct',
  clientName: 'HY Food Company Direct',
  vendorName: 'HY Food Company',
  description: 'HY Food Company pricing with flat $50 driver base pay and Destino-style Ready Set payment tiers',
  isActive: true,

  pricingTiers: [
    // Same Ready Set payment tiers as Destino - flat fee pricing
    // Mileage ($3/mi) only applies AFTER 10 miles
    { headcountMin: 0, headcountMax: 24, foodCostMin: 0, foodCostMax: 299.99, regularRate: 60, within10Miles: 60 },
    { headcountMin: 25, headcountMax: 49, foodCostMin: 300, foodCostMax: 599.99, regularRate: 70, within10Miles: 70 },
    { headcountMin: 50, headcountMax: 74, foodCostMin: 600, foodCostMax: 899.99, regularRate: 90, within10Miles: 90 },
    { headcountMin: 75, headcountMax: 99, foodCostMin: 900, foodCostMax: 1199.99, regularRate: 100, within10Miles: 100 },
    { headcountMin: 100, headcountMax: 124, foodCostMin: 1200, foodCostMax: 1499.99, regularRate: 120, within10Miles: 120 },
    { headcountMin: 125, headcountMax: 149, foodCostMin: 1500, foodCostMax: 1699.99, regularRate: 150, within10Miles: 150 },
    { headcountMin: 150, headcountMax: 174, foodCostMin: 1700, foodCostMax: 1899.99, regularRate: 180, within10Miles: 180 },
    { headcountMin: 175, headcountMax: 199, foodCostMin: 1900, foodCostMax: 2099.99, regularRate: 210, within10Miles: 210 },
    { headcountMin: 200, headcountMax: 249, foodCostMin: 2100, foodCostMax: 2299.99, regularRate: 280, within10Miles: 280 },
    { headcountMin: 250, headcountMax: 299, foodCostMin: 2300, foodCostMax: 2499.99, regularRate: 310, within10Miles: 310 },
    { headcountMin: 300, headcountMax: null, foodCostMin: 2500, foodCostMax: null, regularRate: 0, within10Miles: 0 }
  ],

  mileageRate: 3.0,
  distanceThreshold: 10,

  dailyDriveDiscounts: {
    twoDrivers: 5,
    threeDrivers: 10,
    fourPlusDrivers: 15
  },

  driverPaySettings: {
    maxPayPerDrop: 50, // Cap enforced on base + mileage combined
    basePayPerDrop: 50, // Flat $50 base pay (unique to HY Food Company)
    bonusPay: 10,
    readySetFee: 70
    // No driverBasePayTiers - uses flat basePayPerDrop instead
    //
    // CRITICAL: maxPayPerDrop caps base + mileage at $50. With $50 base + any mileage,
    // the total base pay is capped at $50 (driver loses mileage compensation).
    // Bonus and bridge tolls are added AFTER the cap and are not subject to it.
    //
    // See docs/BUSINESS_RULES.md for detailed explanation and examples.
  },

  bridgeTollSettings: {
    defaultTollAmount: 8.00,
    autoApplyForAreas: ['San Francisco', 'Oakland', 'Marin County']
  },

  createdAt: new Date('2025-11-12'),
  updatedAt: new Date('2025-11-12'),
  notes: 'HY Food Company Direct pricing from REA-41 comments. Unique $50 flat driver base pay.'
};

/**
 * Generic Template - Customizable base configuration
 */
export const GENERIC_TEMPLATE: ClientDeliveryConfiguration = {
  id: 'generic-template',
  clientName: 'Generic Template',
  vendorName: 'Generic Vendor',
  description: 'Customizable base configuration for new clients',
  isActive: false,

  pricingTiers: [
    { headcountMin: 0, headcountMax: 24, foodCostMin: 0, foodCostMax: 299.99, regularRate: 50, within10Miles: 25 },
    { headcountMin: 25, headcountMax: 49, foodCostMin: 300, foodCostMax: 599.99, regularRate: 60, within10Miles: 35 },
    { headcountMin: 50, headcountMax: 74, foodCostMin: 600, foodCostMax: 899.99, regularRate: 75, within10Miles: 45 },
    { headcountMin: 75, headcountMax: 99, foodCostMin: 900, foodCostMax: 1199.99, regularRate: 90, within10Miles: 55 },
    { headcountMin: 100, headcountMax: null, foodCostMin: 1200, foodCostMax: null, regularRate: 110, within10Miles: 65 }
  ],

  mileageRate: 2.5,
  distanceThreshold: 10,

  dailyDriveDiscounts: {
    twoDrivers: 5,
    threeDrivers: 10,
    fourPlusDrivers: 15
  },

  driverPaySettings: {
    maxPayPerDrop: 35,
    basePayPerDrop: 20,
    bonusPay: 8,
    readySetFee: 60
  },

  bridgeTollSettings: {
    defaultTollAmount: 7.00
  },

  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  notes: 'Base template for creating custom client configurations'
};

// ============================================================================
// CONFIGURATION REGISTRY
// ============================================================================

export const CLIENT_CONFIGURATIONS: Record<string, ClientDeliveryConfiguration> = {
  'ready-set-food-standard': READY_SET_FOOD_STANDARD,
  'ready-set-food-premium': READY_SET_FOOD_PREMIUM,
  'kasa': KASA,
  'cater-valley': CATER_VALLEY,
  'try-hungry': TRY_HUNGRY,
  'hy-food-company-direct': HY_FOOD_COMPANY_DIRECT,
  'generic-template': GENERIC_TEMPLATE
};

// ============================================================================
// CONFIGURATION MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Get configuration by ID
 */
export function getConfiguration(configId: string): ClientDeliveryConfiguration | null {
  return CLIENT_CONFIGURATIONS[configId] || null;
}

/**
 * Get all active configurations
 */
export function getActiveConfigurations(): ClientDeliveryConfiguration[] {
  return Object.values(CLIENT_CONFIGURATIONS).filter(config => config.isActive);
}

/**
 * Create a new configuration from template
 */
export function createConfigurationFromTemplate(
  templateId: string,
  overrides: Partial<ClientDeliveryConfiguration>
): ClientDeliveryConfiguration {
  const template = getConfiguration(templateId);

  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  return {
    ...template,
    ...overrides,
    id: overrides.id || `custom-${Date.now()}`,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

/**
 * Validate configuration
 */
export function validateConfiguration(config: ClientDeliveryConfiguration): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate basic fields
  if (!config.clientName || config.clientName.trim() === '') {
    errors.push('Client name is required');
  }

  if (!config.vendorName || config.vendorName.trim() === '') {
    errors.push('Vendor name is required');
  }

  if (!config.pricingTiers || config.pricingTiers.length === 0) {
    errors.push('At least one pricing tier is required');
  }

  if (config.mileageRate < 0) {
    errors.push('Mileage rate cannot be negative');
  }

  if (config.distanceThreshold < 0) {
    errors.push('Distance threshold cannot be negative');
  }

  // Validate pricing tiers
  if (config.pricingTiers) {
    config.pricingTiers.forEach((tier, index) => {
      if (tier.headcountMin < 0) {
        errors.push(`Tier ${index + 1}: Headcount min cannot be negative`);
      }
      if (tier.foodCostMin < 0) {
        errors.push(`Tier ${index + 1}: Food cost min cannot be negative`);
      }
      if (tier.regularRate < 0) {
        errors.push(`Tier ${index + 1}: Regular rate cannot be negative`);
      }
      if (tier.within10Miles < 0) {
        errors.push(`Tier ${index + 1}: Within 10 miles rate cannot be negative`);
      }
    });
  }

  // Validate driver pay settings
  if (config.driverPaySettings) {
    // Only validate maxPayPerDrop if it's set (not null means there's a cap)
    if (config.driverPaySettings.maxPayPerDrop !== null &&
        config.driverPaySettings.maxPayPerDrop < config.driverPaySettings.basePayPerDrop) {
      errors.push('Max pay per drop must be greater than or equal to base pay per drop');
    }
    if (config.driverPaySettings.bonusPay < 0) {
      errors.push('Bonus pay cannot be negative');
    }
    if (config.driverPaySettings.readySetFee < 0) {
      errors.push('Ready Set fee cannot be negative');
    }
  }

  // Validate daily drive discounts
  if (config.dailyDriveDiscounts) {
    if (config.dailyDriveDiscounts.twoDrivers < 0 ||
        config.dailyDriveDiscounts.threeDrivers < 0 ||
        config.dailyDriveDiscounts.fourPlusDrivers < 0) {
      errors.push('Daily drive discounts cannot be negative');
    }
  }

  // Validate driver base pay tiers for gaps and overlaps
  if (config.driverPaySettings?.driverBasePayTiers && config.driverPaySettings.driverBasePayTiers.length > 1) {
    const tiers = config.driverPaySettings.driverBasePayTiers;

    // Sort tiers by headcountMin for validation
    const sortedTiers = [...tiers].sort((a, b) => a.headcountMin - b.headcountMin);

    for (let i = 0; i < sortedTiers.length - 1; i++) {
      const currentTier = sortedTiers[i];
      const nextTier = sortedTiers[i + 1];

      // TypeScript null checks
      if (!currentTier || !nextTier) continue;

      // Check for gaps (current max + 1 should equal next min)
      if (currentTier.headcountMax !== null && nextTier.headcountMin > currentTier.headcountMax + 1) {
        errors.push(
          `Driver base pay tier gap detected: Tier ending at ${currentTier.headcountMax} ` +
          `followed by tier starting at ${nextTier.headcountMin}. ` +
          `Headcount ${currentTier.headcountMax + 1} to ${nextTier.headcountMin - 1} has no tier.`
        );
      }

      // Check for overlaps (current max should be < next min)
      if (currentTier.headcountMax !== null && currentTier.headcountMax >= nextTier.headcountMin) {
        errors.push(
          `Driver base pay tier overlap detected: Tier ${i + 1} (${currentTier.headcountMin}-${currentTier.headcountMax}) ` +
          `overlaps with Tier ${i + 2} (${nextTier.headcountMin}-${nextTier.headcountMax || 'null'})`
        );
      }

      // Validate that only the last tier can have null headcountMax
      if (currentTier.headcountMax === null && i < sortedTiers.length - 1) {
        errors.push(
          `Invalid tier configuration: Only the last tier can have null headcountMax. ` +
          `Tier ${i + 1} has null max but is not the last tier.`
        );
      }
    }

    // Validate basePay values
    sortedTiers.forEach((tier, index) => {
      if (tier.basePay < 0) {
        errors.push(`Driver base pay tier ${index + 1}: basePay cannot be negative`);
      }

      // Warn if basePay is 0 and requiresManualReview is not set
      if (tier.basePay === 0 && !config.driverPaySettings?.requiresManualReview) {
        errors.push(
          `Driver base pay tier ${index + 1}: basePay is 0 but requiresManualReview is not enabled. ` +
          `This may cause runtime errors.`
        );
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Export configuration to JSON
 */
export function exportConfiguration(config: ClientDeliveryConfiguration): string {
  return JSON.stringify(config, null, 2);
}

/**
 * Import configuration from JSON
 */
export function importConfiguration(json: string): ClientDeliveryConfiguration {
  try {
    const config = JSON.parse(json) as ClientDeliveryConfiguration;

    // Convert date strings back to Date objects
    config.createdAt = new Date(config.createdAt);
    config.updatedAt = new Date(config.updatedAt);

    // Validate imported configuration
    const validation = validateConfiguration(config);
    if (!validation.valid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }

    return config;
  } catch (error) {
    throw new Error(`Failed to import configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ============================================================================
// HELPER FUNCTIONS FOR UI
// ============================================================================

/**
 * Get configuration options for dropdown/select
 */
export function getConfigurationOptions(): Array<{ value: string; label: string; description?: string }> {
  return getActiveConfigurations().map(config => ({
    value: config.id,
    label: config.clientName,
    description: config.description
  }));
}

/**
 * Clone configuration with new ID
 */
export function cloneConfiguration(
  configId: string,
  newName: string
): ClientDeliveryConfiguration {
  const original = getConfiguration(configId);

  if (!original) {
    throw new Error(`Configuration not found: ${configId}`);
  }

  return {
    ...original,
    id: `${configId}-clone-${Date.now()}`,
    clientName: newName,
    createdAt: new Date(),
    updatedAt: new Date(),
    notes: `Cloned from ${original.clientName}`
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

const clientConfigurations = {
  // Configurations
  READY_SET_FOOD_STANDARD,
  READY_SET_FOOD_PREMIUM,
  KASA,
  CATER_VALLEY,
  TRY_HUNGRY,
  HY_FOOD_COMPANY_DIRECT,
  GENERIC_TEMPLATE,
  CLIENT_CONFIGURATIONS,

  // Functions
  getConfiguration,
  getActiveConfigurations,
  createConfigurationFromTemplate,
  validateConfiguration,
  exportConfiguration,
  importConfiguration,
  getConfigurationOptions,
  cloneConfiguration
};

export default clientConfigurations;
