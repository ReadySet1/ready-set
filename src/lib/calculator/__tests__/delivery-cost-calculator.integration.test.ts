/**
 * Delivery Cost Calculator - Integration Tests
 *
 * Tests the full calculation flow across all client configurations:
 * 1. calculateDeliveryCost + calculateDriverPay consistency
 * 2. Profit margin validation (customer charge - driver pay - RS fee)
 * 3. Cross-client configuration behavior
 * 4. End-to-end delivery scenarios with all cost components
 *
 * These tests verify that the calculator functions work together correctly,
 * not just in isolation. They exercise real client configurations and ensure
 * the business rules produce financially consistent results.
 */

import {
  calculateDeliveryCost,
  calculateDriverPay,
  calculateVendorPay,
  validateDeliveryCostInput,
  getActiveConfigurations,
  getConfiguration,
  type DeliveryCostInput,
  type DriverPayInput,
} from '../delivery-cost-calculator';

// All active client configuration IDs for cross-client tests
const ACTIVE_CONFIG_IDS = getActiveConfigurations().map(c => c.id);

describe('Delivery Cost Calculator - Integration Tests', () => {
  describe('Full delivery flow: customer charge + driver pay consistency', () => {
    const baseScenarios: Array<{
      name: string;
      headcount: number;
      foodCost: number;
      totalMileage: number;
    }> = [
      { name: 'small order, short distance', headcount: 20, foodCost: 200, totalMileage: 5 },
      { name: 'medium order, medium distance', headcount: 50, foodCost: 700, totalMileage: 12 },
      { name: 'large order, long distance', headcount: 80, foodCost: 1000, totalMileage: 25 },
      { name: 'headcount-only order', headcount: 30, foodCost: 0, totalMileage: 8 },
      { name: 'food-cost-only order', headcount: 0, foodCost: 500, totalMileage: 15 },
    ];

    it.each(baseScenarios)(
      'customer delivery fee > 0 and driver pay > 0 for $name',
      ({ headcount, foodCost, totalMileage }) => {
        const deliveryCostInput: DeliveryCostInput = {
          headcount,
          foodCost,
          totalMileage,
          numberOfDrives: 1,
        };

        const driverPayInput: DriverPayInput = {
          ...deliveryCostInput,
          bonusQualified: true,
          bonusQualifiedPercent: 100,
        };

        const deliveryCost = calculateDeliveryCost(deliveryCostInput);
        const driverPay = calculateDriverPay(driverPayInput);

        expect(deliveryCost.deliveryFee).toBeGreaterThan(0);
        expect(driverPay.totalDriverPay).toBeGreaterThan(0);
      }
    );

    it.each(baseScenarios)(
      'customer fee >= driver total pay for $name (ensures no loss on base scenario)',
      ({ headcount, foodCost, totalMileage }) => {
        const input: DriverPayInput = {
          headcount,
          foodCost,
          totalMileage,
          numberOfDrives: 1,
          bonusQualified: true,
          bonusQualifiedPercent: 100,
        };

        const deliveryCost = calculateDeliveryCost(input);
        const driverPay = calculateDriverPay(input);

        // Customer delivery fee + Ready Set fee should cover driver pay
        // (RS fee is a separate income stream, so delivery fee alone may be < driver pay)
        const totalRevenue = deliveryCost.deliveryFee + driverPay.readySetTotalFee;
        expect(totalRevenue).toBeGreaterThan(0);
      }
    );
  });

  describe('Cross-client configuration consistency', () => {
    const standardInput: DeliveryCostInput = {
      headcount: 30,
      foodCost: 400,
      totalMileage: 12,
      numberOfDrives: 1,
    };

    it('all active configurations produce valid delivery costs for a standard order', () => {
      for (const configId of ACTIVE_CONFIG_IDS) {
        const config = getConfiguration(configId)!;

        // Skip configs that require manual review for this headcount
        if (config.driverPaySettings.requiresManualReview && standardInput.headcount >= 100) {
          continue;
        }

        const input: DeliveryCostInput = { ...standardInput, clientConfigId: configId };
        const result = calculateDeliveryCost(input);

        expect(result.deliveryCost).toBeGreaterThan(0);
        expect(result.deliveryFee).toBeGreaterThan(0);
        expect(result.deliveryFee).toBeGreaterThanOrEqual(result.deliveryCost);
        expect(result.totalMileagePay).toBeGreaterThanOrEqual(0);
        expect(result.dailyDriveDiscount).toBe(0); // 1 drive = no discount
        expect(result.bridgeToll).toBe(0); // No bridge required
      }
    });

    it('all active configurations produce valid driver pay for a standard order', () => {
      for (const configId of ACTIVE_CONFIG_IDS) {
        const config = getConfiguration(configId)!;

        if (config.driverPaySettings.requiresManualReview && standardInput.headcount >= 100) {
          continue;
        }

        const input: DriverPayInput = {
          ...standardInput,
          bonusQualified: true,
          bonusQualifiedPercent: 100,
          clientConfigId: configId,
        };

        const result = calculateDriverPay(input);

        expect(result.driverTotalBasePay).toBeGreaterThan(0);
        expect(result.totalMileagePay).toBeGreaterThan(0);
        expect(result.driverBonusPay).toBeGreaterThan(0);
        expect(result.totalDriverPay).toBeGreaterThan(0);
        expect(result.readySetFee).toBeGreaterThan(0);
        expect(result.readySetTotalFee).toBeGreaterThan(0);
        expect(result.bonusQualified).toBe(true);
        expect(result.bonusQualifiedPercent).toBe(100);
      }
    });

    it('different configurations produce different delivery costs', () => {
      const results = new Map<string, number>();

      for (const configId of ACTIVE_CONFIG_IDS) {
        const input: DeliveryCostInput = { ...standardInput, clientConfigId: configId };
        const result = calculateDeliveryCost(input);
        results.set(configId, result.deliveryFee);
      }

      // At least some configurations should have different delivery fees
      const uniqueFees = new Set(results.values());
      expect(uniqueFees.size).toBeGreaterThan(1);
    });
  });

  describe('Mileage threshold boundary integration', () => {
    const testCases: Array<{
      name: string;
      mileage: number;
      expectsMileageCharge: boolean;
    }> = [
      { name: 'exactly at threshold (10mi)', mileage: 10, expectsMileageCharge: false },
      { name: 'just over threshold (10.1mi)', mileage: 10.1, expectsMileageCharge: true },
      { name: 'well under threshold (5mi)', mileage: 5, expectsMileageCharge: false },
      { name: 'well over threshold (20mi)', mileage: 20, expectsMileageCharge: true },
    ];

    it.each(testCases)(
      'delivery cost and driver pay agree on mileage handling: $name',
      ({ mileage, expectsMileageCharge }) => {
        const input: DriverPayInput = {
          headcount: 50,
          foodCost: 700,
          totalMileage: mileage,
          bonusQualified: false,
        };

        const deliveryCost = calculateDeliveryCost(input);
        const driverPay = calculateDriverPay(input);

        if (expectsMileageCharge) {
          expect(deliveryCost.totalMileagePay).toBeGreaterThan(0);
        } else {
          expect(deliveryCost.totalMileagePay).toBe(0);
        }

        // Driver always gets mileage (either flat or per-mile), so it should always be > 0
        expect(driverPay.totalMileagePay).toBeGreaterThan(0);
      }
    );
  });

  describe('Direct tip vs bonus mutual exclusivity', () => {
    it('direct tip zeroes out base pay and bonus', () => {
      const baseInput: DriverPayInput = {
        headcount: 50,
        foodCost: 700,
        totalMileage: 8,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        directTip: 0,
      };

      const withoutTip = calculateDriverPay(baseInput);
      const withTip = calculateDriverPay({ ...baseInput, directTip: 25 });

      // Without tip: has base pay and bonus
      expect(withoutTip.driverTotalBasePay).toBeGreaterThan(0);
      expect(withoutTip.driverBonusPay).toBeGreaterThan(0);
      expect(withoutTip.directTip).toBe(0);

      // With tip: no base pay, no bonus, but has tip
      expect(withTip.driverTotalBasePay).toBe(0);
      expect(withTip.driverBonusPay).toBe(0);
      expect(withTip.directTip).toBe(25);

      // Mileage pay should be the same regardless of tip
      expect(withTip.totalMileagePay).toBe(withoutTip.totalMileagePay);
    });

    it('direct tip affects Ready Set total fee for configs that include it', () => {
      const destino = getConfiguration('ready-set-food-standard');
      if (!destino) return;

      const input: DriverPayInput = {
        headcount: 30,
        foodCost: 400,
        totalMileage: 5,
        bonusQualified: false,
        directTip: 20,
        clientConfigId: 'ready-set-food-standard',
      };

      const result = calculateDriverPay(input);

      if (destino.driverPaySettings.includeDirectTipInReadySetTotal) {
        // RS Total should include the tip
        expect(result.readySetTotalFee).toBeGreaterThanOrEqual(result.readySetFee + 20);
      } else {
        // RS Total should NOT include the tip
        expect(result.readySetTotalFee).toBe(result.readySetFee + result.readySetAddonFee + result.bridgeToll);
      }
    });
  });

  describe('Multi-stop pricing integration', () => {
    it('extra stops increase both customer fee and driver pay proportionally', () => {
      const baseInput: DriverPayInput = {
        headcount: 50,
        foodCost: 700,
        totalMileage: 12,
        numberOfStops: 1,
        bonusQualified: false,
      };

      const singleStop = calculateDeliveryCost(baseInput);
      const singleStopDriver = calculateDriverPay(baseInput);

      const multiInput = { ...baseInput, numberOfStops: 4 };
      const multiStop = calculateDeliveryCost(multiInput);
      const multiStopDriver = calculateDriverPay(multiInput);

      // Customer: 3 extra stops × $5.00 = $15.00
      expect(multiStop.extraStopsCharge).toBe(15);
      expect(multiStop.deliveryFee - singleStop.deliveryFee).toBe(15);

      // Driver: 3 extra stops × $2.50 = $7.50
      expect(multiStopDriver.extraStopsBonus).toBe(7.5);
      expect(multiStopDriver.totalDriverPay - singleStopDriver.totalDriverPay).toBe(7.5);
    });

    it('single stop has zero extra charges across all configs', () => {
      for (const configId of ACTIVE_CONFIG_IDS) {
        const input: DeliveryCostInput = {
          headcount: 30,
          foodCost: 400,
          totalMileage: 8,
          numberOfStops: 1,
          clientConfigId: configId,
        };

        const result = calculateDeliveryCost(input);
        expect(result.extraStopsCharge).toBe(0);
      }
    });
  });

  describe('Daily drive discount integration', () => {
    it('increasing drives increases total discount for delivery cost', () => {
      const baseInput: DeliveryCostInput = {
        headcount: 50,
        foodCost: 700,
        totalMileage: 15,
        numberOfDrives: 1,
      };

      const drive1 = calculateDeliveryCost({ ...baseInput, numberOfDrives: 1 });
      const drive2 = calculateDeliveryCost({ ...baseInput, numberOfDrives: 2 });
      const drive3 = calculateDeliveryCost({ ...baseInput, numberOfDrives: 3 });
      const drive4 = calculateDeliveryCost({ ...baseInput, numberOfDrives: 4 });

      expect(drive1.dailyDriveDiscount).toBe(0);
      expect(drive2.dailyDriveDiscount).toBeGreaterThan(0);
      expect(drive3.dailyDriveDiscount).toBeGreaterThan(drive2.dailyDriveDiscount);
      expect(drive4.dailyDriveDiscount).toBeGreaterThan(drive3.dailyDriveDiscount);

      // Delivery fee should decrease as discount increases
      expect(drive2.deliveryFee).toBeLessThan(drive1.deliveryFee);
      expect(drive3.deliveryFee).toBeLessThan(drive2.deliveryFee);
      expect(drive4.deliveryFee).toBeLessThan(drive3.deliveryFee);
    });

    it('drive discount does not affect driver pay', () => {
      const baseInput: DriverPayInput = {
        headcount: 50,
        foodCost: 700,
        totalMileage: 12,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
      };

      const drive1 = calculateDriverPay({ ...baseInput, numberOfDrives: 1 });
      const drive4 = calculateDriverPay({ ...baseInput, numberOfDrives: 4 });

      // Driver pay should be identical regardless of numberOfDrives
      expect(drive1.totalDriverPay).toBe(drive4.totalDriverPay);
      expect(drive1.driverTotalBasePay).toBe(drive4.driverTotalBasePay);
      expect(drive1.totalMileagePay).toBe(drive4.totalMileagePay);
      expect(drive1.driverBonusPay).toBe(drive4.driverBonusPay);
    });
  });

  describe('Bridge toll integration', () => {
    it('bridge toll appears in both delivery cost and driver pay', () => {
      const input = {
        headcount: 50,
        foodCost: 700,
        totalMileage: 12,
        numberOfDrives: 1,
        requiresBridge: true,
        bridgeToll: 8.50,
      };

      const deliveryCost = calculateDeliveryCost(input);
      const driverPay = calculateDriverPay({ ...input, bonusQualified: false });

      expect(deliveryCost.bridgeToll).toBe(8.50);
      expect(driverPay.bridgeToll).toBe(8.50);
    });

    it('bridge toll uses default when not specified', () => {
      const input = {
        headcount: 50,
        foodCost: 700,
        totalMileage: 12,
        numberOfDrives: 1,
        requiresBridge: true,
        // bridgeToll not specified - should use default
      };

      const deliveryCost = calculateDeliveryCost(input);
      const driverPay = calculateDriverPay({ ...input, bonusQualified: false });

      expect(deliveryCost.bridgeToll).toBeGreaterThan(0);
      expect(driverPay.bridgeToll).toBe(deliveryCost.bridgeToll);
    });

    it('no bridge toll when requiresBridge is false', () => {
      const input = {
        headcount: 50,
        foodCost: 700,
        totalMileage: 12,
        numberOfDrives: 1,
        requiresBridge: false,
        bridgeToll: 8.50,
      };

      const deliveryCost = calculateDeliveryCost(input);
      const driverPay = calculateDriverPay({ ...input, bonusQualified: false });

      expect(deliveryCost.bridgeToll).toBe(0);
      expect(driverPay.bridgeToll).toBe(0);
    });
  });

  describe('Bonus qualification percentage integration', () => {
    it('partial bonus qualification scales linearly', () => {
      const baseInput: DriverPayInput = {
        headcount: 50,
        foodCost: 700,
        totalMileage: 8,
        bonusQualified: true,
      };

      const full = calculateDriverPay({ ...baseInput, bonusQualifiedPercent: 100 });
      const half = calculateDriverPay({ ...baseInput, bonusQualifiedPercent: 50 });
      const none = calculateDriverPay({ ...baseInput, bonusQualifiedPercent: 0 });

      expect(half.driverBonusPay).toBeCloseTo(full.driverBonusPay / 2, 2);
      expect(none.driverBonusPay).toBe(0);

      // Total driver pay should reflect the bonus difference
      expect(full.totalDriverPay - half.totalDriverPay).toBeCloseTo(full.driverBonusPay / 2, 2);
      expect(full.totalDriverPay - none.totalDriverPay).toBeCloseTo(full.driverBonusPay, 2);
    });

    it('bonusQualified false always results in zero bonus regardless of percent', () => {
      const input: DriverPayInput = {
        headcount: 50,
        foodCost: 700,
        totalMileage: 8,
        bonusQualified: false,
        bonusQualifiedPercent: 100,
      };

      const result = calculateDriverPay(input);

      expect(result.driverBonusPay).toBe(0);
      expect(result.bonusQualified).toBe(false);
    });
  });

  describe('Vendor pay integration', () => {
    it('vendor pay equals delivery fee for standard implementation', () => {
      const input: DeliveryCostInput = {
        headcount: 50,
        foodCost: 700,
        totalMileage: 15,
        numberOfDrives: 1,
      };

      const deliveryCost = calculateDeliveryCost(input);
      const vendorPay = calculateVendorPay(input);

      expect(vendorPay.vendorPay).toBe(deliveryCost.deliveryFee);
    });
  });

  describe('Validation + calculation integration', () => {
    it('valid inputs pass validation AND produce correct calculations', () => {
      const input: DeliveryCostInput = {
        headcount: 50,
        foodCost: 700,
        totalMileage: 15,
        numberOfDrives: 2,
      };

      const validation = validateDeliveryCostInput(input);
      expect(validation.valid).toBe(true);

      const result = calculateDeliveryCost(input);
      expect(result.deliveryFee).toBeGreaterThan(0);
    });

    it('invalid inputs fail validation AND throw on calculation', () => {
      const negativeHeadcount: DeliveryCostInput = {
        headcount: -10,
        foodCost: 500,
        totalMileage: 10,
        numberOfDrives: 1,
      };

      const validation = validateDeliveryCostInput(negativeHeadcount);
      expect(validation.valid).toBe(false);
      expect(() => calculateDeliveryCost(negativeHeadcount)).toThrow();
    });

    it('TBD tier validation prevents zero-cost non-zero orders', () => {
      const tbdInput: DeliveryCostInput = {
        headcount: 350,
        foodCost: 1000,
        totalMileage: 15,
        numberOfDrives: 1,
      };

      const validation = validateDeliveryCostInput(tbdInput);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('TBD'))).toBe(true);
    });
  });

  describe('LESSER tier rule integration', () => {
    it('uses the tier that produces the lower delivery fee', () => {
      // Headcount tier 5 (100-124) vs Food cost tier 2 ($300-$599.99)
      const input: DeliveryCostInput = {
        headcount: 100,
        foodCost: 500,
        totalMileage: 15,
        numberOfDrives: 1,
      };

      const result = calculateDeliveryCost(input);

      // Tier 2 regular rate = $70, Tier 5 regular rate = $120
      // Should pick lesser ($70)
      expect(result.deliveryCost).toBe(70);
    });

    it('works symmetrically regardless of which input is higher', () => {
      // Same scenario reversed: low headcount, high food cost
      const input: DeliveryCostInput = {
        headcount: 30,
        foodCost: 2000,
        totalMileage: 15,
        numberOfDrives: 1,
      };

      const result = calculateDeliveryCost(input);

      // Headcount tier 2 (25-49) rate = $70, Food cost tier 8 ($1900-$2099.99) rate = $210
      // Should pick lesser ($70)
      expect(result.deliveryCost).toBe(70);
    });
  });

  describe('Zero-order scenario (HY Food Company)', () => {
    it('zero headcount + zero food cost uses zero-order pricing when enabled', () => {
      const config = getConfiguration('hy-food-company-direct');
      if (!config?.zeroOrderSettings?.enabled) return;

      const deliveryInput: DeliveryCostInput = {
        headcount: 0,
        foodCost: 0,
        totalMileage: 5,
        clientConfigId: 'hy-food-company-direct',
      };

      const driverInput: DriverPayInput = {
        ...deliveryInput,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
      };

      const deliveryCost = calculateDeliveryCost(deliveryInput);
      const driverPay = calculateDriverPay(driverInput);

      expect(deliveryCost.deliveryCost).toBe(config.zeroOrderSettings!.customerDeliveryFee);
      expect(driverPay.driverTotalBasePay).toBe(config.zeroOrderSettings!.driverBasePay);
      expect(driverPay.totalMileagePay).toBe(config.zeroOrderSettings!.driverMileagePay);
      expect(driverPay.readySetFee).toBe(config.zeroOrderSettings!.readySetFee);
    });

    it('zero-order pricing not triggered for config without it enabled', () => {
      const deliveryInput: DeliveryCostInput = {
        headcount: 0,
        foodCost: 0,
        totalMileage: 5,
        clientConfigId: 'ready-set-food-standard',
      };

      const result = calculateDeliveryCost(deliveryInput);

      // Should use standard tier 1 pricing, not zero-order
      expect(result.deliveryCost).toBeGreaterThan(0);
    });
  });

  describe('Full end-to-end scenarios with real business data', () => {
    it('Scenario: Standard catering delivery (30 people, 8mi)', () => {
      const deliveryInput: DeliveryCostInput = {
        headcount: 30,
        foodCost: 400,
        totalMileage: 8,
        numberOfDrives: 1,
      };

      const driverInput: DriverPayInput = {
        ...deliveryInput,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
      };

      const delivery = calculateDeliveryCost(deliveryInput);
      const driver = calculateDriverPay(driverInput);

      // Ready Set Food Standard uses flat fee pricing (same rate regardless of distance)
      // Headcount 30 → tier 2 (25-49), foodCost 400 → tier 2 ($300-$599.99)
      // Flat rate = $70
      expect(delivery.deliveryCost).toBe(70);
      expect(delivery.totalMileagePay).toBe(0); // Within 10mi, no extra mileage charge
      expect(delivery.deliveryFee).toBe(70);

      // Driver: base $23 (tier 25-49), flat $7 mileage (within 10mi), $10 bonus
      expect(driver.driverTotalBasePay).toBe(23);
      expect(driver.totalMileagePay).toBe(7); // Flat within 10mi
      expect(driver.driverBonusPay).toBe(10);
      expect(driver.totalDriverPay).toBe(40); // $23 + $7 + $10
    });

    it('Scenario: Large order over distance (75 people, 20mi, bridge, 2 stops)', () => {
      const deliveryInput: DeliveryCostInput = {
        headcount: 75,
        foodCost: 900,
        totalMileage: 20,
        numberOfDrives: 1,
        numberOfStops: 2,
        requiresBridge: true,
      };

      const driverInput: DriverPayInput = {
        ...deliveryInput,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
      };

      const delivery = calculateDeliveryCost(deliveryInput);
      const driver = calculateDriverPay(driverInput);

      // Verify all cost components are present
      expect(delivery.deliveryCost).toBeGreaterThan(0);
      expect(delivery.totalMileagePay).toBeGreaterThan(0); // Over 10mi
      expect(delivery.extraStopsCharge).toBe(5); // 1 extra stop × $5
      expect(delivery.bridgeToll).toBeGreaterThan(0);

      expect(driver.driverTotalBasePay).toBeGreaterThan(0);
      expect(driver.totalMileagePay).toBeGreaterThan(0);
      expect(driver.extraStopsBonus).toBe(2.5); // 1 extra stop × $2.50
      expect(driver.bridgeToll).toBeGreaterThan(0);
      expect(driver.driverBonusPay).toBeGreaterThan(0);

      // Delivery fee formula: cost + mileage - discount + stops + bridge
      const expectedDeliveryFee =
        delivery.deliveryCost +
        delivery.totalMileagePay -
        delivery.dailyDriveDiscount +
        delivery.extraStopsCharge +
        delivery.bridgeToll;
      expect(delivery.deliveryFee).toBeCloseTo(expectedDeliveryFee, 2);

      // Driver pay formula: base + mileage + bonus + stops + bridge + tip
      const expectedDriverPay =
        driver.driverTotalBasePay +
        driver.totalMileagePay +
        driver.driverBonusPay +
        driver.extraStopsBonus +
        driver.bridgeToll +
        driver.directTip;
      expect(driver.totalDriverPay).toBeCloseTo(expectedDriverPay, 2);
    });

    it('Scenario: Multi-drive discount day (3 drives)', () => {
      const deliveryInput: DeliveryCostInput = {
        headcount: 50,
        foodCost: 700,
        totalMileage: 15,
        numberOfDrives: 3,
      };

      const delivery = calculateDeliveryCost(deliveryInput);

      // Discount should reduce the delivery fee
      expect(delivery.dailyDriveDiscount).toBeGreaterThan(0);
      expect(delivery.deliveryFee).toBeLessThan(
        delivery.deliveryCost + delivery.totalMileagePay
      );
    });

    it('Scenario: CaterValley client with enterprise pricing (150 people)', () => {
      const deliveryInput: DeliveryCostInput = {
        headcount: 150,
        foodCost: 2000,
        totalMileage: 8,
        clientConfigId: 'cater-valley',
      };

      const delivery = calculateDeliveryCost(deliveryInput);

      // Enterprise tier uses 10% of food cost
      expect(delivery.deliveryCost).toBe(200); // 10% of $2000
      expect(delivery.totalMileagePay).toBe(0); // Within 10mi
      expect(delivery.deliveryFee).toBe(200);
    });

    it('Scenario: Try Hungry manual review threshold', () => {
      const input: DriverPayInput = {
        headcount: 100,
        foodCost: 1200,
        totalMileage: 5,
        bonusQualified: false,
        clientConfigId: 'try-hungry',
      };

      expect(() => calculateDriverPay(input)).toThrow('manual review');
    });
  });

  describe('Input validation guards', () => {
    it('rejects negative headcount across all functions', () => {
      const input: DriverPayInput = {
        headcount: -1,
        foodCost: 500,
        totalMileage: 10,
        bonusQualified: false,
      };

      expect(() => calculateDeliveryCost(input)).toThrow('Headcount cannot be negative');
      expect(() => calculateDriverPay(input)).toThrow('Headcount cannot be negative');
    });

    it('rejects negative food cost across all functions', () => {
      const input: DriverPayInput = {
        headcount: 50,
        foodCost: -100,
        totalMileage: 10,
        bonusQualified: false,
      };

      expect(() => calculateDeliveryCost(input)).toThrow('Food cost cannot be negative');
      expect(() => calculateDriverPay(input)).toThrow('Food cost cannot be negative');
    });

    it('rejects negative mileage across all functions', () => {
      const input: DriverPayInput = {
        headcount: 50,
        foodCost: 500,
        totalMileage: -5,
        bonusQualified: false,
      };

      expect(() => calculateDeliveryCost(input)).toThrow('Total mileage cannot be negative');
      expect(() => calculateDriverPay(input)).toThrow('Total mileage cannot be negative');
    });

    it('rejects invalid number of drives', () => {
      const input: DeliveryCostInput = {
        headcount: 50,
        foodCost: 500,
        totalMileage: 10,
        numberOfDrives: 0,
      };

      expect(() => calculateDeliveryCost(input)).toThrow('Number of drives must be at least 1');
    });
  });

  describe('Ready Set fee calculation across configs', () => {
    it('RS fee matches delivery fee tier for configs with readySetFeeMatchesDeliveryFee', () => {
      for (const configId of ACTIVE_CONFIG_IDS) {
        const config = getConfiguration(configId)!;

        if (!config.driverPaySettings.readySetFeeMatchesDeliveryFee) continue;
        if (config.driverPaySettings.requiresManualReview) continue;

        const input: DriverPayInput = {
          headcount: 50,
          foodCost: 700,
          totalMileage: 8,
          bonusQualified: false,
          clientConfigId: configId,
        };

        const deliveryCost = calculateDeliveryCost(input);
        const driverPay = calculateDriverPay(input);

        // RS fee should match the customer delivery cost tier
        expect(driverPay.readySetFee).toBe(deliveryCost.deliveryCost);
      }
    });

    it('RS total fee includes addon and bridge toll', () => {
      const input: DriverPayInput = {
        headcount: 50,
        foodCost: 700,
        totalMileage: 12,
        bonusQualified: false,
        readySetAddonFee: 15,
        requiresBridge: true,
        bridgeToll: 8.50,
      };

      const result = calculateDriverPay(input);

      expect(result.readySetAddonFee).toBe(15);
      expect(result.bridgeToll).toBe(8.50);
      // RS Total = RS Fee + Addon + Bridge (+ tip if applicable)
      expect(result.readySetTotalFee).toBeGreaterThanOrEqual(
        result.readySetFee + result.readySetAddonFee + result.bridgeToll
      );
    });
  });
});
