'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { STATUS_ORDER, STATUS_LABELS, getStatusIndex } from '@/lib/delivery-status-transitions';
import type { DriverStatus } from '@/types/user';

interface DeliveryStepperProps {
  currentStatus: DriverStatus | string | null | undefined;
  timestamps?: Record<string, string | null | undefined>;
  compact?: boolean;
}

const STEP_LABELS: Record<string, string> = {
  ...STATUS_LABELS,
  COMPLETED: 'Delivered',
};

/**
 * Vertical 7-step stepper showing delivery progress.
 * Brand yellow (#FBD113) for completed/current steps, gray for future.
 */
export function DeliveryStepper({ currentStatus, compact = false }: DeliveryStepperProps) {
  const currentIndex = getStatusIndex(currentStatus);
  // Treat null driverStatus as ASSIGNED (index 0)
  const activeIndex = currentIndex === -1 ? 0 : currentIndex;

  return (
    <div className="flex flex-col" role="list" aria-label="Delivery progress">
      {STATUS_ORDER.map((status, index) => {
        const isCompleted = index < activeIndex;
        const isCurrent = index === activeIndex;
        const isFuture = index > activeIndex;
        const label = STEP_LABELS[status] || status;

        return (
          <div key={status} className="flex items-stretch" role="listitem">
            {/* Dot + connector */}
            <div className="flex flex-col items-center mr-3">
              <div
                className={cn(
                  'rounded-full border-2 flex-shrink-0 transition-all',
                  compact ? 'w-3 h-3' : 'w-4 h-4',
                  isCompleted && 'bg-[#FBD113] border-[#FBD113]',
                  isCurrent && 'bg-[#FBD113] border-[#FBD113] ring-4 ring-[#FBD113]/30 animate-pulse',
                  isFuture && 'bg-white border-gray-300',
                )}
              />
              {index < STATUS_ORDER.length - 1 && (
                <div
                  className={cn(
                    'w-0.5 flex-1',
                    compact ? 'min-h-[16px]' : 'min-h-[24px]',
                    index < activeIndex ? 'bg-[#FBD113]' : 'bg-gray-200',
                  )}
                />
              )}
            </div>

            {/* Label */}
            <div className={cn('pb-2', compact && 'pb-1')}>
              <span
                className={cn(
                  'font-medium leading-none',
                  compact ? 'text-xs' : 'text-sm',
                  isCompleted && 'text-gray-900',
                  isCurrent && 'text-gray-900 font-bold',
                  isFuture && 'text-gray-400',
                )}
              >
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
