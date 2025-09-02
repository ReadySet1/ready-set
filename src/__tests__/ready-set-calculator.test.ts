// Ready Set Food Calculator Tests
// Comprehensive test suite for all 4 examples from CALCULATOR_TESTS.md

import { CalculatorEngine } from '../lib/calculator/calculator-engine';
import { PricingRule, CalculationInput } from '../types/calculator';

describe('Ready Set Food Calculator Rules', () => {
  let calculatorEngine: CalculatorEngine;
  let readySetRules: PricingRule[];

  beforeAll(() => {
    // Create Ready Set Food template rules
    readySetRules = [
      // Customer charge rules
      {
        id: 'rsf-1',
        templateId: 'ready-set-food-standard',
        ruleType: 'customer_charge',
        ruleName: 'tiered_base_fee',
        priority: 100
      },
      {
        id: 'rsf-2',
        templateId: 'ready-set-food-standard',
        ruleType: 'customer_charge',
        ruleName: 'long_distance',
        baseAmount: 0,
        perUnitAmount: 3.00,
        thresholdValue: 10,
        thresholdType: 'above',
        priority: 90
      },
      {
        id: 'rsf-3',
        templateId: 'ready-set-food-standard',
        ruleType: 'customer_charge',
        ruleName: 'bridge_toll',
        baseAmount: 8.00,
        priority: 80
      },
      // Driver payment rules
      {
        id: 'rsf-4',
        templateId: 'ready-set-food-standard',
        ruleType: 'driver_payment',
        ruleName: 'tiered_base_pay',
        priority: 100
      },
      {
        id: 'rsf-5',
        templateId: 'ready-set-food-standard',
        ruleType: 'driver_payment',
        ruleName: 'mileage',
        baseAmount: 0,
        perUnitAmount: 0.35,
        thresholdValue: 10,
        thresholdType: 'above',
        priority: 90
      },
      {
        id: 'rsf-6',
        templateId: 'ready-set-food-standard',
        ruleType: 'driver_payment',
        ruleName: 'bridge_toll',
        baseAmount: 8.00,
        priority: 80
      },
      {
        id: 'rsf-7',
        templateId: 'ready-set-food-standard',
        ruleType: 'driver_payment',
        ruleName: 'tips',
        priority: 70
      }
    ];

    calculatorEngine = new CalculatorEngine(readySetRules);
  });

  describe('Test 1: Example 1 (Easy) - 20 people, $250 order, 8 miles, no bridge, no tip', () => {
    test('should calculate correct customer and driver totals', () => {
      const input: CalculationInput = {
        headcount: 20,
        foodCost: 250,
        mileage: 8,
        requiresBridge: false,
        numberOfStops: 1,
        tips: 0
      };

      const result = calculatorEngine.calculate(input);

      // Expected Results:
      // - Customer Total: ~$65 (Tier 1 base fee)
      // - Driver Total: $35 (Tier 1 base pay - both headcount and order qualify for Tier 1)
      // - Notes: $35 base payment includes first 10 miles, no mileage charge needed

      expect(result.customerCharges.baseFee).toBe(65); // Tier 1 base fee
      expect(result.customerCharges.longDistanceCharge).toBe(0); // No long distance (8 < 10 miles)
      expect(result.customerCharges.bridgeToll).toBe(0); // No bridge
      expect(result.customerCharges.total).toBe(65);

      expect(result.driverPayments.basePay).toBe(35); // Tier 1 base pay
      expect(result.driverPayments.mileagePay).toBe(0); // No mileage charge (8 < 10 miles)
      expect(result.driverPayments.bridgeToll).toBe(0); // No bridge
      expect(result.driverPayments.tips).toBe(0); // No tips
      expect(result.driverPayments.total).toBe(35);

      expect(result.profit).toBe(30); // $65 - $35
    });
  });

  describe('Test 2: Example 2 (Normal) - 35 people, $450 order, 12 miles, no bridge, no tip', () => {
    test('should calculate correct customer and driver totals with mileage charges', () => {
      const input: CalculationInput = {
        headcount: 35,
        foodCost: 450,
        mileage: 12,
        requiresBridge: false,
        numberOfStops: 1,
        tips: 0
      };

      const result = calculatorEngine.calculate(input);

      // Expected Results:
      // - Customer Total: $81 ($75 base + $6 long distance)
      // - Driver Total: $40.70 ($40 base + $0.70 mileage)
      // - Breakdown:
      //   - Customer: $75 Tier 2 base + $6 long distance (2 miles × $3)
      //   - Driver: $40 Tier 2 base + $0.70 mileage (2 miles × $0.35)

      expect(result.customerCharges.baseFee).toBe(75); // Tier 2 base fee
      expect(result.customerCharges.longDistanceCharge).toBe(6); // 2 extra miles × $3
      expect(result.customerCharges.bridgeToll).toBe(0); // No bridge
      expect(result.customerCharges.total).toBe(81);

      expect(result.driverPayments.basePay).toBe(40); // Tier 2 base pay
      expect(result.driverPayments.mileagePay).toBe(0.70); // 2 extra miles × $0.35
      expect(result.driverPayments.bridgeToll).toBe(0); // No bridge
      expect(result.driverPayments.tips).toBe(0); // No tips
      expect(result.driverPayments.total).toBe(40.70);

      expect(result.profit).toBeCloseTo(40.30, 2); // $81 - $40.70
    });
  });

  describe('Test 3: Example 3 (Complex) - 60 people, $500 order, 20 miles, bridge crossing, no tip', () => {
    test('should use correct tier logic (lesser of headcount vs order value)', () => {
      const input: CalculationInput = {
        headcount: 60,
        foodCost: 500,
        mileage: 20,
        requiresBridge: true,
        numberOfStops: 1,
        tips: 0
      };

      const result = calculatorEngine.calculate(input);

      // Expected Results:
      // - Customer Total: $113 ($75 base + $30 long distance + $8 bridge)
      // - Driver Total: $51.50 ($40 base + $3.50 mileage + $8 bridge)
      // - Breakdown:
      //   - Customer: $75 Tier 2 base (by order value) + $30 long distance (10 miles × $3) + $8 bridge
      //   - Driver: $40 Tier 2 base (by order value) + $3.50 mileage (10 miles × $0.35) + $8 bridge
      // - Key Rule: Uses Tier 2 due to order value $500 (lesser of headcount vs order value rule)

      expect(result.customerCharges.baseFee).toBe(75); // Tier 2 base fee (by order value rule)
      expect(result.customerCharges.longDistanceCharge).toBe(30); // 10 extra miles × $3
      expect(result.customerCharges.bridgeToll).toBe(8); // Bridge toll
      expect(result.customerCharges.total).toBe(113);

      expect(result.driverPayments.basePay).toBe(40); // Tier 2 base pay (by order value rule)
      expect(result.driverPayments.mileagePay).toBe(3.50); // 10 extra miles × $0.35
      expect(result.driverPayments.bridgeToll).toBe(8); // Bridge reimbursement
      expect(result.driverPayments.tips).toBe(0); // No tips
      expect(result.driverPayments.total).toBe(51.50);

      expect(result.profit).toBe(61.50); // $113 - $51.50
    });
  });

  describe('Test 4: Example 4 (With Direct Tip) - 30 people, $400 order, 15 miles, $20 tip', () => {
    test('should implement tip exclusivity rule (tips OR bonus structure, never both)', () => {
      const input: CalculationInput = {
        headcount: 30,
        foodCost: 400,
        mileage: 15,
        requiresBridge: false,
        numberOfStops: 1,
        tips: 20
      };

      const result = calculatorEngine.calculate(input);

      // Expected Results:
      // - Customer Total: $110 ($75 base + $15 long distance + $20 tip)
      // - Driver Total: $21.75 ($20 tip + $1.75 mileage only)
      // - Breakdown:
      //   - Customer: $75 Tier 2 base + $15 long distance (5 miles × $3) + $20 tip = $110
      //   - Driver: $20 tip + $1.75 mileage (5 miles × $0.35) = $21.75
      // - Key Rule: With direct tip, driver gets 100% tip but NO bonus structure payment

      expect(result.customerCharges.baseFee).toBe(75); // Tier 2 base fee
      expect(result.customerCharges.longDistanceCharge).toBe(15); // 5 extra miles × $3
      expect(result.customerCharges.bridgeToll).toBe(0); // No bridge
      // Note: Customer total includes tip pass-through
      expect(result.customerCharges.total).toBe(110); // $75 + $15 + $20

      expect(result.driverPayments.basePay).toBe(0); // NO base pay when tip exists
      expect(result.driverPayments.mileagePay).toBe(1.75); // 5 extra miles × $0.35
      expect(result.driverPayments.bridgeToll).toBe(0); // No bridge
      expect(result.driverPayments.tips).toBe(20); // 100% tip pass-through
      expect(result.driverPayments.total).toBe(21.75);

      expect(result.profit).toBe(88.25); // $110 - $21.75
    });
  });

  describe('Tier Determination Logic', () => {
    test('should use lesser of headcount vs order value (conservative approach)', () => {
      // Test case where headcount suggests Tier 3 but order value suggests Tier 2
      const input1: CalculationInput = {
        headcount: 60, // Tier 3 (50-74)
        foodCost: 500, // Tier 2 ($300-599)
        mileage: 5,
        requiresBridge: false,
        numberOfStops: 1,
        tips: 0
      };

      const result1 = calculatorEngine.calculate(input1);
      
      // Should use Tier 2 (lower tier)
      expect(result1.customerCharges.baseFee).toBe(75); // Tier 2 customer fee
      expect(result1.driverPayments.basePay).toBe(40); // Tier 2 driver pay

      // Test case where order value suggests Tier 4 but headcount suggests Tier 2
      const input2: CalculationInput = {
        headcount: 35, // Tier 2 (25-49)
        foodCost: 1000, // Tier 4 ($900-1099)
        mileage: 5,
        requiresBridge: false,
        numberOfStops: 1,
        tips: 0
      };

      const result2 = calculatorEngine.calculate(input2);
      
      // Should use Tier 2 (lower tier)
      expect(result2.customerCharges.baseFee).toBe(75); // Tier 2 customer fee
      expect(result2.driverPayments.basePay).toBe(40); // Tier 2 driver pay
    });
  });

  describe('Edge Cases', () => {
    test('should handle zero values gracefully', () => {
      const input: CalculationInput = {
        headcount: 0,
        foodCost: 0,
        mileage: 0,
        requiresBridge: false,
        numberOfStops: 1,
        tips: 0
      };

      const result = calculatorEngine.calculate(input);

      // Should default to Tier 1
      expect(result.customerCharges.baseFee).toBe(65);
      expect(result.driverPayments.basePay).toBe(35);
      expect(result.customerCharges.longDistanceCharge).toBe(0);
      expect(result.driverPayments.mileagePay).toBe(0);
    });

    test('should handle negative tips (should not break calculation)', () => {
      const input: CalculationInput = {
        headcount: 25,
        foodCost: 300,
        mileage: 12,
        requiresBridge: false,
        numberOfStops: 1,
        tips: -10 // Invalid negative tip
      };

      expect(() => {
        const result = calculatorEngine.calculate(input);
      }).not.toThrow();
    });

    test('should handle very large orders (Tier 5)', () => {
      const input: CalculationInput = {
        headcount: 150,
        foodCost: 1500,
        mileage: 25,
        requiresBridge: true,
        numberOfStops: 1,
        tips: 0
      };

      const result = calculatorEngine.calculate(input);

      // Should use Tier 5
      expect(result.customerCharges.baseFee).toBe(105); // Tier 5 customer fee
      expect(result.driverPayments.basePay).toBe(70); // Tier 5 driver pay
    });
  });
});
