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
    maxPayPerDrop: number;
    basePayPerDrop: number;
    bonusPay: number;
    readySetFee: number;
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
    { headcountMin: 0, headcountMax: 24, foodCostMin: 0, foodCostMax: 299.99, regularRate: 60, within10Miles: 30 },
    { headcountMin: 25, headcountMax: 49, foodCostMin: 300, foodCostMax: 599.99, regularRate: 70, within10Miles: 40 },
    { headcountMin: 50, headcountMax: 74, foodCostMin: 600, foodCostMax: 899.99, regularRate: 90, within10Miles: 60 },
    { headcountMin: 75, headcountMax: 99, foodCostMin: 900, foodCostMax: 1199.99, regularRate: 100, within10Miles: 70 },
    { headcountMin: 100, headcountMax: 124, foodCostMin: 1200, foodCostMax: 1499.99, regularRate: 120, within10Miles: 80 },
    { headcountMin: 125, headcountMax: 149, foodCostMin: 1500, foodCostMax: 1699.99, regularRate: 150, within10Miles: 90 },
    { headcountMin: 150, headcountMax: 174, foodCostMin: 1700, foodCostMax: 1899.99, regularRate: 180, within10Miles: 100 },
    { headcountMin: 175, headcountMax: 199, foodCostMin: 1900, foodCostMax: 2099.99, regularRate: 210, within10Miles: 110 },
    { headcountMin: 200, headcountMax: 249, foodCostMin: 2100, foodCostMax: 2299.99, regularRate: 280, within10Miles: 120 },
    { headcountMin: 250, headcountMax: 299, foodCostMin: 2300, foodCostMax: 2499.99, regularRate: 310, within10Miles: 130 },
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
    basePayPerDrop: 23,
    bonusPay: 10,
    readySetFee: 70
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
    if (config.driverPaySettings.maxPayPerDrop < config.driverPaySettings.basePayPerDrop) {
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
