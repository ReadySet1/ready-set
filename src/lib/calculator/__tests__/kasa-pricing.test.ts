/**
 * Kasa Pricing Tests
 *
 * Verifies correct pricing calculations for the Kasa client configuration.
 *
 * Key rules for Kasa:
 * 1. Ready Set fee is TIER-BASED (matches customer delivery fee via LESSER rule)
 * 2. Two distinct rate structures: within 10 miles vs over 10 miles
 * 3. Driver mileage: flat $7 within 10mi, total × $0.70 over 10mi
 * 4. Customer/RS mileage add-on: $3.00/mile after 10 miles
 * 5. 125+ headcount requires manual review (case by case)
 * 6. RS Total = RS Fee + Addon + Toll + Tip
 * 7. Driver Total = Base Pay + Mileage + Bonus + Extra Stops + Bridge Toll + Tip
 *
 * Ready Set Fee (within 10 miles):
 * | Headcount | Food Cost       | RS Fee |
 * |-----------|-----------------|--------|
 * | 0-24      | < $300          | $30    |
 * | 25-49     | $300-$599       | $40    |
 * | 50-74     | $600-$899       | $60    |
 * | 75-99     | $900-$1,199     | $70    |
 * | 100-124   | $1,200-$1,499   | $80    |
 * | 125-149   | $1,500-$1,699   | $90    |
 * | 150-174   | $1,700-$1,899   | $100   |
 * | 175-199   | $1,900-$2,099   | $110   |
 * | 200-249   | $2,100-$2,299   | $120   |
 * | 250-299   | $2,300-$2,499   | $130   |
 *
 * Ready Set Fee (over 10 miles):
 * | Headcount | Food Cost       | RS Fee |
 * |-----------|-----------------|--------|
 * | 0-24      | < $300          | $60    |
 * | 25-49     | $300-$599       | $70    |
 * | 50-74     | $600-$899       | $90    |
 * | 75-99     | $900-$1,199     | $100   |
 * | 100-124   | $1,200-$1,499   | $120   |
 * | 125-149   | $1,500-$1,699   | $150   |
 * | 150-174   | $1,700-$1,899   | $180   |
 * | 175-199   | $1,900-$2,099   | $210   |
 * | 200-249   | $2,100-$2,299   | $280   |
 * | 250-299   | $2,300-$2,499   | $310   |
 *
 * Driver Base Payment:
 * | Headcount | Food Cost       | Base Pay |
 * |-----------|-----------------|----------|
 * | 0-24      | < $300          | $18      |
 * | 25-49     | $300-$599       | $23      |
 * | 50-74     | $600-$899       | $33      |
 * | 75-99     | $900-$1,199     | $43      |
 * | 100-124   | $1,200-$1,499   | $53      |
 * | 125+      | $1,500+         | Case by case |
 *
 * Driver Mileage:
 * - Within 10 miles: Flat $7.00
 * - Over 10 miles: Total miles × $0.70
 *
 * Daily Drive Discount:
 * - 2 drives/day: -$5/drive
 * - 3 drives/day: -$10/drive
 * - 4+ drives/day: -$15/drive
 */

import { calculateDeliveryCost, calculateDriverPay } from '../delivery-cost-calculator';
import { KASA } from '../client-configurations';

describe('Kasa Pricing', () => {
  // ============================================================================
  // CONFIGURATION VALIDATION
  // ============================================================================

  describe('Configuration Validation', () => {
    it('should have readySetFeeMatchesDeliveryFee enabled', () => {
      expect(KASA.driverPaySettings.readySetFeeMatchesDeliveryFee).toBe(true);
    });

    it('should include direct tip in Ready Set total fee', () => {
      expect(KASA.driverPaySettings.includeDirectTipInReadySetTotal).toBe(true);
    });

    it('should have no max pay cap (null)', () => {
      expect(KASA.driverPaySettings.maxPayPerDrop).toBeNull();
    });

    it('should have driverMileageSettings configured', () => {
      expect(KASA.driverPaySettings.driverMileageSettings).toBeDefined();
      expect(KASA.driverPaySettings.driverMileageSettings?.flatAmountWithinThreshold).toBe(7);
      expect(KASA.driverPaySettings.driverMileageSettings?.perMileRateOverThreshold).toBe(0.70);
      expect(KASA.driverPaySettings.driverMileageSettings?.threshold).toBe(10);
    });

    it('should have $3.00 customer mileage rate (after 10 miles)', () => {
      expect(KASA.mileageRate).toBe(3.0);
    });

    it('should have 10-mile distance threshold', () => {
      expect(KASA.distanceThreshold).toBe(10);
    });

    it('should have requiresManualReview flag for 125+ headcount', () => {
      expect(KASA.driverPaySettings.requiresManualReview).toBe(true);
    });

    it('should have $10 bonus pay', () => {
      expect(KASA.driverPaySettings.bonusPay).toBe(10);
    });

    it('should have daily drive discounts of $5/$10/$15', () => {
      expect(KASA.dailyDriveDiscounts.twoDrivers).toBe(5);
      expect(KASA.dailyDriveDiscounts.threeDrivers).toBe(10);
      expect(KASA.dailyDriveDiscounts.fourPlusDrivers).toBe(15);
    });

    it('should have distinct within/beyond 10 miles rates (not flat)', () => {
      KASA.pricingTiers.slice(0, -1).forEach((tier) => {
        expect(tier.within10Miles).toBeLessThan(tier.regularRate);
      });
    });
  });

  // ============================================================================
  // CUSTOMER DELIVERY FEE - WITHIN 10 MILES
  // ============================================================================

  describe('Customer Delivery Fee — Within 10 Miles', () => {
    const within10MiCases = [
      { headcount: 10, foodCost: 200, expected: 30, tier: '0-24' },
      { headcount: 24, foodCost: 250, expected: 30, tier: '0-24 (boundary)' },
      { headcount: 30, foodCost: 400, expected: 40, tier: '25-49' },
      { headcount: 60, foodCost: 750, expected: 60, tier: '50-74' },
      { headcount: 80, foodCost: 1000, expected: 70, tier: '75-99' },
      { headcount: 110, foodCost: 1300, expected: 80, tier: '100-124' },
      { headcount: 130, foodCost: 1600, expected: 90, tier: '125-149' },
      { headcount: 160, foodCost: 1800, expected: 100, tier: '150-174' },
      { headcount: 180, foodCost: 2000, expected: 110, tier: '175-199' },
      { headcount: 220, foodCost: 2200, expected: 120, tier: '200-249' },
      { headcount: 260, foodCost: 2400, expected: 130, tier: '250-299' },
    ];

    within10MiCases.forEach(({ headcount, foodCost, expected, tier }) => {
      it(`Tier ${tier}: HC ${headcount}, FC $${foodCost} → $${expected}`, () => {
        const result = calculateDeliveryCost({
          headcount,
          foodCost,
          totalMileage: 8,
          clientConfigId: 'kasa',
        });

        expect(result.deliveryCost).toBe(expected);
        expect(result.totalMileagePay).toBe(0);
        expect(result.deliveryFee).toBe(expected);
      });
    });
  });

  // ============================================================================
  // CUSTOMER DELIVERY FEE - OVER 10 MILES
  // ============================================================================

  describe('Customer Delivery Fee — Over 10 Miles', () => {
    const over10MiCases = [
      { headcount: 10, foodCost: 200, expected: 60, tier: '0-24' },
      { headcount: 30, foodCost: 400, expected: 70, tier: '25-49' },
      { headcount: 60, foodCost: 750, expected: 90, tier: '50-74' },
      { headcount: 80, foodCost: 1000, expected: 100, tier: '75-99' },
      { headcount: 110, foodCost: 1300, expected: 120, tier: '100-124' },
      { headcount: 130, foodCost: 1600, expected: 150, tier: '125-149' },
      { headcount: 160, foodCost: 1800, expected: 180, tier: '150-174' },
      { headcount: 180, foodCost: 2000, expected: 210, tier: '175-199' },
      { headcount: 220, foodCost: 2200, expected: 280, tier: '200-249' },
      { headcount: 260, foodCost: 2400, expected: 310, tier: '250-299' },
    ];

    over10MiCases.forEach(({ headcount, foodCost, expected, tier }) => {
      it(`Tier ${tier}: HC ${headcount}, FC $${foodCost} → $${expected}`, () => {
        const result = calculateDeliveryCost({
          headcount,
          foodCost,
          totalMileage: 15,
          clientConfigId: 'kasa',
        });

        expect(result.deliveryCost).toBe(expected);
        // Mileage: (15 - 10) × $3.00 = $15.00
        expect(result.totalMileagePay).toBe(15.00);
        expect(result.deliveryFee).toBe(expected + 15.00);
      });
    });

    it('should calculate mileage at $3.00/mi for 20 miles (10 extra)', () => {
      const result = calculateDeliveryCost({
        headcount: 30,
        foodCost: 400,
        totalMileage: 20,
        clientConfigId: 'kasa',
      });

      expect(result.deliveryCost).toBe(70);
      // (20 - 10) × $3.00 = $30.00
      expect(result.totalMileagePay).toBe(30.00);
      expect(result.deliveryFee).toBe(100.00);
    });
  });

  // ============================================================================
  // LESSER RULE — TIER DETERMINED BY LESSER FEE
  // ============================================================================

  describe('LESSER Rule — Tier Determined by Lesser Fee', () => {
    it('should use food cost tier when it yields a lesser fee (within 10mi)', () => {
      // HC 60 → tier 50-74 → $60 within 10mi
      // FC $350 → tier 25-49 → $40 within 10mi
      // LESSER = $40
      const result = calculateDeliveryCost({
        headcount: 60,
        foodCost: 350,
        totalMileage: 5,
        clientConfigId: 'kasa',
      });

      expect(result.deliveryCost).toBe(40);
    });

    it('should use headcount tier when it yields a lesser fee (within 10mi)', () => {
      // HC 10 → tier 0-24 → $30 within 10mi
      // FC $750 → tier 50-74 → $60 within 10mi
      // LESSER = $30
      const result = calculateDeliveryCost({
        headcount: 10,
        foodCost: 750,
        totalMileage: 5,
        clientConfigId: 'kasa',
      });

      expect(result.deliveryCost).toBe(30);
    });

    it('should use food cost tier when it yields a lesser fee (over 10mi)', () => {
      // HC 80 → tier 75-99 → $100 over 10mi
      // FC $400 → tier 25-49 → $70 over 10mi
      // LESSER = $70
      const result = calculateDeliveryCost({
        headcount: 80,
        foodCost: 400,
        totalMileage: 12,
        clientConfigId: 'kasa',
      });

      expect(result.deliveryCost).toBe(70);
    });
  });

  // ============================================================================
  // READY SET FEE — TIER-BASED (WITHIN 10 MILES)
  // ============================================================================

  describe('Ready Set Fee — Tier-Based (Within 10 Miles)', () => {
    const rsFeeWithin10MiCases = [
      { headcount: 10, foodCost: 200, expected: 30, tier: '0-24' },
      { headcount: 30, foodCost: 400, expected: 40, tier: '25-49' },
      { headcount: 60, foodCost: 750, expected: 60, tier: '50-74' },
      { headcount: 80, foodCost: 1000, expected: 70, tier: '75-99' },
      { headcount: 110, foodCost: 1300, expected: 80, tier: '100-124' },
    ];

    rsFeeWithin10MiCases.forEach(({ headcount, foodCost, expected, tier }) => {
      it(`Tier ${tier}: HC ${headcount} → RS fee $${expected}`, () => {
        const result = calculateDriverPay({
          headcount,
          foodCost,
          totalMileage: 8,
          bonusQualified: true,
          bonusQualifiedPercent: 100,
          clientConfigId: 'kasa',
        });

        expect(result.readySetFee).toBe(expected);
      });
    });
  });

  // ============================================================================
  // READY SET FEE — TIER-BASED (OVER 10 MILES)
  // ============================================================================

  describe('Ready Set Fee — Tier-Based (Over 10 Miles)', () => {
    const rsFeeOver10MiCases = [
      { headcount: 10, foodCost: 200, expected: 60, tier: '0-24' },
      { headcount: 30, foodCost: 400, expected: 70, tier: '25-49' },
      { headcount: 60, foodCost: 750, expected: 90, tier: '50-74' },
      { headcount: 80, foodCost: 1000, expected: 100, tier: '75-99' },
      { headcount: 110, foodCost: 1300, expected: 120, tier: '100-124' },
    ];

    rsFeeOver10MiCases.forEach(({ headcount, foodCost, expected, tier }) => {
      it(`Tier ${tier}: HC ${headcount} → RS fee $${expected}`, () => {
        const result = calculateDriverPay({
          headcount,
          foodCost,
          totalMileage: 15,
          bonusQualified: true,
          bonusQualifiedPercent: 100,
          clientConfigId: 'kasa',
        });

        expect(result.readySetFee).toBe(expected);
      });
    });
  });

  // ============================================================================
  // READY SET TOTAL FEE FORMULA: RS Fee + Addon + Toll + Tip
  // ============================================================================

  describe('Ready Set Total Fee = RS Fee + Addon + Toll + Tip', () => {
    it('should include addon fee in RS total', () => {
      const result = calculateDriverPay({
        headcount: 30,
        foodCost: 400,
        totalMileage: 8,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        readySetAddonFee: 15,
        clientConfigId: 'kasa',
      });

      // RS Fee $40 + Addon $15 = $55
      expect(result.readySetFee).toBe(40);
      expect(result.readySetAddonFee).toBe(15);
      expect(result.readySetTotalFee).toBe(55);
    });

    it('should include bridge toll in RS total', () => {
      const result = calculateDriverPay({
        headcount: 30,
        foodCost: 400,
        totalMileage: 8,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        requiresBridge: true,
        clientConfigId: 'kasa',
      });

      // RS Fee $40 + Toll $8.50 = $48.50
      expect(result.readySetFee).toBe(40);
      expect(result.bridgeToll).toBe(8.50);
      expect(result.readySetTotalFee).toBe(48.50);
    });

    it('should include direct tip in RS total (Kasa-specific)', () => {
      const result = calculateDriverPay({
        headcount: 30,
        foodCost: 400,
        totalMileage: 8,
        bonusQualified: false,
        directTip: 20,
        clientConfigId: 'kasa',
      });

      // RS Fee $40 + Tip $20 = $60
      expect(result.readySetFee).toBe(40);
      expect(result.readySetTotalFee).toBe(60);
    });

    it('should combine all components: RS Fee + Addon + Toll + Tip', () => {
      const result = calculateDriverPay({
        headcount: 60,
        foodCost: 750,
        totalMileage: 8,
        bonusQualified: false,
        directTip: 25,
        readySetAddonFee: 10,
        requiresBridge: true,
        clientConfigId: 'kasa',
      });

      // RS Fee $60 + Addon $10 + Toll $8.50 + Tip $25 = $103.50
      expect(result.readySetFee).toBe(60);
      expect(result.readySetTotalFee).toBe(103.50);
    });
  });

  // ============================================================================
  // DRIVER BASE PAY — TIERED BY HEADCOUNT
  // ============================================================================

  describe('Driver Base Pay — Tiered by Headcount', () => {
    const basePayCases = [
      { headcount: 10, expected: 18, tier: '0-24' },
      { headcount: 24, expected: 18, tier: '0-24 (boundary)' },
      { headcount: 25, expected: 23, tier: '25-49' },
      { headcount: 49, expected: 23, tier: '25-49 (boundary)' },
      { headcount: 50, expected: 33, tier: '50-74' },
      { headcount: 74, expected: 33, tier: '50-74 (boundary)' },
      { headcount: 75, expected: 43, tier: '75-99' },
      { headcount: 99, expected: 43, tier: '75-99 (boundary)' },
      { headcount: 100, expected: 53, tier: '100-124' },
      { headcount: 124, expected: 53, tier: '100-124 (boundary)' },
    ];

    basePayCases.forEach(({ headcount, expected, tier }) => {
      it(`Tier ${tier}: HC ${headcount} → $${expected} base pay`, () => {
        const result = calculateDriverPay({
          headcount,
          foodCost: 0,
          totalMileage: 5,
          bonusQualified: true,
          bonusQualifiedPercent: 100,
          clientConfigId: 'kasa',
        });

        expect(result.driverBasePayPerDrop).toBe(expected);
        expect(result.driverTotalBasePay).toBe(expected);
      });
    });
  });

  // ============================================================================
  // DRIVER BASE PAY — FOOD COST TIERS (WHEN HEADCOUNT = 0)
  // ============================================================================

  describe('Driver Base Pay — Food Cost Tiers (headcount = 0)', () => {
    const foodCostBasePayCases = [
      { foodCost: 200, expected: 18, tier: '< $300' },
      { foodCost: 400, expected: 23, tier: '$300-$599' },
      { foodCost: 750, expected: 33, tier: '$600-$899' },
      { foodCost: 1000, expected: 43, tier: '$900-$1,199' },
      { foodCost: 1300, expected: 53, tier: '$1,200-$1,499' },
    ];

    foodCostBasePayCases.forEach(({ foodCost, expected, tier }) => {
      it(`Food cost tier ${tier}: FC $${foodCost} → $${expected} base pay`, () => {
        const result = calculateDriverPay({
          headcount: 0,
          foodCost,
          totalMileage: 5,
          bonusQualified: true,
          bonusQualifiedPercent: 100,
          clientConfigId: 'kasa',
        });

        expect(result.driverBasePayPerDrop).toBe(expected);
        expect(result.driverTotalBasePay).toBe(expected);
      });
    });
  });

  // ============================================================================
  // DRIVER MILEAGE CALCULATION
  // ============================================================================

  describe('Driver Mileage Calculation', () => {
    it('should pay flat $7 mileage for drives within 10 miles (5 mi)', () => {
      const result = calculateDriverPay({
        headcount: 30,
        foodCost: 400,
        totalMileage: 5,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'kasa',
      });

      expect(result.totalMileagePay).toBe(7);
      expect(result.mileageRate).toBe(0); // Flat rate, not per-mile
    });

    it('should pay flat $7 mileage for exactly 10 miles', () => {
      const result = calculateDriverPay({
        headcount: 30,
        foodCost: 400,
        totalMileage: 10,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'kasa',
      });

      expect(result.totalMileagePay).toBe(7);
    });

    it('should calculate mileage as total × $0.70 for 11 miles', () => {
      const result = calculateDriverPay({
        headcount: 30,
        foodCost: 400,
        totalMileage: 11,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'kasa',
      });

      // 11 miles × $0.70 = $7.70
      expect(result.totalMileagePay).toBe(7.70);
      expect(result.mileageRate).toBe(0.70);
    });

    it('should calculate mileage as total × $0.70 for 15 miles', () => {
      const result = calculateDriverPay({
        headcount: 30,
        foodCost: 400,
        totalMileage: 15,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'kasa',
      });

      // 15 miles × $0.70 = $10.50
      expect(result.totalMileagePay).toBe(10.50);
    });

    it('should calculate mileage as total × $0.70 for 20 miles', () => {
      const result = calculateDriverPay({
        headcount: 30,
        foodCost: 400,
        totalMileage: 20,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'kasa',
      });

      // 20 miles × $0.70 = $14.00
      expect(result.totalMileagePay).toBe(14.00);
    });

    it('should pay flat $7 mileage for 0 miles (within threshold)', () => {
      const result = calculateDriverPay({
        headcount: 30,
        foodCost: 400,
        totalMileage: 0,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'kasa',
      });

      expect(result.totalMileagePay).toBe(7);
    });
  });

  // ============================================================================
  // DRIVER BONUS PAY
  // ============================================================================

  describe('Driver Bonus Pay', () => {
    it('should include $10 bonus when fully qualified', () => {
      const result = calculateDriverPay({
        headcount: 30,
        foodCost: 400,
        totalMileage: 8,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'kasa',
      });

      expect(result.driverBonusPay).toBe(10);
    });

    it('should apply partial bonus based on qualification percentage', () => {
      const result = calculateDriverPay({
        headcount: 30,
        foodCost: 400,
        totalMileage: 8,
        bonusQualified: true,
        bonusQualifiedPercent: 50,
        clientConfigId: 'kasa',
      });

      // $10 × 50% = $5
      expect(result.driverBonusPay).toBe(5);
    });

    it('should exclude bonus when not qualified', () => {
      const result = calculateDriverPay({
        headcount: 30,
        foodCost: 400,
        totalMileage: 8,
        bonusQualified: false,
        clientConfigId: 'kasa',
      });

      expect(result.driverBonusPay).toBe(0);
    });

    it('should exclude bonus when driver receives direct tip', () => {
      const result = calculateDriverPay({
        headcount: 30,
        foodCost: 400,
        totalMileage: 8,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        directTip: 20,
        clientConfigId: 'kasa',
      });

      expect(result.driverBonusPay).toBe(0);
    });
  });

  // ============================================================================
  // DIRECT TIP — MUTUALLY EXCLUSIVE WITH BASE PAY AND BONUS
  // ============================================================================

  describe('Direct Tip — Mutually Exclusive with Base Pay & Bonus', () => {
    it('should set base pay and bonus to $0 when direct tip is received', () => {
      const result = calculateDriverPay({
        headcount: 60,
        foodCost: 750,
        totalMileage: 8,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        directTip: 30,
        clientConfigId: 'kasa',
      });

      expect(result.driverTotalBasePay).toBe(0);
      expect(result.driverBonusPay).toBe(0);
      expect(result.directTip).toBe(30);
      // Total: $0 base + $7 mileage + $0 bonus + $30 tip = $37
      expect(result.totalDriverPay).toBe(37);
    });
  });

  // ============================================================================
  // DAILY DRIVE DISCOUNT
  // ============================================================================

  describe('Daily Drive Discount', () => {
    it('should apply -$5/drive for 2 drives/day', () => {
      const result = calculateDeliveryCost({
        headcount: 30,
        foodCost: 400,
        totalMileage: 8,
        numberOfDrives: 2,
        clientConfigId: 'kasa',
      });

      // $5 × 2 drives = $10 total discount
      expect(result.dailyDriveDiscount).toBe(10);
      // Delivery fee: $40 - $10 = $30
      expect(result.deliveryFee).toBe(30);
    });

    it('should apply -$10/drive for 3 drives/day', () => {
      const result = calculateDeliveryCost({
        headcount: 30,
        foodCost: 400,
        totalMileage: 8,
        numberOfDrives: 3,
        clientConfigId: 'kasa',
      });

      // $10 × 3 drives = $30 total discount
      expect(result.dailyDriveDiscount).toBe(30);
      // Delivery fee: $40 - $30 = $10
      expect(result.deliveryFee).toBe(10);
    });

    it('should apply -$15/drive for 4+ drives/day', () => {
      const result = calculateDeliveryCost({
        headcount: 30,
        foodCost: 400,
        totalMileage: 8,
        numberOfDrives: 4,
        clientConfigId: 'kasa',
      });

      // $15 × 4 drives = $60 total discount
      expect(result.dailyDriveDiscount).toBe(60);
    });
  });

  // ============================================================================
  // BRIDGE TOLL
  // ============================================================================

  describe('Bridge Toll', () => {
    it('should add bridge toll to customer delivery fee', () => {
      const result = calculateDeliveryCost({
        headcount: 30,
        foodCost: 400,
        totalMileage: 8,
        requiresBridge: true,
        clientConfigId: 'kasa',
      });

      expect(result.bridgeToll).toBe(8.50);
      // $40 + $8.50 = $48.50
      expect(result.deliveryFee).toBe(48.50);
    });

    it('should include bridge toll in driver pay', () => {
      const result = calculateDriverPay({
        headcount: 30,
        foodCost: 400,
        totalMileage: 8,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        requiresBridge: true,
        clientConfigId: 'kasa',
      });

      expect(result.bridgeToll).toBe(8.50);
      // $23 base + $7 mileage + $10 bonus + $8.50 toll = $48.50
      expect(result.totalDriverPay).toBe(48.50);
    });
  });

  // ============================================================================
  // COMPLETE CALCULATION SCENARIOS
  // ============================================================================

  describe('Complete Calculation Scenarios', () => {
    it('Scenario 1: HC 10, FC $200, 5mi, bonus — within 10mi', () => {
      const deliveryCost = calculateDeliveryCost({
        headcount: 10,
        foodCost: 200,
        totalMileage: 5,
        clientConfigId: 'kasa',
      });

      const driverPay = calculateDriverPay({
        headcount: 10,
        foodCost: 200,
        totalMileage: 5,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'kasa',
      });

      // Customer fee: $30 (within 10mi, tier 0-24)
      expect(deliveryCost.deliveryCost).toBe(30);
      expect(deliveryCost.deliveryFee).toBe(30);

      // RS fee matches delivery tier: $30
      expect(driverPay.readySetFee).toBe(30);
      expect(driverPay.readySetTotalFee).toBe(30);

      // Driver: $18 base + $7 mileage + $10 bonus = $35
      expect(driverPay.driverTotalBasePay).toBe(18);
      expect(driverPay.totalMileagePay).toBe(7);
      expect(driverPay.driverBonusPay).toBe(10);
      expect(driverPay.totalDriverPay).toBe(35);
    });

    it('Scenario 2: HC 40, FC $500, 15mi, bonus — over 10mi', () => {
      const deliveryCost = calculateDeliveryCost({
        headcount: 40,
        foodCost: 500,
        totalMileage: 15,
        clientConfigId: 'kasa',
      });

      const driverPay = calculateDriverPay({
        headcount: 40,
        foodCost: 500,
        totalMileage: 15,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'kasa',
      });

      // Customer fee: $70 (over 10mi, tier 25-49) + mileage (5 × $3 = $15) = $85
      expect(deliveryCost.deliveryCost).toBe(70);
      expect(deliveryCost.totalMileagePay).toBe(15);
      expect(deliveryCost.deliveryFee).toBe(85);

      // RS fee: $70 (over 10mi tier)
      expect(driverPay.readySetFee).toBe(70);

      // Driver: $23 base + $10.50 mileage (15 × $0.70) + $10 bonus = $43.50
      expect(driverPay.driverTotalBasePay).toBe(23);
      expect(driverPay.totalMileagePay).toBe(10.50);
      expect(driverPay.driverBonusPay).toBe(10);
      expect(driverPay.totalDriverPay).toBe(43.50);
    });

    it('Scenario 3: HC 100, FC $1300, 8mi, bonus, toll — within 10mi', () => {
      const deliveryCost = calculateDeliveryCost({
        headcount: 100,
        foodCost: 1300,
        totalMileage: 8,
        requiresBridge: true,
        clientConfigId: 'kasa',
      });

      const driverPay = calculateDriverPay({
        headcount: 100,
        foodCost: 1300,
        totalMileage: 8,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        requiresBridge: true,
        clientConfigId: 'kasa',
      });

      // Customer fee: $80 (within 10mi, tier 100-124) + toll $8.50 = $88.50
      expect(deliveryCost.deliveryCost).toBe(80);
      expect(deliveryCost.deliveryFee).toBe(88.50);

      // RS fee: $80 + toll $8.50 = $88.50
      expect(driverPay.readySetFee).toBe(80);
      expect(driverPay.readySetTotalFee).toBe(88.50);

      // Driver: $53 base + $7 mileage + $10 bonus + $8.50 toll = $78.50
      expect(driverPay.driverTotalBasePay).toBe(53);
      expect(driverPay.totalMileagePay).toBe(7);
      expect(driverPay.driverBonusPay).toBe(10);
      expect(driverPay.totalDriverPay).toBe(78.50);
    });

    it('Scenario 4: HC 60, FC $750, 8mi, direct tip $25 — within 10mi', () => {
      const driverPay = calculateDriverPay({
        headcount: 60,
        foodCost: 750,
        totalMileage: 8,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        directTip: 25,
        clientConfigId: 'kasa',
      });

      // RS fee: $60 + Tip $25 = $85
      expect(driverPay.readySetFee).toBe(60);
      expect(driverPay.readySetTotalFee).toBe(85);

      // Driver: $0 base (tip) + $7 mileage + $0 bonus (tip) + $25 tip = $32
      expect(driverPay.driverTotalBasePay).toBe(0);
      expect(driverPay.totalMileagePay).toBe(7);
      expect(driverPay.driverBonusPay).toBe(0);
      expect(driverPay.directTip).toBe(25);
      expect(driverPay.totalDriverPay).toBe(32);
    });

    it('Scenario 5: HC 30, FC $400, 20mi, bonus, addon $10, toll — over 10mi', () => {
      const driverPay = calculateDriverPay({
        headcount: 30,
        foodCost: 400,
        totalMileage: 20,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        readySetAddonFee: 10,
        requiresBridge: true,
        clientConfigId: 'kasa',
      });

      // RS fee: $70 (over 10mi) + Addon $10 + Toll $8.50 = $88.50
      expect(driverPay.readySetFee).toBe(70);
      expect(driverPay.readySetTotalFee).toBe(88.50);

      // Driver: $23 base + $14 mileage (20 × $0.70) + $10 bonus + $8.50 toll = $55.50
      expect(driverPay.driverTotalBasePay).toBe(23);
      expect(driverPay.totalMileagePay).toBe(14.00);
      expect(driverPay.driverBonusPay).toBe(10);
      expect(driverPay.bridgeToll).toBe(8.50);
      expect(driverPay.totalDriverPay).toBe(55.50);
    });
  });

  // ============================================================================
  // MANUAL REVIEW — 125+ HEADCOUNT
  // ============================================================================

  describe('Manual Review — 125+ Headcount', () => {
    it('should throw error for 125+ headcount (case by case)', () => {
      expect(() => {
        calculateDriverPay({
          headcount: 130,
          foodCost: 1600,
          totalMileage: 8,
          bonusQualified: true,
          bonusQualifiedPercent: 100,
          clientConfigId: 'kasa',
        });
      }).toThrow();
    });

    it('should calculate normally for headcount 124 (within last supported tier)', () => {
      expect(() => {
        calculateDriverPay({
          headcount: 124,
          foodCost: 1400,
          totalMileage: 8,
          bonusQualified: true,
          bonusQualifiedPercent: 100,
          clientConfigId: 'kasa',
        });
      }).not.toThrow();
    });
  });

  // ============================================================================
  // MULTI-STOP DELIVERIES
  // ============================================================================

  describe('Multi-Stop Deliveries', () => {
    it('should charge $5 per extra stop on customer fee', () => {
      const result = calculateDeliveryCost({
        headcount: 30,
        foodCost: 400,
        totalMileage: 8,
        numberOfStops: 3,
        clientConfigId: 'kasa',
      });

      // 2 extra stops × $5 = $10
      expect(result.extraStopsCharge).toBe(10);
      // $40 + $10 = $50
      expect(result.deliveryFee).toBe(50);
    });

    it('should pay driver $2.50 per extra stop', () => {
      const result = calculateDriverPay({
        headcount: 30,
        foodCost: 400,
        totalMileage: 8,
        numberOfStops: 3,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'kasa',
      });

      // 2 extra stops × $2.50 = $5
      expect(result.extraStopsBonus).toBe(5);
      // $23 base + $7 mileage + $10 bonus + $5 extra stops = $45
      expect(result.totalDriverPay).toBe(45);
    });
  });
});
