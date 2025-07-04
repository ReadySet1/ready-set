'use client';

import React, { useState, useEffect } from 'react';
import { useDebouncedPricingCalculation } from '@/hooks/usePricing';
import type { PricingCalculation } from '@/types/pricing';

interface PricingCalculatorProps {
  /** Initial head count value */
  initialHeadCount?: number;
  /** Initial food cost value */
  initialFoodCost?: number;
  /** Initial tip status */
  initialHasTip?: boolean;
  /** Called when pricing calculation changes */
  onPricingCalculated?: (calculation: PricingCalculation | null) => void;
  /** Whether to show the input fields or just display calculation */
  showInputs?: boolean;
  /** Custom CSS classes */
  className?: string;
  /** Custom styles for different parts */
  styles?: {
    container?: string;
    inputGroup?: string;
    input?: string;
    label?: string;
    calculation?: string;
    discount?: string;
    finalPrice?: string;
    loading?: string;
    error?: string;
  };
}

export function PricingCalculator({
  initialHeadCount = 0,
  initialFoodCost = 0,
  initialHasTip = false,
  onPricingCalculated,
  showInputs = true,
  className = '',
  styles = {},
}: PricingCalculatorProps) {
  const [headCount, setHeadCount] = useState(initialHeadCount);
  const [foodCost, setFoodCost] = useState(initialFoodCost);
  const [hasTip, setHasTip] = useState(initialHasTip);

  // Use debounced pricing calculation to avoid too many API calls
  const { data: calculation, loading, error } = useDebouncedPricingCalculation(
    headCount,
    foodCost,
    hasTip,
    500 // 500ms debounce
  );

  // Notify parent component when calculation changes
  useEffect(() => {
    if (onPricingCalculated) {
      onPricingCalculated(calculation);
    }
  }, [calculation, onPricingCalculated]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatPercentage = (percentage: number) => {
    return `${percentage}%`;
  };

  return (
    <div className={`pricing-calculator ${className} ${styles.container || ''}`}>
      {showInputs && (
        <div className="pricing-inputs space-y-4">
          {/* Head Count Input */}
          <div className={`input-group ${styles.inputGroup || ''}`}>
            <label 
              htmlFor="headCount" 
              className={`block text-sm font-medium text-gray-700 mb-1 ${styles.label || ''}`}
            >
              Head Count
            </label>
            <input
              id="headCount"
              type="number"
              min="1"
              value={headCount || ''}
              onChange={(e) => setHeadCount(parseInt(e.target.value) || 0)}
              placeholder="Enter number of people"
              className={`
                w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm 
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                ${styles.input || ''}
              `}
            />
          </div>

          {/* Food Cost Input */}
          <div className={`input-group ${styles.inputGroup || ''}`}>
            <label 
              htmlFor="foodCost" 
              className={`block text-sm font-medium text-gray-700 mb-1 ${styles.label || ''}`}
            >
              Food Cost
            </label>
            <input
              id="foodCost"
              type="number"
              min="0"
              step="0.01"
              value={foodCost || ''}
              onChange={(e) => setFoodCost(parseFloat(e.target.value) || 0)}
              placeholder="Enter food cost"
              className={`
                w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm 
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                ${styles.input || ''}
              `}
            />
          </div>

          {/* Tip Toggle */}
          <div className={`input-group ${styles.inputGroup || ''}`}>
            <label className={`flex items-center cursor-pointer ${styles.label || ''}`}>
              <input
                type="checkbox"
                checked={hasTip}
                onChange={(e) => setHasTip(e.target.checked)}
                className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-sm font-medium text-gray-700">
                Includes Tip
              </span>
            </label>
          </div>
        </div>
      )}

      {/* Calculation Results */}
      <div className={`pricing-results mt-6 ${styles.calculation || ''}`}>
        {loading && (
          <div className={`text-center py-4 ${styles.loading || ''}`}>
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Calculating pricing...</span>
          </div>
        )}

        {error && (
          <div className={`bg-red-50 border border-red-200 rounded-md p-4 ${styles.error || ''}`}>
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Pricing Error</h3>
                <p className="text-sm text-red-700 mt-1">{error.message}</p>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && calculation && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Pricing Details</h3>
            
            <div className="space-y-3">
              {/* Base Price */}
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Food Cost:</span>
                <span className="font-medium text-gray-900">
                  {formatCurrency(calculation.basePrice)}
                </span>
              </div>

              {/* Applied Tier Info */}
              {calculation.appliedTier && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Applied Tier:</span>
                  <span className="text-sm text-blue-600">
                    {calculation.calculationDetails?.tierName || 'Custom Tier'}
                  </span>
                </div>
              )}

              {/* Applied Rate */}
              {calculation.calculationDetails?.appliedRate && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Applied Rate:</span>
                  <span className="text-sm text-gray-700">
                    {calculation.calculationDetails.isPercentageBased 
                      ? formatPercentage(calculation.calculationDetails.appliedRate)
                      : formatCurrency(calculation.calculationDetails.appliedRate)
                    }
                  </span>
                </div>
              )}

              {/* Discount */}
              {calculation.discount > 0 && (
                <div className={`flex justify-between items-center ${styles.discount || ''}`}>
                  <span className="text-green-600 font-medium">Discount:</span>
                  <span className="font-medium text-green-600">
                    -{formatCurrency(calculation.discount)}
                  </span>
                </div>
              )}

              {/* Final Price */}
              <div className={`flex justify-between items-center pt-3 border-t border-gray-200 ${styles.finalPrice || ''}`}>
                <span className="text-lg font-semibold text-gray-900">Final Price:</span>
                <span className="text-xl font-bold text-blue-600">
                  {formatCurrency(calculation.finalPrice)}
                </span>
              </div>

              {/* Tip Status */}
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Pricing includes tip:</span>
                <span className={`font-medium ${calculation.hasTip ? 'text-green-600' : 'text-gray-600'}`}>
                  {calculation.hasTip ? 'Yes' : 'No'}
                </span>
              </div>
            </div>

            {/* Additional Information */}
            {calculation.calculationDetails?.isPercentageBased && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> This order qualifies for percentage-based pricing 
                  ({formatPercentage(calculation.calculationDetails.appliedRate || 0)} of food cost).
                </p>
              </div>
            )}
          </div>
        )}

        {/* No Calculation Available */}
        {!loading && !error && !calculation && headCount > 0 && foodCost > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">No Pricing Available</h3>
                <p className="text-sm text-yellow-700 mt-1">
                  No pricing tier matches the current head count and food cost. Standard pricing applies.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PricingCalculator; 