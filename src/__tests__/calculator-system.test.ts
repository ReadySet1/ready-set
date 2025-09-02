// Calculator System Tests - Comprehensive testing of the new calculator engine
// Tests calculation accuracy, rule evaluation, and edge cases

import { CalculatorEngine } from '@/lib/calculator/calculator-engine';
import { PricingRule, CalculationInput } from '@/types/calculator';

describe('Calculator System', () => {
  // Sample rules for testing
  const sampleRules: PricingRule[] = [
    // Customer charge rules
    {
      id: '1',
      templateId: 'template-1',
      ruleType: 'customer_charge',
      ruleName: 'base_fee',
      baseAmount: 60.00,
      priority: 100
    },
    {
      id: '2',
      templateId: 'template-1',
      ruleType: 'customer_charge',
      ruleName: 'long_distance',
      perUnitAmount: 3.00,
      thresholdValue: 10.00,
      thresholdType: 'above',
      priority: 90
    },
    {
      id: '3',
      templateId: 'template-1',
      ruleType: 'customer_charge',
      ruleName: 'bridge_toll',
      baseAmount: 8.00,
      priority: 80
    },
    {
      id: '4',
      templateId: 'template-1',
      ruleType: 'customer_charge',
      ruleName: 'extra_stops',
      perUnitAmount: 5.00,
      priority: 70
    },
    // Driver payment rules
    {
      id: '5',
      templateId: 'template-1',
      ruleType: 'driver_payment',
      ruleName: 'base_pay',
      baseAmount: 35.00,
      priority: 100
    },
    {
      id: '6',
      templateId: 'template-1',
      ruleType: 'driver_payment',
      ruleName: 'mileage',
      perUnitAmount: 0.70,
      priority: 90
    },
    {
      id: '7',
      templateId: 'template-1',
      ruleType: 'driver_payment',
      ruleName: 'bridge_toll',
      baseAmount: 8.00,
      priority: 80
    },
    {
      id: '8',
      templateId: 'template-1',
      ruleType: 'driver_payment',
      ruleName: 'extra_stops',
      perUnitAmount: 2.50,
      priority: 70
    }
  ];

  let calculator: CalculatorEngine;

  beforeEach(() => {
    calculator = new CalculatorEngine(sampleRules);
  });

  describe('Basic Calculation', () => {
    test('should calculate simple delivery correctly', () => {
      const input: CalculationInput = {
        headcount: 0,
        foodCost: 0,
        mileage: 5.0,
        requiresBridge: false,
        numberOfStops: 1,
        tips: 0,
        adjustments: 0,
        mileageRate: 0.70
      };

      const result = calculator.calculate(input);

      // Customer charges: $60 base fee
      expect(result.customerCharges.baseFee).toBe(60.00);
      expect(result.customerCharges.longDistanceCharge).toBe(0); // Under 10 miles
      expect(result.customerCharges.bridgeToll).toBe(0);
      expect(result.customerCharges.extraStopsCharge).toBe(0);
      expect(result.customerCharges.total).toBe(60.00);

      // Driver payments: $35 base + $3.50 mileage (5 * 0.70)
      expect(result.driverPayments.basePay).toBe(35.00);
      expect(result.driverPayments.mileagePay).toBe(3.50);
      expect(result.driverPayments.bridgeToll).toBe(0);
      expect(result.driverPayments.extraStopsBonus).toBe(0);
      expect(result.driverPayments.total).toBe(38.50);

      // Profit: $60 - $38.50 = $21.50
      expect(result.profit).toBe(21.50);
      expect(result.profitMargin).toBeCloseTo(35.83, 2);
    });

    test('should calculate long distance delivery correctly', () => {
      const input: CalculationInput = {
        headcount: 0,
        foodCost: 0,
        mileage: 15.0, // Over 10 mile threshold
        requiresBridge: false,
        numberOfStops: 1,
        tips: 0,
        adjustments: 0,
        mileageRate: 0.70
      };

      const result = calculator.calculate(input);

      // Customer charges: $60 base + $15 long distance (5 extra miles * $3)
      expect(result.customerCharges.baseFee).toBe(60.00);
      expect(result.customerCharges.longDistanceCharge).toBe(15.00);
      expect(result.customerCharges.total).toBe(75.00);

      // Driver payments: $35 base + $10.50 mileage (15 * 0.70)
      expect(result.driverPayments.basePay).toBe(35.00);
      expect(result.driverPayments.mileagePay).toBe(10.50);
      expect(result.driverPayments.total).toBe(45.50);

      // Profit: $75 - $45.50 = $29.50
      expect(result.profit).toBe(29.50);
      expect(result.profitMargin).toBeCloseTo(39.33, 2);
    });

    test('should calculate bridge toll correctly', () => {
      const input: CalculationInput = {
        headcount: 0,
        foodCost: 0,
        mileage: 8.0,
        requiresBridge: true,
        numberOfStops: 1,
        tips: 0,
        adjustments: 0,
        mileageRate: 0.70
      };

      const result = calculator.calculate(input);

      // Customer charges: $60 base + $8 bridge toll
      expect(result.customerCharges.baseFee).toBe(60.00);
      expect(result.customerCharges.bridgeToll).toBe(8.00);
      expect(result.customerCharges.total).toBe(68.00);

      // Driver payments: $35 base + $5.60 mileage + $8 bridge toll
      expect(result.driverPayments.basePay).toBe(35.00);
      expect(result.driverPayments.mileagePay).toBe(5.60);
      expect(result.driverPayments.bridgeToll).toBe(8.00);
      expect(result.driverPayments.total).toBe(48.60);

      // Profit: $68 - $48.60 = $19.40
      expect(result.profit).toBe(19.40);
      expect(result.profitMargin).toBeCloseTo(28.53, 2);
    });

    test('should calculate extra stops correctly', () => {
      const input: CalculationInput = {
        headcount: 0,
        foodCost: 0,
        mileage: 10.0,
        requiresBridge: false,
        numberOfStops: 3, // 2 extra stops
        tips: 0,
        adjustments: 0,
        mileageRate: 0.70
      };

      const result = calculator.calculate(input);

      // Customer charges: $60 base + $10 extra stops (2 * $5)
      expect(result.customerCharges.baseFee).toBe(60.00);
      expect(result.customerCharges.extraStopsCharge).toBe(10.00);
      expect(result.customerCharges.total).toBe(70.00);

      // Driver payments: $35 base + $7 mileage + $5 extra stops bonus (2 * $2.50)
      expect(result.driverPayments.basePay).toBe(35.00);
      expect(result.driverPayments.mileagePay).toBe(7.00);
      expect(result.driverPayments.extraStopsBonus).toBe(5.00);
      expect(result.driverPayments.total).toBe(47.00);

      // Profit: $70 - $47 = $23
      expect(result.profit).toBe(23.00);
      expect(result.profitMargin).toBeCloseTo(32.86, 2);
    });
  });

  describe('Complex Scenarios', () => {
    test('should calculate complex delivery with all charges', () => {
      const input: CalculationInput = {
        headcount: 25,
        foodCost: 500.00,
        mileage: 18.0, // Long distance
        requiresBridge: true,
        numberOfStops: 3, // Extra stops
        tips: 25.00,
        adjustments: 10.00,
        mileageRate: 0.70
      };

      const result = calculator.calculate(input);

      // Customer charges: $60 base + $24 long distance + $8 bridge + $10 extra stops + $500 food
      expect(result.customerCharges.baseFee).toBe(60.00);
      expect(result.customerCharges.longDistanceCharge).toBe(24.00); // 8 extra miles * $3
      expect(result.customerCharges.bridgeToll).toBe(8.00);
      expect(result.customerCharges.extraStopsCharge).toBe(10.00); // 2 extra stops * $5
      expect(result.customerCharges.foodCost).toBe(500.00);
      expect(result.customerCharges.total).toBe(602.00);

      // Driver payments: $35 base + $12.60 mileage + $8 bridge + $5 extra stops + $25 tips + $10 adjustments
      expect(result.driverPayments.basePay).toBe(35.00);
      expect(result.driverPayments.mileagePay).toBe(12.60); // 18 * 0.70
      expect(result.driverPayments.bridgeToll).toBe(8.00);
      expect(result.driverPayments.extraStopsBonus).toBe(5.00); // 2 * $2.50
      expect(result.driverPayments.tips).toBe(25.00);
      expect(result.driverPayments.adjustments).toBe(10.00);
      expect(result.driverPayments.total).toBe(95.60);

      // Profit: $602 - $95.60 = $506.40
      expect(result.profit).toBe(506.40);
      expect(result.profitMargin).toBeCloseTo(84.12, 2);
    });

    test('should handle zero and negative values', () => {
      const input: CalculationInput = {
        headcount: 0,
        foodCost: 0,
        mileage: 0,
        requiresBridge: false,
        numberOfStops: 1,
        tips: 0,
        adjustments: -5.00, // Deduction
        mileageRate: 0.70
      };

      const result = calculator.calculate(input);

      // Customer charges: $60 base only
      expect(result.customerCharges.total).toBe(60.00);

      // Driver payments: $35 base + $0 mileage + $0 tips - $5 adjustments
      expect(result.driverPayments.basePay).toBe(35.00);
      expect(result.driverPayments.mileagePay).toBe(0);
      expect(result.driverPayments.adjustments).toBe(-5.00);
      expect(result.driverPayments.total).toBe(30.00);

      // Profit: $60 - $30 = $30
      expect(result.profit).toBe(30.00);
      expect(result.profitMargin).toBe(50.00);
    });
  });

  describe('Edge Cases', () => {
    test('should handle exact threshold values', () => {
      const input: CalculationInput = {
        headcount: 0,
        foodCost: 0,
        mileage: 10.0, // Exactly at threshold
        requiresBridge: false,
        numberOfStops: 1,
        tips: 0,
        adjustments: 0,
        mileageRate: 0.70
      };

      const result = calculator.calculate(input);

      // Should not charge long distance for exactly 10 miles
      expect(result.customerCharges.longDistanceCharge).toBe(0);
    });

    test('should handle single stop correctly', () => {
      const input: CalculationInput = {
        headcount: 0,
        foodCost: 0,
        mileage: 5.0,
        requiresBridge: false,
        numberOfStops: 1, // No extra stops
        tips: 0,
        adjustments: 0,
        mileageRate: 0.70
      };

      const result = calculator.calculate(input);

      // Should not charge for extra stops with only 1 stop
      expect(result.customerCharges.extraStopsCharge).toBe(0);
      expect(result.driverPayments.extraStopsBonus).toBe(0);
    });

    test('should validate input constraints', () => {
      // This would be handled by Zod validation in practice
      expect(() => {
        calculator.calculate({
          headcount: -1, // Invalid
          foodCost: 0,
          mileage: 5.0,
          requiresBridge: false,
          numberOfStops: 1,
          tips: 0,
          adjustments: 0,
          mileageRate: 0.70
        });
      }).toThrow();
    });
  });

  describe('Rule Engine', () => {
    test('should group rules by type correctly', () => {
      const customerRuleTypes = calculator.getRuleTypes();
      expect(customerRuleTypes).toContain('customer_charge');
      expect(customerRuleTypes).toContain('driver_payment');
    });

    test('should get rules for specific type', () => {
      const customerRules = calculator.getRulesForType('customer_charge');
      expect(customerRules).toHaveLength(4);
      expect(customerRules.map(r => r.ruleName)).toContain('base_fee');
      expect(customerRules.map(r => r.ruleName)).toContain('long_distance');
    });

    test('should respect rule priority order', () => {
      const customerRules = calculator.getRulesForType('customer_charge');
      
      // Rules should be sorted by priority (highest first)
      for (let i = 0; i < customerRules.length - 1; i++) {
        expect(customerRules[i].priority).toBeGreaterThanOrEqual(customerRules[i + 1].priority);
      }
    });
  });

  describe('Result Structure', () => {
    test('should return complete result structure', () => {
      const input: CalculationInput = {
        headcount: 10,
        foodCost: 100.00,
        mileage: 8.0,
        requiresBridge: false,
        numberOfStops: 1,
        tips: 5.00,
        adjustments: 0,
        mileageRate: 0.70
      };

      const result = calculator.calculate(input);

      // Check structure
      expect(result).toHaveProperty('customerCharges');
      expect(result).toHaveProperty('driverPayments');
      expect(result).toHaveProperty('profit');
      expect(result).toHaveProperty('profitMargin');
      expect(result).toHaveProperty('calculatedAt');
      expect(result).toHaveProperty('templateUsed');

      // Check customer charges structure
      expect(result.customerCharges).toHaveProperty('baseFee');
      expect(result.customerCharges).toHaveProperty('longDistanceCharge');
      expect(result.customerCharges).toHaveProperty('bridgeToll');
      expect(result.customerCharges).toHaveProperty('extraStopsCharge');
      expect(result.customerCharges).toHaveProperty('headcountCharge');
      expect(result.customerCharges).toHaveProperty('foodCost');
      expect(result.customerCharges).toHaveProperty('customCharges');
      expect(result.customerCharges).toHaveProperty('subtotal');
      expect(result.customerCharges).toHaveProperty('total');

      // Check driver payments structure
      expect(result.driverPayments).toHaveProperty('basePay');
      expect(result.driverPayments).toHaveProperty('mileagePay');
      expect(result.driverPayments).toHaveProperty('bridgeToll');
      expect(result.driverPayments).toHaveProperty('extraStopsBonus');
      expect(result.driverPayments).toHaveProperty('tips');
      expect(result.driverPayments).toHaveProperty('adjustments');
      expect(result.driverPayments).toHaveProperty('customPayments');
      expect(result.driverPayments).toHaveProperty('subtotal');
      expect(result.driverPayments).toHaveProperty('total');

      // Check types
      expect(typeof result.profit).toBe('number');
      expect(typeof result.profitMargin).toBe('number');
      expect(result.calculatedAt).toBeInstanceOf(Date);
      expect(typeof result.templateUsed).toBe('string');
    });
  });
});
