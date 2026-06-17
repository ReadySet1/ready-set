/**
 * VendorCalculatorCard — self-contained delivery cost estimator for vendors.
 *
 * Calls POST /api/vendor/calculator/quote via useVendorQuote and displays
 * a customer-safe breakdown. Never renders driver pay, margin, or RS fee.
 */

'use client';

import { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Calculator,
  DollarSign,
  Users,
  Truck,
  MapPin,
  Loader2,
  Phone,
  Info,
} from 'lucide-react';
import {
  useVendorQuote,
  type VendorQuoteRequest,
} from '@/hooks/useVendorQuote';

// ---------------------------------------------------------------------------
// Local formatCurrency (not exported — avoids coupling to the engine)
// ---------------------------------------------------------------------------

function formatCurrency(value: number | undefined | null): string {
  if (typeof value !== 'number' || isNaN(value)) return '0.00';
  return value.toFixed(2);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function VendorCalculatorCard() {
  // ── Form state ────────────────────────────────────────────────────────
  const [headcount, setHeadcount] = useState(50);
  const [foodCost, setFoodCost] = useState(500);
  const [totalMileage, setTotalMileage] = useState(8);
  const [numberOfDrives, setNumberOfDrives] = useState(1);
  const [numberOfStops, setNumberOfStops] = useState(1);
  const [requiresBridge, setRequiresBridge] = useState(false);

  // Build the request object for the hook (null = don't query)
  const quoteInput = useMemo<VendorQuoteRequest | null>(() => {
    // Don't query if any required field is missing or invalid
    if (headcount < 0 || foodCost < 0 || totalMileage < 0) return null;
    return {
      headcount,
      foodCost,
      totalMileage,
      numberOfDrives,
      numberOfStops,
      requiresBridge,
    };
  }, [headcount, foodCost, totalMileage, numberOfDrives, numberOfStops, requiresBridge]);

  const { data: quote, isLoading, error } = useVendorQuote(quoteInput);

  // ── Helpers ───────────────────────────────────────────────────────────

  /** Parse a string input to a non-negative integer (clamped to 0 min). */
  function toNonNegativeInt(raw: string): number {
    const n = parseInt(raw, 10);
    return isNaN(n) ? 0 : Math.max(0, n);
  }

  /** Parse a string input to a non-negative float. */
  function toNonNegativeFloat(raw: string): number {
    const n = parseFloat(raw);
    return isNaN(n) ? 0 : Math.max(0, n);
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Input Card ─────────────────────────────────────────────── */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg">
              <Calculator className="h-5 w-5 text-white" />
            </div>
            <span className="text-emerald-700">Delivery Cost Estimator</span>
          </CardTitle>
          <CardDescription>
            Estimate the delivery fee for an upcoming order.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Row 1: Headcount + Food Cost */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vc-headcount" className="text-slate-700 font-medium flex items-center gap-1.5">
                <Users className="h-4 w-4 text-slate-400" />
                Headcount
              </Label>
              <Input
                id="vc-headcount"
                type="number"
                min={0}
                value={headcount}
                onChange={(e) => setHeadcount(toNonNegativeInt(e.target.value))}
                className="h-11"
                placeholder="e.g. 50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vc-foodcost" className="text-slate-700 font-medium flex items-center gap-1.5">
                <DollarSign className="h-4 w-4 text-slate-400" />
                Food Cost ($)
              </Label>
              <Input
                id="vc-foodcost"
                type="number"
                min={0}
                step={0.01}
                value={foodCost}
                onChange={(e) => setFoodCost(toNonNegativeFloat(e.target.value))}
                className="h-11"
                placeholder="e.g. 500"
              />
            </div>
          </div>

          {/* Row 2: Mileage + Drives today */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vc-mileage" className="text-slate-700 font-medium flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-slate-400" />
                Total Mileage
              </Label>
              <Input
                id="vc-mileage"
                type="number"
                min={0}
                step={0.1}
                value={totalMileage}
                onChange={(e) => setTotalMileage(toNonNegativeFloat(e.target.value))}
                className="h-11"
                placeholder="e.g. 12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vc-drives" className="text-slate-700 font-medium flex items-center gap-1.5">
                <Truck className="h-4 w-4 text-slate-400" />
                Drives scheduled today
              </Label>
              <Select
                value={String(numberOfDrives)}
                onValueChange={(v) => setNumberOfDrives(parseInt(v, 10))}
              >
                <SelectTrigger id="vc-drives" className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 drive</SelectItem>
                  <SelectItem value="2">2 drives</SelectItem>
                  <SelectItem value="3">3 drives</SelectItem>
                  <SelectItem value="4">4+ drives</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 3: Stops + Bridge */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vc-stops" className="text-slate-700 font-medium flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-slate-400" />
                Number of Stops
              </Label>
              <Input
                id="vc-stops"
                type="number"
                min={1}
                value={numberOfStops}
                onChange={(e) => setNumberOfStops(Math.max(1, toNonNegativeInt(e.target.value)))}
                className="h-11"
                placeholder="1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vc-bridge" className="text-slate-700 font-medium">
                Bridge Toll Required
              </Label>
              <div className="flex items-center gap-3 h-11">
                <Switch
                  id="vc-bridge"
                  checked={requiresBridge}
                  onCheckedChange={setRequiresBridge}
                />
                <span className="text-sm text-slate-500">
                  {requiresBridge ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Results Card ───────────────────────────────────────────── */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-violet-600 rounded-lg">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
            <span className="text-purple-700">Estimated Delivery Fee</span>
          </CardTitle>
        </CardHeader>

        <CardContent>
          {/* Loading state */}
          {isLoading && !quote && (
            <div className="flex items-center justify-center py-8 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Calculating...
            </div>
          )}

          {/* Error state */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Custom quote required */}
          {quote?.requiresCustomQuote && (
            <div className="text-center py-8">
              <div className="p-3 bg-amber-50 rounded-full inline-block mb-3">
                <Phone className="h-6 w-6 text-amber-600" />
              </div>
              <p className="text-lg font-semibold text-slate-800 mb-1">
                This order needs a custom quote
              </p>
              <p className="text-sm text-slate-500">
                Please contact us for orders of this size.
              </p>
            </div>
          )}

          {/* Breakdown (only when we have data and it's NOT a custom quote) */}
          {quote && !quote.requiresCustomQuote && (
            <div className="space-y-3">
              {/* Base delivery cost */}
              <div className="flex justify-between items-center py-2">
                <span className="text-slate-600">Delivery Cost</span>
                <span className="font-semibold">
                  ${formatCurrency(quote.deliveryCost)}
                </span>
              </div>

              {/* Mileage surcharge */}
              {quote.mileageSurcharge > 0 && (
                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-600">Mileage Surcharge</span>
                  <span className="font-semibold">
                    ${formatCurrency(quote.mileageSurcharge)}
                  </span>
                </div>
              )}

              {/* Multi-drive discount (shown as credit) */}
              {quote.multiDriveDiscount > 0 && (
                <div className="flex justify-between items-center py-2 text-green-600">
                  <span>Multi-Drive Discount</span>
                  <span className="font-semibold">
                    -${formatCurrency(quote.multiDriveDiscount)}
                  </span>
                </div>
              )}

              {/* Extra stops */}
              {quote.extraStopsCharge > 0 && (
                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-600">Extra Stops</span>
                  <span className="font-semibold">
                    ${formatCurrency(quote.extraStopsCharge)}
                  </span>
                </div>
              )}

              {/* Bridge toll */}
              {quote.bridgeToll > 0 && (
                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-600">Bridge Toll</span>
                  <span className="font-semibold">
                    ${formatCurrency(quote.bridgeToll)}
                  </span>
                </div>
              )}

              <Separator className="my-3" />

              {/* Total */}
              <div className="flex justify-between items-center p-4 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl border border-purple-200">
                <span className="text-lg font-bold text-purple-800">
                  Total Delivery Fee
                </span>
                <span
                  className="text-2xl font-bold text-purple-900"
                  data-testid="total-delivery-fee"
                >
                  ${formatCurrency(quote.totalDeliveryFee)}
                </span>
              </div>

              {/* Pricing profile label + fallback note */}
              <div className="flex items-start gap-2 pt-2">
                <Info className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <p className="text-xs text-slate-400">
                  Pricing profile: {quote.pricingProfileLabel}
                  {quote.isFallbackPricing && (
                    <span className="ml-1" data-testid="fallback-pricing-note">
                      — Showing standard pricing.
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Empty state: no quote yet and not loading */}
          {!quote && !isLoading && !error && (
            <p className="text-center text-sm text-slate-400 py-8">
              Enter your delivery details above to see an estimate.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
