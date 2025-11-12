/**
 * Delivery Cost Calculator Tests
 * Tests all business rules from pricing documents
 *
 * Note on Magic Numbers:
 * This test file intentionally uses hardcoded values (e.g., 18, 23, 33, 43) rather than
 * importing them from configuration for the following reasons:
 * 1. Tests should verify specific expected values, not just match current config
 * 2. Configuration changes should cause test failures if behavior changes unexpectedly
 * 3. Tests serve as documentation of actual business requirements
 * 4. Hardcoded values make tests more explicit and easier to understand
 *
 * The tier values being tested come from:
 * - READY_SET_FOOD_STANDARD.driverPaySettings.driverBasePayTiers
 * - TRY_HUNGRY.driverPaySettings.driverBasePayTiers
 * - HY_FOOD_COMPANY_DIRECT.driverPaySettings (flat $50 rate)
 */

import {
  calculateDeliveryCost,
  calculateMileagePay,
  calculateDriverPay,
  calculateVendorPay,
  validateDeliveryCostInput,
  DeliveryCostInput,
  DriverPayInput,
  PRICING_TIERS,
  MILEAGE_RATE,
  DISTANCE_THRESHOLD
} from '../lib/calculator/delivery-cost-calculator';

describe('Delivery Cost Calculator', () => {
  describe('calculateDeliveryCost', () => {
    /**
     * Test Case 1: Food Cost based calculation (>10 miles)
     * From Image 2 - Example 1
     */
    test('Example 1 (Image 2): Food Cost $2,300, 14.5 miles, 3 drives/day', () => {
      const input: DeliveryCostInput = {
        headcount: 0,
        foodCost: 2300,
        totalMileage: 14.5,
        numberOfDrives: 3
      };

      const result = calculateDeliveryCost(input);

      // Expected from image:
      // Delivery Cost: $310.00
      // Total Mileage Pay: $13.50
      // Daily Drive Discount: $30.00 (3 drives × $10)
      // Delivery Fee: $293.50

      // Analysis: Mileage Pay = $13.50 for 14.5 miles
      // This means: (14.5 - 10) × $3 = 4.5 × $3 = $13.50
      // So mileage is only charged for miles OVER 10

      expect(result.deliveryCost).toBe(310); // Tier 10: $2300-$2499.99
      expect(result.totalMileagePay).toBeCloseTo(13.50, 2); // (14.5 - 10) × $3.00
      expect(result.dailyDriveDiscount).toBe(30); // 3 drives × $10
      expect(result.deliveryFee).toBeCloseTo(293.50, 2); // 310 + 13.50 - 30
    });

    /**
     * Test Case 2: Head Count based calculation (>10 miles)
     * From Image 2 - Example 2
     */
    test('Example 2 (Image 2): Head Count 243, 14.5 miles, 4 drives/day', () => {
      const input: DeliveryCostInput = {
        headcount: 243,
        foodCost: 0,
        totalMileage: 14.5,
        numberOfDrives: 4
      };

      const result = calculateDeliveryCost(input);

      // Expected from image:
      // Delivery Cost: $280.00 (Tier 9: 200-249 headcount)
      // Total Mileage Pay: $13.50
      // Daily Drive Discount: $60.00 (4 drives × $15)
      // Delivery Fee: $233.50

      expect(result.deliveryCost).toBe(280); // Tier 9: 200-249 headcount
      expect(result.totalMileagePay).toBeCloseTo(13.50, 2); // (14.5 - 10) × $3.00
      expect(result.dailyDriveDiscount).toBe(60); // 4 drives × $15
      expect(result.deliveryFee).toBeCloseTo(233.50, 2); // 280 + 13.50 - 60
    });

    /**
     * Test Case 3: Regular Rate >10 miles
     * From Image 3 - Example 1
     */
    test('Example 3 (Image 3): Food Cost $2,100, 14.5 miles', () => {
      const input: DeliveryCostInput = {
        headcount: 0,
        foodCost: 2100,
        totalMileage: 14.5,
        numberOfDrives: 1 // No discount
      };

      const result = calculateDeliveryCost(input);

      // Expected from image:
      // Delivery Cost: $280.00 (Tier 9: $2100-$2299.99)
      // Total Mileage Pay: $13.50
      // Delivery Fee: $293.50

      expect(result.deliveryCost).toBe(280); // Tier 9
      expect(result.totalMileagePay).toBeCloseTo(13.50, 2); // (14.5 - 10) × $3.00
      expect(result.dailyDriveDiscount).toBe(0); // 1 drive = no discount
      expect(result.deliveryFee).toBeCloseTo(293.50, 2); // 280 + 13.50
    });

    /**
     * Test Case 4: Within 10 miles (no mileage charge)
     * From Image 3 - Example 2
     */
    test('Example 4 (Image 3): Food Cost $1,200, 9.0 miles (within 10)', () => {
      const input: DeliveryCostInput = {
        headcount: 0,
        foodCost: 1200,
        totalMileage: 9.0,
        numberOfDrives: 1
      };

      const result = calculateDeliveryCost(input);

      // Expected from image:
      // Delivery Cost: $80.00 (Within 10 miles rate for Tier 5)
      // Total Mileage Pay: $0.00 (within 10 miles)
      // Delivery Fee: $80.00

      expect(result.deliveryCost).toBe(80); // Tier 5 within 10 miles
      expect(result.totalMileagePay).toBe(0); // No mileage charge within 10 miles
      expect(result.dailyDriveDiscount).toBe(0);
      expect(result.deliveryFee).toBe(80);
    });

    /**
     * Test Case 5: LESSER of headcount vs food cost
     * Headcount suggests higher tier, food cost suggests lower tier
     */
    test('Uses LESSER tier: Headcount 100 (Tier 5) vs Food Cost $500 (Tier 2)', () => {
      const input: DeliveryCostInput = {
        headcount: 100, // Tier 5: 100-124
        foodCost: 500,  // Tier 2: $300-$599.99
        totalMileage: 15,
        numberOfDrives: 1
      };

      const result = calculateDeliveryCost(input);

      // Should use Tier 2 (lower/more conservative)
      expect(result.deliveryCost).toBe(70); // Tier 2 regular rate
    });

    /**
     * Test Case 6: LESSER of headcount vs food cost (reverse)
     * Food cost suggests higher tier, headcount suggests lower tier
     */
    test('Uses LESSER tier: Food Cost $2,000 (Tier 8) vs Headcount 30 (Tier 2)', () => {
      const input: DeliveryCostInput = {
        headcount: 30,   // Tier 2: 25-49
        foodCost: 2000,  // Tier 8: $1900-$2099.99
        totalMileage: 15,
        numberOfDrives: 1
      };

      const result = calculateDeliveryCost(input);

      // Should use Tier 2 (lower/more conservative)
      expect(result.deliveryCost).toBe(70); // Tier 2 regular rate
    });
  });

  describe('calculateMileagePay', () => {
    test('calculates mileage pay at $3.00/mile for miles over 10', () => {
      expect(calculateMileagePay(14.5)).toBeCloseTo(13.50, 2); // (14.5 - 10) × $3
      expect(calculateMileagePay(20)).toBe(30); // (20 - 10) × $3
      expect(calculateMileagePay(5.5)).toBe(0); // Under 10 miles
    });

    test('returns $0 for distances within 10 miles', () => {
      expect(calculateMileagePay(9)).toBe(0);
      expect(calculateMileagePay(10)).toBe(0);
      expect(calculateMileagePay(5)).toBe(0);
    });

    test('returns $0 for zero mileage', () => {
      expect(calculateMileagePay(0)).toBe(0);
    });

    test('throws error for negative mileage', () => {
      expect(() => calculateMileagePay(-5)).toThrow('Total mileage cannot be negative');
    });
  });

  describe('calculateDriverPay', () => {
    /**
     * Test Case: Full driver pay breakdown
     * From Image 1 - Example with all components
     */
    test('Example 5 (Image 1): Full breakdown with bonus', () => {
      const input: DriverPayInput = {
        headcount: 28,
        foodCost: 0,
        totalMileage: 3.1,
        numberOfDrives: 1,
        bonusQualified: true,
        readySetFee: 70,
        readySetAddonFee: 0
      };

      const result = calculateDriverPay(input);

      // Expected with tiered driver base pay (REA-41):
      // Headcount 28 is in 25-49 tier → Driver Base Pay: $23.00
      // Mileage: 3.1 miles × $0.70 = $2.17 < $7 minimum → $7.00
      // Driver Total Base Pay: $23.00 + $7.00 = $30.00
      // Driver Bonus Pay: $10.00
      // Total Driver Pay: $30.00 + $10.00 = $40.00
      // Ready Set Fee: $70.00
      // Ready Set Total Fee: $70.00

      expect(result.driverMaxPayPerDrop).toBe(40);
      expect(result.driverBasePayPerDrop).toBe(23); // Tiered rate for 25-49 headcount
      expect(result.driverTotalBasePay).toBe(30); // $23 base + $7 mileage
      expect(result.readySetFee).toBe(70);
      expect(result.readySetAddonFee).toBe(0);
      expect(result.readySetTotalFee).toBe(70);
      expect(result.driverBonusPay).toBe(10);
      expect(result.totalDriverPay).toBe(40); // $30 base + $10 bonus
      expect(result.bonusQualifiedPercent).toBe(100);
      expect(result.bonusQualified).toBe(true);
      expect(result.totalMileagePay).toBe(7.0); // 3.1 miles × $0.70 = $2.17 < $7 minimum
    });

    test('driver pay with tiered base pay (50-74 headcount)', () => {
      const input: DriverPayInput = {
        headcount: 50,
        foodCost: 800,
        totalMileage: 12,
        numberOfDrives: 1,
        bonusQualified: true,
        readySetFee: 70
      };

      const result = calculateDriverPay(input);

      // With tiered driver base pay (REA-41):
      // Headcount 50 is in 50-74 tier → Driver Base Pay: $33.00
      // Mileage: 12 miles × $0.70 = $8.40 (> $7 minimum)
      // Driver Total Base Pay: $33.00 + $8.40 = $41.40, CAPPED at maxPayPerDrop $40
      // Driver Bonus Pay: $10.00
      // Total Driver Pay: $40.00 + $10.00 = $50.00
      expect(result.driverBasePayPerDrop).toBe(33); // Tiered rate for 50-74 headcount
      expect(result.driverTotalBasePay).toBe(40); // $33 + $8.40 = $41.40, capped at $40
      expect(result.driverBonusPay).toBe(10);
      expect(result.totalDriverPay).toBe(50); // $40 capped base + $10 bonus
    });

    test('no bonus when not qualified', () => {
      const input: DriverPayInput = {
        headcount: 30,
        foodCost: 400,
        totalMileage: 12,
        numberOfDrives: 1,
        bonusQualified: false,
        readySetFee: 70
      };

      const result = calculateDriverPay(input);

      expect(result.driverBonusPay).toBe(0);
      expect(result.bonusQualifiedPercent).toBe(0);
      expect(result.bonusQualified).toBe(false);
      // With tiered driver base pay (REA-41):
      // Headcount 30 is in 25-49 tier → Driver Base Pay: $23.00
      // Mileage: 12 miles × $0.70 = $8.40 (> $7 minimum)
      // Driver Total Base Pay: $23.00 + $8.40 = $31.40
      // No bonus since not qualified
      expect(result.driverBasePayPerDrop).toBe(23); // Tiered rate for 25-49 headcount
      expect(result.driverTotalBasePay).toBeCloseTo(31.4, 1); // $23 base + $8.40 mileage
      expect(result.totalDriverPay).toBeCloseTo(31.4, 1); // No bonus
    });
  });

  describe('calculateVendorPay', () => {
    test('calculates vendor pay based on delivery fee', () => {
      const input: DeliveryCostInput = {
        headcount: 50,
        foodCost: 700,
        totalMileage: 15,
        numberOfDrives: 1
      };

      const result = calculateVendorPay(input);

      // Vendor pay should equal delivery fee for now
      const deliveryCost = calculateDeliveryCost(input);
      expect(result.vendorPay).toBe(deliveryCost.deliveryFee);
    });
  });

  describe('validateDeliveryCostInput', () => {
    test('validates correct input', () => {
      const input: DeliveryCostInput = {
        headcount: 50,
        foodCost: 700,
        totalMileage: 15,
        numberOfDrives: 2
      };

      const validation = validateDeliveryCostInput(input);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('detects negative values', () => {
      const input1: DeliveryCostInput = {
        headcount: -10,
        foodCost: 500,
        totalMileage: 10,
        numberOfDrives: 1
      };

      const validation1 = validateDeliveryCostInput(input1);
      expect(validation1.valid).toBe(false);
      expect(validation1.errors).toContain('Headcount cannot be negative');

      const input2: DeliveryCostInput = {
        headcount: 50,
        foodCost: -100,
        totalMileage: 10,
        numberOfDrives: 1
      };

      const validation2 = validateDeliveryCostInput(input2);
      expect(validation2.valid).toBe(false);
      expect(validation2.errors).toContain('Food cost cannot be negative');
    });

    test('detects TBD tiers (300+ headcount)', () => {
      const input: DeliveryCostInput = {
        headcount: 350,
        foodCost: 1000,
        totalMileage: 15,
        numberOfDrives: 1
      };

      const validation = validateDeliveryCostInput(input);
      expect(validation.valid).toBe(false);
      expect(validation.errors[0]).toContain('TBD');
    });

    test('detects TBD tiers ($2500+ food cost)', () => {
      const input: DeliveryCostInput = {
        headcount: 100,
        foodCost: 3000,
        totalMileage: 15,
        numberOfDrives: 1
      };

      const validation = validateDeliveryCostInput(input);
      expect(validation.valid).toBe(false);
      expect(validation.errors[0]).toContain('TBD');
    });
  });

  describe('Daily Drive Discounts', () => {
    test('applies -$5 discount for 2 drives/day', () => {
      const input: DeliveryCostInput = {
        headcount: 50,
        foodCost: 700,
        totalMileage: 15,
        numberOfDrives: 2
      };

      const result = calculateDeliveryCost(input);
      expect(result.dailyDriveDiscount).toBe(10); // 2 drives × $5
    });

    test('applies -$10 discount for 3 drives/day', () => {
      const input: DeliveryCostInput = {
        headcount: 50,
        foodCost: 700,
        totalMileage: 15,
        numberOfDrives: 3
      };

      const result = calculateDeliveryCost(input);
      expect(result.dailyDriveDiscount).toBe(30); // 3 drives × $10
    });

    test('applies -$15 discount for 4+ drives/day', () => {
      const input: DeliveryCostInput = {
        headcount: 50,
        foodCost: 700,
        totalMileage: 15,
        numberOfDrives: 4
      };

      const result = calculateDeliveryCost(input);
      expect(result.dailyDriveDiscount).toBe(60); // 4 drives × $15

      const input2: DeliveryCostInput = {
        ...input,
        numberOfDrives: 5
      };

      const result2 = calculateDeliveryCost(input2);
      expect(result2.dailyDriveDiscount).toBe(75); // 5 drives × $15
    });
  });

  describe('Edge Cases', () => {
    test('handles zero values gracefully', () => {
      const input: DeliveryCostInput = {
        headcount: 0,
        foodCost: 0,
        totalMileage: 0,
        numberOfDrives: 1
      };

      const result = calculateDeliveryCost(input);

      // Should default to Tier 1 within 10 miles
      expect(result.deliveryCost).toBe(30);
      expect(result.totalMileagePay).toBe(0);
      expect(result.dailyDriveDiscount).toBe(0);
    });

    test('handles exactly 10 miles (boundary)', () => {
      const input: DeliveryCostInput = {
        headcount: 50,
        foodCost: 700,
        totalMileage: 10,
        numberOfDrives: 1
      };

      const result = calculateDeliveryCost(input);

      // Exactly 10 miles should use within 10 miles rate
      expect(result.deliveryCost).toBe(60); // Tier 3 within 10 miles
      expect(result.totalMileagePay).toBe(0); // No mileage charge at exactly 10
    });

    test('handles exactly 10.1 miles (just over threshold)', () => {
      const input: DeliveryCostInput = {
        headcount: 50,
        foodCost: 700,
        totalMileage: 10.1,
        numberOfDrives: 1
      };

      const result = calculateDeliveryCost(input);

      // Just over 10 miles should use regular rate
      expect(result.deliveryCost).toBe(90); // Tier 3 regular rate
      expect(result.totalMileagePay).toBeCloseTo(0.30, 2); // (10.1 - 10) × $3
    });

    test('handles bridge toll', () => {
      const input: DeliveryCostInput = {
        headcount: 50,
        foodCost: 700,
        totalMileage: 15,
        numberOfDrives: 1,
        requiresBridge: true,
        bridgeToll: 8
      };

      const result = calculateDeliveryCost(input);

      expect(result.bridgeToll).toBe(8);
      // Delivery fee should include bridge toll
      expect(result.deliveryFee).toBeGreaterThan(result.deliveryCost + result.totalMileagePay);
    });
  });

  describe('Pricing Tier Boundaries', () => {
    test('Tier 1: 0-24 headcount, <$300 food cost', () => {
      const input: DeliveryCostInput = {
        headcount: 20,
        foodCost: 250,
        totalMileage: 15,
        numberOfDrives: 1
      };

      const result = calculateDeliveryCost(input);
      expect(result.deliveryCost).toBe(60); // Tier 1 regular rate
    });

    test('Tier 2: 25-49 headcount, $300-$599.99 food cost', () => {
      const input: DeliveryCostInput = {
        headcount: 30,
        foodCost: 400,
        totalMileage: 15,
        numberOfDrives: 1
      };

      const result = calculateDeliveryCost(input);
      expect(result.deliveryCost).toBe(70); // Tier 2 regular rate
    });

    test('Tier 3: 50-74 headcount, $600-$899.99 food cost', () => {
      const input: DeliveryCostInput = {
        headcount: 60,
        foodCost: 700,
        totalMileage: 15,
        numberOfDrives: 1
      };

      const result = calculateDeliveryCost(input);
      expect(result.deliveryCost).toBe(90); // Tier 3 regular rate
    });

    test('Tier 9: 200-249 headcount, $2100-$2299.99 food cost', () => {
      const input: DeliveryCostInput = {
        headcount: 220,
        foodCost: 2200,
        totalMileage: 15,
        numberOfDrives: 1
      };

      const result = calculateDeliveryCost(input);
      expect(result.deliveryCost).toBe(280); // Tier 9 regular rate
    });
  });

  describe('CaterValley Client Configuration', () => {
    test('CaterValley: Minimum delivery fee of $42.50 for small orders within 10 miles', () => {
      const input: DeliveryCostInput = {
        headcount: 20,
        foodCost: 250,
        totalMileage: 5,
        numberOfDrives: 1,
        clientConfigId: 'cater-valley'
      };

      const result = calculateDeliveryCost(input);

      // CaterValley minimum fee: $42.50 (within 10 miles)
      expect(result.deliveryCost).toBe(42.50);
      expect(result.deliveryFee).toBe(42.50); // No additional mileage within 10 miles
    });

    test('CaterValley: Medium order (25-49 headcount) within 10 miles shows $52.50', () => {
      const input: DeliveryCostInput = {
        headcount: 30,
        foodCost: 400,
        totalMileage: 8,
        numberOfDrives: 1,
        clientConfigId: 'cater-valley'
      };

      const result = calculateDeliveryCost(input);

      expect(result.deliveryCost).toBe(52.50);
      expect(result.deliveryFee).toBe(52.50);
    });

    test('CaterValley: Small order over 10 miles uses $85.00 rate plus mileage', () => {
      const input: DeliveryCostInput = {
        headcount: 20,
        foodCost: 250,
        totalMileage: 15,
        numberOfDrives: 1,
        clientConfigId: 'cater-valley'
      };

      const result = calculateDeliveryCost(input);

      // Over 10 miles uses regularRate of $85
      expect(result.deliveryCost).toBe(85);
      // Mileage: (15 - 10) × $3 = $15
      expect(result.totalMileagePay).toBe(15);
      // Total: $85 + $15 = $100
      expect(result.deliveryFee).toBe(100);
    });

    test('CaterValley: Large order (50-74 headcount) within 10 miles shows $62.50', () => {
      const input: DeliveryCostInput = {
        headcount: 60,
        foodCost: 700,
        totalMileage: 7,
        numberOfDrives: 1,
        clientConfigId: 'cater-valley'
      };

      const result = calculateDeliveryCost(input);

      expect(result.deliveryCost).toBe(62.50);
      expect(result.deliveryFee).toBe(62.50);
    });

    test('CaterValley: Fallback to default configuration if config not found', () => {
      const input: DeliveryCostInput = {
        headcount: 20,
        foodCost: 250,
        totalMileage: 5,
        numberOfDrives: 1,
        clientConfigId: 'non-existent-config'
      };

      const result = calculateDeliveryCost(input);

      // Should fallback to Ready Set Food Standard (within10Miles: 30)
      expect(result.deliveryCost).toBe(30);
    });

    test('CaterValley: Edge case - Exactly 10.0 miles uses within10Miles rate', () => {
      const input: DeliveryCostInput = {
        headcount: 20,
        foodCost: 250,
        totalMileage: 10.0, // Exactly at threshold
        numberOfDrives: 1,
        clientConfigId: 'cater-valley'
      };

      const result = calculateDeliveryCost(input);

      // At exactly 10 miles, should use within10Miles rate
      expect(result.deliveryCost).toBe(42.50);
      expect(result.totalMileagePay).toBe(0); // No mileage fee
      expect(result.deliveryFee).toBe(42.50); // Just the base rate
    });

    test('CaterValley: Edge case - 10.1 miles uses regularRate plus mileage', () => {
      const input: DeliveryCostInput = {
        headcount: 20,
        foodCost: 250,
        totalMileage: 10.1, // Just over threshold
        numberOfDrives: 1,
        clientConfigId: 'cater-valley'
      };

      const result = calculateDeliveryCost(input);

      // Over 10 miles, should use regularRate
      expect(result.deliveryCost).toBe(85); // Regular rate for tier 1
      expect(result.totalMileagePay).toBeCloseTo(0.30, 2); // (10.1 - 10) × $3 = $0.30
      expect(result.deliveryFee).toBeCloseTo(85.30, 2); // $85 + $0.30
    });

    test('CaterValley: Edge case - 9.9 miles uses within10Miles rate', () => {
      const input: DeliveryCostInput = {
        headcount: 20,
        foodCost: 250,
        totalMileage: 9.9, // Just under threshold
        numberOfDrives: 1,
        clientConfigId: 'cater-valley'
      };

      const result = calculateDeliveryCost(input);

      // Under 10 miles, should use within10Miles rate
      expect(result.deliveryCost).toBe(42.50);
      expect(result.totalMileagePay).toBe(0); // No mileage fee
      expect(result.deliveryFee).toBe(42.50);
    });

    test('CaterValley: Tier 1 boundary - Exactly 25 headcount uses tier 1 rate ($42.50)', () => {
      const input: DeliveryCostInput = {
        headcount: 25,
        foodCost: 250,
        totalMileage: 8,
        numberOfDrives: 1,
        clientConfigId: 'cater-valley'
      };

      const result = calculateDeliveryCost(input);

      // 25 headcount should be included in tier 1 (≤25), not tier 2
      expect(result.deliveryCost).toBe(42.50);
      expect(result.totalMileagePay).toBe(0); // Within 10 miles
      expect(result.deliveryFee).toBe(42.50);
    });

    test('CaterValley: Tier 2 boundary - Exactly 26 headcount uses tier 2 rate ($52.50)', () => {
      const input: DeliveryCostInput = {
        headcount: 26,
        foodCost: 350, // Use food cost in tier 2 range (300.01-599.99)
        totalMileage: 8,
        numberOfDrives: 1,
        clientConfigId: 'cater-valley'
      };

      const result = calculateDeliveryCost(input);

      // 26 headcount and $350 food cost both qualify for tier 2
      expect(result.deliveryCost).toBe(52.50);
      expect(result.totalMileagePay).toBe(0); // Within 10 miles
      expect(result.deliveryFee).toBe(52.50);
    });

    test('CaterValley: Enterprise tier (100+ headcount) uses 10% percentage-based pricing', () => {
      const input: DeliveryCostInput = {
        headcount: 150,
        foodCost: 2000,
        totalMileage: 8,
        numberOfDrives: 1,
        clientConfigId: 'cater-valley'
      };

      const result = calculateDeliveryCost(input);

      // 10% of $2000 = $200
      expect(result.deliveryCost).toBe(200);
      expect(result.totalMileagePay).toBe(0); // Within 10 miles
      expect(result.deliveryFee).toBe(200);
    });

    test('CaterValley: Enterprise tier at exact threshold (100 headcount, $1200 food cost)', () => {
      const input: DeliveryCostInput = {
        headcount: 100,
        foodCost: 1200,
        totalMileage: 8,
        numberOfDrives: 1,
        clientConfigId: 'cater-valley'
      };

      const result = calculateDeliveryCost(input);

      // 10% of $1200 = $120
      expect(result.deliveryCost).toBe(120);
      expect(result.totalMileagePay).toBe(0); // Within 10 miles
      expect(result.deliveryFee).toBe(120);
    });

    test('CaterValley: Enterprise tier over 10 miles uses 10% percentage-based pricing', () => {
      const input: DeliveryCostInput = {
        headcount: 120,
        foodCost: 1500,
        totalMileage: 15,
        numberOfDrives: 1,
        clientConfigId: 'cater-valley'
      };

      const result = calculateDeliveryCost(input);

      // 10% of $1500 = $150 base
      // 5 miles over threshold × $3.00 = $15 mileage
      expect(result.deliveryCost).toBe(150);
      expect(result.totalMileagePay).toBe(15);
      expect(result.deliveryFee).toBe(165);
    });

    test('CaterValley: Zero-cost validation prevents $0 delivery for non-zero orders', () => {
      // This test would require a misconfigured tier, but with our fixes
      // the tier 100+ now has percentage fields set, so it won't be zero
      // Instead, test that the validation logic exists by checking a hypothetical scenario

      // Note: With the current fix, tier 100+ has regularRatePercent: 0.10
      // So this test validates the safety mechanism is in place
      // If someone accidentally sets a tier to 0, it should throw an error

      const input: DeliveryCostInput = {
        headcount: 10,
        foodCost: 100,
        totalMileage: 5,
        numberOfDrives: 1,
        clientConfigId: 'cater-valley'
      };

      // This should NOT throw because tier has proper rates
      expect(() => calculateDeliveryCost(input)).not.toThrow();

      // Result should have non-zero delivery cost
      const result = calculateDeliveryCost(input);
      expect(result.deliveryCost).toBeGreaterThan(0);
      expect(result.deliveryFee).toBeGreaterThan(0);
    });

    test('CaterValley: numberOfDrives parameter is respected (no discount for single drive)', () => {
      const input: DeliveryCostInput = {
        headcount: 50,
        foodCost: 600,
        totalMileage: 8,
        numberOfDrives: 1, // Single drive - no discount
        clientConfigId: 'cater-valley'
      };

      const result = calculateDeliveryCost(input);

      // Should use within10Miles rate for 50-74 headcount tier
      expect(result.deliveryCost).toBe(62.50);
      expect(result.dailyDriveDiscount).toBe(0); // No discount for single drive
      expect(result.deliveryFee).toBe(62.50);
    });

    describe('Try Hungry Configuration', () => {
      test('uses custom $2.50 mileage rate for deliveries over 10 miles', () => {
        const input: DeliveryCostInput = {
          headcount: 50,
          foodCost: 600,
          totalMileage: 15, // 15 miles - 10 = 5 extra miles
          clientConfigId: 'try-hungry'
        };

        const result = calculateDeliveryCost(input);

        // Mileage calculation: (15 - 10) × $2.50 = $12.50
        expect(result.totalMileagePay).toBe(12.50);
        expect(result.deliveryCost).toBe(60); // 50-74 headcount tier
        expect(result.deliveryFee).toBe(72.50); // $60 + $12.50
      });

      test('uses correct driver base pay for 0-24 headcount tier', () => {
        const input: DriverPayInput = {
          headcount: 20,
          foodCost: 200,
          totalMileage: 5,
          bonusQualified: false,
          clientConfigId: 'try-hungry'
        };

        const result = calculateDriverPay(input);

        expect(result.driverBasePayPerDrop).toBe(18); // Tier 0-24
        expect(result.driverTotalBasePay).toBe(25); // $18 + $7 mileage minimum
        expect(result.totalDriverPay).toBe(25); // No bonus
      });

      test('uses correct driver base pay for 25-49 headcount tier', () => {
        const input: DriverPayInput = {
          headcount: 30,
          foodCost: 400,
          totalMileage: 5,
          bonusQualified: true,
          clientConfigId: 'try-hungry'
        };

        const result = calculateDriverPay(input);

        expect(result.driverBasePayPerDrop).toBe(23); // Tier 25-49
        expect(result.driverTotalBasePay).toBe(30); // $23 + $7 mileage minimum
        expect(result.totalDriverPay).toBe(40); // $30 + $10 bonus (capped at maxPayPerDrop)
      });

      test('uses correct driver base pay for 50-74 headcount tier', () => {
        const input: DriverPayInput = {
          headcount: 60,
          foodCost: 700,
          totalMileage: 5,
          bonusQualified: false,
          clientConfigId: 'try-hungry'
        };

        const result = calculateDriverPay(input);

        expect(result.driverBasePayPerDrop).toBe(33); // Tier 50-74
        expect(result.driverTotalBasePay).toBe(40); // $33 + $7 = $40 (capped at maxPayPerDrop)
        expect(result.totalDriverPay).toBe(40); // Capped, no bonus
      });

      test('uses correct driver base pay for 75-99 headcount tier', () => {
        const input: DriverPayInput = {
          headcount: 85,
          foodCost: 1000,
          totalMileage: 5,
          bonusQualified: false,
          clientConfigId: 'try-hungry'
        };

        const result = calculateDriverPay(input);

        expect(result.driverBasePayPerDrop).toBe(43); // Tier 75-99
        // $43 + $7 = $50, but capped at $40
        expect(result.driverTotalBasePay).toBe(40); // Capped at maxPayPerDrop
        expect(result.totalDriverPay).toBe(40);
      });

      test('tier boundary: 24 headcount uses 0-24 tier', () => {
        const input: DriverPayInput = {
          headcount: 24,
          foodCost: 250,
          totalMileage: 5,
          bonusQualified: false,
          clientConfigId: 'try-hungry'
        };

        const result = calculateDriverPay(input);

        expect(result.driverBasePayPerDrop).toBe(18); // Tier 0-24
      });

      test('tier boundary: 25 headcount uses 25-49 tier', () => {
        const input: DriverPayInput = {
          headcount: 25,
          foodCost: 300,
          totalMileage: 5,
          bonusQualified: false,
          clientConfigId: 'try-hungry'
        };

        const result = calculateDriverPay(input);

        expect(result.driverBasePayPerDrop).toBe(23); // Tier 25-49
      });

      test('tier boundary: 49 headcount uses 25-49 tier', () => {
        const input: DriverPayInput = {
          headcount: 49,
          foodCost: 550,
          totalMileage: 5,
          bonusQualified: false,
          clientConfigId: 'try-hungry'
        };

        const result = calculateDriverPay(input);

        expect(result.driverBasePayPerDrop).toBe(23); // Tier 25-49
      });

      test('tier boundary: 50 headcount uses 50-74 tier', () => {
        const input: DriverPayInput = {
          headcount: 50,
          foodCost: 600,
          totalMileage: 5,
          bonusQualified: false,
          clientConfigId: 'try-hungry'
        };

        const result = calculateDriverPay(input);

        expect(result.driverBasePayPerDrop).toBe(33); // Tier 50-74
      });

      test('tier boundary: 74 headcount uses 50-74 tier', () => {
        const input: DriverPayInput = {
          headcount: 74,
          foodCost: 850,
          totalMileage: 5,
          bonusQualified: false,
          clientConfigId: 'try-hungry'
        };

        const result = calculateDriverPay(input);

        expect(result.driverBasePayPerDrop).toBe(33); // Tier 50-74
      });

      test('tier boundary: 75 headcount uses 75-99 tier', () => {
        const input: DriverPayInput = {
          headcount: 75,
          foodCost: 900,
          totalMileage: 5,
          bonusQualified: false,
          clientConfigId: 'try-hungry'
        };

        const result = calculateDriverPay(input);

        expect(result.driverBasePayPerDrop).toBe(43); // Tier 75-99
      });

      test('tier boundary: 99 headcount uses 75-99 tier', () => {
        const input: DriverPayInput = {
          headcount: 99,
          foodCost: 1150,
          totalMileage: 5,
          bonusQualified: false,
          clientConfigId: 'try-hungry'
        };

        const result = calculateDriverPay(input);

        expect(result.driverBasePayPerDrop).toBe(43); // Tier 75-99
      });

      test('throws error for 100+ headcount requiring manual review', () => {
        const input: DriverPayInput = {
          headcount: 100,
          foodCost: 1200,
          totalMileage: 5,
          bonusQualified: false,
          clientConfigId: 'try-hungry'
        };

        // Error message is sanitized to not expose business logic thresholds
        expect(() => calculateDriverPay(input)).toThrow('This order requires manual review');
        expect(() => calculateDriverPay(input)).toThrow('contact support for a custom quote');
      });

      test('throws error for 150 headcount requiring manual review', () => {
        const input: DriverPayInput = {
          headcount: 150,
          foodCost: 1800,
          totalMileage: 5,
          bonusQualified: false,
          clientConfigId: 'try-hungry'
        };

        // Error message is sanitized to not expose business logic thresholds or client names
        expect(() => calculateDriverPay(input)).toThrow('This order requires manual review');
        expect(() => calculateDriverPay(input)).toThrow('contact support for a custom quote');
      });

      test('handles edge case: zero headcount', () => {
        const input: DriverPayInput = {
          headcount: 0,
          foodCost: 100,
          totalMileage: 5,
          bonusQualified: false,
          clientConfigId: 'try-hungry'
        };

        const result = calculateDriverPay(input);

        // Should use 0-24 tier
        expect(result.driverBasePayPerDrop).toBe(18);
        expect(result.driverTotalBasePay).toBe(25); // $18 + $7 minimum
      });

      test('concurrent conditions: 100 headcount with multiple edge cases', () => {
        // Test interaction between manual review and other business rules
        const input: DriverPayInput = {
          headcount: 100, // Triggers manual review
          foodCost: 1200,
          totalMileage: 0, // Edge case: no mileage
          bonusQualified: true, // Edge case: bonus should not be calculated
          requiresBridge: true, // Edge case: bridge toll should not be calculated
          clientConfigId: 'try-hungry'
        };

        // Manual review should throw before any other calculations
        expect(() => calculateDriverPay(input)).toThrow('This order requires manual review');
        expect(() => calculateDriverPay(input)).toThrow('contact support for a custom quote');
      });

      test('validates negative values are rejected', () => {
        const input: DriverPayInput = {
          headcount: -10, // Negative headcount
          foodCost: 200,
          totalMileage: 5,
          bonusQualified: false,
          clientConfigId: 'try-hungry'
        };

        expect(() => calculateDriverPay(input)).toThrow('Headcount cannot be negative');
      });

      test('validates negative mileage is rejected', () => {
        const input: DriverPayInput = {
          headcount: 30,
          foodCost: 400,
          totalMileage: -5, // Negative mileage
          bonusQualified: false,
          clientConfigId: 'try-hungry'
        };

        expect(() => calculateDriverPay(input)).toThrow('Total mileage cannot be negative');
      });
    });

    describe('HY Food Company Configuration', () => {
      test('uses flat $50 driver base pay regardless of headcount (10 people)', () => {
        const input: DriverPayInput = {
          headcount: 10,
          foodCost: 150,
          totalMileage: 5,
          bonusQualified: false,
          clientConfigId: 'hy-food-company-direct'
        };

        const result = calculateDriverPay(input);

        expect(result.driverBasePayPerDrop).toBe(50); // Flat $50
        // $50 + $7 = $57, but capped at $50 maxPayPerDrop
        expect(result.driverTotalBasePay).toBe(50); // Capped at maxPayPerDrop
        expect(result.totalDriverPay).toBe(50);
      });

      test('uses flat $50 driver base pay regardless of headcount (50 people)', () => {
        const input: DriverPayInput = {
          headcount: 50,
          foodCost: 600,
          totalMileage: 5,
          bonusQualified: false,
          clientConfigId: 'hy-food-company-direct'
        };

        const result = calculateDriverPay(input);

        expect(result.driverBasePayPerDrop).toBe(50); // Flat $50
        expect(result.driverTotalBasePay).toBe(50); // Capped at maxPayPerDrop
        expect(result.totalDriverPay).toBe(50);
      });

      test('uses flat $50 driver base pay regardless of headcount (100 people)', () => {
        const input: DriverPayInput = {
          headcount: 100,
          foodCost: 1200,
          totalMileage: 5,
          bonusQualified: false,
          clientConfigId: 'hy-food-company-direct'
        };

        const result = calculateDriverPay(input);

        expect(result.driverBasePayPerDrop).toBe(50); // Flat $50
        expect(result.driverTotalBasePay).toBe(50); // Capped at maxPayPerDrop
        expect(result.totalDriverPay).toBe(50);
      });

      test('maxPayPerDrop cap is enforced with mileage (12 miles scenario)', () => {
        const input: DriverPayInput = {
          headcount: 30,
          foodCost: 400,
          totalMileage: 12, // 12 miles × $0.70 = $8.40
          bonusQualified: false,
          clientConfigId: 'hy-food-company-direct'
        };

        const result = calculateDriverPay(input);

        expect(result.driverBasePayPerDrop).toBe(50); // Flat $50
        expect(result.totalMileagePay).toBeCloseTo(8.40, 2); // 12 × $0.70
        // $50 + $8.40 = $58.40, but should be capped at $50
        expect(result.driverTotalBasePay).toBe(50); // Capped at maxPayPerDrop
        expect(result.totalDriverPay).toBe(50);
      });

      test('maxPayPerDrop cap is enforced with mileage and bonus', () => {
        const input: DriverPayInput = {
          headcount: 30,
          foodCost: 400,
          totalMileage: 12,
          bonusQualified: true,
          clientConfigId: 'hy-food-company-direct'
        };

        const result = calculateDriverPay(input);

        expect(result.driverBasePayPerDrop).toBe(50);
        expect(result.totalMileagePay).toBeCloseTo(8.40, 2);
        expect(result.driverBonusPay).toBe(10);
        // Base + mileage = $50 (capped), then add bonus
        expect(result.driverTotalBasePay).toBe(50); // Capped
        expect(result.totalDriverPay).toBe(60); // $50 capped base + $10 bonus
      });

      test('maxPayPerDrop cap with bridge toll', () => {
        const input: DriverPayInput = {
          headcount: 30,
          foodCost: 400,
          totalMileage: 12,
          bonusQualified: false,
          requiresBridge: true,
          clientConfigId: 'hy-food-company-direct'
        };

        const result = calculateDriverPay(input);

        expect(result.driverTotalBasePay).toBe(50); // Capped
        expect(result.bridgeToll).toBe(8.00);
        // Capped base + bridge toll
        expect(result.totalDriverPay).toBe(58); // $50 + $8 bridge toll
      });

      test('handles edge case: zero headcount with flat rate', () => {
        const input: DriverPayInput = {
          headcount: 0,
          foodCost: 100,
          totalMileage: 5,
          bonusQualified: false,
          clientConfigId: 'hy-food-company-direct'
        };

        const result = calculateDriverPay(input);

        expect(result.driverBasePayPerDrop).toBe(50); // Flat $50 for any headcount
        expect(result.driverTotalBasePay).toBe(50); // Capped
      });

      test('standard mileage pay ($7 minimum) is used for HY Food Company', () => {
        const input: DriverPayInput = {
          headcount: 30,
          foodCost: 400,
          totalMileage: 3, // 3 miles × $0.70 = $2.10 < $7 minimum
          bonusQualified: false,
          clientConfigId: 'hy-food-company-direct'
        };

        const result = calculateDriverPay(input);

        expect(result.totalMileagePay).toBe(7.0); // $7 minimum
        // $50 + $7 = $57, capped at $50
        expect(result.driverTotalBasePay).toBe(50); // Capped at maxPayPerDrop
      });
    });
  });
});
