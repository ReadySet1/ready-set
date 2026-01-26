/**
 * RealtimeStatusIndicator
 *
 * A small visual indicator showing real-time connection status.
 * Displays a "Live" badge with a pulsing dot when connected,
 * or a "Connecting..." state when establishing connection.
 */

'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RealtimeStatusIndicatorProps {
  /**
   * Whether the real-time connection is active
   */
  isConnected: boolean;

  /**
   * Whether the connection is being established
   */
  isConnecting?: boolean;

  /**
   * Error message if connection failed
   */
  error?: string | null;

  /**
   * Optional callback when user clicks to reconnect
   */
  onReconnect?: () => void;

  /**
   * Size variant
   */
  size?: 'sm' | 'md';

  /**
   * Additional class names
   */
  className?: string;
}

export function RealtimeStatusIndicator({
  isConnected,
  isConnecting = false,
  error,
  onReconnect,
  size = 'sm',
  className,
}: RealtimeStatusIndicatorProps) {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
  };

  if (isConnecting) {
    return (
      <Badge
        variant="outline"
        className={cn(
          'border-blue-200 bg-blue-50 text-blue-700',
          sizeClasses[size],
          className
        )}
      >
        <Loader2 className={cn(iconSizes[size], 'mr-1 animate-spin')} />
        Connecting...
      </Badge>
    );
  }

  if (error) {
    return (
      <Badge
        variant="outline"
        className={cn(
          'cursor-pointer border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
          sizeClasses[size],
          className
        )}
        onClick={onReconnect}
        title={`Error: ${error}. Click to reconnect.`}
      >
        <WifiOff className={cn(iconSizes[size], 'mr-1')} />
        Offline
      </Badge>
    );
  }

  if (!isConnected) {
    return (
      <Badge
        variant="outline"
        className={cn(
          'cursor-pointer border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100',
          sizeClasses[size],
          className
        )}
        onClick={onReconnect}
        title="Click to connect"
      >
        <WifiOff className={cn(iconSizes[size], 'mr-1')} />
        Offline
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        'border-green-200 bg-green-50 text-green-700',
        sizeClasses[size],
        className
      )}
      title="Real-time updates active"
    >
      {/* Pulsing dot indicator */}
      <span className="relative mr-1.5 flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
      </span>
      Live
    </Badge>
  );
}

export default RealtimeStatusIndicator;
