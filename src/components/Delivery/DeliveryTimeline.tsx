'use client';

import React from 'react';
import {
  Package,
  UserCheck,
  Store,
  PackageCheck,
  Truck,
  MapPin,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatTimeForDisplay, formatDateTimeForDisplay } from '@/lib/utils/date-display';
import { DriverStatus } from '@/types/user';
import { getStatusIndex, STATUS_ORDER } from '@/lib/delivery-status-transitions';

/**
 * Timeline stage definition with timestamp and metadata
 */
interface TimelineStage {
  key: string;
  label: string;
  icon: React.ElementType;
  timestamp: Date | string | null | undefined;
  estimatedTime?: Date | string | null;
}

export interface DeliveryTimelineProps {
  /** When the order was created */
  createdAt: Date | string | null | undefined;
  /** When a driver was assigned */
  assignedAt?: Date | string | null;
  /** When the driver arrived at the vendor */
  arrivedAtVendorAt?: Date | string | null;
  /** When the driver picked up the order */
  pickedUpAt?: Date | string | null;
  /** When the driver started en route to client */
  enRouteAt?: Date | string | null;
  /** When the driver arrived at the client */
  arrivedAtClientAt?: Date | string | null;
  /** When the delivery was completed */
  deliveredAt?: Date | string | null;
  /** Estimated pickup time for comparison */
  estimatedPickupTime?: Date | string | null;
  /** Estimated delivery time for comparison */
  estimatedDeliveryTime?: Date | string | null;
  /** Current delivery status */
  currentStatus?: DriverStatus | string | null;
  /** Compact mode for smaller layouts */
  compact?: boolean;
}

/**
 * Calculates duration between two timestamps in a human-readable format
 */
function getDuration(
  start: Date | string | null | undefined,
  end: Date | string | null | undefined
): string | null {
  if (!start || !end) return null;

  const startDate = typeof start === 'string' ? new Date(start) : start;
  const endDate = typeof end === 'string' ? new Date(end) : end;
  const diffMs = endDate.getTime() - startDate.getTime();

  if (diffMs < 0) return null;

  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '<1 min';
  if (diffMin < 60) return `${diffMin} min`;

  const hours = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Checks if actual time exceeds estimated time (delivery is late)
 */
function isLate(
  actual: Date | string | null | undefined,
  estimated: Date | string | null | undefined
): boolean {
  if (!actual || !estimated) return false;

  const actualDate = typeof actual === 'string' ? new Date(actual) : actual;
  const estimatedDate = typeof estimated === 'string' ? new Date(estimated) : estimated;

  return actualDate.getTime() > estimatedDate.getTime();
}

/**
 * Delivery Timeline component showing all stages of the delivery lifecycle
 * as a vertical stepper with timestamps, durations, and status indicators.
 */
export function DeliveryTimeline({
  createdAt,
  assignedAt,
  arrivedAtVendorAt,
  pickedUpAt,
  enRouteAt,
  arrivedAtClientAt,
  deliveredAt,
  estimatedPickupTime,
  estimatedDeliveryTime,
  currentStatus,
  compact = false,
}: DeliveryTimelineProps) {
  const stages: TimelineStage[] = [
    { key: 'created', label: 'Order Placed', icon: Package, timestamp: createdAt },
    { key: 'assigned', label: 'Driver Assigned', icon: UserCheck, timestamp: assignedAt },
    { key: 'at_vendor', label: 'Arrived at Vendor', icon: Store, timestamp: arrivedAtVendorAt },
    {
      key: 'picked_up',
      label: 'Pickup Completed',
      icon: PackageCheck,
      timestamp: pickedUpAt,
      estimatedTime: estimatedPickupTime,
    },
    { key: 'en_route', label: 'En Route to Client', icon: Truck, timestamp: enRouteAt },
    { key: 'arrived', label: 'Arrived at Client', icon: MapPin, timestamp: arrivedAtClientAt },
    {
      key: 'delivered',
      label: 'Delivered',
      icon: CheckCircle2,
      timestamp: deliveredAt,
      estimatedTime: estimatedDeliveryTime,
    },
  ];

  // Determine which stage is currently active based on status
  const currentStatusIndex = getStatusIndex(currentStatus);

  // Map STATUS_ORDER index to stage index (stages include 'created' at index 0)
  // STATUS_ORDER: ASSIGNED(0), ARRIVED_AT_VENDOR(1), EN_ROUTE(2), ARRIVED(3), COMPLETED(4)
  // stages:       created(0), assigned(1), at_vendor(2), picked_up(3), en_route(4), arrived(5), delivered(6)
  const statusToStageMap: Record<number, number> = {
    0: 1, // ASSIGNED -> assigned stage
    1: 2, // ARRIVED_AT_VENDOR -> at_vendor stage
    2: 4, // EN_ROUTE_TO_CLIENT -> en_route stage
    3: 5, // ARRIVED_TO_CLIENT -> arrived stage
    4: 6, // COMPLETED -> delivered stage
  };

  const activeStageIndex = currentStatusIndex >= 0 ? (statusToStageMap[currentStatusIndex] ?? -1) : -1;

  return (
    <div className={cn('relative', compact ? 'space-y-0' : 'space-y-0')}>
      {stages.map((stage, index) => {
        const isCompleted = !!stage.timestamp;
        const isCurrent = index === activeStageIndex && !deliveredAt;
        const isPending = !isCompleted && !isCurrent;
        const prevStage = index > 0 ? stages[index - 1] : null;
        const duration = prevStage ? getDuration(prevStage.timestamp, stage.timestamp) : null;
        const latePickup = stage.key === 'picked_up' && isLate(stage.timestamp, stage.estimatedTime);
        const lateDelivery = stage.key === 'delivered' && isLate(stage.timestamp, stage.estimatedTime);
        const isLateStage = latePickup || lateDelivery;

        const Icon = stage.icon;

        return (
          <div key={stage.key} className="relative flex gap-3">
            {/* Vertical line connector */}
            <div className="flex flex-col items-center">
              {/* Icon circle */}
              <div
                className={cn(
                  'relative z-10 flex items-center justify-center rounded-full border-2',
                  compact ? 'h-7 w-7' : 'h-9 w-9',
                  isCompleted && !isLateStage &&
                    'border-green-500 bg-green-50 text-green-600 dark:border-green-400 dark:bg-green-950 dark:text-green-400',
                  isCompleted && isLateStage &&
                    'border-amber-500 bg-amber-50 text-amber-600 dark:border-amber-400 dark:bg-amber-950 dark:text-amber-400',
                  isCurrent &&
                    'border-blue-500 bg-blue-50 text-blue-600 animate-pulse dark:border-blue-400 dark:bg-blue-950 dark:text-blue-400',
                  isPending &&
                    'border-gray-300 bg-gray-50 text-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-500'
                )}
              >
                <Icon className={cn(compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
              </div>

              {/* Connector line (not after last item) */}
              {index < stages.length - 1 && (
                <div
                  className={cn(
                    'w-0.5 flex-1',
                    compact ? 'min-h-[20px]' : 'min-h-[28px]',
                    isCompleted
                      ? 'bg-green-300 dark:bg-green-700'
                      : 'bg-gray-200 dark:bg-gray-700'
                  )}
                />
              )}
            </div>

            {/* Stage content */}
            <div className={cn('flex-1 pb-4', compact && 'pb-2')}>
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={cn(
                    'font-medium',
                    compact ? 'text-xs' : 'text-sm',
                    isCompleted && 'text-foreground',
                    isCurrent && 'text-blue-700 dark:text-blue-300',
                    isPending && 'text-muted-foreground'
                  )}
                >
                  {stage.label}
                </span>

                {isCompleted && (
                  <span className={cn('text-muted-foreground', compact ? 'text-[10px]' : 'text-xs')}>
                    {formatTimeForDisplay(stage.timestamp)}
                  </span>
                )}

                {isCurrent && (
                  <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                    In progress
                  </span>
                )}
              </div>

              {/* Duration between stages */}
              {duration && !compact && (
                <div className="flex items-center gap-1 mt-0.5">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{duration}</span>
                </div>
              )}

              {/* Estimated vs actual comparison */}
              {isCompleted && stage.estimatedTime && !compact && (
                <div className={cn(
                  'flex items-center gap-1 mt-0.5',
                  isLateStage ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'
                )}>
                  {isLateStage ? (
                    <AlertTriangle className="h-3 w-3" />
                  ) : (
                    <Clock className="h-3 w-3" />
                  )}
                  <span className="text-xs">
                    Est. {formatTimeForDisplay(stage.estimatedTime)}
                    {isLateStage && ' (late)'}
                  </span>
                </div>
              )}

              {/* Full date for first and last stages when not compact */}
              {isCompleted && (stage.key === 'created' || stage.key === 'delivered') && !compact && (
                <span className="text-[10px] text-muted-foreground">
                  {formatDateTimeForDisplay(stage.timestamp, 'MMM d, yyyy')}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default DeliveryTimeline;
