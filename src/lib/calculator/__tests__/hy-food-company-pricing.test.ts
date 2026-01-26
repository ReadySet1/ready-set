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
 * Mileage: $3.00/mile ONLY for miles beyond 10
 */

import { calculateDeliveryCost } from '../delivery-cost-calculator';
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

    it('should have the same mileage rate ($3.00/mile)', () => {
      expect(HY_FOOD_COMPANY_DIRECT.mileageRate).toBe(READY_SET_FOOD_STANDARD.mileageRate);
      expect(HY_FOOD_COMPANY_DIRECT.mileageRate).toBe(3.0);
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

        // Beyond 10 miles should add mileage charge
        expect(hyResultBeyond.totalMileagePay).toBe(15); // (15-10) * $3 = $15
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

    it('should charge $3/mile for miles beyond 10', () => {
      const result = calculateDeliveryCost({
        headcount: 25,
        foodCost: 400,
        totalMileage: 15,
        clientConfigId: 'hy-food-company-direct',
      });

      expect(result.deliveryCost).toBe(70); // Flat fee unchanged
      expect(result.totalMileagePay).toBe(15); // (15-10) * $3 = $15
      expect(result.deliveryFee).toBe(85); // $70 + $15 = $85
    });

    it('should calculate mileage correctly for various distances', () => {
      const testDistances = [
        { miles: 10, expectedMileage: 0 },
        { miles: 11, expectedMileage: 3 },
        { miles: 12, expectedMileage: 6 },
        { miles: 15, expectedMileage: 15 },
        { miles: 20, expectedMileage: 30 },
        { miles: 25, expectedMileage: 45 },
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
     * - Headcount: - (not specified, assume lowest tier)
     * - Miles: 10
     * - Toll: -
     * - Expected Driver Pay: $30.00
     *
     * Note: The expected driver pay of $30 was based on the OLD within10Miles pricing.
     * With flat fee pricing, the delivery cost should now be $60 (tier 0-24).
     * Driver pay calculation is separate from delivery cost.
     */
    it('should calculate correct delivery cost for Route #4 (10 miles, no headcount)', () => {
      // When headcount is 0 or not specified, use lowest tier
      const result = calculateDeliveryCost({
        headcount: 0, // Not specified in test data
        foodCost: 0, // Not specified
        totalMileage: 10,
        clientConfigId: 'hy-food-company-direct',
      });

      // With flat fee pricing, lowest tier is $60
      expect(result.deliveryCost).toBe(60);
      expect(result.totalMileagePay).toBe(0); // Exactly 10 miles = no extra charge
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

    it('Headcount 25, Food $400, 15 miles → $70 + (5 × $3) = $85', () => {
      const result = calculateDeliveryCost({
        headcount: 25,
        foodCost: 400,
        totalMileage: 15,
        clientConfigId: 'hy-food-company-direct',
      });

      expect(result.deliveryCost).toBe(70);
      expect(result.totalMileagePay).toBe(15); // 5 miles × $3
      expect(result.deliveryFee).toBe(85);
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

    it('Headcount 50, Food $700, 12 miles → $90 + (2 × $3) = $96', () => {
      const result = calculateDeliveryCost({
        headcount: 50,
        foodCost: 700,
        totalMileage: 12,
        clientConfigId: 'hy-food-company-direct',
      });

      expect(result.deliveryCost).toBe(90);
      expect(result.totalMileagePay).toBe(6); // 2 miles × $3
      expect(result.deliveryFee).toBe(96);
    });
  });
});
