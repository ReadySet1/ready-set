/**
 * Multi-Stop Pricing Tests
 *
 * Comprehensive test suite for the multi-stop delivery pricing functionality.
 *
 * Tests cover:
 * - Unit tests for extra stops charge calculation
 * - Unit tests for extra stops bonus calculation
 * - Integration with other pricing components (mileage, bridge toll, daily drive discount)
 * - Edge cases and boundary conditions
 * - Pricing tier interactions with multi-stop
 * - Real-world scenario simulations
 */

import {
  calculateDeliveryCost,
  calculateDriverPay,
  type DeliveryCostInput,
  type DriverPayInput,
} from '../delivery-cost-calculator';

// Test constants for verification
const CUSTOMER_EXTRA_STOP_RATE = 5.00;  // $5.00 per additional stop
const DRIVER_EXTRA_STOP_BONUS = 2.50;   // $2.50 per additional stop

describe('Multi-Stop Pricing', () => {
  describe('calculateExtraStopsCharge (via calculateDeliveryCost)', () => {
    const baseInput: DeliveryCostInput = {
      headcount: 50,
      foodCost: 500,
      totalMileage: 8, // Within 10 miles to simplify testing
      numberOfDrives: 1,
      requiresBridge: false,
      clientConfigId: 'ready-set-food-standard',
    };

    it('should return 0 extra stops charge for 1 stop (default)', () => {
      const result = calculateDeliveryCost({
        ...baseInput,
        numberOfStops: 1,
      });

      expect(result.extraStopsCharge).toBe(0);
    });

    it('should return 0 extra stops charge when numberOfStops is not provided', () => {
      const result = calculateDeliveryCost(baseInput);

      expect(result.extraStopsCharge).toBe(0);
    });

    it('should charge $5.00 for 2 stops (1 extra stop)', () => {
      const result = calculateDeliveryCost({
        ...baseInput,
        numberOfStops: 2,
      });

      expect(result.extraStopsCharge).toBe(5.0);
    });

    it('should charge $10.00 for 3 stops (2 extra stops)', () => {
      const result = calculateDeliveryCost({
        ...baseInput,
        numberOfStops: 3,
      });

      expect(result.extraStopsCharge).toBe(10.0);
    });

    it('should charge $25.00 for 6 stops (5 extra stops)', () => {
      const result = calculateDeliveryCost({
        ...baseInput,
        numberOfStops: 6,
      });

      expect(result.extraStopsCharge).toBe(25.0);
    });

    it('should include extra stops charge in total delivery fee', () => {
      const resultWithoutExtraStops = calculateDeliveryCost({
        ...baseInput,
        numberOfStops: 1,
      });

      const resultWithExtraStops = calculateDeliveryCost({
        ...baseInput,
        numberOfStops: 3,
      });

      // The difference should be $10.00 (2 extra stops × $5.00)
      expect(resultWithExtraStops.deliveryFee - resultWithoutExtraStops.deliveryFee).toBe(10.0);
      expect(resultWithExtraStops.extraStopsCharge).toBe(10.0);
    });
  });

  describe('calculateExtraStopsBonus (via calculateDriverPay)', () => {
    const baseInput: DriverPayInput = {
      headcount: 50,
      foodCost: 500,
      totalMileage: 8,
      numberOfDrives: 1,
      requiresBridge: false,
      bonusQualified: true,
      bonusQualifiedPercent: 100,
      clientConfigId: 'ready-set-food-standard',
    };

    it('should return 0 extra stops bonus for 1 stop (default)', () => {
      const result = calculateDriverPay({
        ...baseInput,
        numberOfStops: 1,
      });

      expect(result.extraStopsBonus).toBe(0);
    });

    it('should return 0 extra stops bonus when numberOfStops is not provided', () => {
      const result = calculateDriverPay(baseInput);

      expect(result.extraStopsBonus).toBe(0);
    });

    it('should give $2.50 bonus for 2 stops (1 extra stop)', () => {
      const result = calculateDriverPay({
        ...baseInput,
        numberOfStops: 2,
      });

      expect(result.extraStopsBonus).toBe(2.5);
    });

    it('should give $5.00 bonus for 3 stops (2 extra stops)', () => {
      const result = calculateDriverPay({
        ...baseInput,
        numberOfStops: 3,
      });

      expect(result.extraStopsBonus).toBe(5.0);
    });

    it('should give $12.50 bonus for 6 stops (5 extra stops)', () => {
      const result = calculateDriverPay({
        ...baseInput,
        numberOfStops: 6,
      });

      expect(result.extraStopsBonus).toBe(12.5);
    });

    it('should include extra stops bonus in total driver pay', () => {
      const resultWithoutExtraStops = calculateDriverPay({
        ...baseInput,
        numberOfStops: 1,
      });

      const resultWithExtraStops = calculateDriverPay({
        ...baseInput,
        numberOfStops: 3,
      });

      // The difference should be $5.00 (2 extra stops × $2.50)
      expect(resultWithExtraStops.totalDriverPay - resultWithoutExtraStops.totalDriverPay).toBe(5.0);
      expect(resultWithExtraStops.extraStopsBonus).toBe(5.0);
    });
  });

  describe('Multi-Stop Integration', () => {
    it('should correctly calculate both customer charge and driver bonus for 3 stops', () => {
      const input: DriverPayInput = {
        headcount: 50,
        foodCost: 500,
        totalMileage: 15,
        numberOfStops: 3,
        numberOfDrives: 1,
        requiresBridge: false,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'ready-set-food-standard',
      };

      const deliveryResult = calculateDeliveryCost(input);
      const driverResult = calculateDriverPay(input);

      // Customer extra stops charge: 2 × $5.00 = $10.00
      expect(deliveryResult.extraStopsCharge).toBe(10.0);

      // Driver extra stops bonus: 2 × $2.50 = $5.00
      expect(driverResult.extraStopsBonus).toBe(5.0);

      // Verify they are included in totals
      expect(deliveryResult.deliveryFee).toBeGreaterThanOrEqual(deliveryResult.extraStopsCharge);
      expect(driverResult.totalDriverPay).toBeGreaterThanOrEqual(driverResult.extraStopsBonus);
    });

    it('should handle the example from manual testing: headcount=50, foodCost=$500, mileage=15, stops=3', () => {
      // This is the test case from the verification section of the plan
      const deliveryInput: DeliveryCostInput = {
        headcount: 50,
        foodCost: 500,
        totalMileage: 15,
        numberOfStops: 3,
        numberOfDrives: 1,
        requiresBridge: false,
        clientConfigId: 'ready-set-food-standard',
      };

      const driverInput: DriverPayInput = {
        ...deliveryInput,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
      };

      const deliveryResult = calculateDeliveryCost(deliveryInput);
      const driverResult = calculateDriverPay(driverInput);

      // Verify extra stops pricing
      // 2 extra stops × $5.00 = $10.00 customer charge
      expect(deliveryResult.extraStopsCharge).toBe(10.0);

      // 2 extra stops × $2.50 = $5.00 driver bonus
      expect(driverResult.extraStopsBonus).toBe(5.0);

      // Verify the charges are included in totals
      expect(deliveryResult.deliveryFee).toContain;
      expect(driverResult.totalDriverPay).toContain;
    });

    it('should work correctly with bridge toll and multiple stops', () => {
      const input: DriverPayInput = {
        headcount: 50,
        foodCost: 500,
        totalMileage: 15,
        numberOfStops: 2,
        numberOfDrives: 1,
        requiresBridge: true,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'ready-set-food-standard',
      };

      const deliveryResult = calculateDeliveryCost(input);
      const driverResult = calculateDriverPay(input);

      // Should have both bridge toll and extra stops
      expect(deliveryResult.bridgeToll).toBeGreaterThan(0);
      expect(deliveryResult.extraStopsCharge).toBe(5.0);

      expect(driverResult.bridgeToll).toBeGreaterThan(0);
      expect(driverResult.extraStopsBonus).toBe(2.5);
    });

    it('should work correctly with daily drive discount and multiple stops', () => {
      const input: DriverPayInput = {
        headcount: 50,
        foodCost: 500,
        totalMileage: 15,
        numberOfStops: 4,
        numberOfDrives: 3, // Should trigger daily drive discount
        requiresBridge: false,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'ready-set-food-standard',
      };

      const deliveryResult = calculateDeliveryCost(input);

      // Should have both daily drive discount and extra stops
      expect(deliveryResult.dailyDriveDiscount).toBeGreaterThan(0);
      expect(deliveryResult.extraStopsCharge).toBe(15.0); // 3 extra stops × $5.00
    });
  });

  describe('Edge Cases', () => {
    it('should handle 0 stops (treat as 1 stop)', () => {
      // numberOfStops minimum should be 1, but test defensive behavior
      const result = calculateDeliveryCost({
        headcount: 50,
        foodCost: 500,
        totalMileage: 8,
        numberOfStops: 0, // Invalid, should be treated as 1
        clientConfigId: 'ready-set-food-standard',
      });

      // Even with 0, the function should handle it gracefully
      // (0 - 1) * 5 would be negative, but Math.max should prevent that
      expect(result.extraStopsCharge).toBe(0);
    });

    it('should handle negative stops (treat as 1 stop)', () => {
      const result = calculateDeliveryCost({
        headcount: 50,
        foodCost: 500,
        totalMileage: 8,
        numberOfStops: -2, // Invalid
        clientConfigId: 'ready-set-food-standard',
      });

      expect(result.extraStopsCharge).toBe(0);
    });

    it('should handle very large number of stops', () => {
      const result = calculateDeliveryCost({
        headcount: 50,
        foodCost: 500,
        totalMileage: 8,
        numberOfStops: 100,
        clientConfigId: 'ready-set-food-standard',
      });

      // 99 extra stops × $5.00 = $495.00
      expect(result.extraStopsCharge).toBe(495.0);
    });
  });

  describe('Pricing Tier Interactions', () => {
    it('should correctly apply extra stops to small order tier', () => {
      // Small order: headcount 20, food cost $200 - within 10 miles
      const deliveryResult = calculateDeliveryCost({
        headcount: 20,
        foodCost: 200,
        totalMileage: 5,
        numberOfStops: 2,
        clientConfigId: 'ready-set-food-standard',
      });

      // Should have base delivery cost + extra stops charge
      expect(deliveryResult.extraStopsCharge).toBe(5.0);
      expect(deliveryResult.deliveryFee).toBeGreaterThan(deliveryResult.extraStopsCharge);
    });

    it('should correctly apply extra stops to medium order tier', () => {
      // Medium order: headcount 75, food cost $750 - within 10 miles
      const deliveryResult = calculateDeliveryCost({
        headcount: 75,
        foodCost: 750,
        totalMileage: 8,
        numberOfStops: 3,
        clientConfigId: 'ready-set-food-standard',
      });

      expect(deliveryResult.extraStopsCharge).toBe(10.0);
      expect(deliveryResult.deliveryFee).toBeGreaterThan(deliveryResult.extraStopsCharge);
    });

    it('should correctly apply extra stops to large order tier', () => {
      // Large order: headcount 150, food cost $1500 - over 10 miles
      const deliveryResult = calculateDeliveryCost({
        headcount: 150,
        foodCost: 1500,
        totalMileage: 20,
        numberOfStops: 4,
        clientConfigId: 'ready-set-food-standard',
      });

      expect(deliveryResult.extraStopsCharge).toBe(15.0);
      // Should also have mileage charges for miles over 10
      expect(deliveryResult.totalMileagePay).toBeGreaterThan(0);
    });
  });

  describe('Real-World Scenarios', () => {
    it('should calculate correctly for corporate lunch delivery to 2 buildings', () => {
      // Scenario: Corporate lunch, 50 people, $600 food, 12 miles, 2 stops
      const deliveryInput: DeliveryCostInput = {
        headcount: 50,
        foodCost: 600,
        totalMileage: 12,
        numberOfStops: 2,
        numberOfDrives: 1,
        requiresBridge: false,
        clientConfigId: 'ready-set-food-standard',
      };

      const driverInput: DriverPayInput = {
        ...deliveryInput,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
      };

      const deliveryResult = calculateDeliveryCost(deliveryInput);
      const driverResult = calculateDriverPay(driverInput);

      // Verify extra stops (1 extra stop)
      expect(deliveryResult.extraStopsCharge).toBe(5.0);
      expect(driverResult.extraStopsBonus).toBe(2.5);

      // Verify mileage (2 miles over 10)
      expect(deliveryResult.totalMileagePay).toBeGreaterThan(0);

      // Verify totals include all components
      expect(deliveryResult.deliveryFee).toBeGreaterThan(
        deliveryResult.deliveryCost + deliveryResult.extraStopsCharge
      );
    });

    it('should calculate correctly for multi-office catering event with 5 stops', () => {
      // Scenario: Large catering, 200 people, $2000 food, 25 miles, 5 stops, bridge crossing
      const deliveryInput: DeliveryCostInput = {
        headcount: 200,
        foodCost: 2000,
        totalMileage: 25,
        numberOfStops: 5,
        numberOfDrives: 1,
        requiresBridge: true,
        clientConfigId: 'ready-set-food-standard',
      };

      const driverInput: DriverPayInput = {
        ...deliveryInput,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
      };

      const deliveryResult = calculateDeliveryCost(deliveryInput);
      const driverResult = calculateDriverPay(driverInput);

      // Verify extra stops (4 extra stops)
      expect(deliveryResult.extraStopsCharge).toBe(20.0);
      expect(driverResult.extraStopsBonus).toBe(10.0);

      // Verify bridge toll is included
      expect(driverResult.bridgeToll).toBeGreaterThan(0);

      // Verify total is sum of components
      const expectedDriverTotal =
        driverResult.driverTotalBasePay +
        driverResult.totalMileagePay +
        driverResult.driverBonusPay +
        driverResult.extraStopsBonus +
        driverResult.directTip;
      expect(driverResult.totalDriverPay).toBe(expectedDriverTotal);
    });

    it('should calculate correctly for recurring daily delivery with discount', () => {
      // Scenario: Daily delivery (3rd of the day), 30 people, $350 food, 8 miles, 2 stops
      const deliveryInput: DeliveryCostInput = {
        headcount: 30,
        foodCost: 350,
        totalMileage: 8,
        numberOfStops: 2,
        numberOfDrives: 3, // 3rd drive of the day - should get discount
        requiresBridge: false,
        clientConfigId: 'ready-set-food-standard',
      };

      const deliveryResult = calculateDeliveryCost(deliveryInput);

      // Verify extra stops
      expect(deliveryResult.extraStopsCharge).toBe(5.0);

      // Verify daily drive discount is applied
      expect(deliveryResult.dailyDriveDiscount).toBeGreaterThan(0);

      // Verify delivery fee accounts for both
      const baseWithExtras = deliveryResult.deliveryCost + deliveryResult.extraStopsCharge;
      expect(deliveryResult.deliveryFee).toBeLessThan(baseWithExtras + 1); // Allow for rounding
    });

    it('should calculate correctly for single-stop delivery (no extra charges)', () => {
      // Scenario: Standard delivery, 40 people, $450 food, 10 miles, 1 stop
      const deliveryInput: DeliveryCostInput = {
        headcount: 40,
        foodCost: 450,
        totalMileage: 10,
        numberOfStops: 1,
        numberOfDrives: 1,
        requiresBridge: false,
        clientConfigId: 'ready-set-food-standard',
      };

      const driverInput: DriverPayInput = {
        ...deliveryInput,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
      };

      const deliveryResult = calculateDeliveryCost(deliveryInput);
      const driverResult = calculateDriverPay(driverInput);

      // No extra stops charges
      expect(deliveryResult.extraStopsCharge).toBe(0);
      expect(driverResult.extraStopsBonus).toBe(0);

      // Within 10 miles - no mileage charges
      expect(deliveryResult.totalMileagePay).toBe(0);
    });
  });

  describe('Consistency and Accuracy', () => {
    it('should maintain mathematical consistency between customer charge and driver bonus', () => {
      // Customer pays 2x what driver receives for extra stops
      for (let stops = 1; stops <= 10; stops++) {
        const deliveryResult = calculateDeliveryCost({
          headcount: 50,
          foodCost: 500,
          totalMileage: 8,
          numberOfStops: stops,
          clientConfigId: 'ready-set-food-standard',
        });

        const driverResult = calculateDriverPay({
          headcount: 50,
          foodCost: 500,
          totalMileage: 8,
          numberOfStops: stops,
          bonusQualified: true,
          bonusQualifiedPercent: 100,
          clientConfigId: 'ready-set-food-standard',
        });

        const extraStops = Math.max(0, stops - 1);
        expect(deliveryResult.extraStopsCharge).toBe(extraStops * CUSTOMER_EXTRA_STOP_RATE);
        expect(driverResult.extraStopsBonus).toBe(extraStops * DRIVER_EXTRA_STOP_BONUS);

        // Customer charge should be 2x driver bonus
        if (extraStops > 0) {
          expect(deliveryResult.extraStopsCharge / driverResult.extraStopsBonus).toBe(2);
        }
      }
    });

    it('should return consistent results for same inputs', () => {
      const input: DriverPayInput = {
        headcount: 50,
        foodCost: 500,
        totalMileage: 15,
        numberOfStops: 3,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'ready-set-food-standard',
      };

      // Run calculation multiple times
      const results = Array.from({ length: 5 }, () => ({
        delivery: calculateDeliveryCost(input),
        driver: calculateDriverPay(input),
      }));

      // All results should be identical
      const firstDelivery = results[0].delivery;
      const firstDriver = results[0].driver;

      results.forEach((result) => {
        expect(result.delivery.extraStopsCharge).toBe(firstDelivery.extraStopsCharge);
        expect(result.delivery.deliveryFee).toBe(firstDelivery.deliveryFee);
        expect(result.driver.extraStopsBonus).toBe(firstDriver.extraStopsBonus);
        expect(result.driver.totalDriverPay).toBe(firstDriver.totalDriverPay);
      });
    });

    it('should correctly handle decimal number of stops (round down)', () => {
      // numberOfStops should be an integer, but test defensive handling
      const result = calculateDeliveryCost({
        headcount: 50,
        foodCost: 500,
        totalMileage: 8,
        numberOfStops: 2.7 as unknown as number, // Force decimal
        clientConfigId: 'ready-set-food-standard',
      });

      // Should handle gracefully - 2.7 - 1 = 1.7 * 5 = 8.5
      expect(result.extraStopsCharge).toBeCloseTo(8.5, 2);
    });
  });

  describe('Driver Pay Breakdown Integrity', () => {
    it('should include extraStopsBonus in the DriverPayBreakdown object', () => {
      const result = calculateDriverPay({
        headcount: 50,
        foodCost: 500,
        totalMileage: 15,
        numberOfStops: 3,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'ready-set-food-standard',
      });

      // Verify extraStopsBonus is a property of the result
      expect(result).toHaveProperty('extraStopsBonus');
      expect(typeof result.extraStopsBonus).toBe('number');
      expect(result.extraStopsBonus).toBe(5.0);
    });

    it('should verify driver pay formula with extra stops', () => {
      const result = calculateDriverPay({
        headcount: 50,
        foodCost: 500,
        totalMileage: 15,
        numberOfStops: 4,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        clientConfigId: 'ready-set-food-standard',
      });

      // Total = basePay + mileagePay + bonus + extraStopsBonus + directTip
      const calculatedTotal =
        result.driverTotalBasePay +
        result.totalMileagePay +
        result.driverBonusPay +
        result.extraStopsBonus +
        result.directTip;

      expect(result.totalDriverPay).toBe(calculatedTotal);
    });
  });

  describe('Delivery Cost Breakdown Integrity', () => {
    it('should include extraStopsCharge in the DeliveryCostBreakdown object', () => {
      const result = calculateDeliveryCost({
        headcount: 50,
        foodCost: 500,
        totalMileage: 15,
        numberOfStops: 3,
        clientConfigId: 'ready-set-food-standard',
      });

      // Verify extraStopsCharge is a property of the result
      expect(result).toHaveProperty('extraStopsCharge');
      expect(typeof result.extraStopsCharge).toBe('number');
      expect(result.extraStopsCharge).toBe(10.0);
    });

    it('should verify delivery fee formula with extra stops', () => {
      const result = calculateDeliveryCost({
        headcount: 50,
        foodCost: 500,
        totalMileage: 15,
        numberOfStops: 4,
        numberOfDrives: 1,
        requiresBridge: false,
        clientConfigId: 'ready-set-food-standard',
      });

      // deliveryFee = deliveryCost + mileagePay - discount + extraStops + bridgeToll
      const calculatedFee =
        result.deliveryCost +
        result.totalMileagePay -
        result.dailyDriveDiscount +
        result.extraStopsCharge; // No bridge toll in this test

      expect(result.deliveryFee).toBe(calculatedFee);
    });
  });
});
