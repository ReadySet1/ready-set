/**
 * Web Pricing Configurations Tests
 *
 * Tests for the pricing configurations and helper functions
 */

import {
  WEB_PRICING_TIERS,
  WEB_ADDON_FEATURES,
  getTierById,
  getAddOnById,
  getAddOnsByCategory,
  getTiersByCategory,
  isAddOnCompatibleWithTier,
  areAddOnsCompatible,
  getPopularAddOns,
  getAddOnCategoryDisplayName,
} from '../pricing-configurations';

describe('WEB_PRICING_TIERS', () => {
  it('should have 4 pricing tiers', () => {
    expect(WEB_PRICING_TIERS).toHaveLength(4);
  });

  it('should have 2 marketing tiers', () => {
    const marketingTiers = WEB_PRICING_TIERS.filter(
      (t) => t.category === 'marketing'
    );
    expect(marketingTiers).toHaveLength(2);
  });

  it('should have 2 ecommerce tiers', () => {
    const ecommerceTiers = WEB_PRICING_TIERS.filter(
      (t) => t.category === 'ecommerce'
    );
    expect(ecommerceTiers).toHaveLength(2);
  });

  it('should have valid pricing structure for all tiers', () => {
    for (const tier of WEB_PRICING_TIERS) {
      expect(tier.id).toBeDefined();
      expect(tier.name).toBeDefined();
      expect(tier.basePrice).toBeGreaterThan(0);
      expect(tier.monthlyFee).toBeGreaterThan(0);
      expect(tier.features.length).toBeGreaterThan(0);
    }
  });

  it('should have limited offer flag on marketing tiers', () => {
    const marketingTiers = WEB_PRICING_TIERS.filter(
      (t) => t.category === 'marketing'
    );
    for (const tier of marketingTiers) {
      expect(tier.limitedOffer).toBe(true);
    }
  });

  it('should have original price on discounted tiers', () => {
    const discountedTiers = WEB_PRICING_TIERS.filter((t) => t.originalPrice);
    expect(discountedTiers.length).toBeGreaterThan(0);
    for (const tier of discountedTiers) {
      expect(tier.originalPrice).toBeGreaterThan(tier.basePrice);
    }
  });
});

describe('WEB_ADDON_FEATURES', () => {
  it('should have add-ons defined', () => {
    expect(WEB_ADDON_FEATURES.length).toBeGreaterThan(0);
  });

  it('should have valid structure for all add-ons', () => {
    for (const addon of WEB_ADDON_FEATURES) {
      expect(addon.id).toBeDefined();
      expect(addon.name).toBeDefined();
      expect(addon.category).toBeDefined();
      expect(addon.description).toBeDefined();
      expect(typeof addon.oneTimePrice).toBe('number');
      expect(typeof addon.monthlyPrice).toBe('number');
    }
  });

  it('should have add-ons in each category', () => {
    const categories = ['design', 'development', 'integration', 'hosting', 'maintenance'];
    for (const category of categories) {
      const addons = WEB_ADDON_FEATURES.filter((a) => a.category === category);
      expect(addons.length).toBeGreaterThan(0);
    }
  });

  it('should have some popular add-ons', () => {
    const popularAddons = WEB_ADDON_FEATURES.filter((a) => a.isPopular);
    expect(popularAddons.length).toBeGreaterThan(0);
  });
});

describe('getTierById', () => {
  it('should return correct tier for valid ID', () => {
    const tier = getTierById('marketing-essential');
    expect(tier).toBeDefined();
    expect(tier?.name).toBe('Marketing Essential');
  });

  it('should return undefined for invalid ID', () => {
    const tier = getTierById('invalid-tier');
    expect(tier).toBeUndefined();
  });

  it('should return correct tier for each valid ID', () => {
    const ids = [
      'marketing-essential',
      'marketing-professional',
      'ecommerce-starter',
      'ecommerce-growth',
    ];
    for (const id of ids) {
      const tier = getTierById(id);
      expect(tier).toBeDefined();
      expect(tier?.id).toBe(id);
    }
  });
});

describe('getAddOnById', () => {
  it('should return correct add-on for valid ID', () => {
    const addon = getAddOnById('custom-design');
    expect(addon).toBeDefined();
    expect(addon?.name).toBe('Custom Design Package');
  });

  it('should return undefined for invalid ID', () => {
    const addon = getAddOnById('invalid-addon');
    expect(addon).toBeUndefined();
  });
});

describe('getAddOnsByCategory', () => {
  it('should return design add-ons', () => {
    const addons = getAddOnsByCategory('design');
    expect(addons.length).toBeGreaterThan(0);
    for (const addon of addons) {
      expect(addon.category).toBe('design');
    }
  });

  it('should return development add-ons', () => {
    const addons = getAddOnsByCategory('development');
    expect(addons.length).toBeGreaterThan(0);
    for (const addon of addons) {
      expect(addon.category).toBe('development');
    }
  });

  it('should return integration add-ons', () => {
    const addons = getAddOnsByCategory('integration');
    expect(addons.length).toBeGreaterThan(0);
    for (const addon of addons) {
      expect(addon.category).toBe('integration');
    }
  });

  it('should return hosting add-ons', () => {
    const addons = getAddOnsByCategory('hosting');
    expect(addons.length).toBeGreaterThan(0);
    for (const addon of addons) {
      expect(addon.category).toBe('hosting');
    }
  });

  it('should return maintenance add-ons', () => {
    const addons = getAddOnsByCategory('maintenance');
    expect(addons.length).toBeGreaterThan(0);
    for (const addon of addons) {
      expect(addon.category).toBe('maintenance');
    }
  });
});

describe('getTiersByCategory', () => {
  it('should return marketing tiers', () => {
    const tiers = getTiersByCategory('marketing');
    expect(tiers).toHaveLength(2);
    for (const tier of tiers) {
      expect(tier.category).toBe('marketing');
    }
  });

  it('should return ecommerce tiers', () => {
    const tiers = getTiersByCategory('ecommerce');
    expect(tiers).toHaveLength(2);
    for (const tier of tiers) {
      expect(tier.category).toBe('ecommerce');
    }
  });
});

describe('isAddOnCompatibleWithTier', () => {
  it('should return true for universal add-ons with any tier', () => {
    // custom-design has no requiredTiers, so it's universal
    expect(isAddOnCompatibleWithTier('custom-design', 'marketing-essential')).toBe(true);
    expect(isAddOnCompatibleWithTier('custom-design', 'ecommerce-growth')).toBe(true);
  });

  it('should return true for e-commerce-only add-ons with e-commerce tiers', () => {
    // erp-integration requires e-commerce tiers
    expect(isAddOnCompatibleWithTier('erp-integration', 'ecommerce-starter')).toBe(true);
    expect(isAddOnCompatibleWithTier('erp-integration', 'ecommerce-growth')).toBe(true);
  });

  it('should return false for e-commerce-only add-ons with marketing tiers', () => {
    expect(isAddOnCompatibleWithTier('erp-integration', 'marketing-essential')).toBe(false);
    expect(isAddOnCompatibleWithTier('erp-integration', 'marketing-professional')).toBe(false);
  });

  it('should return false for invalid add-on ID', () => {
    expect(isAddOnCompatibleWithTier('invalid-addon', 'marketing-essential')).toBe(false);
  });
});

describe('areAddOnsCompatible', () => {
  it('should return true for compatible add-ons', () => {
    expect(areAddOnsCompatible('custom-design', 'premium-hosting')).toBe(true);
    expect(areAddOnsCompatible('member-portal', 'priority-support')).toBe(true);
  });

  it('should return false for incompatible add-ons', () => {
    // logo-design and brand-kit are incompatible
    expect(areAddOnsCompatible('logo-design', 'brand-kit')).toBe(false);
    expect(areAddOnsCompatible('brand-kit', 'logo-design')).toBe(false);
  });

  it('should return false for invalid add-on IDs', () => {
    expect(areAddOnsCompatible('invalid-addon', 'custom-design')).toBe(false);
    expect(areAddOnsCompatible('custom-design', 'invalid-addon')).toBe(false);
  });
});

describe('getPopularAddOns', () => {
  it('should return only popular add-ons', () => {
    const popularAddons = getPopularAddOns();
    expect(popularAddons.length).toBeGreaterThan(0);
    for (const addon of popularAddons) {
      expect(addon.isPopular).toBe(true);
    }
  });
});

describe('getAddOnCategoryDisplayName', () => {
  it('should return correct display names', () => {
    expect(getAddOnCategoryDisplayName('design')).toBe('Design');
    expect(getAddOnCategoryDisplayName('development')).toBe('Development');
    expect(getAddOnCategoryDisplayName('integration')).toBe('Integrations');
    expect(getAddOnCategoryDisplayName('hosting')).toBe('Hosting & Infrastructure');
    expect(getAddOnCategoryDisplayName('maintenance')).toBe('Maintenance & Support');
  });
});
