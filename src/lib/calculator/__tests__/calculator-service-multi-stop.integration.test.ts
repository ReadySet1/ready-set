/**
 * Calculator Service Multi-Stop Integration Tests
 *
 * Tests for verifying the integration between CalculatorService and
 * the multi-stop pricing functionality in delivery-cost-calculator.
 *
 * These tests ensure that:
 * - numberOfStops is correctly passed through the service layer
 * - extraStopsCharge appears in customer charges
 * - extraStopsBonus appears in driver payments
 * - Metadata includes numberOfStops
 * - Results breakdown arrays include extra stops line items
 */

import { CalculatorService } from '../calculator-service';
import type { CalculationInput } from '@/types/calculator';

// Mock Supabase client that returns valid template data
const createMockSupabase = () => {
  const mockTemplate = {
    id: 'template-1',
    name: 'Standard Delivery',
    is_active: true,
  };

  const mockRules: any[] = [];

  return {
    from: jest.fn((table: string) => {
      if (table === 'calculator_templates') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockTemplate, error: null }),
            }),
          }),
        };
      }
      if (table === 'pricing_rules') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: mockRules, error: null }),
            }),
          }),
        };
      }
      return {};
    }),
  };
};

describe('CalculatorService Multi-Stop Integration', () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    mockSupabase = createMockSupabase();
  });

  describe('calculate() with numberOfStops', () => {
    it('should include numberOfStops in calculation and return extraStopsCharge', async () => {
      const input: CalculationInput = {
        headcount: 50,
        foodCost: 500,
        mileage: 15,
        numberOfStops: 3,
        numberOfDrives: 1,
        requiresBridge: false,
      };

      const result = await CalculatorService.calculate(mockSupabase, 'template-1', input);

      // Verify extraStopsCharge is in customer charges (2 extra stops × $5 = $10)
      expect(result.customerCharges.extraStopsCharge).toBe(10.0);

      // Verify extraStopsBonus is in driver payments (2 extra stops × $2.50 = $5)
      expect(result.driverPayments.extraStopsBonus).toBe(5.0);
    });

    it('should include numberOfStops in metadata', async () => {
      const input: CalculationInput = {
        headcount: 50,
        foodCost: 500,
        mileage: 15,
        numberOfStops: 4,
        numberOfDrives: 1,
      };

      const result = await CalculatorService.calculate(mockSupabase, 'template-1', input);

      expect(result.metadata?.numberOfStops).toBe(4);
    });

    it('should default numberOfStops to 1 when not provided', async () => {
      const input: CalculationInput = {
        headcount: 50,
        foodCost: 500,
        mileage: 15,
        // numberOfStops not provided
      };

      const result = await CalculatorService.calculate(mockSupabase, 'template-1', input);

      // No extra stops charge when only 1 stop
      expect(result.customerCharges.extraStopsCharge).toBe(0);
      expect(result.driverPayments.extraStopsBonus).toBe(0);
      expect(result.metadata?.numberOfStops).toBe(1);
    });

    it('should include Extra Stops in customer charges breakdown array', async () => {
      const input: CalculationInput = {
        headcount: 50,
        foodCost: 500,
        mileage: 15,
        numberOfStops: 2,
      };

      const result = await CalculatorService.calculate(mockSupabase, 'template-1', input);

      // Find the Extra Stops Charge line item
      const extraStopsItem = result.customerCharges.breakdown?.find(
        (item) => item.label === 'Extra Stops Charge'
      );

      expect(extraStopsItem).toBeDefined();
      expect(extraStopsItem?.amount).toBe(5.0);
    });

    it('should include Extra Stops Bonus in driver payments breakdown array', async () => {
      const input: CalculationInput = {
        headcount: 50,
        foodCost: 500,
        mileage: 15,
        numberOfStops: 2,
      };

      const result = await CalculatorService.calculate(mockSupabase, 'template-1', input);

      // Find the Extra Stops Bonus line item
      const extraStopsItem = result.driverPayments.breakdown?.find(
        (item) => item.label === 'Extra Stops Bonus'
      );

      expect(extraStopsItem).toBeDefined();
      expect(extraStopsItem?.amount).toBe(2.5);
    });

    it('should include extraStopsCharge in customer charges total', async () => {
      const input: CalculationInput = {
        headcount: 50,
        foodCost: 500,
        mileage: 15,
        numberOfStops: 1, // No extra stops
      };

      const resultWithoutExtras = await CalculatorService.calculate(mockSupabase, 'template-1', input);

      const inputWithExtras: CalculationInput = {
        ...input,
        numberOfStops: 3, // 2 extra stops
      };

      const resultWithExtras = await CalculatorService.calculate(mockSupabase, 'template-1', inputWithExtras);

      // Total should be higher by $10 (2 extra stops × $5)
      expect(resultWithExtras.customerCharges.total - resultWithoutExtras.customerCharges.total).toBe(10.0);
    });

    it('should include extraStopsBonus in driver payments total', async () => {
      const input: CalculationInput = {
        headcount: 50,
        foodCost: 500,
        mileage: 15,
        numberOfStops: 1,
      };

      const resultWithoutExtras = await CalculatorService.calculate(mockSupabase, 'template-1', input);

      const inputWithExtras: CalculationInput = {
        ...input,
        numberOfStops: 3,
      };

      const resultWithExtras = await CalculatorService.calculate(mockSupabase, 'template-1', inputWithExtras);

      // Total should be higher by $5 (2 extra stops × $2.50)
      expect(resultWithExtras.driverPayments.total - resultWithoutExtras.driverPayments.total).toBe(5.0);
    });
  });

  describe('Multi-stop with other pricing factors', () => {
    it('should correctly combine numberOfStops with bridge crossing', async () => {
      const input: CalculationInput = {
        headcount: 50,
        foodCost: 500,
        mileage: 15,
        numberOfStops: 2,
        requiresBridge: true,
      };

      const result = await CalculatorService.calculate(mockSupabase, 'template-1', input);

      // Should have both extra stops charge and bridge toll
      expect(result.customerCharges.extraStopsCharge).toBe(5.0);
      expect(result.driverPayments.bridgeToll).toBeGreaterThan(0);
    });

    it('should correctly combine numberOfStops with daily drive discount', async () => {
      const input: CalculationInput = {
        headcount: 50,
        foodCost: 500,
        mileage: 15,
        numberOfStops: 3,
        numberOfDrives: 3, // Should trigger discount
      };

      const result = await CalculatorService.calculate(mockSupabase, 'template-1', input);

      // Should have extra stops charge
      expect(result.customerCharges.extraStopsCharge).toBe(10.0);

      // Should have daily drive discount (negative value in breakdown)
      expect(result.customerCharges.dailyDriveDiscount).toBeLessThan(0);
    });

    it('should correctly combine numberOfStops with mileage charges', async () => {
      const input: CalculationInput = {
        headcount: 50,
        foodCost: 500,
        mileage: 20, // Over 10 miles, should have mileage charges
        numberOfStops: 4,
      };

      const result = await CalculatorService.calculate(mockSupabase, 'template-1', input);

      // Should have extra stops charge
      expect(result.customerCharges.extraStopsCharge).toBe(15.0);

      // Should have mileage charges for miles over 10
      expect(result.customerCharges.mileageCharges).toBeGreaterThan(0);

      // Total should include both
      expect(result.customerCharges.total).toBeGreaterThan(
        result.customerCharges.baseDeliveryFee +
          result.customerCharges.extraStopsCharge +
          result.customerCharges.mileageCharges -
          1 // Allow for rounding
      );
    });
  });

  describe('Profit calculation with multi-stop', () => {
    it('should correctly calculate profit with extra stops', async () => {
      const input: CalculationInput = {
        headcount: 50,
        foodCost: 500,
        mileage: 15,
        numberOfStops: 3,
      };

      const result = await CalculatorService.calculate(mockSupabase, 'template-1', input);

      // Extra stops contribute to profit: customer charge ($10) - driver bonus ($5) = $5 profit
      // Verify profit is calculated correctly
      const readySetFee = result.metadata?.readySetTotalFee || 0;
      const expectedProfit = result.customerCharges.total - result.driverPayments.total - readySetFee;

      expect(result.profit).toBeCloseTo(expectedProfit, 2);
    });

    it('should increase profit when adding extra stops', async () => {
      const baseInput: CalculationInput = {
        headcount: 50,
        foodCost: 500,
        mileage: 15,
        numberOfStops: 1,
      };

      const inputWithStops: CalculationInput = {
        ...baseInput,
        numberOfStops: 5, // 4 extra stops
      };

      const resultBase = await CalculatorService.calculate(mockSupabase, 'template-1', baseInput);
      const resultWithStops = await CalculatorService.calculate(mockSupabase, 'template-1', inputWithStops);

      // Extra stops should increase profit
      // 4 extra stops: customer pays $20 more, driver gets $10 more = $10 more profit
      expect(resultWithStops.profit - resultBase.profit).toBeCloseTo(10.0, 2);
    });
  });

  describe('Edge cases through service layer', () => {
    it('should handle numberOfStops = 0 (treat as 1)', async () => {
      const input: CalculationInput = {
        headcount: 50,
        foodCost: 500,
        mileage: 15,
        numberOfStops: 0,
      };

      const result = await CalculatorService.calculate(mockSupabase, 'template-1', input);

      // Should not have negative charges
      expect(result.customerCharges.extraStopsCharge).toBe(0);
      expect(result.driverPayments.extraStopsBonus).toBe(0);
    });

    it('should handle very large number of stops', async () => {
      const input: CalculationInput = {
        headcount: 50,
        foodCost: 500,
        mileage: 15,
        numberOfStops: 50,
      };

      const result = await CalculatorService.calculate(mockSupabase, 'template-1', input);

      // 49 extra stops × $5 = $245
      expect(result.customerCharges.extraStopsCharge).toBe(245.0);

      // 49 extra stops × $2.50 = $122.50
      expect(result.driverPayments.extraStopsBonus).toBe(122.5);
    });
  });
});
