'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  NavigationIcon,
  SignalIcon,
  WifiOffIcon,
  ClockIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDriverTracking } from '@/contexts/DriverTrackingContext';

/**
 * Floating tracking indicator that appears on all driver pages (except /driver/tracking)
 * Shows current tracking status and provides quick access to the tracking page
 */
export function DriverTrackingIndicator() {
  const pathname = usePathname();
  const {
    isTracking,
    isShiftActive,
    currentShift,
    accuracy,
    isOnline,
    isRealtimeConnected,
  } = useDriverTracking();

  // Don't show on the tracking page itself
  if (pathname === '/driver/tracking') {
    return null;
  }

  // Don't show if no active shift
  if (!isShiftActive) {
    return null;
  }

  // Calculate shift duration
  const getShiftDuration = () => {
    if (!currentShift?.startTime) return '0:00';
    const start = new Date(currentShift.startTime);
    const now = new Date();
    const diff = now.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-auto">
      <Button
        variant="default"
        className={cn(
          'w-full md:w-auto shadow-lg rounded-full px-4 py-6 flex items-center gap-3',
          isTracking ? 'bg-green-600 hover:bg-green-700' : 'bg-yellow-600 hover:bg-yellow-700'
        )}
        asChild
      >
        <Link href="/driver/tracking">
          {/* Tracking Status Icon */}
          <div className="relative">
            <NavigationIcon className={cn(
              'w-5 h-5',
              isTracking && 'animate-pulse'
            )} />
            {!isOnline && (
              <WifiOffIcon className="w-3 h-3 absolute -top-1 -right-1 text-red-300" />
            )}
          </div>

          {/* Status Info */}
          <div className="flex flex-col items-start text-left">
            <span className="text-sm font-medium">
              {isTracking ? 'Tracking Active' : 'Shift Active'}
            </span>
            <div className="flex items-center gap-2 text-xs opacity-90">
              <span className="flex items-center gap-1">
                <ClockIcon className="w-3 h-3" />
                {getShiftDuration()}
              </span>
              {accuracy && (
                <span className="flex items-center gap-1">
                  <SignalIcon className="w-3 h-3" />
                  {Math.round(accuracy)}m
                </span>
              )}
            </div>
          </div>

          {/* Connection Status Badge */}
          <Badge
            variant="secondary"
            className={cn(
              'ml-2 text-xs',
              isRealtimeConnected ? 'bg-green-500/20 text-green-100' : 'bg-yellow-500/20 text-yellow-100'
            )}
          >
            {isRealtimeConnected ? 'Live' : 'REST'}
          </Badge>
        </Link>
      </Button>
    </div>
  );
}

export default DriverTrackingIndicator;
