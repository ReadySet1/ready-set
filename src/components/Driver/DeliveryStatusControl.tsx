'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ChevronRight, CheckCircle2 } from 'lucide-react';
import { DriverStatus } from '@/types/user';
import {
  getStatusLabel,
  getNextActionLabel,
  getNextStatus,
  canAdvanceStatus,
  getStatusProgress,
  isDeliveryCompleted,
} from '@/lib/delivery-status-transitions';
import { cn } from '@/lib/utils';

export interface DeliveryStatusControlProps {
  deliveryId: string;
  orderNumber: string;
  orderType: 'catering' | 'on_demand';
  currentStatus: DriverStatus | string | null | undefined;
  onStatusChange: (newStatus: DriverStatus) => Promise<void>;
  onPODRequest?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  compact?: boolean;
}

/**
 * Mobile-friendly inline status control for driver deliveries
 * Shows current status and a button to advance to the next status
 */
export function DeliveryStatusControl({
  deliveryId,
  orderNumber,
  orderType,
  currentStatus,
  onStatusChange,
  onPODRequest,
  isLoading = false,
  disabled = false,
  compact = false,
}: DeliveryStatusControlProps) {
  const nextStatus = getNextStatus(currentStatus);
  const canAdvance = canAdvanceStatus(currentStatus);
  const isCompleted = isDeliveryCompleted(currentStatus);
  const progress = getStatusProgress(currentStatus);

  const handleAdvance = async () => {
    if (!nextStatus || isLoading || disabled) return;

    // If advancing to COMPLETED and POD handler exists, trigger it first
    if (nextStatus === DriverStatus.COMPLETED && onPODRequest) {
      onPODRequest();
      return;
    }

    await onStatusChange(nextStatus);
  };

  // Status badge color based on progress
  const getBadgeVariant = (): 'default' | 'secondary' | 'outline' | 'destructive' => {
    if (isCompleted) return 'default';
    if (progress >= 50) return 'secondary';
    return 'outline';
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant={getBadgeVariant()} className="text-xs">
          {getStatusLabel(currentStatus)}
        </Badge>
        {canAdvance && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleAdvance}
            disabled={isLoading || disabled}
            className="h-7 px-2 text-xs"
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                {getNextActionLabel(currentStatus)}
                <ChevronRight className="ml-1 h-3 w-3" />
              </>
            )}
          </Button>
        )}
        {isCompleted && (
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Progress indicator */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full transition-all duration-300 rounded-full',
              isCompleted ? 'bg-green-500' : 'bg-blue-500'
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground">{progress}%</span>
      </div>

      {/* Status and action */}
      <div className="flex items-center justify-between gap-2">
        <Badge variant={getBadgeVariant()} className="font-medium">
          {getStatusLabel(currentStatus)}
        </Badge>

        {canAdvance ? (
          <Button
            size="sm"
            onClick={handleAdvance}
            disabled={isLoading || disabled}
            className="min-w-[100px]"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                {getNextActionLabel(currentStatus)}
                <ChevronRight className="ml-1 h-4 w-4" />
              </>
            )}
          </Button>
        ) : (
          <div className="flex items-center gap-1 text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm font-medium">Done</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default DeliveryStatusControl;
