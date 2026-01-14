/**
 * CaterValley Calculator Tests
 *
 * Tests specific to CaterValley vendor configuration:
 * - Minimum delivery fee: $42.50
 * - Bridge toll: Driver compensation paid by Ready Set (NOT charged to customer)
 * - Percentage-based pricing for 100+ headcount (10% of food cost)
 * - Customer mileage rate: $3.00/mile after 10 miles
 * - Driver mileage rate: $0.70/mile for ALL miles
 * - Driver base pay: $18.00 flat
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

    it('should calculate $85.00 over 10 miles', () => {
      const input: DeliveryCostInput = {
        headcount: 20,
        foodCost: 250,
        totalMileage: 12,
        numberOfDrives: 1,
        clientConfigId: 'cater-valley'
      };

      const result = calculateDeliveryCost(input);
      expect(result.deliveryCost).toBe(85.00);
      // Mileage: (12 - 10) × $3.00 = $6.00
      expect(result.totalMileagePay).toBe(6.00);
      expect(result.deliveryFee).toBe(91.00);
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

    it('should calculate $90.00 over 10 miles', () => {
      const input: DeliveryCostInput = {
        headcount: 35,
        foodCost: 450,
        totalMileage: 15,
        numberOfDrives: 1,
        clientConfigId: 'cater-valley'
      };

      const result = calculateDeliveryCost(input);
      expect(result.deliveryCost).toBe(90.00);
      // Mileage: (15 - 10) × $3.00 = $15.00
      expect(result.totalMileagePay).toBe(15.00);
      expect(result.deliveryFee).toBe(105.00);
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

    it('should calculate $110.00 over 10 miles', () => {
      const input: DeliveryCostInput = {
        headcount: 65,
        foodCost: 800,
        totalMileage: 14,
        numberOfDrives: 1,
        clientConfigId: 'cater-valley'
      };

      const result = calculateDeliveryCost(input);
      expect(result.deliveryCost).toBe(110.00);
      // Mileage: (14 - 10) × $3.00 = $12.00
      expect(result.totalMileagePay).toBe(12.00);
      expect(result.deliveryFee).toBe(122.00);
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

    it('should calculate $120.00 over 10 miles', () => {
      const input: DeliveryCostInput = {
        headcount: 90,
        foodCost: 1100,
        totalMileage: 18,
        numberOfDrives: 1,
        clientConfigId: 'cater-valley'
      };

      const result = calculateDeliveryCost(input);
      expect(result.deliveryCost).toBe(120.00);
      // Mileage: (18 - 10) × $3.00 = $24.00
      expect(result.totalMileagePay).toBe(24.00);
      expect(result.deliveryFee).toBe(144.00);
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
      // Bridge toll should NOT be added to customer fee for CaterValley
      // Base $90 + Mileage $6 = $96 (no bridge toll)
      expect(result.deliveryCost).toBe(90.00);
      expect(result.totalMileagePay).toBe(6.00);
      // Bridge toll NOT included in deliveryFee for CaterValley
      expect(result.deliveryFee).toBe(96.00);
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
    it('should calculate driver base pay based on headcount tier', () => {
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
      // CaterValley driver base pay: $18 flat
      expect(result.driverTotalBasePay).toBe(18);
    });
  });

  describe('Mileage pay calculation', () => {
    it('should calculate mileage at $0.70/mile for all miles', () => {
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
      // 10 miles × $0.70 = $7.00
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
    it('should track bridge toll separately for CaterValley', () => {
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
      // Bridge toll tracked separately for CaterValley (paid by Ready Set)
      expect(result.bridgeToll).toBe(8);
      // Base $18 + Mileage (12 × $0.70 = $8.40) + Bonus $10 = $36.40
      // Bridge toll is separate reimbursement, not in totalDriverPay
      expect(result.totalDriverPay).toBeCloseTo(36.40, 2);
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
      // Base $18 + Mileage (15 × $0.70 = $10.50) + Bonus $10 = $38.50
      const expectedTotal = 18 + 10.50 + 10;
      expect(result.totalDriverPay).toBeCloseTo(expectedTotal, 2);
    });
  });
});
