/**
 * CostEstimatorCard - Delivery cost estimator for vendor order forms
 * Uses Ready Set flat rate pricing to estimate delivery costs
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Calculator, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { calculateDeliveryCost, DeliveryCostBreakdown } from '@/lib/calculator/delivery-cost-calculator';

interface CostEstimatorCardProps {
  /** Number of guests/headcount for the order */
  headcount: number;
  /** Callback when estimated cost changes - can be used to auto-fill order total */
  onEstimatedCostChange?: (cost: number) => void;
  /** Optional class name for styling */
  className?: string;
}

interface EstimateResult {
  breakdown: DeliveryCostBreakdown;
  isWithin10Miles: boolean;
}

export function CostEstimatorCard({
  headcount,
  onEstimatedCostChange,
  className = '',
}: CostEstimatorCardProps) {
  const [distance, setDistance] = useState<string>('');
  const [estimate, setEstimate] = useState<EstimateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  // Calculate estimate when inputs change
  const calculateEstimate = useCallback(() => {
    const distanceNum = parseFloat(distance);

    // Validate inputs
    if (!headcount || headcount <= 0) {
      setEstimate(null);
      setError(null);
      return;
    }

    if (!distance || isNaN(distanceNum) || distanceNum < 0) {
      setEstimate(null);
      setError(null);
      return;
    }

    try {
      // Use Ready Set Food Standard configuration
      const breakdown = calculateDeliveryCost({
        headcount,
        foodCost: 0, // We use headcount-only for vendor estimates
        totalMileage: distanceNum,
        numberOfDrives: 1,
        clientConfigId: 'ready-set-food-standard',
      });

      const result: EstimateResult = {
        breakdown,
        isWithin10Miles: distanceNum <= 10,
      };

      setEstimate(result);
      setError(null);

      // Notify parent of new estimate
      if (onEstimatedCostChange) {
        onEstimatedCostChange(breakdown.deliveryFee);
      }
    } catch (err) {
      console.error('Cost estimation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to calculate estimate');
      setEstimate(null);
    }
  }, [headcount, distance, onEstimatedCostChange]);

  // Debounce calculation
  useEffect(() => {
    const timer = setTimeout(calculateEstimate, 300);
    return () => clearTimeout(timer);
  }, [calculateEstimate]);

  const handleApplyToOrderTotal = () => {
    if (estimate && onEstimatedCostChange) {
      onEstimatedCostChange(estimate.breakdown.deliveryFee);
    }
  };

  const formatCurrency = (value: number): string => {
    return value.toFixed(2);
  };

  return (
    <div className={`rounded-lg border border-blue-200 bg-blue-50 ${className}`}>
      {/* Header - Collapsible */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-blue-100 p-2">
            <Calculator className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-blue-900">Delivery Cost Estimator</h3>
            <p className="text-xs text-blue-600">Ready Set flat rate pricing</p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-blue-600" />
        ) : (
          <ChevronDown className="h-5 w-5 text-blue-600" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-blue-200 p-4">
          {/* Distance Input */}
          <div className="mb-4">
            <label
              htmlFor="estimator-distance"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Delivery Distance (miles)
            </label>
            <input
              id="estimator-distance"
              type="number"
              min="0"
              step="0.1"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              placeholder="Enter estimated distance"
              className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Tip: Use Google Maps to check distance between pickup and delivery locations
            </p>
          </div>

          {/* Status Messages */}
          {!headcount || headcount <= 0 ? (
            <div className="flex items-center gap-2 rounded-md bg-gray-100 p-3 text-sm text-gray-600">
              <Info className="h-4 w-4" />
              Enter headcount above to see delivery estimate
            </div>
          ) : !distance ? (
            <div className="flex items-center gap-2 rounded-md bg-gray-100 p-3 text-sm text-gray-600">
              <Info className="h-4 w-4" />
              Enter delivery distance to calculate estimate
            </div>
          ) : error ? (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : estimate ? (
            <div className="space-y-3">
              {/* Breakdown */}
              <div className="rounded-md bg-white p-3">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">
                      Base Delivery Fee ({headcount} headcount)
                    </span>
                    <span className="font-medium">
                      ${formatCurrency(estimate.breakdown.deliveryCost)}
                    </span>
                  </div>

                  {estimate.breakdown.totalMileagePay > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">
                        Mileage ({parseFloat(distance) - 10} mi × $3.00)
                      </span>
                      <span className="font-medium">
                        ${formatCurrency(estimate.breakdown.totalMileagePay)}
                      </span>
                    </div>
                  )}

                  {estimate.breakdown.bridgeToll > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Bridge Toll</span>
                      <span className="font-medium">
                        ${formatCurrency(estimate.breakdown.bridgeToll)}
                      </span>
                    </div>
                  )}

                  <div className="border-t border-gray-200 pt-2">
                    <div className="flex justify-between text-base font-semibold">
                      <span className="text-gray-900">Estimated Total</span>
                      <span className="text-blue-600">
                        ${formatCurrency(estimate.breakdown.deliveryFee)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Apply Button */}
              {onEstimatedCostChange && (
                <button
                  type="button"
                  onClick={handleApplyToOrderTotal}
                  className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Apply to Order Total
                </button>
              )}

              {/* Disclaimer */}
              <p className="flex items-start gap-1 text-xs text-gray-500">
                <Info className="mt-0.5 h-3 w-3 flex-shrink-0" />
                This is an estimate based on Ready Set flat rate pricing. Final cost may vary
                based on actual distance and order details.
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default CostEstimatorCard;
