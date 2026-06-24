/**
 * VendorCalculatorCard — self-contained delivery cost estimator for vendors.
 *
 * Calls POST /api/vendor/calculator/quote via useVendorQuote and displays
 * a customer-safe breakdown. Never renders driver pay, margin, or RS fee.
 */

'use client';

import { useState, useCallback } from 'react';
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
import { Button } from '@/components/ui/button';
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
  RotateCcw,
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
  // Text inputs stored as strings so they can be empty after reset.
  const [headcountRaw, setHeadcountRaw] = useState('');
  const [foodCostRaw, setFoodCostRaw] = useState('');
  const [totalMileageRaw, setTotalMileageRaw] = useState('');
  const [numberOfStopsRaw, setNumberOfStopsRaw] = useState('');
  const [numberOfDrives, setNumberOfDrives] = useState(1);
  const [requiresBridge, setRequiresBridge] = useState(false);

  // Parsed numeric values (NaN when empty)
  const headcount = headcountRaw === '' ? NaN : Math.max(0, parseInt(headcountRaw, 10));
  const foodCost = foodCostRaw === '' ? NaN : Math.max(0, parseFloat(foodCostRaw));
  const totalMileage = totalMileageRaw === '' ? NaN : Math.max(0, parseFloat(totalMileageRaw));
  const numberOfStops = numberOfStopsRaw === '' ? NaN : Math.max(1, parseInt(numberOfStopsRaw, 10));

  // Whether the current form inputs are valid (used to enable/disable Calculate)
  // Rule: at least one of headcount/foodCost, plus totalMileage and numberOfStops.
  // Drives is always valid (Select, never empty).
  const hasHeadcount = !isNaN(headcount);
  const hasFoodCost = !isNaN(foodCost);
  const isFormValid = (hasHeadcount || hasFoodCost) && !isNaN(totalMileage) && !isNaN(numberOfStops);

  // Only query when the user explicitly clicks Calculate
  const [submittedInput, setSubmittedInput] = useState<VendorQuoteRequest | null>(null);

  const { data: quote, isLoading, error } = useVendorQuote(submittedInput);

  // ── Helpers ───────────────────────────────────────────────────────────

  /** Submit current form values for calculation. */
  const handleCalculate = useCallback(() => {
    if (!isFormValid) return;
    setSubmittedInput({
      headcount: hasHeadcount ? headcount : 0,
      foodCost: hasFoodCost ? foodCost : 0,
      totalMileage,
      numberOfDrives,
      numberOfStops,
      requiresBridge,
    });
  }, [isFormValid, hasHeadcount, hasFoodCost, headcount, foodCost, totalMileage, numberOfDrives, numberOfStops, requiresBridge]);

  /** Reset all fields to empty and clear results. */
  const handleReset = useCallback(() => {
    setHeadcountRaw('');
    setFoodCostRaw('');
    setTotalMileageRaw('');
    setNumberOfStopsRaw('');
    setNumberOfDrives(1);
    setRequiresBridge(false);
    setSubmittedInput(null);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Input Card ─────────────────────────────────────────────── */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-lg">
              <Calculator className="h-5 w-5 text-gray-900" />
            </div>
            <span className="text-gray-900">Delivery Cost Estimator</span>
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
                value={headcountRaw}
                onChange={(e) => setHeadcountRaw(e.target.value)}
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
                value={foodCostRaw}
                onChange={(e) => setFoodCostRaw(e.target.value)}
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
                value={totalMileageRaw}
                onChange={(e) => setTotalMileageRaw(e.target.value)}
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
                value={numberOfStopsRaw}
                onChange={(e) => setNumberOfStopsRaw(e.target.value)}
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

          {/* Action buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="text-gray-600 hover:text-gray-900"
            >
              <RotateCcw className="mr-1.5 h-4 w-4" />
              Reset
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!isFormValid || isLoading}
              onClick={handleCalculate}
              className="bg-amber-400 text-gray-900 hover:bg-amber-500"
            >
              {isLoading ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Calculator className="mr-1.5 h-4 w-4" />
              )}
              Calculate
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Results Card ───────────────────────────────────────────── */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 bg-gradient-to-br from-yellow-500 to-amber-500 rounded-lg">
              <DollarSign className="h-5 w-5 text-gray-900" />
            </div>
            <span className="text-gray-900">Estimated Delivery Fee</span>
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
              <div className="flex justify-between items-center p-4 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl border border-amber-300">
                <span className="text-lg font-bold text-gray-900">
                  Total Delivery Fee
                </span>
                <span
                  className="text-2xl font-bold text-gray-900"
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
