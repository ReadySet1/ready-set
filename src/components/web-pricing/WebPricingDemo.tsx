/**
 * WebPricingDemo - Interactive web development pricing tool
 * Public demo component for sales conversations
 *
 * Design: Clean editorial aesthetic with premium feel
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Globe,
  ShoppingCart,
  Check,
  DollarSign,
  Calendar,
  ArrowRight,
  Phone,
  Info,
  Palette,
  Code,
  Plug,
  Server,
  Wrench,
  Zap,
  TrendingUp,
  ChevronRight,
} from 'lucide-react';

import type {
  WebsitePricingTier,
  AddOnFeature,
  WebPricingBreakdown,
  AddOnCategory,
} from '@/types/web-pricing';

import {
  WEB_PRICING_TIERS,
  WEB_ADDON_FEATURES,
  getAddOnsByCategory,
  getAddOnCategoryDisplayName,
  isAddOnCompatibleWithTier,
  areAddOnsCompatible,
} from '@/lib/web-pricing/pricing-configurations';

import {
  calculateWebPricing,
  formatCurrency,
  formatMonthly,
} from '@/lib/web-pricing/pricing-calculator';

import ScheduleDialog from '@/components/Logistics/Schedule';

// ============================================================================
// CONSTANTS
// ============================================================================

const ADD_ON_CATEGORIES: AddOnCategory[] = [
  'design',
  'development',
  'integration',
  'hosting',
  'maintenance',
];

const CATEGORY_ICONS: Record<AddOnCategory, React.ReactNode> = {
  design: <Palette className="h-4 w-4" />,
  development: <Code className="h-4 w-4" />,
  integration: <Plug className="h-4 w-4" />,
  hosting: <Server className="h-4 w-4" />,
  maintenance: <Wrench className="h-4 w-4" />,
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  }),
};

// ============================================================================
// PACKAGE CARD COMPONENT
// ============================================================================

interface PackageCardProps {
  tier: WebsitePricingTier;
  isSelected: boolean;
  onSelect: () => void;
  index: number;
}

function PackageCard({ tier, isSelected, onSelect, index }: PackageCardProps) {
  const isEcommerce = tier.category === 'ecommerce';
  const hasDiscount = tier.originalPrice && tier.originalPrice > tier.basePrice;
  const savingsAmount = hasDiscount ? tier.originalPrice! - tier.basePrice : 0;

  return (
    <motion.div
      custom={index}
      initial="hidden"
      animate="visible"
      variants={cardVariants}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className="h-full"
    >
      <div
        onClick={onSelect}
        className={`
          relative cursor-pointer rounded-2xl p-6 h-full flex flex-col
          transition-all duration-300 ease-out
          ${isSelected
            ? 'bg-gradient-to-br from-emerald-50 to-teal-50 ring-2 ring-emerald-500 shadow-xl shadow-emerald-500/10'
            : 'bg-white hover:shadow-xl hover:shadow-slate-200/50 border border-slate-200/80'
          }
        `}
      >
        {/* Status Badges - Inside card, top right */}
        <div className="absolute top-4 right-4 flex flex-col gap-1.5 items-end">
          {tier.limitedOffer && hasDiscount && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm">
              <Zap className="h-3 w-3" />
              Save {formatCurrency(savingsAmount)}
            </span>
          )}
          {tier.popular && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-600 text-white shadow-sm">
              <TrendingUp className="h-3 w-3" />
              Most Popular
            </span>
          )}
        </div>

        {/* Category Icon & Label */}
        <div className="flex items-center gap-2 mb-4">
          <div className={`
            p-2 rounded-lg
            ${isEcommerce
              ? 'bg-violet-100 text-violet-600'
              : 'bg-sky-100 text-sky-600'
            }
          `}>
            {isEcommerce ? <ShoppingCart className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
          </div>
          <span className={`
            text-xs font-semibold uppercase tracking-wider
            ${isEcommerce ? 'text-violet-600' : 'text-sky-600'}
          `}>
            {isEcommerce ? 'E-commerce' : 'Marketing'}
          </span>
        </div>

        {/* Title & Description */}
        <h3 className="text-xl font-bold text-slate-900 mb-1">
          {tier.name}
        </h3>
        <p className="text-sm text-slate-500 mb-5 pr-16">
          {tier.description}
        </p>

        {/* Pricing */}
        <div className="mb-5">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-4xl font-extrabold text-slate-900 tracking-tight">
              {formatCurrency(tier.basePrice)}
            </span>
            {hasDiscount && (
              <span className="text-lg text-slate-400 line-through font-medium">
                {formatCurrency(tier.originalPrice!)}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500">
            + {formatMonthly(tier.monthlyFee)} monthly
          </p>
        </div>

        {/* Specs */}
        <div className="flex gap-4 mb-5 pb-5 border-b border-slate-100">
          <div className="text-center">
            <div className="text-2xl font-bold text-slate-800">
              {tier.pageCount === 'unlimited' ? '∞' : tier.pageCount}
            </div>
            <div className="text-xs text-slate-500 uppercase tracking-wide">Pages</div>
          </div>
          {tier.productLimit && (
            <div className="text-center pl-4 border-l border-slate-100">
              <div className="text-2xl font-bold text-slate-800">
                {tier.productLimit === 'unlimited' ? '∞' : tier.productLimit}
              </div>
              <div className="text-xs text-slate-500 uppercase tracking-wide">Products</div>
            </div>
          )}
        </div>

        {/* Features */}
        <ul className="space-y-2.5 mb-6 flex-grow">
          {tier.features.slice(0, 5).map((feature, idx) => (
            <li key={idx} className="flex items-start gap-2.5 text-sm">
              <Check className={`h-4 w-4 mt-0.5 flex-shrink-0 ${isSelected ? 'text-emerald-600' : 'text-emerald-500'}`} />
              <span className="text-slate-600">{feature}</span>
            </li>
          ))}
          {tier.features.length > 5 && (
            <li className="flex items-center gap-2 text-sm text-slate-400 pl-6">
              <ChevronRight className="h-3 w-3" />
              {tier.features.length - 5} more included
            </li>
          )}
        </ul>

        {/* Select Button */}
        <button
          className={`
            w-full py-3 px-4 rounded-xl font-semibold text-sm
            transition-all duration-200
            ${isSelected
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }
          `}
        >
          {isSelected ? (
            <span className="flex items-center justify-center gap-2">
              <Check className="h-4 w-4" />
              Selected
            </span>
          ) : (
            'Select Package'
          )}
        </button>
      </div>
    </motion.div>
  );
}

// ============================================================================
// PACKAGE SELECTOR COMPONENT
// ============================================================================

interface PackageSelectorProps {
  selectedTierId: string | null;
  onSelect: (tierId: string) => void;
}

function PackageSelector({ selectedTierId, onSelect }: PackageSelectorProps) {
  const marketingTiers = WEB_PRICING_TIERS.filter((t) => t.category === 'marketing');
  const ecommerceTiers = WEB_PRICING_TIERS.filter((t) => t.category === 'ecommerce');

  return (
    <div className="space-y-10">
      {/* Marketing Sites */}
      <div>
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-xl bg-sky-100">
            <Globe className="h-5 w-5 text-sky-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Marketing Sites</h3>
            <p className="text-sm text-slate-500">Showcase your brand online</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {marketingTiers.map((tier, idx) => (
            <PackageCard
              key={tier.id}
              tier={tier}
              isSelected={selectedTierId === tier.id}
              onSelect={() => onSelect(tier.id)}
              index={idx}
            />
          ))}
        </div>
      </div>

      {/* E-commerce Sites */}
      <div>
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-xl bg-violet-100">
            <ShoppingCart className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">E-commerce Sites</h3>
            <p className="text-sm text-slate-500">Sell products online</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {ecommerceTiers.map((tier, idx) => (
            <PackageCard
              key={tier.id}
              tier={tier}
              isSelected={selectedTierId === tier.id}
              onSelect={() => onSelect(tier.id)}
              index={idx + 2}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// FEATURE CONFIGURATOR COMPONENT
// ============================================================================

interface FeatureConfiguratorProps {
  selectedTierId: string | null;
  selectedAddOnIds: string[];
  onToggleAddOn: (addOnId: string) => void;
}

function FeatureConfigurator({
  selectedTierId,
  selectedAddOnIds,
  onToggleAddOn,
}: FeatureConfiguratorProps) {
  if (!selectedTierId) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-12 text-center"
      >
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <Info className="h-8 w-8 text-slate-300" />
        </div>
        <p className="text-slate-500 font-medium">Select a package above to customize with add-ons</p>
      </motion.div>
    );
  }

  const isAddOnDisabled = (addOn: AddOnFeature): boolean => {
    if (!isAddOnCompatibleWithTier(addOn.id, selectedTierId)) return true;
    for (const selectedId of selectedAddOnIds) {
      if (selectedId !== addOn.id && !areAddOnsCompatible(addOn.id, selectedId)) return true;
    }
    return false;
  };

  const getDisabledReason = (addOn: AddOnFeature): string | null => {
    if (!isAddOnCompatibleWithTier(addOn.id, selectedTierId)) {
      return 'Not available for this package';
    }
    for (const selectedId of selectedAddOnIds) {
      if (selectedId !== addOn.id && !areAddOnsCompatible(addOn.id, selectedId)) {
        const conflictingAddon = WEB_ADDON_FEATURES.find((a) => a.id === selectedId);
        return `Conflicts with "${conflictingAddon?.name}"`;
      }
    }
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {ADD_ON_CATEGORIES.map((category, catIdx) => {
        const categoryAddOns = getAddOnsByCategory(category);
        if (categoryAddOns.length === 0) return null;

        return (
          <motion.div
            key={category}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: catIdx * 0.05 }}
            className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden"
          >
            {/* Category Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-slate-100 text-slate-600">
                  {CATEGORY_ICONS[category]}
                </div>
                <span className="font-semibold text-slate-800">
                  {getAddOnCategoryDisplayName(category)}
                </span>
              </div>
            </div>

            {/* Add-ons List */}
            <div className="divide-y divide-slate-100">
              {categoryAddOns.map((addOn) => {
                const isSelected = selectedAddOnIds.includes(addOn.id);
                const disabled = isAddOnDisabled(addOn);
                const disabledReason = getDisabledReason(addOn);

                return (
                  <div
                    key={addOn.id}
                    className={`
                      flex items-start gap-4 px-5 py-4 transition-colors duration-150
                      ${isSelected ? 'bg-emerald-50/50' : disabled ? 'opacity-50' : 'hover:bg-slate-50'}
                    `}
                  >
                    <Checkbox
                      id={addOn.id}
                      checked={isSelected}
                      disabled={disabled}
                      onCheckedChange={() => onToggleAddOn(addOn.id)}
                      className={`mt-0.5 ${isSelected ? 'border-emerald-600 bg-emerald-600' : ''}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Label
                          htmlFor={addOn.id}
                          className={`font-medium cursor-pointer ${disabled ? 'text-slate-400' : 'text-slate-800'}`}
                        >
                          {addOn.name}
                        </Label>
                        {addOn.isPopular && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-amber-100 text-amber-700">
                            Popular
                          </span>
                        )}
                      </div>
                      <p className={`text-sm mt-0.5 ${disabled ? 'text-slate-300' : 'text-slate-500'}`}>
                        {addOn.description}
                      </p>
                      {disabled && disabledReason && (
                        <p className="text-xs text-amber-600 mt-1 font-medium">{disabledReason}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      {addOn.oneTimePrice > 0 && (
                        <div className="font-semibold text-slate-800">
                          {formatCurrency(addOn.oneTimePrice)}
                        </div>
                      )}
                      {addOn.monthlyPrice > 0 && (
                        <div className="text-sm text-slate-500">
                          {formatMonthly(addOn.monthlyPrice)}
                        </div>
                      )}
                      {addOn.oneTimePrice === 0 && addOn.monthlyPrice > 0 && (
                        <div className="font-semibold text-slate-800">
                          {formatMonthly(addOn.monthlyPrice)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

// ============================================================================
// PRICING BREAKDOWN COMPONENT
// ============================================================================

interface PricingBreakdownProps {
  breakdown: WebPricingBreakdown | null;
}

function PricingBreakdown({ breakdown }: PricingBreakdownProps) {
  if (!breakdown) {
    return (
      <div className="rounded-2xl bg-white border border-slate-200 p-8 text-center sticky top-32">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <DollarSign className="h-7 w-7 text-slate-300" />
        </div>
        <p className="text-slate-500 font-medium">Select a package to see pricing</p>
      </div>
    );
  }

  const packageItem = breakdown.lineItems.find((item) => item.type === 'package');
  const addOnItems = breakdown.lineItems.filter((item) => item.type === 'addon');

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="sticky top-32"
    >
      <div className="rounded-2xl bg-white border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-br from-slate-900 to-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/10 backdrop-blur">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white">Your Quote</h3>
              <p className="text-sm text-slate-400">
                {breakdown.addOnCount} add-on{breakdown.addOnCount !== 1 ? 's' : ''} selected
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Package */}
          {packageItem && (
            <div className="flex justify-between items-start pb-4 border-b border-slate-100">
              <div>
                <div className="font-semibold text-slate-900">{packageItem.name}</div>
                <div className="text-sm text-slate-500">Base package</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-slate-900">{formatCurrency(packageItem.oneTimeAmount)}</div>
                {packageItem.monthlyAmount > 0 && (
                  <div className="text-sm text-slate-500">{formatMonthly(packageItem.monthlyAmount)}</div>
                )}
              </div>
            </div>
          )}

          {/* Add-ons */}
          <AnimatePresence>
            {addOnItems.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2 pb-4 border-b border-slate-100"
              >
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Add-ons
                </div>
                {addOnItems.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="flex justify-between items-start text-sm"
                  >
                    <span className="text-slate-600">{item.name}</span>
                    <div className="text-right font-medium text-slate-700">
                      {item.oneTimeAmount > 0 && formatCurrency(item.oneTimeAmount)}
                      {item.monthlyAmount > 0 && (
                        <span className="text-slate-400 text-xs block">
                          {formatMonthly(item.monthlyAmount)}
                        </span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Totals */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-slate-600">One-time</span>
              <span className="text-xl font-bold text-slate-900">{formatCurrency(breakdown.oneTimeCost)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Monthly</span>
              <span className="text-xl font-bold text-slate-900">{formatMonthly(breakdown.monthlyCost)}</span>
            </div>
          </div>

          {/* Year 1 Total */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
            <div className="flex justify-between items-center">
              <div>
                <div className="font-bold text-lg">Year 1 Total</div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="text-sm text-emerald-100 flex items-center gap-1 cursor-help">
                        <Calendar className="h-3 w-3" />
                        Includes 12 months
                        <Info className="h-3 w-3" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="bg-slate-900 text-white border-0">
                      <p>{formatCurrency(breakdown.oneTimeCost)} + ({formatCurrency(breakdown.monthlyCost)} × 12)</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <span className="text-3xl font-extrabold">
                {formatCurrency(breakdown.yearOneTotalCost)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Card */}
      <div className="mt-5 rounded-2xl bg-slate-900 p-6 text-white">
        <h3 className="text-lg font-bold mb-2">Ready to Get Started?</h3>
        <p className="text-slate-400 text-sm mb-5">
          Contact our team to discuss your project and get a detailed proposal.
        </p>
        <div className="space-y-3">
          <Link href="/contact" className="block">
            <Button className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-semibold h-12 rounded-xl shadow-lg shadow-emerald-500/25 transition-all hover:shadow-emerald-500/40">
              Contact Sales
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <ScheduleDialog
            buttonText="Schedule a Call"
            dialogTitle="Schedule a Consultation"
            dialogDescription="Choose a convenient time to discuss your web development project."
            calendarUrl="https://calendar.google.com/calendar/appointments/schedules/AcZssZ0J6woLwahSRd6c1KrJ_X1cOl99VPr6x-Rp240gi87kaD28RsU1rOuiLVyLQKleUqoVJQqDEPVu?gv=true"
            customButton={
              <Button
                variant="outline"
                className="w-full border-slate-700 bg-slate-800 text-white hover:bg-slate-700 hover:text-white font-semibold h-12 rounded-xl"
              >
                <Phone className="mr-2 h-4 w-4" />
                Schedule a Call
              </Button>
            }
          />
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function WebPricingDemo() {
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);
  const [selectedAddOnIds, setSelectedAddOnIds] = useState<string[]>([]);
  const [breakdown, setBreakdown] = useState<WebPricingBreakdown | null>(null);

  useEffect(() => {
    if (!selectedTierId) {
      setBreakdown(null);
      return;
    }

    try {
      const result = calculateWebPricing({
        selectedTierId,
        selectedAddOnIds,
      });
      setBreakdown(result);
    } catch (error) {
      console.error('Pricing calculation error:', error);
      setBreakdown(null);
    }
  }, [selectedTierId, selectedAddOnIds]);

  const handleTierSelect = (tierId: string) => {
    setSelectedTierId(tierId);
    setSelectedAddOnIds((prev) =>
      prev.filter((addOnId) => isAddOnCompatibleWithTier(addOnId, tierId))
    );
  };

  const handleToggleAddOn = (addOnId: string) => {
    setSelectedAddOnIds((prev) =>
      prev.includes(addOnId) ? prev.filter((id) => id !== addOnId) : [...prev, addOnId]
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      {/* Subtle background pattern */}
      <div className="fixed inset-0 -z-10 opacity-40">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgb(226 232 240) 1px, transparent 0)`,
          backgroundSize: '32px 32px'
        }} />
      </div>

      <div className="container mx-auto px-4 pt-28 pb-16 max-w-7xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-100 text-emerald-700 font-medium text-sm mb-6">
            <Zap className="h-4 w-4" />
            Interactive Pricing Tool
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-4 tracking-tight">
            Web Development Pricing
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Build your custom quote for marketing sites or e-commerce platforms.
            Select a package and customize with add-on features.
          </p>
        </motion.div>

        {/* Section Header */}
        <div className="flex items-center gap-3 mb-6">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-sm">
            1
          </span>
          <h2 className="text-xl font-bold text-slate-900">
            Choose Your Package
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Left Column - Package Selection & Add-ons */}
          <div className="lg:col-span-2 space-y-12">
            {/* Package Selection */}
            <section>
              <PackageSelector selectedTierId={selectedTierId} onSelect={handleTierSelect} />
            </section>

            {/* Add-on Features */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-sm">
                  2
                </span>
                <h2 className="text-xl font-bold text-slate-900">
                  Customize with Add-ons
                </h2>
              </div>
              <FeatureConfigurator
                selectedTierId={selectedTierId}
                selectedAddOnIds={selectedAddOnIds}
                onToggleAddOn={handleToggleAddOn}
              />
            </section>
          </div>

          {/* Right Column - Pricing Summary */}
          <div className="lg:col-span-1 lg:mt-[72px]">
            <PricingBreakdown breakdown={breakdown} />
          </div>
        </div>

        {/* Info Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-20"
        >
          <div className="rounded-2xl bg-slate-900 p-8 md:p-10">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-white/10">
                <Info className="h-5 w-5 text-emerald-400" />
              </div>
              What&apos;s Included in Every Project
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                {
                  title: 'Development Process',
                  description: 'Discovery, design, development, testing, and deployment with your dedicated project manager.'
                },
                {
                  title: 'Training & Handoff',
                  description: 'Comprehensive training sessions and documentation for your team to manage the site.'
                },
                {
                  title: 'Post-Launch Support',
                  description: 'Bug fixes and support included based on your package tier. Extended support available.'
                }
              ].map((item, idx) => (
                <div key={idx} className="p-5 rounded-xl bg-white/5 border border-white/10">
                  <div className="font-semibold text-white mb-2">{item.title}</div>
                  <p className="text-sm text-slate-400 leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
