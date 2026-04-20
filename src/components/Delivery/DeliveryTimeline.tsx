'use client';

import React, { useState } from 'react';
import {
  Package,
  Store,
  PackageCheck,
  Truck,
  MapPin,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatTimeForDisplay, formatDateTimeForDisplay } from '@/lib/utils/date-display';
import { DriverStatus } from '@/types/order';
import { getStatusIndex, STATUS_ORDER } from '@/lib/delivery-status-transitions';

interface TimelineStage {
  key: string;
  label: string;
  icon: React.ElementType;
  timestamp: Date | string | null | undefined;
  estimatedTime?: Date | string | null;
  /** The DriverStatus enum value this stage maps to (null for 'created' which has no driver status) */
  driverStatus: DriverStatus | null;
}

export interface DeliveryTimelineProps {
  /** When the order was created */
  createdAt: Date | string | null | undefined;
  /** When the driver started en route to vendor */
  enRouteToVendorAt?: Date | string | null;
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
  /** Whether the user can click timeline steps to update driver status (driver, helpdesk, admin only) */
  canUpdateStatus?: boolean;
  /** Callback fired when the user clicks a timeline step to advance driver status */
  onStatusUpdate?: (newStatus: DriverStatus) => Promise<void>;
}

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
 *
 * When `canUpdateStatus` is true and `onStatusUpdate` is provided, each
 * pending step that is the immediate next step becomes clickable, allowing
 * drivers / helpdesk / admins to advance the delivery status.
 */
export function DeliveryTimeline({
  createdAt,
  enRouteToVendorAt,
  arrivedAtVendorAt,
  pickedUpAt,
  enRouteAt,
  arrivedAtClientAt,
  deliveredAt,
  estimatedPickupTime,
  estimatedDeliveryTime,
  currentStatus,
  compact = false,
  canUpdateStatus = false,
  onStatusUpdate,
}: DeliveryTimelineProps) {
  const [updatingStatus, setUpdatingStatus] = useState<DriverStatus | null>(null);

  const stages: TimelineStage[] = [
    { key: 'created', label: 'Order Placed', icon: Package, timestamp: createdAt, driverStatus: null },
    { key: 'en_route_vendor', label: 'En Route to Resto', icon: Truck, timestamp: enRouteToVendorAt, driverStatus: DriverStatus.EN_ROUTE_TO_VENDOR },
    { key: 'at_vendor', label: 'Arrived at Vendor', icon: Store, timestamp: arrivedAtVendorAt, driverStatus: DriverStatus.ARRIVED_AT_VENDOR },
    {
      key: 'picked_up',
      label: 'Pickup Completed',
      icon: PackageCheck,
      timestamp: pickedUpAt,
      estimatedTime: estimatedPickupTime,
      driverStatus: DriverStatus.PICKED_UP,
    },
    { key: 'en_route', label: 'En Route to Client', icon: Truck, timestamp: enRouteAt, driverStatus: DriverStatus.EN_ROUTE_TO_CLIENT },
    { key: 'arrived', label: 'Arrived at Client', icon: MapPin, timestamp: arrivedAtClientAt, driverStatus: DriverStatus.ARRIVED_TO_CLIENT },
    {
      key: 'delivered',
      label: 'Delivered',
      icon: CheckCircle2,
      timestamp: deliveredAt,
      estimatedTime: estimatedDeliveryTime,
      driverStatus: DriverStatus.COMPLETED,
    },
  ];

  const currentStatusIndex = getStatusIndex(currentStatus);

  // Map STATUS_ORDER index to stage index.
  // ASSIGNED has no dedicated UI stage (it's implicit), so it maps to the "created" row.
  // STATUS_ORDER: ASSIGNED(0), EN_ROUTE_TO_VENDOR(1), ARRIVED_AT_VENDOR(2), PICKED_UP(3), EN_ROUTE(4), ARRIVED(5), COMPLETED(6)
  // stages:       created(0), en_route_vendor(1), at_vendor(2), picked_up(3), en_route(4), arrived(5), delivered(6)
  const statusToStageMap: Record<number, number> = {
    0: 0,
    1: 1,
    2: 2,
    3: 3,
    4: 4,
    5: 5,
    6: 6,
  };

  const activeStageIndex = currentStatusIndex >= 0 ? (statusToStageMap[currentStatusIndex] ?? -1) : -1;

  const handleStageClick = async (stage: TimelineStage) => {
    if (!canUpdateStatus || !onStatusUpdate || !stage.driverStatus || updatingStatus) return;

    setUpdatingStatus(stage.driverStatus);
    try {
      await onStatusUpdate(stage.driverStatus);
    } finally {
      setUpdatingStatus(null);
    }
  };

  return (
    <div className={cn('relative', compact ? 'space-y-0' : 'space-y-0')}>
      {stages.map((stage, index) => {
        const hasTimestamp = !!stage.timestamp;
        // A stage is completed if it has a timestamp OR if the current driver
        // status is at or past this stage (the API already recorded the event).
        const isCompleted = hasTimestamp || index <= activeStageIndex;
        // "Next step" = the immediate next stage after the last completed one.
        // This is where the delivery is heading and should be the primary click target.
        // Only applies when there is an active driver status (activeStageIndex >= 0).
        const isNextStep = activeStageIndex >= 0 && !isCompleted && !deliveredAt && index === activeStageIndex + 1;
        const isPending = !isCompleted && !isNextStep;
        const prevStage = index > 0 ? stages[index - 1] : null;
        const duration = prevStage ? getDuration(prevStage.timestamp, stage.timestamp) : null;
        const latePickup = stage.key === 'picked_up' && isLate(stage.timestamp, stage.estimatedTime);
        const lateDelivery = stage.key === 'delivered' && isLate(stage.timestamp, stage.estimatedTime);
        const isLateStage = latePickup || lateDelivery;

        // A stage is clickable when the user has permission and this stage
        // is any uncompleted step that comes after the current active status.
        const isClickable =
          canUpdateStatus &&
          !!onStatusUpdate &&
          !!stage.driverStatus &&
          !isCompleted &&
          !deliveredAt &&
          index > activeStageIndex;
        const isUpdating = updatingStatus !== null && updatingStatus === stage.driverStatus;

        const Icon = stage.icon;

        return (
          <div
            key={stage.key}
            className={cn(
              'relative flex gap-3',
              isClickable && 'group cursor-pointer',
            )}
            onClick={isClickable ? () => handleStageClick(stage) : undefined}
            role={isClickable ? 'button' : undefined}
            tabIndex={isClickable ? 0 : undefined}
            onKeyDown={isClickable ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleStageClick(stage);
              }
            } : undefined}
            aria-label={isClickable ? `Update status to ${stage.label}` : undefined}
          >
            {/* Vertical line connector */}
            <div className="flex flex-col items-center">
              {/* Icon circle */}
              <div
                className={cn(
                  'relative z-10 flex items-center justify-center rounded-full border-2 transition-all duration-200',
                  compact ? 'h-7 w-7' : 'h-9 w-9',
                  isCompleted && !isLateStage &&
                    'border-green-500 bg-green-50 text-green-600 dark:border-green-400 dark:bg-green-950 dark:text-green-400',
                  isCompleted && isLateStage &&
                    'border-amber-500 bg-amber-50 text-amber-600 dark:border-amber-400 dark:bg-amber-950 dark:text-amber-400',
                  isPending && !isClickable &&
                    'border-gray-300 bg-gray-50 text-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-500',
                  isClickable && !isUpdating && isNextStep &&
                    'border-blue-400 bg-blue-50 text-blue-500 ring-2 ring-blue-200 animate-pulse group-hover:border-blue-600 group-hover:bg-blue-100 group-hover:text-blue-700 group-hover:ring-blue-300 group-hover:scale-110 dark:border-blue-500 dark:ring-blue-800 dark:group-hover:border-blue-400',
                  isClickable && !isUpdating && !isNextStep &&
                    'border-gray-300 bg-gray-50 text-gray-400 group-hover:border-blue-400 group-hover:bg-blue-50 group-hover:text-blue-500 group-hover:ring-2 group-hover:ring-blue-200 group-hover:scale-110 dark:border-gray-600 dark:group-hover:border-blue-500',
                  isUpdating &&
                    'border-blue-400 bg-blue-100 text-blue-600',
                )}
              >
                {isUpdating ? (
                  <Loader2 className={cn(compact ? 'h-3.5 w-3.5' : 'h-4 w-4', 'animate-spin')} />
                ) : (
                  <Icon className={cn(compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
                )}
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
                    'font-medium transition-colors duration-200',
                    compact ? 'text-xs' : 'text-sm',
                    isCompleted && 'text-foreground',
                    isPending && !isClickable && 'text-muted-foreground',
                    isClickable && isNextStep && 'text-blue-600 group-hover:text-blue-800 dark:text-blue-400 dark:group-hover:text-blue-200',
                    isClickable && !isNextStep && 'text-muted-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400',
                  )}
                >
                  {stage.label}
                </span>

                {isCompleted && hasTimestamp && (
                  <span className={cn('text-muted-foreground', compact ? 'text-[10px]' : 'text-xs')}>
                    {formatTimeForDisplay(stage.timestamp)}
                  </span>
                )}

                {isNextStep && !isClickable && (
                  <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                    In progress
                  </span>
                )}

                {isClickable && !isUpdating && isNextStep && (
                  <span className="text-[10px] font-medium text-blue-500">
                    Click to update
                  </span>
                )}

                {isClickable && !isUpdating && !isNextStep && (
                  <span className="text-[10px] font-medium text-blue-500 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    Click to update
                  </span>
                )}

                {isUpdating && (
                  <span className="text-[10px] font-medium text-blue-600">
                    Updating...
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
