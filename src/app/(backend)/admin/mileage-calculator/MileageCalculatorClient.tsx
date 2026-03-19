'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NavigationIcon, History, Calculator, Loader2 } from 'lucide-react';
import {
  MileageForm,
  MileageResults,
  MileageMap,
} from '@/components/MileageCalculator';
import type {
  MileageStop,
  MileageCalculation,
  MileageCalculationStatus,
} from '@/types/mileage';
import type {
  RouteApiResponse,
  DistanceMatrixResult,
  RouteResult,
} from '@/types/routing';

interface MileageCalculatorClientProps {
  userType: string;
}

const MAX_HISTORY = 10;

export default function MileageCalculatorClient({
  userType,
}: MileageCalculatorClientProps) {
  const [status, setStatus] = useState<MileageCalculationStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [currentCalculation, setCurrentCalculation] =
    useState<MileageCalculation | null>(null);
  const [history, setHistory] = useState<MileageCalculation[]>([]);

  const handleCalculate = useCallback(
    async (pickup: MileageStop, dropoffs: MileageStop[]) => {
      setStatus('loading');
      setError(null);
      setCurrentCalculation(null);

      try {
        // Step 1: Get distance/duration via Distance Matrix API
        const distanceRes = await fetch('/api/routes/distance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            origins: [{ address: pickup.address }],
            destinations: dropoffs.map((d) => ({ address: d.address })),
          }),
        });

        if (!distanceRes.ok) {
          const errorBody = (await distanceRes.json()) as RouteApiResponse<never>;
          throw new Error(errorBody.error ?? 'Failed to calculate distance');
        }

        const distanceData =
          (await distanceRes.json()) as RouteApiResponse<DistanceMatrixResult>;

        if (!distanceData.success || !distanceData.data) {
          throw new Error(distanceData.error ?? 'No distance data returned');
        }

        const { entries } = distanceData.data;

        // Build legs from distance matrix entries
        const legs = entries.map((entry) => ({
          from: entry.originAddress,
          to: entry.destinationAddress,
          distanceMiles: entry.distanceMiles,
          durationMinutes: entry.durationMinutes,
        }));

        let totalDistanceMiles = legs.reduce((s, l) => s + l.distanceMiles, 0);
        let totalDurationMinutes = legs.reduce(
          (s, l) => s + l.durationMinutes,
          0,
        );

        // Step 2 (multi-stop): Get sequential route via Directions API
        // For multi-stop routes, the Distance Matrix gives origin→each destination
        // independently. The Directions API gives the actual sequential driving route.
        let polyline: string | undefined;

        if (dropoffs.length > 1) {
          try {
            const optimizeRes = await fetch('/api/routes/optimize', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                pickup: { address: pickup.address },
                dropoff: { address: dropoffs[dropoffs.length - 1]!.address },
                waypoints: dropoffs
                  .slice(0, -1)
                  .map((d) => ({ address: d.address })),
                optimizeWaypoints: false,
                preferMedianRoute: true,
              }),
            });

            if (optimizeRes.ok) {
              const optimizeData =
                (await optimizeRes.json()) as RouteApiResponse<RouteResult>;

              if (optimizeData.success && optimizeData.data) {
                polyline = optimizeData.data.polyline;
                // Use sequential totals from Directions API (more accurate for multi-stop)
                totalDistanceMiles = optimizeData.data.totalDistanceMiles;
                totalDurationMinutes = optimizeData.data.totalDurationMinutes;

                // Replace legs with sequential breakdown from Directions API
                legs.length = 0;
                for (const routeLeg of optimizeData.data.legs) {
                  legs.push({
                    from: routeLeg.startAddress,
                    to: routeLeg.endAddress,
                    distanceMiles: routeLeg.distanceMiles,
                    durationMinutes: routeLeg.durationMinutes,
                  });
                }
              }
            }
          } catch {
            // Polyline/directions are optional; distance matrix data is sufficient
          }
        } else {
          // Single drop-off: fetch directions with median route selection.
          // The Directions API result overrides Distance Matrix values because
          // the median route may differ from the fastest route that Distance Matrix returns.
          try {
            const optimizeRes = await fetch('/api/routes/optimize', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                pickup: { address: pickup.address },
                dropoff: { address: dropoffs[0]!.address },
                preferMedianRoute: true,
              }),
            });

            if (optimizeRes.ok) {
              const optimizeData =
                (await optimizeRes.json()) as RouteApiResponse<RouteResult>;

              if (optimizeData.success && optimizeData.data) {
                polyline = optimizeData.data.polyline;
                totalDistanceMiles = optimizeData.data.totalDistanceMiles;
                totalDurationMinutes = optimizeData.data.totalDurationMinutes;

                legs.length = 0;
                for (const routeLeg of optimizeData.data.legs) {
                  legs.push({
                    from: routeLeg.startAddress,
                    to: routeLeg.endAddress,
                    distanceMiles: routeLeg.distanceMiles,
                    durationMinutes: routeLeg.durationMinutes,
                  });
                }
              }
            }
          } catch {
            // Falls back to Distance Matrix values if directions fail
          }
        }

        const calculation: MileageCalculation = {
          pickup,
          dropoffs,
          totalDistanceMiles: Math.round(totalDistanceMiles * 100) / 100,
          totalDurationMinutes: Math.round(totalDurationMinutes * 10) / 10,
          legs,
          polyline,
          calculatedAt: new Date(),
        };

        setCurrentCalculation(calculation);
        setHistory((prev) => [calculation, ...prev.slice(0, MAX_HISTORY - 1)]);
        setStatus('success');
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'An unexpected error occurred';
        setError(message);
        setStatus('error');
      }
    },
    [],
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50/40 to-white">
      <div className="container mx-auto py-6 px-4 space-y-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold flex items-center gap-3 text-slate-900">
              <div className="p-2 bg-gradient-to-br from-primary to-amber-500 rounded-xl shadow-lg">
                <NavigationIcon className="h-6 w-6 text-slate-900" />
              </div>
              Total Mileage Calculation
            </h1>
            <p className="text-slate-600 text-base max-w-2xl leading-relaxed">
              Calculate driving distance and estimated travel time between
              pickup and drop-off locations
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Badge
              variant="secondary"
              className="px-4 py-2 bg-amber-100 text-amber-800 border-amber-300 shadow-sm"
            >
              Google Maps
            </Badge>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="calculator" className="w-full">
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-2 mb-8">
            <TabsList className="grid w-full grid-cols-2 bg-gradient-to-r from-slate-50 to-amber-50/50 p-1.5 rounded-xl shadow-inner h-14">
              <TabsTrigger
                value="calculator"
                className="flex items-center justify-center gap-2 rounded-lg px-4 py-3 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-slate-900 data-[state=active]:border-b-2 data-[state=active]:border-primary text-slate-600 font-semibold transition-all duration-200 hover:text-slate-800 whitespace-nowrap"
              >
                <NavigationIcon className="h-4 w-4 flex-shrink-0" />
                <span className="hidden sm:inline">Mileage Calculator</span>
                <span className="sm:hidden">Calculator</span>
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="flex items-center justify-center gap-2 rounded-lg px-4 py-3 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-slate-900 data-[state=active]:border-b-2 data-[state=active]:border-primary text-slate-600 font-semibold transition-all duration-200 hover:text-slate-800 whitespace-nowrap"
              >
                <History className="h-4 w-4 flex-shrink-0" />
                <span className="hidden sm:inline">Recent Calculations</span>
                <span className="sm:hidden">Recent</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Calculator Tab */}
          <TabsContent value="calculator">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Left: Form (2/5 on desktop) */}
              <div className="lg:col-span-2">
                <MileageForm
                  onCalculate={handleCalculate}
                  isLoading={status === 'loading'}
                  error={error}
                />
              </div>

              {/* Right: Map + Results (3/5 on desktop) */}
              <div
                className="lg:col-span-3 space-y-5"
                role="region"
                aria-label="Calculation results"
                aria-live="polite"
              >
                <MileageMap calculation={currentCalculation} />

                {status === 'loading' ? (
                  <Card className="border-0 shadow-sm rounded-2xl bg-white/80">
                    <CardContent className="py-12">
                      <div className="flex flex-col items-center justify-center gap-4" role="status">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                        <p className="text-sm font-medium text-slate-500">
                          Calculating route...
                        </p>
                        <div className="w-full max-w-sm space-y-3">
                          <div className="h-3 bg-slate-100 rounded-full animate-pulse" />
                          <div className="h-3 bg-slate-100 rounded-full animate-pulse w-4/5" />
                          <div className="h-3 bg-slate-100 rounded-full animate-pulse w-3/5" />
                        </div>
                        <span className="sr-only">Loading calculation results</span>
                      </div>
                    </CardContent>
                  </Card>
                ) : currentCalculation ? (
                  <MileageResults calculation={currentCalculation} />
                ) : (
                  <Card className="border-0 shadow-sm rounded-2xl bg-white/80">
                    <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                      <div className="p-3 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full w-16 h-16 mb-4 flex items-center justify-center">
                        <NavigationIcon className="h-8 w-8 text-slate-400" />
                      </div>
                      <p className="text-base font-medium text-slate-600 mb-1">
                        No calculation yet
                      </p>
                      <p className="text-sm text-slate-400 max-w-xs">
                        Enter a pickup and drop-off address, then click
                        &quot;Calculate Mileage&quot; to see results
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            <Card className="border-0 shadow-lg rounded-3xl bg-white/80 backdrop-blur-sm">
              <CardHeader className="pb-6">
                <CardTitle className="text-2xl font-semibold text-slate-800 flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-primary to-amber-500 rounded-xl shadow-sm">
                    <History className="h-5 w-5 text-slate-900" />
                  </div>
                  Recent Calculations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {history.length > 0 ? (
                  <div className="space-y-4">
                    {history.map((calc, index) => (
                      <div
                        key={index}
                        className="border border-slate-200 rounded-2xl p-6 bg-gradient-to-r from-white to-slate-50 shadow-sm hover:shadow-md transition-shadow duration-200"
                      >
                        <div className="flex justify-between items-start">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 flex-1">
                            <div className="space-y-1">
                              <div className="text-sm font-medium text-slate-500">
                                Total Distance
                              </div>
                              <div className="text-xl font-bold text-amber-600">
                                {calc.totalDistanceMiles.toFixed(1)} mi
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="text-sm font-medium text-slate-500">
                                Drive Time
                              </div>
                              <div className="text-xl font-bold text-slate-800">
                                {formatDurationShort(calc.totalDurationMinutes)}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="text-sm font-medium text-slate-500">
                                Stops
                              </div>
                              <div className="text-xl font-bold text-amber-600">
                                {calc.dropoffs.length}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="text-sm font-medium text-slate-500">
                                Legs
                              </div>
                              <div className="text-xl font-bold text-slate-700">
                                {calc.legs.length}
                              </div>
                            </div>
                          </div>
                          <div className="text-sm text-slate-400 ml-6 bg-slate-100 px-3 py-1 rounded-full whitespace-nowrap">
                            {calc.calculatedAt.toLocaleString()}
                          </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-200">
                          <div className="flex flex-wrap gap-3 text-sm">
                            <span className="bg-amber-50 text-amber-800 px-3 py-1 rounded-full">
                              <strong>From:</strong>{' '}
                              {truncateAddress(calc.pickup.address)}
                            </span>
                            {calc.dropoffs.map((d, i) => (
                              <span
                                key={i}
                                className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full"
                              >
                                <strong>To{calc.dropoffs.length > 1 ? ` ${i + 1}` : ''}:</strong>{' '}
                                {truncateAddress(d.address)}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-slate-500 py-16">
                    <div className="p-4 bg-gradient-to-br from-amber-100 to-amber-200 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                      <Calculator className="h-12 w-12 text-amber-500" />
                    </div>
                    <p className="text-xl font-medium text-slate-600 mb-2">
                      No calculations yet
                    </p>
                    <p className="text-slate-500">
                      Switch to the Calculator tab to perform calculations
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function formatDurationShort(minutes: number): string {
  if (minutes < 1) return '< 1 min';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function truncateAddress(address: string, maxLen = 35): string {
  if (address.length <= maxLen) return address;
  return address.slice(0, maxLen) + '...';
}
