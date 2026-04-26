/**
 * Unit Tests for Vendor Pricing Zod Schema
 *
 * Tests cover:
 * - Valid configuration parsing
 * - Required field validation
 * - Number constraints (min, max)
 * - Complex nested structure validation
 * - Edge cases
 */

import { VendorPricingSchema, VendorPricingFormData } from '../vendor-pricing';

// Helper: create a valid config object
function createValidConfig(): VendorPricingFormData {
  return {
    id: 'test-config',
    clientName: 'Test Client',
    vendorName: 'Test Vendor',
    description: 'A test configuration',
    isActive: true,
    pricingTiers: [
      {
        headcountMin: 1,
        headcountMax: 25,
        foodCostMin: 0,
        foodCostMax: null,
        regularRate: 79,
        within10Miles: 69,
      },
    ],
    mileageRate: 2.5,
    distanceThreshold: 10,
    dailyDriveDiscounts: {
      twoDrivers: 10,
      threeDrivers: 15,
      fourPlusDrivers: 20,
    },
    driverPaySettings: {
      maxPayPerDrop: 65,
      basePayPerDrop: 25,
      bonusPay: 5,
      readySetFee: 10,
    },
    bridgeTollSettings: {
      defaultTollAmount: 7,
      autoApplyForAreas: ['San Francisco'],
    },
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  };
}

describe('VendorPricingSchema', () => {
  describe('Valid Configurations', () => {
    it('should accept a valid configuration', () => {
      const config = createValidConfig();
      const result = VendorPricingSchema.safeParse(config);

      expect(result.success).toBe(true);
    });

    it('should accept configuration with optional fields omitted', () => {
      const config = createValidConfig();
      delete (config as any).description;
      delete (config as any).zeroOrderSettings;
      delete (config as any).customSettings;
      delete (config as any).createdBy;
      delete (config as any).notes;

      const result = VendorPricingSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should accept configuration with zero order settings', () => {
      const config = createValidConfig();
      (config as any).zeroOrderSettings = {
        enabled: true,
        readySetFee: 15,
        customerDeliveryFee: 15,
        driverBasePay: 20,
        driverMileagePay: 7,
        driverBonusPay: 5,
      };

      const result = VendorPricingSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should coerce date strings to Date objects', () => {
      const config = {
        ...createValidConfig(),
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      };

      const result = VendorPricingSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.createdAt).toBeInstanceOf(Date);
        expect(result.data.updatedAt).toBeInstanceOf(Date);
      }
    });

    it('should accept null maxPayPerDrop (no cap)', () => {
      const config = createValidConfig();
      config.driverPaySettings.maxPayPerDrop = null;

      const result = VendorPricingSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should accept multiple pricing tiers', () => {
      const config = createValidConfig();
      config.pricingTiers = [
        { headcountMin: 1, headcountMax: 25, foodCostMin: 0, foodCostMax: null, regularRate: 79, within10Miles: 69 },
        { headcountMin: 26, headcountMax: 50, foodCostMin: 0, foodCostMax: null, regularRate: 89, within10Miles: 79 },
        { headcountMin: 51, headcountMax: null, foodCostMin: 0, foodCostMax: null, regularRate: 99, within10Miles: 89 },
      ];

      const result = VendorPricingSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });

  describe('Required Field Validation', () => {
    it('should reject missing clientName', () => {
      const config = createValidConfig();
      (config as any).clientName = '';

      const result = VendorPricingSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject missing vendorName', () => {
      const config = createValidConfig();
      (config as any).vendorName = '';

      const result = VendorPricingSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject empty pricingTiers array', () => {
      const config = createValidConfig();
      config.pricingTiers = [];

      const result = VendorPricingSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject missing bridgeTollSettings', () => {
      const config = createValidConfig();
      delete (config as any).bridgeTollSettings;

      const result = VendorPricingSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject missing driverPaySettings', () => {
      const config = createValidConfig();
      delete (config as any).driverPaySettings;

      const result = VendorPricingSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe('Number Constraints', () => {
    it('should reject negative mileageRate', () => {
      const config = createValidConfig();
      config.mileageRate = -1;

      const result = VendorPricingSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject negative distanceThreshold', () => {
      const config = createValidConfig();
      config.distanceThreshold = -5;

      const result = VendorPricingSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject negative discount values', () => {
      const config = createValidConfig();
      config.dailyDriveDiscounts.twoDrivers = -10;

      const result = VendorPricingSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject negative bonusPay', () => {
      const config = createValidConfig();
      config.driverPaySettings.bonusPay = -5;

      const result = VendorPricingSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject negative readySetFee', () => {
      const config = createValidConfig();
      config.driverPaySettings.readySetFee = -1;

      const result = VendorPricingSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject negative defaultTollAmount', () => {
      const config = createValidConfig();
      config.bridgeTollSettings.defaultTollAmount = -7;

      const result = VendorPricingSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should accept zero values for numeric fields', () => {
      const config = createValidConfig();
      config.mileageRate = 0;
      config.distanceThreshold = 0;
      config.dailyDriveDiscounts.twoDrivers = 0;
      config.dailyDriveDiscounts.threeDrivers = 0;
      config.dailyDriveDiscounts.fourPlusDrivers = 0;

      const result = VendorPricingSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });

  describe('Driver Pay Settings Validation', () => {
    it('should reject maxPayPerDrop less than basePayPerDrop when set', () => {
      const config = createValidConfig();
      config.driverPaySettings.maxPayPerDrop = 10;
      config.driverPaySettings.basePayPerDrop = 25;

      const result = VendorPricingSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should accept maxPayPerDrop equal to basePayPerDrop', () => {
      const config = createValidConfig();
      config.driverPaySettings.maxPayPerDrop = 25;
      config.driverPaySettings.basePayPerDrop = 25;

      const result = VendorPricingSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should accept optional driver base pay tiers', () => {
      const config = createValidConfig();
      config.driverPaySettings.driverBasePayTiers = [
        { headcountMin: 1, headcountMax: 25, basePay: 25 },
        { headcountMin: 26, headcountMax: null, basePay: 35 },
      ];

      const result = VendorPricingSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should accept optional driver mileage settings', () => {
      const config = createValidConfig();
      config.driverPaySettings.driverMileageSettings = {
        flatAmountWithinThreshold: 7,
        perMileRateOverThreshold: 0.70,
      };

      const result = VendorPricingSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });

  describe('Pricing Tier Validation', () => {
    it('should reject negative headcountMin', () => {
      const config = createValidConfig();
      config.pricingTiers[0]!.headcountMin = -1;

      const result = VendorPricingSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject negative regularRate', () => {
      const config = createValidConfig();
      config.pricingTiers[0]!.regularRate = -50;

      const result = VendorPricingSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should accept null headcountMax (open-ended tier)', () => {
      const config = createValidConfig();
      config.pricingTiers = [
        { headcountMin: 1, headcountMax: null, foodCostMin: 0, foodCostMax: null, regularRate: 79, within10Miles: 69 },
      ];

      const result = VendorPricingSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should accept percentage rate fields', () => {
      const config = createValidConfig();
      config.pricingTiers[0]!.regularRatePercent = 0.15;
      config.pricingTiers[0]!.within10MilesPercent = 0.12;

      const result = VendorPricingSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should reject percentage rate above 1', () => {
      const config = createValidConfig();
      config.pricingTiers[0]!.regularRatePercent = 1.5;

      const result = VendorPricingSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe('Zero Order Settings Validation', () => {
    it('should reject negative values in zero order settings', () => {
      const config = createValidConfig();
      (config as any).zeroOrderSettings = {
        enabled: true,
        readySetFee: -1,
        customerDeliveryFee: 15,
        driverBasePay: 20,
        driverMileagePay: 7,
        driverBonusPay: 5,
      };

      const result = VendorPricingSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should accept zero order settings with maxMileage', () => {
      const config = createValidConfig();
      (config as any).zeroOrderSettings = {
        enabled: true,
        readySetFee: 15,
        customerDeliveryFee: 15,
        driverBasePay: 20,
        driverMileagePay: 7,
        driverBonusPay: 5,
        maxMileage: 10,
      };

      const result = VendorPricingSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });
});
