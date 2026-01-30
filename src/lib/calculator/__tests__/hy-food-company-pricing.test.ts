/**
 * HY Food Company Pricing Tests
 *
 * Verifies that HY Food Company uses the same Ready Set flat fee pricing tiers.
 * Both configurations should produce identical delivery costs for the same inputs.
 *
 * Pricing tiers (from PDF "Direct Client Pricing"):
 * | Headcount | Food Cost      | Delivery Fee |
 * |-----------|----------------|--------------|
 * | 0-24      | <$300          | $60          |
 * | 25-49     | $300-$599      | $70          |
 * | 50-74     | $600-$899      | $90          |
 * | 75-99     | $900-$1199     | $100         |
 * | 100-124   | $1200-$1499    | $120         |
 * | 125-149   | $1500-$1699    | $150         |
 * | 150-174   | $1700-$1899    | $180         |
 * | 175-199   | $1900-$2099    | $210         |
 * | 200-249   | $2100-$2299    | $280         |
 * | 250-299   | $2300-$2499    | $310         |
 *
 * Mileage: $2.50/mile ONLY for miles beyond 10 (HY Food Company specific rate)
 */

import { calculateDeliveryCost, calculateDriverPay } from '../delivery-cost-calculator';
import {
  READY_SET_FOOD_STANDARD,
  HY_FOOD_COMPANY_DIRECT,
} from '../client-configurations';

describe('HY Food Company Pricing matches Ready Set Flat Fee', () => {
  describe('Pricing Tiers Match', () => {
    it('should have identical pricing tiers between HY Food Company and Ready Set', () => {
      const hyTiers = HY_FOOD_COMPANY_DIRECT.pricingTiers;
      const readySetTiers = READY_SET_FOOD_STANDARD.pricingTiers;

      expect(hyTiers.length).toBe(readySetTiers.length);

      hyTiers.forEach((hyTier, index) => {
        const rsTier = readySetTiers[index];

        // Check headcount ranges match
        expect(hyTier.headcountMin).toBe(rsTier?.headcountMin);
        expect(hyTier.headcountMax).toBe(rsTier?.headcountMax);

        // Check food cost ranges match
        expect(hyTier.foodCostMin).toBe(rsTier?.foodCostMin);
        expect(hyTier.foodCostMax).toBe(rsTier?.foodCostMax);

        // Check rates match (flat fee = regularRate equals within10Miles)
        expect(hyTier.regularRate).toBe(rsTier?.regularRate);
        expect(hyTier.within10Miles).toBe(rsTier?.within10Miles);

        // Verify flat fee pricing (within10Miles should equal regularRate)
        expect(hyTier.within10Miles).toBe(hyTier.regularRate);
      });
    });

    it('should have custom mileage rate ($2.50/mile) for HY Food Company', () => {
      // HY Food Company has a special lower mileage rate
      expect(HY_FOOD_COMPANY_DIRECT.mileageRate).toBe(2.5);
      // This is different from Ready Set standard ($3.00)
      expect(READY_SET_FOOD_STANDARD.mileageRate).toBe(3.0);
    });

    it('should have the same distance threshold (10 miles)', () => {
      expect(HY_FOOD_COMPANY_DIRECT.distanceThreshold).toBe(READY_SET_FOOD_STANDARD.distanceThreshold);
      expect(HY_FOOD_COMPANY_DIRECT.distanceThreshold).toBe(10);
    });

    it('should have the same daily drive discounts', () => {
      expect(HY_FOOD_COMPANY_DIRECT.dailyDriveDiscounts).toEqual(
        READY_SET_FOOD_STANDARD.dailyDriveDiscounts
      );
    });
  });

  describe('Flat Fee Pricing Verification', () => {
    const testCases = [
      // Format: [headcount, foodCost, expectedFlatFee]
      { headcount: 10, foodCost: 200, expectedFee: 60, tier: '0-24' },
      { headcount: 24, foodCost: 299, expectedFee: 60, tier: '0-24' },
      { headcount: 25, foodCost: 300, expectedFee: 70, tier: '25-49' },
      { headcount: 49, foodCost: 599, expectedFee: 70, tier: '25-49' },
      { headcount: 50, foodCost: 600, expectedFee: 90, tier: '50-74' },
      { headcount: 74, foodCost: 899, expectedFee: 90, tier: '50-74' },
      { headcount: 75, foodCost: 900, expectedFee: 100, tier: '75-99' },
      { headcount: 99, foodCost: 1199, expectedFee: 100, tier: '75-99' },
      { headcount: 100, foodCost: 1200, expectedFee: 120, tier: '100-124' },
      { headcount: 124, foodCost: 1499, expectedFee: 120, tier: '100-124' },
      { headcount: 125, foodCost: 1500, expectedFee: 150, tier: '125-149' },
      { headcount: 149, foodCost: 1699, expectedFee: 150, tier: '125-149' },
      { headcount: 150, foodCost: 1700, expectedFee: 180, tier: '150-174' },
      { headcount: 174, foodCost: 1899, expectedFee: 180, tier: '150-174' },
      { headcount: 175, foodCost: 1900, expectedFee: 210, tier: '175-199' },
      { headcount: 199, foodCost: 2099, expectedFee: 210, tier: '175-199' },
      { headcount: 200, foodCost: 2100, expectedFee: 280, tier: '200-249' },
      { headcount: 249, foodCost: 2299, expectedFee: 280, tier: '200-249' },
      { headcount: 250, foodCost: 2300, expectedFee: 310, tier: '250-299' },
      { headcount: 299, foodCost: 2499, expectedFee: 310, tier: '250-299' },
    ];

    testCases.forEach(({ headcount, foodCost, expectedFee, tier }) => {
      it(`Tier ${tier}: Headcount ${headcount}, Food $${foodCost} → $${expectedFee} (within 10mi)`, () => {
        const hyResult = calculateDeliveryCost({
          headcount,
          foodCost,
          totalMileage: 8, // Within 10 miles
          clientConfigId: 'hy-food-company-direct',
        });

        const rsResult = calculateDeliveryCost({
          headcount,
          foodCost,
          totalMileage: 8, // Within 10 miles
          clientConfigId: 'ready-set-food-standard',
        });

        // Both should have the same delivery cost
        expect(hyResult.deliveryCost).toBe(expectedFee);
        expect(rsResult.deliveryCost).toBe(expectedFee);
        expect(hyResult.deliveryCost).toBe(rsResult.deliveryCost);

        // No mileage charge for within 10 miles
        expect(hyResult.totalMileagePay).toBe(0);
        expect(rsResult.totalMileagePay).toBe(0);
      });

      it(`Tier ${tier}: Same fee for beyond 10 miles (flat fee model)`, () => {
        const hyResultWithin = calculateDeliveryCost({
          headcount,
          foodCost,
          totalMileage: 8, // Within 10 miles
          clientConfigId: 'hy-food-company-direct',
        });

        const hyResultBeyond = calculateDeliveryCost({
          headcount,
          foodCost,
          totalMileage: 15, // Beyond 10 miles
          clientConfigId: 'hy-food-company-direct',
        });

        // Base delivery cost should be the same (flat fee)
        expect(hyResultWithin.deliveryCost).toBe(expectedFee);
        expect(hyResultBeyond.deliveryCost).toBe(expectedFee);

        // Beyond 10 miles should add mileage charge (HY Food Company: $2.50/mi)
        expect(hyResultBeyond.totalMileagePay).toBe(12.5); // (15-10) * $2.50 = $12.50
      });
    });
  });

  describe('Mileage Charges (Only Beyond 10 Miles)', () => {
    it('should NOT charge mileage for deliveries within 10 miles', () => {
      const result = calculateDeliveryCost({
        headcount: 25,
        foodCost: 400,
        totalMileage: 8,
        clientConfigId: 'hy-food-company-direct',
      });

      expect(result.deliveryCost).toBe(70); // Flat fee for tier 25-49
      expect(result.totalMileagePay).toBe(0); // No mileage charge
      expect(result.deliveryFee).toBe(70); // Total = flat fee only
    });

    it('should NOT charge mileage for exactly 10 miles', () => {
      const result = calculateDeliveryCost({
        headcount: 25,
        foodCost: 400,
        totalMileage: 10,
        clientConfigId: 'hy-food-company-direct',
      });

      expect(result.deliveryCost).toBe(70);
      expect(result.totalMileagePay).toBe(0);
      expect(result.deliveryFee).toBe(70);
    });

    it('should charge $2.50/mile for miles beyond 10 (HY Food Company specific rate)', () => {
      const result = calculateDeliveryCost({
        headcount: 25,
        foodCost: 400,
        totalMileage: 15,
        clientConfigId: 'hy-food-company-direct',
      });

      expect(result.deliveryCost).toBe(70); // Flat fee unchanged
      expect(result.totalMileagePay).toBe(12.5); // (15-10) * $2.50 = $12.50
      expect(result.deliveryFee).toBe(82.5); // $70 + $12.50 = $82.50
    });

    it('should calculate mileage correctly for various distances (HY Food Company: $2.50/mi)', () => {
      const testDistances = [
        { miles: 10, expectedMileage: 0 },
        { miles: 11, expectedMileage: 2.5 },   // (11-10) * $2.50
        { miles: 12, expectedMileage: 5 },     // (12-10) * $2.50
        { miles: 15, expectedMileage: 12.5 },  // (15-10) * $2.50
        { miles: 20, expectedMileage: 25 },    // (20-10) * $2.50
        { miles: 25, expectedMileage: 37.5 }, // (25-10) * $2.50
      ];

      testDistances.forEach(({ miles, expectedMileage }) => {
        const result = calculateDeliveryCost({
          headcount: 50,
          foodCost: 700,
          totalMileage: miles,
          clientConfigId: 'hy-food-company-direct',
        });

        expect(result.totalMileagePay).toBe(expectedMileage);
        expect(result.deliveryFee).toBe(90 + expectedMileage); // $90 flat fee + mileage
      });
    });
  });

  describe('Test Route from Documentation (Route #4)', () => {
    /**
     * From calculator-test-routes.md:
     * Route #4: HY Food Company
     * - Pickup: 121 S Maple Ave unit 3, South San Francisco, CA 94080
     * - Delivery: 120 Montgomery St, San Francisco, CA 94104
     * - Headcount: - (not specified = zero-order mode)
     * - Miles: 10
     * - Toll: -
     * - Expected Driver Pay: $30.00
     *
     * ZERO-ORDER MODE (headcount = 0 AND foodCost = 0):
     * When no headcount or food cost is specified, HY Food Company uses special pricing:
     * - Customer/Ready Set Fee: $50
     * - Driver: $13 base + $7 mileage (flat) + $10 bonus = $30 total
     *
     * This applies to standard drives within 10 miles without order details.
     */
    it('should calculate correct delivery cost for Route #4 (10 miles, no headcount) - ZERO ORDER MODE', () => {
      // Zero-order mode: headcount = 0 AND foodCost = 0
      const result = calculateDeliveryCost({
        headcount: 0,
        foodCost: 0,
        totalMileage: 10,
        clientConfigId: 'hy-food-company-direct',
      });

      // Zero-order pricing: Customer pays $50
      expect(result.deliveryCost).toBe(50);
      expect(result.totalMileagePay).toBe(0); // Zero-order has flat mileage included
      expect(result.deliveryFee).toBe(50);
    });

    it('should use normal tier pricing when headcount > 0', () => {
      // Normal mode: headcount > 0, should use tiered pricing
      const result = calculateDeliveryCost({
        headcount: 10, // Has headcount, so NOT zero-order
        foodCost: 0,
        totalMileage: 10,
        clientConfigId: 'hy-food-company-direct',
      });

      // Normal tier 0-24 pricing: $60
      expect(result.deliveryCost).toBe(60);
      expect(result.deliveryFee).toBe(60);
    });

    it('should use normal tier pricing when foodCost > 0', () => {
      // Normal mode: foodCost > 0, should use tiered pricing
      const result = calculateDeliveryCost({
        headcount: 0,
        foodCost: 100, // Has food cost, so NOT zero-order
        totalMileage: 10,
        clientConfigId: 'hy-food-company-direct',
      });

      // Normal tier 0-24 pricing: $60
      expect(result.deliveryCost).toBe(60);
      expect(result.deliveryFee).toBe(60);
    });
  });

  describe('LESSER Rule Verification', () => {
    it('should use LESSER fee when headcount and food cost are in different tiers', () => {
      // Headcount 25 = tier 25-49 ($70)
      // Food cost $200 = tier 0-24 ($60)
      // LESSER = $60
      const result = calculateDeliveryCost({
        headcount: 25,
        foodCost: 200,
        totalMileage: 8,
        clientConfigId: 'hy-food-company-direct',
      });

      expect(result.deliveryCost).toBe(60); // Uses lesser fee
    });

    it('should use LESSER fee (food cost tier) when it produces lower fee', () => {
      // Headcount 50 = tier 50-74 ($90)
      // Food cost $400 = tier 25-49 ($70)
      // LESSER = $70
      const result = calculateDeliveryCost({
        headcount: 50,
        foodCost: 400,
        totalMileage: 8,
        clientConfigId: 'hy-food-company-direct',
      });

      expect(result.deliveryCost).toBe(70); // Uses lesser fee from food cost tier
    });

    it('should use LESSER fee (headcount tier) when it produces lower fee', () => {
      // Headcount 25 = tier 25-49 ($70)
      // Food cost $700 = tier 50-74 ($90)
      // LESSER = $70
      const result = calculateDeliveryCost({
        headcount: 25,
        foodCost: 700,
        totalMileage: 8,
        clientConfigId: 'hy-food-company-direct',
      });

      expect(result.deliveryCost).toBe(70); // Uses lesser fee from headcount tier
    });
  });

  describe('Daily Drive Discounts', () => {
    it('should apply $5 discount per drive for 2 daily drives', () => {
      const result = calculateDeliveryCost({
        headcount: 25,
        foodCost: 400,
        totalMileage: 8,
        numberOfDrives: 2,
        clientConfigId: 'hy-food-company-direct',
      });

      expect(result.dailyDriveDiscount).toBe(10); // $5 × 2 drives
      expect(result.deliveryFee).toBe(60); // $70 - $10 = $60
    });

    it('should apply $10 discount per drive for 3 daily drives', () => {
      const result = calculateDeliveryCost({
        headcount: 25,
        foodCost: 400,
        totalMileage: 8,
        numberOfDrives: 3,
        clientConfigId: 'hy-food-company-direct',
      });

      expect(result.dailyDriveDiscount).toBe(30); // $10 × 3 drives
      expect(result.deliveryFee).toBe(40); // $70 - $30 = $40
    });

    it('should apply $15 discount per drive for 4+ daily drives', () => {
      const result = calculateDeliveryCost({
        headcount: 25,
        foodCost: 400,
        totalMileage: 8,
        numberOfDrives: 4,
        clientConfigId: 'hy-food-company-direct',
      });

      expect(result.dailyDriveDiscount).toBe(60); // $15 × 4 drives
      expect(result.deliveryFee).toBe(10); // $70 - $60 = $10
    });
  });

  describe('Complete Calculation Examples from Plan', () => {
    it('Headcount 25, Food $400, 8 miles → $70 (within 10mi = flat fee)', () => {
      const result = calculateDeliveryCost({
        headcount: 25,
        foodCost: 400,
        totalMileage: 8,
        clientConfigId: 'hy-food-company-direct',
      });

      expect(result.deliveryCost).toBe(70);
      expect(result.totalMileagePay).toBe(0);
      expect(result.deliveryFee).toBe(70);
    });

    it('Headcount 25, Food $400, 15 miles → $70 + (5 × $2.50) = $82.50', () => {
      const result = calculateDeliveryCost({
        headcount: 25,
        foodCost: 400,
        totalMileage: 15,
        clientConfigId: 'hy-food-company-direct',
      });

      expect(result.deliveryCost).toBe(70);
      expect(result.totalMileagePay).toBe(12.5); // 5 miles × $2.50
      expect(result.deliveryFee).toBe(82.5);
    });

    it('Headcount 50, Food $700, 10 miles → $90 (exactly at threshold)', () => {
      const result = calculateDeliveryCost({
        headcount: 50,
        foodCost: 700,
        totalMileage: 10,
        clientConfigId: 'hy-food-company-direct',
      });

      expect(result.deliveryCost).toBe(90);
      expect(result.totalMileagePay).toBe(0);
      expect(result.deliveryFee).toBe(90);
    });

    it('Headcount 50, Food $700, 12 miles → $90 + (2 × $2.50) = $95', () => {
      const result = calculateDeliveryCost({
        headcount: 50,
        foodCost: 700,
        totalMileage: 12,
        clientConfigId: 'hy-food-company-direct',
      });

      expect(result.deliveryCost).toBe(90);
      expect(result.totalMileagePay).toBe(5); // 2 miles × $2.50
      expect(result.deliveryFee).toBe(95);
    });
  });

  describe('Zero-Order Driver Pay (Route #4 Scenario)', () => {
    /**
     * ZERO-ORDER MODE for HY Food Company:
     * When headcount = 0 AND foodCost = 0 (standard drive within 10 miles):
     * - Ready Set Fee: $50
     * - Driver Base Pay: $13
     * - Driver Mileage: $7 (flat, not per-mile)
     * - Driver Bonus: $10
     * - Total Driver Pay: $30
     */
    it('should calculate zero-order driver pay: $13 base + $7 mileage + $10 bonus = $30', () => {
      const result = calculateDriverPay({
        headcount: 0,
        foodCost: 0,
        totalMileage: 10,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'hy-food-company-direct',
      });

      // Zero-order pricing
      expect(result.driverBasePayPerDrop).toBe(13);
      expect(result.driverTotalBasePay).toBe(13);
      expect(result.totalMileagePay).toBe(7); // Flat $7, not per-mile
      expect(result.driverBonusPay).toBe(10);
      expect(result.readySetFee).toBe(50);
      expect(result.totalDriverPay).toBe(30); // $13 + $7 + $10 = $30
    });

    it('should calculate zero-order driver pay without bonus: $13 base + $7 mileage = $20', () => {
      const result = calculateDriverPay({
        headcount: 0,
        foodCost: 0,
        totalMileage: 10,
        bonusQualified: false,
        clientConfigId: 'hy-food-company-direct',
      });

      expect(result.driverBasePayPerDrop).toBe(13);
      expect(result.totalMileagePay).toBe(7);
      expect(result.driverBonusPay).toBe(0);
      expect(result.totalDriverPay).toBe(20); // $13 + $7 + $0 = $20
    });

    it('should use tiered pricing when headcount > 0 (NOT zero-order)', () => {
      const result = calculateDriverPay({
        headcount: 10, // Has headcount = NOT zero-order, tier 0-24
        foodCost: 0,
        totalMileage: 10,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'hy-food-company-direct',
      });

      // Normal tiered pricing: headcount 10 = tier 0-24 = $13 base pay
      // Ready Set fee matches customer tier (0-24 = $60)
      expect(result.driverBasePayPerDrop).toBe(13);
      expect(result.readySetFee).toBe(60);
    });

    it('should use tiered pricing when foodCost > 0 (NOT zero-order)', () => {
      const result = calculateDriverPay({
        headcount: 0,
        foodCost: 100, // Has food cost = NOT zero-order
        totalMileage: 10,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'hy-food-company-direct',
      });

      // Normal tiered pricing: food cost $100 = tier $0-$299 = $13 base pay
      // Ready Set fee matches customer tier ($0-$299 = $60)
      expect(result.driverBasePayPerDrop).toBe(13);
      expect(result.readySetFee).toBe(60);
    });

    it('should use tiered pricing when mileage exceeds threshold (NOT zero-order)', () => {
      const result = calculateDriverPay({
        headcount: 0,
        foodCost: 0,
        totalMileage: 15, // Beyond 10 miles = NOT zero-order
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'hy-food-company-direct',
      });

      // Normal tiered pricing: headcount 0 = tier 0-24 = $13 base pay
      // Ready Set fee matches customer tier (0-24 regularRate = $60)
      expect(result.driverBasePayPerDrop).toBe(13);
      expect(result.readySetFee).toBe(60);
    });
  });

  describe('HY Food Company Tiered Driver Base Pay', () => {
    /**
     * HY Food Company Driver Base Payment tiers:
     * - $13.00 if headcount < 25
     * - $23.00 if headcount 25-49
     * - $33.00 if headcount 50-74
     * - $43.00 if headcount 75-99
     * - $53.00 if headcount > 100
     */
    it('should pay $13 driver base for headcount < 25', () => {
      const result = calculateDriverPay({
        headcount: 20,
        foodCost: 200,
        totalMileage: 5,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'hy-food-company-direct',
      });

      expect(result.driverBasePayPerDrop).toBe(13);
    });

    it('should pay $23 driver base for headcount 25-49', () => {
      const result = calculateDriverPay({
        headcount: 30,
        foodCost: 400,
        totalMileage: 5,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'hy-food-company-direct',
      });

      expect(result.driverBasePayPerDrop).toBe(23);
    });

    it('should pay $33 driver base for headcount 50-74', () => {
      const result = calculateDriverPay({
        headcount: 60,
        foodCost: 700,
        totalMileage: 5,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'hy-food-company-direct',
      });

      expect(result.driverBasePayPerDrop).toBe(33);
    });

    it('should pay $43 driver base for headcount 75-99', () => {
      const result = calculateDriverPay({
        headcount: 80,
        foodCost: 1000,
        totalMileage: 5,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'hy-food-company-direct',
      });

      expect(result.driverBasePayPerDrop).toBe(43);
    });

    it('should pay $53 driver base for headcount > 100', () => {
      const result = calculateDriverPay({
        headcount: 120,
        foodCost: 1400,
        totalMileage: 5,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'hy-food-company-direct',
      });

      expect(result.driverBasePayPerDrop).toBe(53);
    });

    it('should calculate correct total driver pay for tier 25-49 (within 10 miles)', () => {
      // Headcount 30 = $23 base
      // Mileage 5 (within 10 threshold) = $7 flat
      // Bonus = $10
      // Total = $23 + $7 + $10 = $40
      const result = calculateDriverPay({
        headcount: 30,
        foodCost: 400,
        totalMileage: 5,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'hy-food-company-direct',
      });

      expect(result.driverBasePayPerDrop).toBe(23);
      expect(result.driverBonusPay).toBe(10);
      // HY Food Company: flat $7 for drives within 10 miles
      expect(result.totalMileagePay).toBe(7);
      expect(result.totalDriverPay).toBe(40); // $23 + $7 + $10
    });
  });

  describe('HY Food Company Food Cost-Based Driver Base Pay (Headcount = 0)', () => {
    /**
     * When headcount is 0 but food cost > 0, driver base pay is determined by food cost tiers:
     * - $13.00 if Food Cost < $300
     * - $23.00 if Food Cost is $300-$599
     * - $33.00 if Food Cost is $600-$899
     * - $43.00 if Food Cost is $900-$1,199
     * - $53.00 if Food Cost > $1,200
     */
    it('should pay $13 driver base for food cost < $300 (when headcount = 0)', () => {
      const result = calculateDriverPay({
        headcount: 0,
        foodCost: 200,
        totalMileage: 5,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'hy-food-company-direct',
      });

      expect(result.driverBasePayPerDrop).toBe(13);
    });

    it('should pay $23 driver base for food cost $300-$599 (when headcount = 0)', () => {
      const result = calculateDriverPay({
        headcount: 0,
        foodCost: 300,
        totalMileage: 5,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'hy-food-company-direct',
      });

      expect(result.driverBasePayPerDrop).toBe(23);
    });

    it('should pay $23 driver base for food cost $400 (when headcount = 0)', () => {
      const result = calculateDriverPay({
        headcount: 0,
        foodCost: 400,
        totalMileage: 5,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'hy-food-company-direct',
      });

      expect(result.driverBasePayPerDrop).toBe(23);
    });

    it('should pay $33 driver base for food cost $600-$899 (when headcount = 0)', () => {
      const result = calculateDriverPay({
        headcount: 0,
        foodCost: 700,
        totalMileage: 5,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'hy-food-company-direct',
      });

      expect(result.driverBasePayPerDrop).toBe(33);
    });

    it('should pay $43 driver base for food cost $900-$1,199 (when headcount = 0)', () => {
      const result = calculateDriverPay({
        headcount: 0,
        foodCost: 1000,
        totalMileage: 5,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'hy-food-company-direct',
      });

      expect(result.driverBasePayPerDrop).toBe(43);
    });

    it('should pay $53 driver base for food cost $1,200+ (when headcount = 0)', () => {
      const result = calculateDriverPay({
        headcount: 0,
        foodCost: 1500,
        totalMileage: 5,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'hy-food-company-direct',
      });

      expect(result.driverBasePayPerDrop).toBe(53);
    });

    it('should calculate correct total driver pay for food cost $300 (tier $300-$599) within 10 miles', () => {
      // Food Cost $300 = $23 base
      // Mileage 5 (within 10 threshold) = $7 flat
      // Bonus = $10
      // Total = $23 + $7 + $10 = $40
      const result = calculateDriverPay({
        headcount: 0,
        foodCost: 300,
        totalMileage: 5,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'hy-food-company-direct',
      });

      expect(result.driverBasePayPerDrop).toBe(23);
      expect(result.totalMileagePay).toBe(7);
      expect(result.driverBonusPay).toBe(10);
      expect(result.totalDriverPay).toBe(40); // $23 + $7 + $10
    });

    it('should calculate correct total driver pay for food cost $700 (tier $600-$899) within 10 miles', () => {
      // Food Cost $700 = $33 base
      // Mileage 8 (within 10 threshold) = $7 flat
      // Bonus = $10
      // Total = $33 + $7 + $10 = $50
      const result = calculateDriverPay({
        headcount: 0,
        foodCost: 700,
        totalMileage: 8,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'hy-food-company-direct',
      });

      expect(result.driverBasePayPerDrop).toBe(33);
      expect(result.totalMileagePay).toBe(7);
      expect(result.driverBonusPay).toBe(10);
      expect(result.totalDriverPay).toBe(50); // $33 + $7 + $10
    });

    it('should still use headcount-based tiers when headcount > 0', () => {
      // Even with high food cost, headcount should take precedence
      const result = calculateDriverPay({
        headcount: 30, // Headcount tier 25-49 = $23
        foodCost: 1000, // Would be $43 if using food cost
        totalMileage: 5,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'hy-food-company-direct',
      });

      expect(result.driverBasePayPerDrop).toBe(23); // Uses headcount tier, not food cost
    });
  });

  describe('HY Food Company Driver Mileage Calculation', () => {
    /**
     * HY Food Company Mileage Rules:
     * - Within 10 miles: Flat $7
     * - Over 10 miles: Total miles × $0.70 (e.g., 11 mi × $0.70 = $7.70)
     */
    it('should pay flat $7 mileage for drives within 10 miles', () => {
      const result = calculateDriverPay({
        headcount: 20,
        foodCost: 200,
        totalMileage: 5,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'hy-food-company-direct',
      });

      expect(result.totalMileagePay).toBe(7); // Flat $7
    });

    it('should pay flat $7 mileage for exactly 10 miles', () => {
      const result = calculateDriverPay({
        headcount: 20,
        foodCost: 200,
        totalMileage: 10,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'hy-food-company-direct',
      });

      expect(result.totalMileagePay).toBe(7); // Flat $7
    });

    it('should calculate mileage as total × $0.70 for over 10 miles (11 mi)', () => {
      const result = calculateDriverPay({
        headcount: 20,
        foodCost: 200,
        totalMileage: 11,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'hy-food-company-direct',
      });

      // 11 miles × $0.70 = $7.70
      expect(result.totalMileagePay).toBe(7.70);
      expect(result.mileageRate).toBe(0.70);
    });

    it('should calculate mileage as total × $0.70 for over 10 miles (15 mi)', () => {
      const result = calculateDriverPay({
        headcount: 30,
        foodCost: 400,
        totalMileage: 15,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'hy-food-company-direct',
      });

      // 15 miles × $0.70 = $10.50
      expect(result.totalMileagePay).toBe(10.50);
    });

    it('should calculate mileage as total × $0.70 for over 10 miles (20 mi)', () => {
      const result = calculateDriverPay({
        headcount: 50,
        foodCost: 700,
        totalMileage: 20,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'hy-food-company-direct',
      });

      // 20 miles × $0.70 = $14.00
      expect(result.totalMileagePay).toBe(14.00);
    });

    it('should calculate complete driver pay for drive over 10 miles', () => {
      // Headcount 30 = $23 base (tier 25-49)
      // Mileage 15 = 15 × $0.70 = $10.50
      // Bonus = $10
      // Total = $23 + $10.50 + $10 = $43.50
      const result = calculateDriverPay({
        headcount: 30,
        foodCost: 400,
        totalMileage: 15,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'hy-food-company-direct',
      });

      expect(result.driverBasePayPerDrop).toBe(23);
      expect(result.totalMileagePay).toBe(10.50);
      expect(result.driverBonusPay).toBe(10);
      expect(result.totalDriverPay).toBe(43.50); // $23 + $10.50 + $10
    });
  });
});
