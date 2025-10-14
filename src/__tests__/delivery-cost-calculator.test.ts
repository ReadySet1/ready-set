/**
 * Delivery Cost Calculator Tests
 * Tests all business rules from pricing documents
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

      // Expected from Coolfire data fix:
      // Driver Max Pay Per Drop: $40.00
      // Driver Base Pay Per Drop: $23.00 (not used in actual calculation)
      // Driver Total Base Pay: $40.00 (ALWAYS equals max in practice)
      // Ready Set Fee: $70.00
      // Ready Set Total Fee: $70.00
      // Driver Bonus Pay: $10.00 (shown separately, NOT added to total)
      // Total Driver Pay: $40.00 (equals max, bonus separate)
      // % Bonus Qualified: 100.00%

      expect(result.driverMaxPayPerDrop).toBe(40);
      expect(result.driverBasePayPerDrop).toBe(23);
      expect(result.driverTotalBasePay).toBe(40); // Equals max in practice
      expect(result.readySetFee).toBe(70);
      expect(result.readySetAddonFee).toBe(0);
      expect(result.readySetTotalFee).toBe(70);
      expect(result.driverBonusPay).toBe(10);
      expect(result.totalDriverPay).toBe(40); // Equals max, bonus NOT added
      expect(result.bonusQualifiedPercent).toBe(100);
      expect(result.bonusQualified).toBe(true);
      expect(result.totalMileagePay).toBe(7.0); // 3.1 miles × $0.70 = $2.17 < $7 minimum
    });

    test('driver pay always equals max per drop', () => {
      const input: DriverPayInput = {
        headcount: 50,
        foodCost: 800,
        totalMileage: 12,
        numberOfDrives: 1,
        bonusQualified: true,
        readySetFee: 70
      };

      const result = calculateDriverPay(input);

      // Per Coolfire data: totalDriverPay ALWAYS equals max, bonus shown separately
      expect(result.totalDriverPay).toBe(40);
      expect(result.driverBonusPay).toBe(10);
      // Bonus is NOT added to total
      expect(result.totalDriverPay).not.toBe(result.driverTotalBasePay + result.driverBonusPay);
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
      // Even without bonus, totalDriverPay equals max per drop
      expect(result.totalDriverPay).toBe(40);
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
});
