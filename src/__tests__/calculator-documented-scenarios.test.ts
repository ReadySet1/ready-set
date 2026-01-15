/**
 * Test Cases from docs/testing/CALCULATOR_TESTS.md
 *
 * Verifies KASA (Client Pricing) and Destino (Driver Compensation) calculators
 * match the documented expected results.
 */

import {
  calculateDeliveryCost,
  calculateDriverPay,
  DeliveryCostInput,
  DriverPayInput
} from '@/lib/calculator/delivery-cost-calculator';

describe('KASA Calculator - Client Pricing (Documented Scenarios)', () => {
  describe('Test K1: Small Order Within 10 Miles', () => {
    // Scenario: 20 people, $250 order, 8 miles, no tolls
    const input: DeliveryCostInput = {
      headcount: 20,
      foodCost: 250,
      totalMileage: 8,
      numberOfDrives: 1
    };

    it('should use Within 10 Miles rate', () => {
      const result = calculateDeliveryCost(input);
      // Within 10 miles = lower rate table
      expect(result.totalMileagePay).toBe(0); // No mileage charge within 10 miles
    });

    it('should calculate delivery cost as $30.00', () => {
      const result = calculateDeliveryCost(input);
      // Tier: <$300 food cost, <25 headcount = $30
      expect(result.deliveryCost).toBe(30);
    });

    it('should calculate total client charge as $30.00', () => {
      const result = calculateDeliveryCost(input);
      expect(result.deliveryFee).toBe(30);
    });
  });

  describe('Test K2: Medium Order Slightly Over 10 Miles', () => {
    // Scenario: 35 people, $450 order, 12 miles, no tolls
    const input: DeliveryCostInput = {
      headcount: 35,
      foodCost: 450,
      totalMileage: 12,
      numberOfDrives: 1
    };

    it('should use Regular Rate (>10 miles)', () => {
      const result = calculateDeliveryCost(input);
      // Over 10 miles = higher rate table
      // Mileage: (12 - 10) × $3.00 = $6.00
      expect(result.totalMileagePay).toBe(6);
    });

    it('should calculate delivery cost as $70.00', () => {
      const result = calculateDeliveryCost(input);
      // Tier: $300-599 food cost, 25-49 headcount, Regular Rate = $70
      expect(result.deliveryCost).toBe(70);
    });

    it('should calculate total client charge as $76.00', () => {
      const result = calculateDeliveryCost(input);
      // Base $70 + Mileage $6 = $76
      expect(result.deliveryFee).toBe(76);
    });
  });

  describe('Test K3: Large Order With Tolls', () => {
    // Scenario: 100 people, $1200 order, 14.5 miles, $8 bridge toll
    const input: DeliveryCostInput = {
      headcount: 100,
      foodCost: 1200,
      totalMileage: 14.5,
      numberOfDrives: 1,
      requiresBridge: true,
      bridgeToll: 8
    };

    it('should calculate mileage charge as $13.50', () => {
      const result = calculateDeliveryCost(input);
      // (14.5 - 10) × $3.00 = $13.50
      expect(result.totalMileagePay).toBe(13.5);
    });

    it('should calculate delivery cost as $120.00', () => {
      const result = calculateDeliveryCost(input);
      // Tier tables show:
      // - Headcount 100-124 → Regular Rate: $120
      // - Food cost $1200-1499 → Regular Rate: $120
      // LESSER of $120 and $120 = $120
      // NOTE: Doc test K3 expected $100 but tier tables show $120 for both
      expect(result.deliveryCost).toBe(120);
    });

    it('should include toll fees in total', () => {
      const result = calculateDeliveryCost(input);
      // Base $120 + Mileage $13.50 + Tolls $8 = $141.50
      expect(result.deliveryFee).toBe(141.5);
    });
  });

  describe('Test K4: High Volume Within Range', () => {
    // Scenario: 200 people, $2100 order, 9 miles, no tolls
    const input: DeliveryCostInput = {
      headcount: 200,
      foodCost: 2100,
      totalMileage: 9,
      numberOfDrives: 1
    };

    it('should use Within 10 Miles rate', () => {
      const result = calculateDeliveryCost(input);
      // Within 10 miles = no mileage charge
      expect(result.totalMileagePay).toBe(0);
    });

    it('should calculate delivery cost as $120.00', () => {
      const result = calculateDeliveryCost(input);
      // Tier: $2100-2299 food cost, 200-249 headcount
      // Within 10 miles: $120
      expect(result.deliveryCost).toBe(120);
    });

    it('should calculate total client charge as $120.00', () => {
      const result = calculateDeliveryCost(input);
      expect(result.deliveryFee).toBe(120);
    });
  });
});

describe('Destino Calculator - Driver Compensation (Documented Scenarios)', () => {
  describe('Test D1: Basic Delivery No Bonus Deductions', () => {
    // Scenario: 28 people, $400 order, 3.1 miles, no tips, no infractions
    const input: DriverPayInput = {
      headcount: 28,
      foodCost: 400,
      totalMileage: 3.1,
      numberOfDrives: 1,
      bonusQualified: true,
      bonusQualifiedPercent: 100,
      directTip: 0
    };

    it('should calculate base pay as $30.00', () => {
      const result = calculateDriverPay(input);
      // Tier: 25-49 headcount = $30
      expect(result.driverTotalBasePay).toBe(30);
    });

    it('should calculate mileage pay as $1.09', () => {
      const result = calculateDriverPay(input);
      // 3.1 miles × $0.35 = $1.085 ≈ $1.09
      // Note: All mileage paid at $0.35/mile
      expect(result.totalMileagePay).toBeCloseTo(1.09, 2);
    });

    it('should include $10 bonus (100% qualified)', () => {
      const result = calculateDriverPay(input);
      expect(result.driverBonusPay).toBe(10);
    });

    it('should calculate total driver pay as $41.09', () => {
      const result = calculateDriverPay(input);
      // Base $30 + Mileage $1.09 + Bonus $10 = $41.09
      expect(result.totalDriverPay).toBeCloseTo(41.09, 2);
    });
  });

  describe('Test D2: Order Value Limits Tier (Lesser Rule)', () => {
    // Scenario: 60 people, $500 order, 20 miles, no tips, no infractions
    const input: DriverPayInput = {
      headcount: 60,
      foodCost: 500,
      totalMileage: 20,
      numberOfDrives: 1,
      bonusQualified: true,
      bonusQualifiedPercent: 100,
      directTip: 0
    };

    it('should use LESSER tier - food cost tier ($40) vs headcount tier ($50)', () => {
      const result = calculateDriverPay(input);
      // Headcount 60 suggests Tier 3 ($50 for 50-74)
      // Food cost $500 suggests Tier 2 ($40 for $300-599)
      // LESSER = $40
      expect(result.driverTotalBasePay).toBe(40);
    });

    it('should calculate mileage pay as $7.00', () => {
      const result = calculateDriverPay(input);
      // 20 miles × $0.35 = $7.00
      expect(result.totalMileagePay).toBe(7);
    });

    it('should calculate total driver pay as $57.00', () => {
      const result = calculateDriverPay(input);
      // Base $40 + Mileage $7 + Bonus $10 = $57
      expect(result.totalDriverPay).toBe(57);
    });
  });

  describe('Test D3: With Direct Tip - NO BASE PAY', () => {
    // Scenario: 30 people, $400 order, 15 miles, $20 direct tip, no infractions
    // CRITICAL: Direct tip = NO base pay, NO bonus
    const input: DriverPayInput = {
      headcount: 30,
      foodCost: 400,
      totalMileage: 15,
      numberOfDrives: 1,
      bonusQualified: false, // Tips exclude bonus
      bonusQualifiedPercent: 0,
      directTip: 20
    };

    it('should have NO base pay when direct tip received', () => {
      const result = calculateDriverPay(input);
      // Direct tip = base pay excluded
      expect(result.driverTotalBasePay).toBe(0);
    });

    it('should calculate mileage pay as $5.25', () => {
      const result = calculateDriverPay(input);
      // 15 miles × $0.35 = $5.25
      expect(result.totalMileagePay).toBe(5.25);
    });

    it('should have NO bonus when direct tip received', () => {
      const result = calculateDriverPay(input);
      expect(result.driverBonusPay).toBe(0);
    });

    it('should include full direct tip of $20.00', () => {
      const result = calculateDriverPay(input);
      expect(result.directTip).toBe(20);
    });

    it('should calculate total driver pay as $25.25', () => {
      const result = calculateDriverPay(input);
      // Mileage $5.25 + Tip $20 = $25.25
      expect(result.totalDriverPay).toBe(25.25);
    });
  });

  describe('Test D4: With Weekly Infractions', () => {
    // Scenario: 50 people, $700 order, 10 miles, no tip, infractions
    // 1 late (>15min) = -10%, 1 no photo = -5%
    const input: DriverPayInput = {
      headcount: 50,
      foodCost: 700,
      totalMileage: 10,
      numberOfDrives: 1,
      bonusQualified: true,
      bonusQualifiedPercent: 85, // 100% - 10% - 5% = 85%
      directTip: 0
    };

    it('should calculate base pay as $50.00', () => {
      const result = calculateDriverPay(input);
      // Tier: 50-74 headcount = $50
      expect(result.driverTotalBasePay).toBe(50);
    });

    it('should calculate mileage pay as $3.50', () => {
      const result = calculateDriverPay(input);
      // 10 miles × $0.35 = $3.50
      expect(result.totalMileagePay).toBe(3.5);
    });

    it('should calculate reduced bonus as $8.50 (85%)', () => {
      const result = calculateDriverPay(input);
      // $10 × 85% = $8.50
      expect(result.driverBonusPay).toBe(8.5);
    });

    it('should calculate total driver pay as $62.00', () => {
      const result = calculateDriverPay(input);
      // Base $50 + Mileage $3.50 + Bonus $8.50 = $62.00
      expect(result.totalDriverPay).toBe(62);
    });
  });

  describe('Test D5: High Volume Basic', () => {
    // Scenario: 100 people, $1500 order, 25 miles, no tip, no infractions
    const input: DriverPayInput = {
      headcount: 100,
      foodCost: 1500,
      totalMileage: 25,
      numberOfDrives: 1,
      bonusQualified: true,
      bonusQualifiedPercent: 100,
      directTip: 0
    };

    it('should calculate base pay as $50.00 (case by case estimate)', () => {
      const result = calculateDriverPay(input);
      // Over 100 headcount is "case by case" - estimated Tier 4 = $50
      expect(result.driverTotalBasePay).toBe(50);
    });

    it('should calculate mileage pay as $8.75', () => {
      const result = calculateDriverPay(input);
      // 25 miles × $0.35 = $8.75
      expect(result.totalMileagePay).toBe(8.75);
    });

    it('should include $10 bonus', () => {
      const result = calculateDriverPay(input);
      expect(result.driverBonusPay).toBe(10);
    });

    it('should calculate total driver pay as $68.75', () => {
      const result = calculateDriverPay(input);
      // Base $50 + Mileage $8.75 + Bonus $10 = $68.75
      expect(result.totalDriverPay).toBe(68.75);
    });
  });
});
