/**
 * CaterValley Calculator Tests
 *
 * Tests specific to CaterValley vendor configuration:
 * - Flat fee pricing (same rate within/beyond 10 miles per tier)
 * - Mileage: $3.00/mile after 10 miles (added to delivery fee)
 * - Bridge toll: Driver compensation paid by Ready Set (NOT charged to customer)
 * - Percentage-based pricing for 100+ headcount (10% of food cost)
 * - Driver mileage: flat $7 within 10mi, $0.70/mile × total miles over 10mi
 * - Driver base pay: tiered by headcount ($18/$23/$33/$43, 100+ case by case)
 */

import {
  calculateDeliveryCost,
  calculateDriverPay,
  DeliveryCostInput,
  DriverPayInput
} from '@/lib/calculator/delivery-cost-calculator';

describe('CaterValley Calculator - Client Pricing', () => {
  describe('Tier 1: Small orders (≤25 headcount OR ≤$300 food cost)', () => {
    it('should calculate $42.50 within 10 miles (minimum fee)', () => {
      const input: DeliveryCostInput = {
        headcount: 20,
        foodCost: 250,
        totalMileage: 8,
        numberOfDrives: 1,
        clientConfigId: 'cater-valley'
      };

      const result = calculateDeliveryCost(input);
      expect(result.deliveryCost).toBe(42.50);
      expect(result.totalMileagePay).toBe(0); // Within 10 miles
      expect(result.deliveryFee).toBe(42.50);
    });

    it('should calculate $42.50 plus mileage over 10 miles (flat fee)', () => {
      const input: DeliveryCostInput = {
        headcount: 20,
        foodCost: 250,
        totalMileage: 12,
        numberOfDrives: 1,
        clientConfigId: 'cater-valley'
      };

      const result = calculateDeliveryCost(input);
      // CaterValley uses flat fee: regularRate = within10Miles = $42.50
      expect(result.deliveryCost).toBe(42.50);
      // Mileage: (12 - 10) × $3.00 = $6.00
      expect(result.totalMileagePay).toBe(6.00);
      expect(result.deliveryFee).toBe(48.50);
    });
  });

  describe('Tier 2: 26-49 headcount OR $300.01-599.99 food cost', () => {
    it('should calculate $52.50 within 10 miles', () => {
      const input: DeliveryCostInput = {
        headcount: 30,
        foodCost: 400,
        totalMileage: 8,
        numberOfDrives: 1,
        clientConfigId: 'cater-valley'
      };

      const result = calculateDeliveryCost(input);
      expect(result.deliveryCost).toBe(52.50);
      expect(result.deliveryFee).toBe(52.50);
    });

    it('should calculate $52.50 plus mileage over 10 miles (flat fee)', () => {
      const input: DeliveryCostInput = {
        headcount: 35,
        foodCost: 450,
        totalMileage: 15,
        numberOfDrives: 1,
        clientConfigId: 'cater-valley'
      };

      const result = calculateDeliveryCost(input);
      expect(result.deliveryCost).toBe(52.50);
      // Mileage: (15 - 10) × $3.00 = $15.00
      expect(result.totalMileagePay).toBe(15.00);
      expect(result.deliveryFee).toBe(67.50);
    });
  });

  describe('Tier 3: 50-74 headcount OR $600-899.99 food cost', () => {
    it('should calculate $62.50 within 10 miles', () => {
      const input: DeliveryCostInput = {
        headcount: 60,
        foodCost: 750,
        totalMileage: 9,
        numberOfDrives: 1,
        clientConfigId: 'cater-valley'
      };

      const result = calculateDeliveryCost(input);
      expect(result.deliveryCost).toBe(62.50);
      expect(result.deliveryFee).toBe(62.50);
    });

    it('should calculate $62.50 plus mileage over 10 miles (flat fee)', () => {
      const input: DeliveryCostInput = {
        headcount: 65,
        foodCost: 800,
        totalMileage: 14,
        numberOfDrives: 1,
        clientConfigId: 'cater-valley'
      };

      const result = calculateDeliveryCost(input);
      expect(result.deliveryCost).toBe(62.50);
      // Mileage: (14 - 10) × $3.00 = $12.00
      expect(result.totalMileagePay).toBe(12.00);
      expect(result.deliveryFee).toBe(74.50);
    });
  });

  describe('Tier 4: 75-99 headcount OR $900-1199.99 food cost', () => {
    it('should calculate $72.50 within 10 miles', () => {
      const input: DeliveryCostInput = {
        headcount: 80,
        foodCost: 1000,
        totalMileage: 7,
        numberOfDrives: 1,
        clientConfigId: 'cater-valley'
      };

      const result = calculateDeliveryCost(input);
      expect(result.deliveryCost).toBe(72.50);
      expect(result.deliveryFee).toBe(72.50);
    });

    it('should calculate $72.50 plus mileage over 10 miles (flat fee)', () => {
      const input: DeliveryCostInput = {
        headcount: 90,
        foodCost: 1100,
        totalMileage: 18,
        numberOfDrives: 1,
        clientConfigId: 'cater-valley'
      };

      const result = calculateDeliveryCost(input);
      expect(result.deliveryCost).toBe(72.50);
      // Mileage: (18 - 10) × $3.00 = $24.00
      expect(result.totalMileagePay).toBe(24.00);
      expect(result.deliveryFee).toBe(96.50);
    });
  });

  describe('Tier 5: 100+ headcount OR $1200+ food cost (percentage-based)', () => {
    it('should calculate 10% of food cost for large orders', () => {
      const input: DeliveryCostInput = {
        headcount: 120,
        foodCost: 1500,
        totalMileage: 8,
        numberOfDrives: 1,
        clientConfigId: 'cater-valley'
      };

      const result = calculateDeliveryCost(input);
      // 10% of $1500 = $150
      expect(result.deliveryCost).toBe(150.00);
      expect(result.deliveryFee).toBe(150.00);
    });

    it('should calculate 10% with mileage for large orders over 10 miles', () => {
      const input: DeliveryCostInput = {
        headcount: 150,
        foodCost: 2000,
        totalMileage: 20,
        numberOfDrives: 1,
        clientConfigId: 'cater-valley'
      };

      const result = calculateDeliveryCost(input);
      // 10% of $2000 = $200
      expect(result.deliveryCost).toBe(200.00);
      // Mileage: (20 - 10) × $3.00 = $30.00
      expect(result.totalMileagePay).toBe(30.00);
      expect(result.deliveryFee).toBe(230.00);
    });
  });

  describe('Bridge toll handling - CaterValley specific', () => {
    it('should NOT add bridge toll to customer delivery fee', () => {
      const input: DeliveryCostInput = {
        headcount: 40,
        foodCost: 500,
        totalMileage: 12,
        numberOfDrives: 1,
        requiresBridge: true,
        bridgeToll: 8,
        clientConfigId: 'cater-valley'
      };

      const result = calculateDeliveryCost(input);
      // CaterValley: bridge toll NOT added to customer fee
      // Tier 2 flat fee: $52.50
      expect(result.deliveryCost).toBe(52.50);
      expect(result.totalMileagePay).toBe(6.00); // (12 - 10) × $3.00
      // Bridge toll NOT included in deliveryFee for CaterValley
      expect(result.deliveryFee).toBe(58.50); // $52.50 + $6
    });
  });

  describe('Minimum delivery fee enforcement', () => {
    it('should enforce $42.50 minimum for very small orders', () => {
      const input: DeliveryCostInput = {
        headcount: 5,
        foodCost: 50,
        totalMileage: 3,
        numberOfDrives: 1,
        clientConfigId: 'cater-valley'
      };

      const result = calculateDeliveryCost(input);
      // Even for tiny orders, minimum fee is $42.50
      expect(result.deliveryFee).toBeGreaterThanOrEqual(42.50);
    });
  });
});

describe('CaterValley Calculator - Driver Compensation', () => {
  describe('Base pay calculation', () => {
    it('should calculate driver base pay based on headcount tier (25-49 = $23)', () => {
      const input: DriverPayInput = {
        headcount: 30,
        foodCost: 400,
        totalMileage: 8,
        numberOfDrives: 1,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        directTip: 0,
        clientConfigId: 'cater-valley'
      };

      const result = calculateDriverPay(input);
      // CaterValley tiered base pay: HC 25-49 = $23
      expect(result.driverTotalBasePay).toBe(23);
    });
  });

  describe('Mileage pay calculation', () => {
    it('should calculate flat $7 mileage within 10 miles', () => {
      const input: DriverPayInput = {
        headcount: 30,
        foodCost: 400,
        totalMileage: 10,
        numberOfDrives: 1,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        directTip: 0,
        clientConfigId: 'cater-valley'
      };

      const result = calculateDriverPay(input);
      // Within 10mi: flat $7
      expect(result.totalMileagePay).toBe(7.00);
    });
  });

  describe('Bonus calculation', () => {
    it('should include $10 bonus when qualified', () => {
      const input: DriverPayInput = {
        headcount: 30,
        foodCost: 400,
        totalMileage: 8,
        numberOfDrives: 1,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        directTip: 0,
        clientConfigId: 'cater-valley'
      };

      const result = calculateDriverPay(input);
      expect(result.driverBonusPay).toBe(10);
    });

    it('should exclude bonus when driver receives direct tip', () => {
      const input: DriverPayInput = {
        headcount: 30,
        foodCost: 400,
        totalMileage: 8,
        numberOfDrives: 1,
        bonusQualified: false,
        bonusQualifiedPercent: 0,
        directTip: 25,
        clientConfigId: 'cater-valley'
      };

      const result = calculateDriverPay(input);
      expect(result.driverBonusPay).toBe(0);
      expect(result.driverTotalBasePay).toBe(0); // No base pay with direct tip
      expect(result.directTip).toBe(25);
    });
  });

  describe('Bridge toll as driver compensation', () => {
    it('should include bridge toll in total driver pay', () => {
      const input: DriverPayInput = {
        headcount: 40,
        foodCost: 500,
        totalMileage: 12,
        numberOfDrives: 1,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        directTip: 0,
        requiresBridge: true,
        bridgeToll: 8,
        clientConfigId: 'cater-valley'
      };

      const result = calculateDriverPay(input);
      expect(result.bridgeToll).toBe(8);
      // HC 26-49 = $23 base + Mileage (12 × $0.70 = $8.40) + Bonus $10 + Toll $8 = $49.40
      expect(result.totalDriverPay).toBeCloseTo(49.40, 2);
    });
  });

  describe('Total driver pay calculation', () => {
    it('should calculate total driver pay correctly', () => {
      const input: DriverPayInput = {
        headcount: 50,
        foodCost: 700,
        totalMileage: 15,
        numberOfDrives: 1,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        directTip: 0,
        clientConfigId: 'cater-valley'
      };

      const result = calculateDriverPay(input);
      // HC 50-74 = $33 base + Mileage (15 × $0.70 = $10.50) + Bonus $10 = $53.50
      expect(result.totalDriverPay).toBeCloseTo(53.50, 2);
    });
  });
});
