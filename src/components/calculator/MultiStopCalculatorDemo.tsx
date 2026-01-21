// MultiStopCalculatorDemo - Public demo component for multi-stop delivery calculator
// No authentication required - uses calculator functions directly

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Calculator,
  DollarSign,
  Truck,
  Users,
  MapPin,
  Plus,
  ArrowRight,
  Phone,
  Info,
  Sparkles,
  Route
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  calculateDeliveryCost,
  calculateDriverPay,
  type DeliveryCostInput,
  type DriverPayInput,
  type DeliveryCostBreakdown,
  type DriverPayBreakdown
} from '@/lib/calculator/delivery-cost-calculator';
import { AddressInput } from '@/components/calculator/AddressInput';
import {
  calculateEstimatedDrivingDistance,
  type Coordinates,
} from '@/lib/calculator/distance-calculator';

// Helper function for safe number formatting
const formatCurrency = (value: number | undefined | null): string => {
  if (typeof value !== 'number' || isNaN(value)) {
    return '0.00';
  }
  return value.toFixed(2);
};

interface DemoInput {
  headcount: number;
  foodCost: number;
  mileage: number;
  numberOfStops: number;
  requiresBridge: boolean;
}

export default function MultiStopCalculatorDemo() {
  const [input, setInput] = useState<DemoInput>({
    headcount: 50,
    foodCost: 500,
    mileage: 15,
    numberOfStops: 1,
    requiresBridge: false
  });

  const [deliveryResult, setDeliveryResult] = useState<DeliveryCostBreakdown | null>(null);
  const [driverResult, setDriverResult] = useState<DriverPayBreakdown | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Address-based distance calculation state
  const [pickupCoords, setPickupCoords] = useState<Coordinates | null>(null);
  const [deliveryCoords, setDeliveryCoords] = useState<Coordinates | null>(null);
  const [useManualMileage, setUseManualMileage] = useState(false);
  const [isAutoCalculated, setIsAutoCalculated] = useState(false);

  // Calculate results when input changes
  useEffect(() => {
    try {
      setError(null);

      const deliveryInput: DeliveryCostInput = {
        headcount: input.headcount,
        foodCost: input.foodCost,
        totalMileage: input.mileage,
        numberOfStops: input.numberOfStops,
        requiresBridge: input.requiresBridge,
        clientConfigId: 'ready-set-food-standard'
      };

      const driverInput: DriverPayInput = {
        ...deliveryInput,
        bonusQualified: true,
        bonusQualifiedPercent: 100
      };

      const deliveryBreakdown = calculateDeliveryCost(deliveryInput);
      const driverBreakdown = calculateDriverPay(driverInput);

      setDeliveryResult(deliveryBreakdown);
      setDriverResult(driverBreakdown);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setDeliveryResult(null);
      setDriverResult(null);
    }
  }, [input]);

  const handleInputChange = (field: keyof DemoInput, value: number | boolean) => {
    setInput(prev => ({ ...prev, [field]: value }));
  };

  // Handlers for address coordinate changes
  const handlePickupCoordsChange = useCallback((coords: Coordinates | null) => {
    setPickupCoords(coords);
  }, []);

  const handleDeliveryCoordsChange = useCallback((coords: Coordinates | null) => {
    setDeliveryCoords(coords);
  }, []);

  // Auto-calculate distance when both addresses are geocoded
  useEffect(() => {
    if (pickupCoords && deliveryCoords && !useManualMileage) {
      const estimated = calculateEstimatedDrivingDistance(pickupCoords, deliveryCoords);
      setInput(prev => ({ ...prev, mileage: estimated }));
      setIsAutoCalculated(true);
    } else if (useManualMileage) {
      setIsAutoCalculated(false);
    }
  }, [pickupCoords, deliveryCoords, useManualMileage]);

  // Reset auto-calculated flag when switching to manual
  const handleManualMileageToggle = (checked: boolean) => {
    setUseManualMileage(checked);
    if (checked) {
      setIsAutoCalculated(false);
    }
  };

  // Calculate extra stops info for highlighting
  const extraStopsInfo = useMemo(() => {
    const extraStops = Math.max(0, input.numberOfStops - 1);
    return {
      count: extraStops,
      customerCharge: extraStops * 5.00,
      driverBonus: extraStops * 2.50
    };
  }, [input.numberOfStops]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
      <div className="container mx-auto px-4 pt-28 pb-8 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-10">
          <Badge variant="secondary" className="mb-4 bg-emerald-100 text-emerald-700 hover:bg-emerald-200">
            <Sparkles className="h-3 w-3 mr-1" />
            Interactive Demo
          </Badge>
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            Delivery Cost Calculator
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            See transparent pricing for catering and specialty deliveries.
            Our multi-stop feature makes complex deliveries simple.
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertDescription className="text-red-800">
              {error}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="space-y-6">
            {/* Basic Info Card */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                  Delivery Details
                </CardTitle>
                <CardDescription>
                  Enter your delivery information to see the cost breakdown
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="headcount" className="text-slate-700 font-medium">
                      Headcount
                    </Label>
                    <Input
                      id="headcount"
                      type="number"
                      min="0"
                      value={input.headcount}
                      onChange={(e) => handleInputChange('headcount', parseInt(e.target.value) || 0)}
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="foodCost" className="text-slate-700 font-medium">
                      Food Cost ($)
                    </Label>
                    <Input
                      id="foodCost"
                      type="number"
                      min="0"
                      step="0.01"
                      value={input.foodCost}
                      onChange={(e) => handleInputChange('foodCost', parseFloat(e.target.value) || 0)}
                      className="h-11"
                    />
                  </div>
                </div>

                {/* Distance Calculation Section */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-slate-700 font-medium flex items-center gap-2">
                      <Route className="h-4 w-4" />
                      Distance
                    </Label>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="manual-mileage" className="text-sm text-slate-500 cursor-pointer">
                        Enter manually
                      </Label>
                      <Switch
                        id="manual-mileage"
                        checked={useManualMileage}
                        onCheckedChange={handleManualMileageToggle}
                      />
                    </div>
                  </div>

                  {useManualMileage ? (
                    <div className="space-y-2">
                      <Label htmlFor="mileage" className="text-slate-600 text-sm">
                        Total Mileage (round trip)
                      </Label>
                      <Input
                        id="mileage"
                        type="number"
                        min="0"
                        step="0.1"
                        value={input.mileage}
                        onChange={(e) => handleInputChange('mileage', parseFloat(e.target.value) || 0)}
                        className="h-11"
                      />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <AddressInput
                        label="Pickup Address"
                        placeholder="e.g., 1 Market St, San Francisco, CA"
                        onCoordinatesChange={handlePickupCoordsChange}
                      />
                      <AddressInput
                        label="Delivery Address"
                        placeholder="e.g., 1355 Market St, San Francisco, CA"
                        onCoordinatesChange={handleDeliveryCoordsChange}
                      />

                      {/* Display estimated distance */}
                      {isAutoCalculated && (
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-blue-700 font-medium">
                              Estimated Distance (one way)
                            </span>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Info className="h-4 w-4 text-blue-400" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p>This is an estimate based on straight-line distance with a road adjustment factor. Actual driving distance may vary.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <span className="text-xl font-bold text-blue-900">
                            {input.mileage} miles
                          </span>
                        </div>
                      )}

                      {!pickupCoords && !deliveryCoords && (
                        <p className="text-sm text-slate-500">
                          Enter both addresses and click &quot;Check&quot; to auto-calculate distance.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-slate-500" />
                    <Label htmlFor="bridge" className="text-slate-700 font-medium cursor-pointer">
                      Requires Bridge Crossing
                    </Label>
                  </div>
                  <Switch
                    id="bridge"
                    checked={input.requiresBridge}
                    onCheckedChange={(checked) => handleInputChange('requiresBridge', checked)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Multi-Stop Card - Highlighted Feature */}
            <Card className="border-2 border-emerald-200 shadow-lg bg-gradient-to-br from-emerald-50/50 to-white">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg">
                    <Plus className="h-5 w-5 text-white" />
                  </div>
                  Multi-Stop Delivery
                  <Badge className="ml-2 bg-emerald-500 text-white">New Feature</Badge>
                </CardTitle>
                <CardDescription>
                  Need to deliver to multiple locations? Add extra stops and see the pricing.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="stops" className="text-slate-700 font-medium">
                      Number of Stops
                    </Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-slate-400" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>First stop is included in the base delivery fee. Each additional stop is $5.00 for the customer, and the driver receives a $2.50 bonus per extra stop.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleInputChange('numberOfStops', Math.max(1, input.numberOfStops - 1))}
                      disabled={input.numberOfStops <= 1}
                      className="h-11 w-11"
                    >
                      -
                    </Button>
                    <Input
                      id="stops"
                      type="number"
                      min="1"
                      value={input.numberOfStops}
                      onChange={(e) => handleInputChange('numberOfStops', Math.max(1, parseInt(e.target.value) || 1))}
                      className="h-11 text-center text-lg font-semibold"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleInputChange('numberOfStops', input.numberOfStops + 1)}
                      className="h-11 w-11"
                    >
                      +
                    </Button>
                  </div>
                </div>

                {extraStopsInfo.count > 0 && (
                  <div className="p-4 bg-emerald-100/50 rounded-lg border border-emerald-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Truck className="h-4 w-4 text-emerald-600" />
                      <span className="font-semibold text-emerald-800">
                        {extraStopsInfo.count} Extra Stop{extraStopsInfo.count > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="text-sm text-emerald-700 space-y-1">
                      <p>Customer charge: +${formatCurrency(extraStopsInfo.customerCharge)}</p>
                      <p>Driver bonus: +${formatCurrency(extraStopsInfo.driverBonus)}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Results Section */}
          <div className="space-y-6">
            {deliveryResult && (
              <>
                {/* Customer Charges */}
                <Card className="border-0 shadow-lg">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-3 text-xl">
                      <div className="p-2 bg-gradient-to-br from-purple-500 to-violet-600 rounded-lg">
                        <DollarSign className="h-5 w-5 text-white" />
                      </div>
                      <span className="text-purple-700">Customer Charges</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-2">
                        <span className="text-slate-600">Base Delivery Fee:</span>
                        <span className="font-semibold">${formatCurrency(deliveryResult.deliveryCost)}</span>
                      </div>

                      {deliveryResult.totalMileagePay > 0 && (
                        <div className="flex justify-between items-center py-2">
                          <span className="text-slate-600">Mileage ({Math.max(0, input.mileage - 10).toFixed(1)} mi over 10):</span>
                          <span className="font-semibold">${formatCurrency(deliveryResult.totalMileagePay)}</span>
                        </div>
                      )}

                      {deliveryResult.extraStopsCharge > 0 && (
                        <div className="flex justify-between items-center py-2 bg-emerald-50 -mx-4 px-4 rounded-lg border border-emerald-200">
                          <span className="text-emerald-700 font-medium flex items-center gap-2">
                            <Plus className="h-4 w-4" />
                            Extra Stops ({extraStopsInfo.count}):
                          </span>
                          <span className="font-bold text-emerald-700">${formatCurrency(deliveryResult.extraStopsCharge)}</span>
                        </div>
                      )}

                      {deliveryResult.bridgeToll > 0 && (
                        <div className="flex justify-between items-center py-2">
                          <span className="text-slate-600">Bridge Toll:</span>
                          <span className="font-semibold">${formatCurrency(deliveryResult.bridgeToll)}</span>
                        </div>
                      )}

                      {deliveryResult.dailyDriveDiscount > 0 && (
                        <div className="flex justify-between items-center py-2 text-green-600">
                          <span>Daily Drive Discount:</span>
                          <span className="font-semibold">-${formatCurrency(deliveryResult.dailyDriveDiscount)}</span>
                        </div>
                      )}

                      <Separator className="my-3" />

                      <div className="flex justify-between items-center p-4 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl border border-purple-200">
                        <span className="text-lg font-bold text-purple-800">Total Delivery Fee:</span>
                        <span className="text-2xl font-bold text-purple-900">${formatCurrency(deliveryResult.deliveryFee)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Driver Payments */}
                {driverResult && (
                  <Card className="border-0 shadow-lg">
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center gap-3 text-xl">
                        <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
                          <Truck className="h-5 w-5 text-white" />
                        </div>
                        <span className="text-blue-700">Driver Earnings</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center py-2">
                          <span className="text-slate-600">Base Pay:</span>
                          <span className="font-semibold">${formatCurrency(driverResult.driverBasePayPerDrop)}</span>
                        </div>

                        <div className="flex justify-between items-center py-2">
                          <span className="text-slate-600">Mileage ({input.mileage} mi):</span>
                          <span className="font-semibold">${formatCurrency(driverResult.totalMileagePay)}</span>
                        </div>

                        {driverResult.driverBonusPay > 0 && (
                          <div className="flex justify-between items-center py-2">
                            <span className="text-slate-600">Bonus:</span>
                            <span className="font-semibold text-green-600">${formatCurrency(driverResult.driverBonusPay)}</span>
                          </div>
                        )}

                        {driverResult.extraStopsBonus > 0 && (
                          <div className="flex justify-between items-center py-2 bg-emerald-50 -mx-4 px-4 rounded-lg border border-emerald-200">
                            <span className="text-emerald-700 font-medium flex items-center gap-2">
                              <Plus className="h-4 w-4" />
                              Extra Stops Bonus ({extraStopsInfo.count}):
                            </span>
                            <span className="font-bold text-emerald-700">${formatCurrency(driverResult.extraStopsBonus)}</span>
                          </div>
                        )}

                        {driverResult.bridgeToll > 0 && (
                          <div className="flex justify-between items-center py-2">
                            <span className="text-slate-600">Bridge Toll:</span>
                            <span className="font-semibold">${formatCurrency(driverResult.bridgeToll)}</span>
                          </div>
                        )}

                        <Separator className="my-3" />

                        <div className="flex justify-between items-center p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                          <span className="text-lg font-bold text-blue-800">Total Driver Pay:</span>
                          <span className="text-2xl font-bold text-blue-900">${formatCurrency(driverResult.totalDriverPay)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {/* CTA Card */}
            <Card className="border-0 shadow-lg bg-gradient-to-br from-slate-900 to-slate-800 text-white">
              <CardContent className="p-6">
                <h3 className="text-xl font-bold mb-2">Ready to Get Started?</h3>
                <p className="text-slate-300 mb-4">
                  Sign up for a Ready Set account to access our full suite of delivery management tools.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link href="/sign-up" className="flex-1">
                    <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white h-11">
                      Sign Up Free
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/contact" className="flex-1">
                    <Button variant="outline" className="w-full border-slate-500 bg-slate-700 text-white hover:bg-slate-600 hover:text-white h-11">
                      <Phone className="mr-2 h-4 w-4" />
                      Contact Sales
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Pricing Info Footer */}
        <div className="mt-12 p-6 bg-slate-100 rounded-2xl">
          <h3 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <Calculator className="h-5 w-5 text-slate-600" />
            How Multi-Stop Pricing Works
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-600">
            <div className="p-4 bg-white rounded-lg">
              <div className="font-semibold text-slate-800 mb-1">First Stop</div>
              <p>Included in the base delivery fee based on your headcount and food cost tier.</p>
            </div>
            <div className="p-4 bg-white rounded-lg">
              <div className="font-semibold text-slate-800 mb-1">Additional Stops</div>
              <p>$5.00 per extra stop is added to the customer charge for handling multiple locations.</p>
            </div>
            <div className="p-4 bg-white rounded-lg">
              <div className="font-semibold text-slate-800 mb-1">Driver Bonus</div>
              <p>Drivers receive a $2.50 bonus per additional stop to compensate for extra time and effort.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
