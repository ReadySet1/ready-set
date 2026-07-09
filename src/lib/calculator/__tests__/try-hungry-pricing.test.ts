/**
 * Try Hungry Pricing Tests
 *
 * Verifies correct pricing calculations for the Try Hungry client configuration.
 *
 * Key rules for Try Hungry:
 * 1. Ready Set fee is TIER-BASED (matches customer delivery fee), NOT fixed $70
 * 2. Driver mileage: $0.70/mile (flat $7 within 10 miles, total × $0.70 over 10 miles)
 * 3. Customer mileage add-on: $2.50/mile after 10 miles
 * 4. 100+ headcount requires manual review (case by case)
 *
 * Ready Set Fee by Headcount:
 * | Headcount | Ready Set Fee |
 * |-----------|--------------|
 * | < 25      | $40          |
 * | 25-49     | $50          |
 * | 50-74     | $60          |
 * | 75-99     | $70          |
 * | 100+      | Case by case |
 *
 * Driver Base Payment by Headcount:
 * | Headcount | Driver Base Pay |
 * |-----------|----------------|
 * | < 25      | $18.00         |
 * | 25-49     | $23.00         |
 * | 50-74     | $33.00         |
 * | 75-99     | $43.00         |
 * | 100+      | Case by case   |
 *
 * Driver Mileage:
 * - Within 10 miles: Flat $7.00 ($0.70/mi × 10)
 * - Over 10 miles: Total miles × $0.70
 *
 * Customer Mileage (Ready Set add-on):
 * - $0.70 first 10 miles (included in base)
 * - $2.50/mile after 10 miles
 */

import { calculateDeliveryCost, calculateDriverPay } from '../delivery-cost-calculator';
import { TRY_HUNGRY } from '../client-configurations';

describe('Try Hungry Pricing', () => {
  // ============================================================================
  // CONFIGURATION VALIDATION
  // ============================================================================

  describe('Configuration Validation', () => {
    it('should have readySetFeeMatchesDeliveryFee enabled', () => {
      expect(TRY_HUNGRY.driverPaySettings.readySetFeeMatchesDeliveryFee).toBe(true);
    });

    it('should have driverMileageSettings configured', () => {
      expect(TRY_HUNGRY.driverPaySettings.driverMileageSettings).toBeDefined();
      expect(TRY_HUNGRY.driverPaySettings.driverMileageSettings?.flatAmountWithinThreshold).toBe(7);
      expect(TRY_HUNGRY.driverPaySettings.driverMileageSettings?.perMileRateOverThreshold).toBe(0.70);
      expect(TRY_HUNGRY.driverPaySettings.driverMileageSettings?.threshold).toBe(10);
    });

    it('should have $2.50 customer mileage rate (after 10 miles)', () => {
      expect(TRY_HUNGRY.mileageRate).toBe(2.5);
    });

    it('should have 10-mile distance threshold', () => {
      expect(TRY_HUNGRY.distanceThreshold).toBe(10);
    });

    it('should have flat fee pricing (regularRate equals within10Miles)', () => {
      TRY_HUNGRY.pricingTiers.forEach((tier) => {
        expect(tier.regularRate).toBe(tier.within10Miles);
      });
    });

    it('should have $40 driver pay cap (maxPayPerDrop)', () => {
      expect(TRY_HUNGRY.driverPaySettings.maxPayPerDrop).toBe(40);
    });

    it('should have requiresManualReview flag for 100+ headcount', () => {
      expect(TRY_HUNGRY.driverPaySettings.requiresManualReview).toBe(true);
    });
  });

  // ============================================================================
  // READY SET FEE (TIER-BASED, NOT FIXED)
  // ============================================================================

  describe('Ready Set Fee (Tier-Based by Headcount)', () => {
    /**
     * Ready Set fee must match the customer delivery fee tier:
     * - < 25 HC → $40
     * - 25-49 HC → $50
     * - 50-74 HC → $60
     * - 75-99 HC → $70
     */
    it('should charge $40 Ready Set fee for headcount < 25', () => {
      const result = calculateDriverPay({
        headcount: 10,
        foodCost: 0,
        totalMileage: 5,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'try-hungry',
      });

      expect(result.readySetFee).toBe(40);
    });

    it('should charge $50 Ready Set fee for headcount 25-49', () => {
      const result = calculateDriverPay({
        headcount: 30,
        foodCost: 0,
        totalMileage: 5,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'try-hungry',
      });

      expect(result.readySetFee).toBe(50);
    });

    it('should charge $60 Ready Set fee for headcount 50-74', () => {
      const result = calculateDriverPay({
        headcount: 60,
        foodCost: 0,
        totalMileage: 5,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'try-hungry',
      });

      expect(result.readySetFee).toBe(60);
    });

    it('should charge $70 Ready Set fee for headcount 75-99', () => {
      const result = calculateDriverPay({
        headcount: 80,
        foodCost: 0,
        totalMileage: 5,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'try-hungry',
      });

      expect(result.readySetFee).toBe(70);
    });

    it('should use headcount-based tier even when food cost is also provided', () => {
      // Headcount 10 → tier < 25 → Ready Set fee = $40
      // (food cost may affect customer delivery fee via LESSER rule, but RS fee follows tier)
      const result = calculateDriverPay({
        headcount: 10,
        foodCost: 200,
        totalMileage: 5,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'try-hungry',
      });

      expect(result.readySetFee).toBe(40);
    });
  });

  // ============================================================================
  // DRIVER MILEAGE CALCULATION
  // ============================================================================

  describe('Driver Mileage Calculation', () => {
    /**
     * Try Hungry driver mileage rules:
     * - Within 10 miles: Flat $7.00
     * - Over 10 miles: Total miles × $0.70
     */
    it('should pay flat $7 mileage for drives within 10 miles (5 mi)', () => {
      const result = calculateDriverPay({
        headcount: 10,
        foodCost: 0,
        totalMileage: 5,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'try-hungry',
      });

      expect(result.totalMileagePay).toBe(7); // Flat $7
    });

    it('should pay flat $7 mileage for exactly 10 miles', () => {
      const result = calculateDriverPay({
        headcount: 10,
        foodCost: 0,
        totalMileage: 10,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'try-hungry',
      });

      expect(result.totalMileagePay).toBe(7); // Flat $7 at threshold
    });

    it('should calculate mileage as total × $0.70 for 11 miles', () => {
      const result = calculateDriverPay({
        headcount: 10,
        foodCost: 0,
        totalMileage: 11,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'try-hungry',
      });

      // 11 miles × $0.70 = $7.70
      expect(result.totalMileagePay).toBe(7.70);
      expect(result.mileageRate).toBe(0.70);
    });

    it('should calculate mileage as total × $0.70 for 15 miles', () => {
      const result = calculateDriverPay({
        headcount: 10,
        foodCost: 0,
        totalMileage: 15,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'try-hungry',
      });

      // 15 miles × $0.70 = $10.50
      expect(result.totalMileagePay).toBe(10.50);
    });

    it('should calculate mileage as total × $0.70 for 20 miles', () => {
      const result = calculateDriverPay({
        headcount: 10,
        foodCost: 0,
        totalMileage: 20,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'try-hungry',
      });

      // 20 miles × $0.70 = $14.00
      expect(result.totalMileagePay).toBe(14.00);
    });

    it('should pay flat $7 mileage for 0 miles (minimum flat rate)', () => {
      const result = calculateDriverPay({
        headcount: 10,
        foodCost: 0,
        totalMileage: 0,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'try-hungry',
      });

      expect(result.totalMileagePay).toBe(7); // Flat $7 (within threshold)
    });
  });

  // ============================================================================
  // DRIVER BASE PAY (TIERED BY HEADCOUNT)
  // ============================================================================

  describe('Driver Base Pay (Tiered by Headcount)', () => {
    /**
     * Driver base payment tiers:
     * - < 25: $18.00
     * - 25-49: $23.00
     * - 50-74: $33.00
     * - 75-99: $43.00
     * - 100+: case by case (basePay = 0)
     */
    it('should pay $18 driver base for headcount < 25', () => {
      const result = calculateDriverPay({
        headcount: 10,
        foodCost: 0,
        totalMileage: 5,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'try-hungry',
      });

      expect(result.driverBasePayPerDrop).toBe(18);
    });

    it('should pay $23 driver base for headcount 25-49', () => {
      const result = calculateDriverPay({
        headcount: 30,
        foodCost: 0,
        totalMileage: 5,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'try-hungry',
      });

      expect(result.driverBasePayPerDrop).toBe(23);
    });

    it('should pay $33 driver base for headcount 50-74', () => {
      const result = calculateDriverPay({
        headcount: 60,
        foodCost: 0,
        totalMileage: 5,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'try-hungry',
      });

      expect(result.driverBasePayPerDrop).toBe(33);
    });

    it('should pay $43 driver base for headcount 75-99', () => {
      const result = calculateDriverPay({
        headcount: 80,
        foodCost: 0,
        totalMileage: 5,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'try-hungry',
      });

      expect(result.driverBasePayPerDrop).toBe(43);
    });
  });

  // ============================================================================
  // CUSTOMER DELIVERY FEE
  // ============================================================================

  describe('Customer Delivery Fee (Flat Fee by Headcount)', () => {
    const testCases = [
      { headcount: 10, expectedFee: 40, tier: '< 25' },
      { headcount: 24, expectedFee: 40, tier: '< 25' },
      { headcount: 25, expectedFee: 50, tier: '25-49' },
      { headcount: 49, expectedFee: 50, tier: '25-49' },
      { headcount: 50, expectedFee: 60, tier: '50-74' },
      { headcount: 74, expectedFee: 60, tier: '50-74' },
      { headcount: 75, expectedFee: 70, tier: '75-99' },
      { headcount: 99, expectedFee: 70, tier: '75-99' },
    ];

    testCases.forEach(({ headcount, expectedFee, tier }) => {
      it(`Tier ${tier}: Headcount ${headcount} → $${expectedFee} delivery fee (within 10mi)`, () => {
        const result = calculateDeliveryCost({
          headcount,
          foodCost: 0,
          totalMileage: 5, // Within 10 miles
          clientConfigId: 'try-hungry',
        });

        expect(result.deliveryCost).toBe(expectedFee);
        expect(result.totalMileagePay).toBe(0); // No customer mileage within 10mi
        expect(result.deliveryFee).toBe(expectedFee);
      });
    });

    it('should charge $2.50/mile for customer mileage beyond 10 miles', () => {
      const result = calculateDeliveryCost({
        headcount: 30,
        foodCost: 0,
        totalMileage: 15, // 5 miles over threshold
        clientConfigId: 'try-hungry',
      });

      expect(result.deliveryCost).toBe(50); // Base tier fee
      expect(result.totalMileagePay).toBe(12.5); // (15-10) × $2.50
      expect(result.deliveryFee).toBe(62.5); // $50 + $12.50
    });
  });

  // ============================================================================
  // COMPLETE CALCULATION SCENARIOS
  // ============================================================================

  describe('Complete Calculation Scenarios', () => {
    /**
     * Scenario from screenshot: Headcount < 25, 0 miles, within 10 miles
     * Expected:
     * - Customer Fee: $40
     * - Ready Set Fee: $40 (matches tier)
     * - Driver Base: $18
     * - Driver Mileage: $7 (flat within 10mi)
     * - Driver Bonus: $10
     * - Total Driver Pay: capped at $35 (base $18 + mileage $7 + bonus $10 = $35)
     */
    it('Headcount < 25, within 10 miles: RS fee $40, driver mileage $7', () => {
      const deliveryCost = calculateDeliveryCost({
        headcount: 10,
        foodCost: 0,
        totalMileage: 5,
        clientConfigId: 'try-hungry',
      });

      const driverPay = calculateDriverPay({
        headcount: 10,
        foodCost: 0,
        totalMileage: 5,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'try-hungry',
      });

      // Customer delivery fee
      expect(deliveryCost.deliveryCost).toBe(40);
      expect(deliveryCost.deliveryFee).toBe(40);

      // Ready Set fee matches tier (NOT fixed $70)
      expect(driverPay.readySetFee).toBe(40);

      // Driver pay
      expect(driverPay.driverBasePayPerDrop).toBe(18);
      expect(driverPay.totalMileagePay).toBe(7); // Flat $7 (within 10mi)
      expect(driverPay.driverBonusPay).toBe(10);
      expect(driverPay.totalDriverPay).toBe(35); // $18 + $7 + $10 = $35
    });

    it('Headcount 25-49, within 10 miles: RS fee $50, driver base $23', () => {
      const driverPay = calculateDriverPay({
        headcount: 30,
        foodCost: 0,
        totalMileage: 8,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'try-hungry',
      });

      expect(driverPay.readySetFee).toBe(50);
      expect(driverPay.driverBasePayPerDrop).toBe(23);
      expect(driverPay.totalMileagePay).toBe(7); // Flat $7
      expect(driverPay.driverBonusPay).toBe(10);
      // $23 + $7 + $10 = $40, capped at $40
      expect(driverPay.totalDriverPay).toBe(40);
    });

    it('Headcount 50-74, within 10 miles: RS fee $60, driver base $33', () => {
      const driverPay = calculateDriverPay({
        headcount: 60,
        foodCost: 0,
        totalMileage: 5,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'try-hungry',
      });

      expect(driverPay.readySetFee).toBe(60);
      expect(driverPay.driverBasePayPerDrop).toBe(33);
      expect(driverPay.totalMileagePay).toBe(7); // Flat $7
      expect(driverPay.driverBonusPay).toBe(10);
      // Calculator returns uncapped total; maxPayPerDrop ($40) is metadata for the UI/service layer
      expect(driverPay.totalDriverPay).toBe(50); // $33 + $7 + $10
      expect(driverPay.driverMaxPayPerDrop).toBe(40); // Cap available for UI to apply
    });

    it('Headcount 75-99, within 10 miles: RS fee $70, driver base $43', () => {
      const driverPay = calculateDriverPay({
        headcount: 80,
        foodCost: 0,
        totalMileage: 5,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'try-hungry',
      });

      expect(driverPay.readySetFee).toBe(70);
      expect(driverPay.driverBasePayPerDrop).toBe(43);
      // Note: with $40 cap, base + mileage already exceeds cap
      // Behavior depends on how cap is applied in the calculator
    });

    it('Headcount 30, 15 miles: driver mileage = 15 × $0.70 = $10.50', () => {
      const driverPay = calculateDriverPay({
        headcount: 30,
        foodCost: 0,
        totalMileage: 15,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'try-hungry',
      });

      expect(driverPay.readySetFee).toBe(50); // Tier-based, not fixed
      expect(driverPay.driverBasePayPerDrop).toBe(23);
      expect(driverPay.totalMileagePay).toBe(10.50); // 15 × $0.70
      expect(driverPay.mileageRate).toBe(0.70);
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle headcount 0 with food cost = 0 (lowest tier)', () => {
      const result = calculateDriverPay({
        headcount: 0,
        foodCost: 0,
        totalMileage: 5,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'try-hungry',
      });

      // Lowest tier: < 25 headcount
      expect(result.readySetFee).toBe(40);
      expect(result.driverBasePayPerDrop).toBe(18);
      expect(result.totalMileagePay).toBe(7); // Flat $7
    });

    it('should not charge bonus when bonusQualified is false', () => {
      const result = calculateDriverPay({
        headcount: 10,
        foodCost: 0,
        totalMileage: 5,
        bonusQualified: false,
        clientConfigId: 'try-hungry',
      });

      expect(result.driverBonusPay).toBe(0);
      expect(result.totalDriverPay).toBe(25); // $18 + $7 + $0
    });

    it('should handle mileage at exactly 10 miles boundary (flat $7)', () => {
      const resultAt10 = calculateDriverPay({
        headcount: 10,
        foodCost: 0,
        totalMileage: 10,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'try-hungry',
      });

      expect(resultAt10.totalMileagePay).toBe(7); // Flat $7 (at threshold)
    });

    it('should handle mileage at 10.1 miles (over threshold)', () => {
      const result = calculateDriverPay({
        headcount: 10,
        foodCost: 0,
        totalMileage: 10.1,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'try-hungry',
      });

      // 10.1 × $0.70 = $7.07
      expect(result.totalMileagePay).toBe(7.07);
    });
  });

  // ============================================================================
  // 9% FOOD COST BAND (> $1,200)
  // ============================================================================

  describe('9% Food Cost Band (> $1,200)', () => {
    it('should charge 9% of food cost when headcount = 0 and foodCost > $1,200', () => {
      const result = calculateDeliveryCost({
        headcount: 0,
        foodCost: 1300,
        totalMileage: 5,
        clientConfigId: 'try-hungry',
      });

      // 1300 × 0.09 = $117.00
      expect(result.deliveryCost).toBe(117);
      expect(result.deliveryFee).toBe(117);
    });

    it('should charge 9% for foodCost = $2,000 (headcount = 0)', () => {
      const result = calculateDeliveryCost({
        headcount: 0,
        foodCost: 2000,
        totalMileage: 8,
        clientConfigId: 'try-hungry',
      });

      // 2000 × 0.09 = $180.00
      expect(result.deliveryCost).toBe(180);
    });

    it('should use lesser fee when both headcount and food cost are supplied', () => {
      // headcount 10 → tier < 25 → $40
      // foodCost 1300 → tier > 1200 → 1300 × 0.09 = $117
      // Lesser fee = $40 (headcount wins)
      const result = calculateDeliveryCost({
        headcount: 10,
        foodCost: 1300,
        totalMileage: 5,
        clientConfigId: 'try-hungry',
      });

      expect(result.deliveryCost).toBe(40);
    });

    it('should charge 9% at exact $1,200 boundary (foodCostMin)', () => {
      const result = calculateDeliveryCost({
        headcount: 0,
        foodCost: 1200,
        totalMileage: 5,
        clientConfigId: 'try-hungry',
      });

      // 1200 × 0.09 = $108.00
      expect(result.deliveryCost).toBe(108);
    });

    it('foodCost $1,199.99 (just below boundary) → $70 flat rate tier', () => {
      const result = calculateDeliveryCost({
        headcount: 0,
        foodCost: 1199.99,
        totalMileage: 5,
        clientConfigId: 'try-hungry',
      });

      expect(result.deliveryCost).toBe(70);
    });

    it('should add customer mileage surcharge on top of 9% band', () => {
      const result = calculateDeliveryCost({
        headcount: 0,
        foodCost: 1300,
        totalMileage: 15, // 5 miles over threshold
        clientConfigId: 'try-hungry',
      });

      // 9% of $1,300 = $117, plus (15-10) × $2.50 = $12.50
      expect(result.deliveryCost).toBe(117);
      expect(result.totalMileagePay).toBe(12.5);
      expect(result.deliveryFee).toBe(129.5);
    });
  });

  // ============================================================================
  // HEADCOUNT BOUNDARY TESTS
  // ============================================================================

  describe('Headcount Tier Boundaries', () => {
    it('headcount 24 → tier < 25 → $40', () => {
      const result = calculateDeliveryCost({
        headcount: 24, foodCost: 0, totalMileage: 5, clientConfigId: 'try-hungry',
      });
      expect(result.deliveryCost).toBe(40);
    });

    it('headcount 25 → tier 25-49 → $50', () => {
      const result = calculateDeliveryCost({
        headcount: 25, foodCost: 0, totalMileage: 5, clientConfigId: 'try-hungry',
      });
      expect(result.deliveryCost).toBe(50);
    });

    it('headcount 49 → tier 25-49 → $50', () => {
      const result = calculateDeliveryCost({
        headcount: 49, foodCost: 0, totalMileage: 5, clientConfigId: 'try-hungry',
      });
      expect(result.deliveryCost).toBe(50);
    });

    it('headcount 50 → tier 50-74 → $60', () => {
      const result = calculateDeliveryCost({
        headcount: 50, foodCost: 0, totalMileage: 5, clientConfigId: 'try-hungry',
      });
      expect(result.deliveryCost).toBe(60);
    });

    it('headcount 74 → tier 50-74 → $60', () => {
      const result = calculateDeliveryCost({
        headcount: 74, foodCost: 0, totalMileage: 5, clientConfigId: 'try-hungry',
      });
      expect(result.deliveryCost).toBe(60);
    });

    it('headcount 75 → tier 75-99 → $70', () => {
      const result = calculateDeliveryCost({
        headcount: 75, foodCost: 0, totalMileage: 5, clientConfigId: 'try-hungry',
      });
      expect(result.deliveryCost).toBe(70);
    });

    it('headcount 99 → tier 75-99 → $70', () => {
      const result = calculateDeliveryCost({
        headcount: 99, foodCost: 0, totalMileage: 5, clientConfigId: 'try-hungry',
      });
      expect(result.deliveryCost).toBe(70);
    });
  });

  // ============================================================================
  // MANUAL REVIEW (100+ HEADCOUNT)
  // ============================================================================

  describe('Manual Review (100+ Headcount)', () => {
    it('headcount >= 100 → checkManualReviewRequired throws', () => {
      expect(() =>
        calculateDeliveryCost({
          headcount: 100, foodCost: 0, totalMileage: 5, clientConfigId: 'try-hungry',
        }),
      ).toThrow('manual review');
    });

    it('headcount 110 → throws for manual review', () => {
      expect(() =>
        calculateDeliveryCost({
          headcount: 110, foodCost: 0, totalMileage: 5, clientConfigId: 'try-hungry',
        }),
      ).toThrow('manual review');
    });

    it('headcount 99 → does NOT throw (last non-review tier)', () => {
      expect(() =>
        calculateDeliveryCost({
          headcount: 99, foodCost: 0, totalMileage: 5, clientConfigId: 'try-hungry',
        }),
      ).not.toThrow();
    });

    it('headcount >= 100 with non-zero foodCost still triggers manual review', () => {
      // Regression: the 9% regularRatePercent on the 100+ tier must NOT
      // bypass the manual review guard when foodCost > 0
      expect(() =>
        calculateDeliveryCost({
          headcount: 100, foodCost: 100, totalMileage: 5, clientConfigId: 'try-hungry',
        }),
      ).toThrow('manual review');
    });

    it('headcount 150 with foodCost $1,500 → manual review, not 9%', () => {
      expect(() =>
        calculateDeliveryCost({
          headcount: 150, foodCost: 1500, totalMileage: 5, clientConfigId: 'try-hungry',
        }),
      ).toThrow('manual review');
    });
  });
});
