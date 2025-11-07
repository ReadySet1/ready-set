'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  NavigationIcon,
  ClockIcon,
  MapPinIcon,
  TruckIcon,
  BatteryIcon,
  SignalIcon,
  PlayIcon,
  PauseIcon,
  SquareIcon,
  CoffeeIcon,
  AlertTriangleIcon,
  CheckCircleIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRealtimeLocationTracking } from '@/hooks/tracking/useRealtimeLocationTracking';
import { useDriverShift } from '@/hooks/tracking/useDriverShift';
import { useDriverDeliveries } from '@/hooks/tracking/useDriverDeliveries';
import { useOfflineQueue } from '@/hooks/tracking/useOfflineQueue';
import { DriverStatus } from '@/types/user';
import type { LocationUpdate, DriverShift } from '@/types/tracking';

interface DriverTrackingPortalProps {
  className?: string;
}

export default function DriverTrackingPortal({ className }: DriverTrackingPortalProps) {
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  
  // Offline support
  const { offlineStatus, queuedItems } = useOfflineQueue();
  
  const {
    currentLocation,
    isTracking,
    accuracy,
    startTracking,
    stopTracking,
    error: locationError,
    isRealtimeConnected,
    isRealtimeEnabled,
    connectionMode
  } = useRealtimeLocationTracking();

  const {
    currentShift,
    isShiftActive,
    startShift,
    endShift,
    startBreak,
    endBreak,
    loading: shiftLoading,
    error: shiftError
  } = useDriverShift();

  const {
    activeDeliveries,
    updateDeliveryStatus,
    loading: deliveriesLoading,
    error: deliveriesError
  } = useDriverDeliveries();

  // Use offline status from the hook
  const isOnline = offlineStatus.isOnline;

  // Monitor battery level
  useEffect(() => {
    setIsMounted(true);
    const getBatteryInfo = async () => {
      if ('getBattery' in navigator) {
        try {
          const battery = await (navigator as any).getBattery();
          setBatteryLevel(battery.level * 100);
          
          battery.addEventListener('levelchange', () => {
            setBatteryLevel(battery.level * 100);
          });
        } catch (error) {
                  }
      }
    };

    getBatteryInfo();
  }, []);

  // Handle shift start
  const handleStartShift = async () => {
    if (!currentLocation) {
      alert('Please enable location services to start your shift');
      return;
    }

    const success = await startShift(currentLocation);
    if (success) {
      startTracking();
    }
  };

  // Handle shift end
  const handleEndShift = async () => {
    if (!currentLocation || !currentShift?.id) return;

    const success = await endShift(currentShift.id, currentLocation);
    if (success) {
      stopTracking();
    }
  };

  // Handle break start
  const handleStartBreak = async (breakType: 'rest' | 'meal' | 'fuel' | 'emergency' = 'rest') => {
    if (!currentShift?.id) return;
    await startBreak(currentShift.id, breakType, currentLocation || undefined);
  };

  // Handle break end
  const handleEndBreak = async () => {
    const activeBreak = currentShift?.breaks.find(b => !b.endTime);
    if (!activeBreak?.id) return;
    await endBreak(activeBreak.id, currentLocation || undefined);
  };

  // Calculate shift duration
  const getShiftDuration = () => {
    if (!currentShift?.startTime) return '0h 0m';
    
    const start = new Date(currentShift.startTime);
    const now = new Date();
    const diff = now.getTime() - start.getTime();
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  // Get current break
  const getCurrentBreak = () => {
    return currentShift?.breaks.find(b => !b.endTime);
  };

  const currentBreak = getCurrentBreak();
  const isOnBreak = !!currentBreak;

  return (
    <div className={cn('w-full max-w-md mx-auto p-4 space-y-4', className)}>
      {/* Header Status Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col space-y-1">
              <div className="flex items-center space-x-2">
                <div suppressHydrationWarning className={cn('w-3 h-3 rounded-full', {
                  'bg-green-500': isMounted && isOnline,
                  'bg-red-500': isMounted && !isOnline,
                  'bg-gray-400': !isMounted
                })} />
                <span suppressHydrationWarning className="text-sm font-medium">
                  {isMounted ? (isOnline ? 'Online' : 'Offline') : '...'}
                </span>
              </div>
              {isRealtimeEnabled && (
                <span suppressHydrationWarning className="text-xs text-muted-foreground ml-5">
                  {connectionMode === 'realtime' && isRealtimeConnected && '✓ Real-time connected'}
                  {connectionMode === 'hybrid' && '⟳ Connecting to real-time...'}
                  {connectionMode === 'rest' && 'Standard mode'}
                </span>
              )}
            </div>
            
            <div className="flex items-center space-x-4">
              {/* GPS Status */}
              <div className="flex items-center space-x-1">
                <SignalIcon className={cn('w-4 h-4', {
                  'text-green-500': accuracy && accuracy < 50,
                  'text-yellow-500': accuracy && accuracy >= 50 && accuracy < 100,
                  'text-red-500': !accuracy || accuracy >= 100
                })} />
                <span className="text-xs text-muted-foreground">
                  {accuracy ? `${Math.round(accuracy)}m` : '--'}
                </span>
              </div>

              {/* Battery Level */}
              {batteryLevel !== null && (
                <div className="flex items-center space-x-1">
                  <BatteryIcon className={cn('w-4 h-4', {
                    'text-green-500': batteryLevel > 20,
                    'text-yellow-500': batteryLevel <= 20 && batteryLevel > 10,
                    'text-red-500': batteryLevel <= 10
                  })} />
                  <span className="text-xs text-muted-foreground">
                    {Math.round(batteryLevel)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Alerts */}
      {(locationError || shiftError || deliveriesError) && (
        <Alert variant="destructive">
          <AlertTriangleIcon className="h-4 w-4" />
          <AlertDescription>
            {locationError || shiftError || deliveriesError}
          </AlertDescription>
        </Alert>
      )}

      {/* Shift Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <ClockIcon className="w-5 h-5" />
            <span>Shift Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isShiftActive && currentShift ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Active Shift</p>
                  <p className="text-sm text-muted-foreground">
                    Started: {new Date(currentShift.startTime).toLocaleTimeString()}
                  </p>
                </div>
                <Badge variant={isOnBreak ? 'secondary' : 'default'}>
                  {isOnBreak ? 'On Break' : 'Active'}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-primary">{getShiftDuration()}</p>
                  <p className="text-xs text-muted-foreground">Duration</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">{currentShift.deliveryCount}</p>
                  <p className="text-xs text-muted-foreground">Deliveries</p>
                </div>
              </div>

              <Separator />

              {/* Break Controls */}
              <div className="space-y-2">
                {isOnBreak && currentBreak ? (
                  <div className="space-y-2">
                    <p className="text-sm text-center text-muted-foreground">
                      On {currentBreak.breakType} break since{' '}
                      {new Date(currentBreak.startTime).toLocaleTimeString()}
                    </p>
                    <Button 
                      onClick={handleEndBreak}
                      className="w-full"
                      variant="outline"
                    >
                      <PlayIcon className="w-4 h-4 mr-2" />
                      End Break
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      onClick={() => handleStartBreak('rest')}
                      variant="outline"
                      size="sm"
                    >
                      <CoffeeIcon className="w-4 h-4 mr-1" />
                      Break
                    </Button>
                    <Button 
                      onClick={() => handleStartBreak('meal')}
                      variant="outline"
                      size="sm"
                    >
                      <PauseIcon className="w-4 h-4 mr-1" />
                      Meal
                    </Button>
                  </div>
                )}
              </div>

              <Button 
                onClick={handleEndShift}
                className="w-full"
                variant="destructive"
                disabled={shiftLoading}
              >
                <SquareIcon className="w-4 h-4 mr-2" />
                End Shift
              </Button>
            </>
          ) : (
            <div className="space-y-4">
              <div className="text-center py-4">
                <TruckIcon className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-lg font-medium">Ready to Start</p>
                <p className="text-sm text-muted-foreground">
                  Start your shift to begin location tracking
                </p>
              </div>

              <Button 
                onClick={handleStartShift}
                className="w-full"
                disabled={shiftLoading || !currentLocation}
              >
                <PlayIcon className="w-4 h-4 mr-2" />
                Start Shift
              </Button>

              {!currentLocation && (
                <p className="text-xs text-center text-muted-foreground">
                  Please enable location services
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current Location Card */}
      {currentLocation && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <NavigationIcon className="w-5 h-5" />
              <span>Current Location</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Coordinates:</span>
                <span className="text-sm font-mono">
                  {currentLocation.coordinates.lat.toFixed(6)}, {currentLocation.coordinates.lng.toFixed(6)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Accuracy:</span>
                <span className="text-sm">{Math.round(currentLocation.accuracy)}m</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Speed:</span>
                <span className="text-sm">{Math.round(currentLocation.speed * 2.237)} mph</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Updated:</span>
                <span className="text-sm">
                  {new Date(currentLocation.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Deliveries */}
      {activeDeliveries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MapPinIcon className="w-5 h-5" />
              <span>Active Deliveries ({activeDeliveries.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeDeliveries.map((delivery) => (
              <div key={delivery.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    Delivery #{delivery.id.slice(-6)}
                  </span>
                  <Badge variant="outline">
                    {delivery.status}
                  </Badge>
                </div>
                
                <div className="text-sm text-muted-foreground">
                  <p>📍 {delivery.deliveryLocation.coordinates[1].toFixed(4)}, {delivery.deliveryLocation.coordinates[0].toFixed(4)}</p>
                  {delivery.estimatedArrival && (
                    <p>⏰ ETA: {new Date(delivery.estimatedArrival).toLocaleTimeString()}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => updateDeliveryStatus(delivery.id, DriverStatus.EN_ROUTE_TO_CLIENT, currentLocation || undefined)}
                  >
                    En Route
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => updateDeliveryStatus(delivery.id, DriverStatus.ARRIVED_TO_CLIENT, currentLocation || undefined)}
                  >
                    Arrived
                  </Button>
                </div>
                
                <Button 
                  size="sm" 
                  className="w-full"
                  onClick={() => updateDeliveryStatus(delivery.id, DriverStatus.COMPLETED, currentLocation || undefined)}
                >
                  <CheckCircleIcon className="w-4 h-4 mr-2" />
                  Complete Delivery
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Tracking Status */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div suppressHydrationWarning className={cn('w-2 h-2 rounded-full', {
                'bg-green-500 animate-pulse': isMounted && isTracking,
                'bg-gray-400': !isMounted || !isTracking
              })} />
              <span suppressHydrationWarning className="text-sm">
                {isMounted ? (isTracking ? 'Location tracking active' : 'Location tracking stopped') : '...'}
              </span>
            </div>
            
            {isTracking && (
              <span className="text-xs text-muted-foreground">
                Updates every 30s
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}