/**
 * Web Pricing Calculator Tests
 */

import {
  calculateWebPricing,
  validateWebPricingInput,
  formatCurrency,
  formatMonthly,
} from '../pricing-calculator';
import type { WebPricingInput, WebPricingBreakdown } from '@/types/web-pricing';

describe('calculateWebPricing', () => {
  describe('basic package pricing', () => {
    it('should calculate pricing for Marketing Essential package only', () => {
      const input: WebPricingInput = {
        selectedTierId: 'marketing-essential',
        selectedAddOnIds: [],
      };

      const result = calculateWebPricing(input);

      expect(result.packageName).toBe('Marketing Essential');
      expect(result.packageCategory).toBe('marketing');
      expect(result.oneTimeCost).toBe(2500);
      expect(result.monthlyCost).toBe(75);
      expect(result.yearOneTotalCost).toBe(2500 + 75 * 12); // 3400
      expect(result.addOnCount).toBe(0);
      expect(result.lineItems).toHaveLength(1);
    });

    it('should calculate pricing for Marketing Professional package only', () => {
      const input: WebPricingInput = {
        selectedTierId: 'marketing-professional',
        selectedAddOnIds: [],
      };

      const result = calculateWebPricing(input);

      expect(result.packageName).toBe('Marketing Professional');
      expect(result.oneTimeCost).toBe(5000);
      expect(result.monthlyCost).toBe(125);
      expect(result.yearOneTotalCost).toBe(5000 + 125 * 12); // 6500
    });

    it('should calculate pricing for E-commerce Starter package only', () => {
      const input: WebPricingInput = {
        selectedTierId: 'ecommerce-starter',
        selectedAddOnIds: [],
      };

      const result = calculateWebPricing(input);

      expect(result.packageName).toBe('E-commerce Starter');
      expect(result.packageCategory).toBe('ecommerce');
      expect(result.oneTimeCost).toBe(7500);
      expect(result.monthlyCost).toBe(175);
      expect(result.yearOneTotalCost).toBe(7500 + 175 * 12); // 9600
    });

    it('should calculate pricing for E-commerce Growth package only', () => {
      const input: WebPricingInput = {
        selectedTierId: 'ecommerce-growth',
        selectedAddOnIds: [],
      };

      const result = calculateWebPricing(input);

      expect(result.packageName).toBe('E-commerce Growth');
      expect(result.oneTimeCost).toBe(15000);
      expect(result.monthlyCost).toBe(350);
      expect(result.yearOneTotalCost).toBe(15000 + 350 * 12); // 19200
    });
  });

  describe('add-on pricing', () => {
    it('should add one-time add-on cost correctly', () => {
      const input: WebPricingInput = {
        selectedTierId: 'marketing-essential',
        selectedAddOnIds: ['logo-design'], // $800 one-time
      };

      const result = calculateWebPricing(input);

      expect(result.oneTimeCost).toBe(2500 + 800); // 3300
      expect(result.monthlyCost).toBe(75); // unchanged
      expect(result.addOnCount).toBe(1);
      expect(result.lineItems).toHaveLength(2);
    });

    it('should add monthly add-on cost correctly', () => {
      const input: WebPricingInput = {
        selectedTierId: 'marketing-professional',
        selectedAddOnIds: ['priority-support'], // $150/mo
      };

      const result = calculateWebPricing(input);

      expect(result.oneTimeCost).toBe(5000);
      expect(result.monthlyCost).toBe(125 + 150); // 275
      expect(result.yearOneTotalCost).toBe(5000 + 275 * 12); // 8300
    });

    it('should handle add-on with both one-time and monthly costs', () => {
      const input: WebPricingInput = {
        selectedTierId: 'marketing-professional',
        selectedAddOnIds: ['member-portal'], // $2500 one-time + $50/mo
      };

      const result = calculateWebPricing(input);

      expect(result.oneTimeCost).toBe(5000 + 2500); // 7500
      expect(result.monthlyCost).toBe(125 + 50); // 175
      expect(result.yearOneTotalCost).toBe(7500 + 175 * 12); // 9600
    });

    it('should calculate multiple add-ons correctly', () => {
      const input: WebPricingInput = {
        selectedTierId: 'ecommerce-growth',
        selectedAddOnIds: [
          'custom-design', // $1500 one-time
          'premium-hosting', // $75/mo
          'priority-support', // $150/mo
        ],
      };

      const result = calculateWebPricing(input);

      expect(result.oneTimeCost).toBe(15000 + 1500); // 16500
      expect(result.monthlyCost).toBe(350 + 75 + 150); // 575
      expect(result.yearOneTotalCost).toBe(16500 + 575 * 12); // 23400
      expect(result.addOnCount).toBe(3);
      expect(result.lineItems).toHaveLength(4); // package + 3 add-ons
    });
  });

  describe('tier-specific add-ons', () => {
    it('should skip add-ons not compatible with selected tier', () => {
      const input: WebPricingInput = {
        selectedTierId: 'marketing-essential',
        selectedAddOnIds: ['erp-integration'], // Only for e-commerce tiers
      };

      const result = calculateWebPricing(input);

      // ERP integration should be skipped
      expect(result.oneTimeCost).toBe(2500); // only package cost
      expect(result.addOnCount).toBe(0);
    });

    it('should include e-commerce-only add-ons for e-commerce tiers', () => {
      const input: WebPricingInput = {
        selectedTierId: 'ecommerce-starter',
        selectedAddOnIds: ['payment-gateways'], // $500 + $15/mo
      };

      const result = calculateWebPricing(input);

      expect(result.oneTimeCost).toBe(7500 + 500); // 8000
      expect(result.monthlyCost).toBe(175 + 15); // 190
      expect(result.addOnCount).toBe(1);
    });
  });

  describe('incompatible add-ons', () => {
    it('should skip incompatible add-ons when both are selected', () => {
      const input: WebPricingInput = {
        selectedTierId: 'marketing-professional',
        selectedAddOnIds: [
          'logo-design', // $800 one-time
          'brand-kit', // $2000 one-time (incompatible with logo-design)
        ],
      };

      const result = calculateWebPricing(input);

      // First one (logo-design) should be included, second one (brand-kit) should be skipped
      expect(result.oneTimeCost).toBe(5000 + 800); // 5800 (only logo-design)
      expect(result.addOnCount).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should throw error for invalid tier ID', () => {
      const input: WebPricingInput = {
        selectedTierId: 'invalid-tier',
        selectedAddOnIds: [],
      };

      expect(() => calculateWebPricing(input)).toThrow('Invalid tier ID');
    });

    it('should handle invalid add-on IDs gracefully', () => {
      const input: WebPricingInput = {
        selectedTierId: 'marketing-essential',
        selectedAddOnIds: ['invalid-addon'],
      };

      const result = calculateWebPricing(input);

      // Should just skip the invalid add-on
      expect(result.oneTimeCost).toBe(2500);
      expect(result.addOnCount).toBe(0);
    });

    it('should include calculatedAt timestamp', () => {
      const input: WebPricingInput = {
        selectedTierId: 'marketing-essential',
        selectedAddOnIds: [],
      };

      const before = new Date();
      const result = calculateWebPricing(input);
      const after = new Date();

      expect(result.calculatedAt).toBeInstanceOf(Date);
      expect(result.calculatedAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime()
      );
      expect(result.calculatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });
});

describe('validateWebPricingInput', () => {
  it('should return empty array for valid input', () => {
    const input: WebPricingInput = {
      selectedTierId: 'marketing-essential',
      selectedAddOnIds: ['logo-design'],
    };

    const errors = validateWebPricingInput(input);

    expect(errors).toHaveLength(0);
  });

  it('should return error for invalid tier', () => {
    const input: WebPricingInput = {
      selectedTierId: 'invalid-tier',
      selectedAddOnIds: [],
    };

    const errors = validateWebPricingInput(input);

    expect(errors).toContain('Invalid package tier: invalid-tier');
  });

  it('should return error for invalid add-on', () => {
    const input: WebPricingInput = {
      selectedTierId: 'marketing-essential',
      selectedAddOnIds: ['invalid-addon'],
    };

    const errors = validateWebPricingInput(input);

    expect(errors).toContain('Invalid add-on: invalid-addon');
  });

  it('should return error for tier-incompatible add-on', () => {
    const input: WebPricingInput = {
      selectedTierId: 'marketing-essential',
      selectedAddOnIds: ['erp-integration'],
    };

    const errors = validateWebPricingInput(input);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('only available for specific packages');
  });

  it('should return error for mutually incompatible add-ons', () => {
    const input: WebPricingInput = {
      selectedTierId: 'marketing-professional',
      selectedAddOnIds: ['logo-design', 'brand-kit'],
    };

    const errors = validateWebPricingInput(input);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes('cannot be combined'))).toBe(true);
  });
});

describe('formatting helpers', () => {
  describe('formatCurrency', () => {
    it('should format whole dollar amounts', () => {
      expect(formatCurrency(2500)).toBe('$2,500');
      expect(formatCurrency(15000)).toBe('$15,000');
      expect(formatCurrency(0)).toBe('$0');
    });

    it('should round decimal amounts', () => {
      expect(formatCurrency(2500.5)).toBe('$2,501');
      expect(formatCurrency(2500.4)).toBe('$2,500');
    });
  });

  describe('formatMonthly', () => {
    it('should format monthly amounts with suffix', () => {
      expect(formatMonthly(75)).toBe('$75/mo');
      expect(formatMonthly(350)).toBe('$350/mo');
    });

    it('should handle zero', () => {
      expect(formatMonthly(0)).toBe('$0');
    });
  });
});

describe('year one total calculation', () => {
  it('should correctly calculate complex year one total', () => {
    // Marketing Professional ($5000 + $125/mo)
    // + Custom Design ($1500)
    // + Member Portal ($2500 + $50/mo)
    // + Priority Support ($150/mo)
    const input: WebPricingInput = {
      selectedTierId: 'marketing-professional',
      selectedAddOnIds: ['custom-design', 'member-portal', 'priority-support'],
    };

    const result = calculateWebPricing(input);

    const expectedOneTime = 5000 + 1500 + 2500; // 9000
    const expectedMonthly = 125 + 50 + 150; // 325
    const expectedYearOne = expectedOneTime + expectedMonthly * 12; // 9000 + 3900 = 12900

    expect(result.oneTimeCost).toBe(expectedOneTime);
    expect(result.monthlyCost).toBe(expectedMonthly);
    expect(result.yearOneTotalCost).toBe(expectedYearOne);
  });
});
