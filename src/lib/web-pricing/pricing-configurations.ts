/**
 * Web Development Pricing Configurations
 * Package tiers and add-on features for web development services
 */

import type {
  WebsitePricingTier,
  AddOnFeature,
  AddOnCategory,
} from '@/types/web-pricing';

// ============================================================================
// PACKAGE TIERS
// ============================================================================

export const WEB_PRICING_TIERS: WebsitePricingTier[] = [
  // Marketing Sites
  {
    id: 'marketing-essential',
    name: 'Marketing Essential',
    category: 'marketing',
    description: 'Perfect for small businesses getting started online',
    basePrice: 2500,
    originalPrice: 3125, // 20% off
    monthlyFee: 75,
    pageCount: 5,
    targetAudience: 'Small businesses, startups, local services',
    limitedOffer: true,
    features: [
      'Responsive design (mobile, tablet, desktop)',
      'Up to 5 custom pages',
      'Contact form with email notifications',
      'Basic SEO setup',
      'Google Analytics integration',
      'Social media links',
      'SSL certificate included',
      '1 month post-launch support',
    ],
  },
  {
    id: 'marketing-professional',
    name: 'Marketing Professional',
    category: 'marketing',
    description: 'Full-featured marketing site with CMS and blog',
    basePrice: 5000,
    originalPrice: 6250, // 20% off
    monthlyFee: 125,
    pageCount: 15,
    targetAudience: 'Growing businesses, agencies, professional services',
    popular: true,
    limitedOffer: true,
    features: [
      'Everything in Essential, plus:',
      'Up to 15 custom pages',
      'Content Management System (CMS)',
      'Blog with categories and tags',
      'Newsletter signup integration',
      'Advanced SEO with meta management',
      'Custom animations and transitions',
      'Lead capture forms',
      'Live chat integration ready',
      '3 months post-launch support',
    ],
  },

  // E-commerce Sites
  {
    id: 'ecommerce-starter',
    name: 'E-commerce Starter',
    category: 'ecommerce',
    description: 'Launch your online store with essential features',
    basePrice: 7500,
    monthlyFee: 175,
    pageCount: 10,
    productLimit: 50,
    targetAudience: 'Small retail businesses, artisans, boutiques',
    features: [
      'Responsive storefront design',
      'Up to 50 products',
      'Shopping cart and checkout',
      'Secure payment processing (Stripe)',
      'Order management dashboard',
      'Inventory tracking',
      'Email notifications (orders, shipping)',
      'Basic shipping configuration',
      'Customer accounts',
      '2 months post-launch support',
    ],
  },
  {
    id: 'ecommerce-growth',
    name: 'E-commerce Growth',
    category: 'ecommerce',
    description: 'Scale your online business with advanced features',
    basePrice: 15000,
    monthlyFee: 350,
    pageCount: 'unlimited',
    productLimit: 'unlimited',
    targetAudience: 'Established retailers, brands, high-volume sellers',
    popular: true,
    features: [
      'Everything in Starter, plus:',
      'Unlimited products',
      'Advanced product variants',
      'Multi-currency support',
      'Discount codes and promotions',
      'Abandoned cart recovery',
      'Customer reviews and ratings',
      'Wishlist functionality',
      'Advanced analytics dashboard',
      'Inventory alerts',
      'Multiple shipping carriers',
      'Tax calculation automation',
      '6 months post-launch support',
    ],
  },
];

// ============================================================================
// ADD-ON FEATURES
// ============================================================================

export const WEB_ADDON_FEATURES: AddOnFeature[] = [
  // Design Add-ons
  {
    id: 'custom-design',
    name: 'Custom Design Package',
    category: 'design',
    description: 'Fully custom design with multiple revision rounds',
    oneTimePrice: 1500,
    monthlyPrice: 0,
    isPopular: true,
  },
  {
    id: 'additional-pages',
    name: 'Additional Pages (5)',
    category: 'design',
    description: 'Add 5 more custom-designed pages to your site',
    oneTimePrice: 750,
    monthlyPrice: 0,
  },
  {
    id: 'logo-design',
    name: 'Logo Design',
    category: 'design',
    description: 'Professional logo design with brand guidelines',
    oneTimePrice: 800,
    monthlyPrice: 0,
  },
  {
    id: 'brand-kit',
    name: 'Complete Brand Kit',
    category: 'design',
    description: 'Logo, color palette, typography, and brand guidelines',
    oneTimePrice: 2000,
    monthlyPrice: 0,
    incompatibleWith: ['logo-design'],
  },

  // Development Add-ons
  {
    id: 'member-portal',
    name: 'Member Portal',
    category: 'development',
    description: 'Password-protected member area with user accounts',
    oneTimePrice: 2500,
    monthlyPrice: 50,
    isPopular: true,
  },
  {
    id: 'booking-system',
    name: 'Booking/Appointment System',
    category: 'development',
    description: 'Online scheduling with calendar integration',
    oneTimePrice: 1800,
    monthlyPrice: 35,
  },
  {
    id: 'custom-forms',
    name: 'Advanced Custom Forms',
    category: 'development',
    description: 'Multi-step forms with conditional logic and file uploads',
    oneTimePrice: 900,
    monthlyPrice: 0,
  },
  {
    id: 'multilingual',
    name: 'Multi-Language Support',
    category: 'development',
    description: 'Support for multiple languages with easy translation management',
    oneTimePrice: 1200,
    monthlyPrice: 25,
  },
  {
    id: 'search-functionality',
    name: 'Advanced Search',
    category: 'development',
    description: 'Full-text search with filters and autocomplete',
    oneTimePrice: 600,
    monthlyPrice: 0,
  },

  // Integration Add-ons
  {
    id: 'crm-integration',
    name: 'CRM Integration',
    category: 'integration',
    description: 'Connect with Salesforce, HubSpot, or other CRM platforms',
    oneTimePrice: 1500,
    monthlyPrice: 45,
    isPopular: true,
  },
  {
    id: 'erp-integration',
    name: 'ERP Integration',
    category: 'integration',
    description: 'Connect with your enterprise resource planning system',
    oneTimePrice: 3000,
    monthlyPrice: 75,
    requiredTiers: ['ecommerce-starter', 'ecommerce-growth'],
  },
  {
    id: 'custom-api',
    name: 'Custom API Development',
    category: 'integration',
    description: 'Build custom APIs for third-party integrations',
    oneTimePrice: 2500,
    monthlyPrice: 0,
  },
  {
    id: 'payment-gateways',
    name: 'Additional Payment Gateways',
    category: 'integration',
    description: 'Add PayPal, Apple Pay, Google Pay, or other processors',
    oneTimePrice: 500,
    monthlyPrice: 15,
    requiredTiers: ['ecommerce-starter', 'ecommerce-growth'],
  },
  {
    id: 'email-marketing',
    name: 'Email Marketing Integration',
    category: 'integration',
    description: 'Connect with Mailchimp, Klaviyo, or similar platforms',
    oneTimePrice: 400,
    monthlyPrice: 0,
  },

  // Hosting Add-ons
  {
    id: 'premium-hosting',
    name: 'Premium Hosting',
    category: 'hosting',
    description: 'High-performance hosting with dedicated resources',
    oneTimePrice: 0,
    monthlyPrice: 75,
    isPopular: true,
  },
  {
    id: 'cdn-global',
    name: 'Global CDN',
    category: 'hosting',
    description: 'Content delivery network for fast global page loads',
    oneTimePrice: 0,
    monthlyPrice: 35,
  },
  {
    id: 'ssl-extended',
    name: 'Extended Validation SSL',
    category: 'hosting',
    description: 'EV SSL certificate with organization validation',
    oneTimePrice: 200,
    monthlyPrice: 0,
  },
  {
    id: 'daily-backups',
    name: 'Daily Backups & Disaster Recovery',
    category: 'hosting',
    description: '30-day backup retention with quick restore capability',
    oneTimePrice: 0,
    monthlyPrice: 25,
  },

  // Maintenance Add-ons
  {
    id: 'priority-support',
    name: 'Priority Support',
    category: 'maintenance',
    description: '4-hour response time with dedicated support channel',
    oneTimePrice: 0,
    monthlyPrice: 150,
    isPopular: true,
  },
  {
    id: 'content-updates',
    name: 'Monthly Content Updates',
    category: 'maintenance',
    description: 'Up to 4 hours of content updates per month',
    oneTimePrice: 0,
    monthlyPrice: 200,
  },
  {
    id: 'security-monitoring',
    name: 'Security Monitoring & Patching',
    category: 'maintenance',
    description: '24/7 security monitoring with automatic updates',
    oneTimePrice: 0,
    monthlyPrice: 100,
  },
  {
    id: 'performance-monitoring',
    name: 'Performance Monitoring',
    category: 'maintenance',
    description: 'Uptime monitoring with performance optimization',
    oneTimePrice: 0,
    monthlyPrice: 75,
  },
  {
    id: 'seo-maintenance',
    name: 'SEO Maintenance Package',
    category: 'maintenance',
    description: 'Monthly SEO audits and optimization recommendations',
    oneTimePrice: 0,
    monthlyPrice: 250,
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get a pricing tier by ID
 */
export function getTierById(tierId: string): WebsitePricingTier | undefined {
  return WEB_PRICING_TIERS.find((tier) => tier.id === tierId);
}

/**
 * Get an add-on feature by ID
 */
export function getAddOnById(addOnId: string): AddOnFeature | undefined {
  return WEB_ADDON_FEATURES.find((addon) => addon.id === addOnId);
}

/**
 * Get all add-ons by category
 */
export function getAddOnsByCategory(category: AddOnCategory): AddOnFeature[] {
  return WEB_ADDON_FEATURES.filter((addon) => addon.category === category);
}

/**
 * Get all tiers by category
 */
export function getTiersByCategory(
  category: 'marketing' | 'ecommerce'
): WebsitePricingTier[] {
  return WEB_PRICING_TIERS.filter((tier) => tier.category === category);
}

/**
 * Check if an add-on is compatible with a tier
 */
export function isAddOnCompatibleWithTier(
  addOnId: string,
  tierId: string
): boolean {
  const addon = getAddOnById(addOnId);
  if (!addon) return false;

  if (!addon.requiredTiers || addon.requiredTiers.length === 0) {
    return true;
  }

  return addon.requiredTiers.includes(tierId);
}

/**
 * Check if two add-ons are compatible with each other
 */
export function areAddOnsCompatible(
  addOnId1: string,
  addOnId2: string
): boolean {
  const addon1 = getAddOnById(addOnId1);
  const addon2 = getAddOnById(addOnId2);

  if (!addon1 || !addon2) return false;

  if (addon1.incompatibleWith?.includes(addOnId2)) return false;
  if (addon2.incompatibleWith?.includes(addOnId1)) return false;

  return true;
}

/**
 * Get popular add-ons
 */
export function getPopularAddOns(): AddOnFeature[] {
  return WEB_ADDON_FEATURES.filter((addon) => addon.isPopular);
}

/**
 * Get add-on category display name
 */
export function getAddOnCategoryDisplayName(category: AddOnCategory): string {
  const names: Record<AddOnCategory, string> = {
    design: 'Design',
    development: 'Development',
    integration: 'Integrations',
    hosting: 'Hosting & Infrastructure',
    maintenance: 'Maintenance & Support',
  };
  return names[category];
}

// ============================================================================
// EXPORTS
// ============================================================================

const webPricingConfigurations = {
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
};

export default webPricingConfigurations;
