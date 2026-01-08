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
import DriverLiveMap from '@/components/Driver/DriverLiveMap';

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
    connectionMode,
    permissionState,
    isRequestingPermission,
    requestLocationPermission
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

  // Auto-request location when shift is active but location is not available
  // This handles the case after page refresh where shift is active but tracking needs to be resumed
  useEffect(() => {
    if (isMounted && isShiftActive && !currentLocation && !isTracking && !isRequestingPermission) {
      // Try to get location and resume tracking for active shift
      const resumeTracking = async () => {
        const granted = await requestLocationPermission();
        if (granted) {
          startTracking();
        }
      };
      resumeTracking();
    }
  }, [isMounted, isShiftActive, currentLocation, isTracking, isRequestingPermission, requestLocationPermission, startTracking]);

  // Handle location permission request
  const handleRequestLocationPermission = async () => {
    await requestLocationPermission();
  };

  // Handle shift start
  const handleStartShift = async () => {
    // If no location yet, try to get permission first
    if (!currentLocation) {
      const granted = await requestLocationPermission();
      if (!granted) {
        return; // Error message is handled by the hook
      }
    }

    // Wait a moment for location to update if we just got permission
    const locationToUse = currentLocation;
    if (!locationToUse) {
      return;
    }

    const success = await startShift(locationToUse);
    if (success) {
      startTracking();
    }
  };

  // Handle shift end
  const handleEndShift = async () => {
    if (!currentShift?.id) return;

    // Try to get current location, but allow ending shift without it
    let locationForEndShift = currentLocation;

    if (!locationForEndShift) {
      // Try to get location one more time
      try {
        const granted = await requestLocationPermission();
        if (granted && currentLocation) {
          locationForEndShift = currentLocation;
        }
      } catch {
        // Continue without location
      }
    }

    // If still no location, create a minimal one from the shift's start location or use defaults
    if (!locationForEndShift) {
      // Create a placeholder location to allow shift to end
      const driverId = currentShift.driverId;
      locationForEndShift = {
        driverId,
        coordinates: { lat: 0, lng: 0 }, // Server should handle missing location gracefully
        accuracy: 0,
        speed: 0,
        heading: 0,
        isMoving: false,
        activityType: 'stationary' as const,
        timestamp: new Date()
      };
    }

    const success = await endShift(currentShift.id, locationForEndShift);
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

      {/* Live Map & Current Location */}
      {(currentLocation || isShiftActive) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <NavigationIcon className="w-5 h-5" />
              <span>Live Map</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentLocation ? (
              <>
                <div className="h-64 rounded-lg overflow-hidden">
                  <DriverLiveMap
                    currentLocation={currentLocation}
                    activeDeliveries={activeDeliveries}
                  />
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span>Coordinates:</span>
                    <span className="font-mono">
                      {currentLocation.coordinates.lat.toFixed(6)},{' '}
                      {currentLocation.coordinates.lng.toFixed(6)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Accuracy:</span>
                    <span>{Math.round(currentLocation.accuracy)}m</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Speed:</span>
                    <span>{Math.round(currentLocation.speed * 2.237)} mph</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Updated:</span>
                    <span>
                      {new Date(currentLocation.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="h-64 rounded-lg bg-muted flex flex-col items-center justify-center space-y-4">
                <MapPinIcon className="w-12 h-12 text-muted-foreground" />
                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {isRequestingPermission ? 'Getting your location...' : 'Location not available'}
                  </p>
                  {!isRequestingPermission && (
                    <Button
                      onClick={handleRequestLocationPermission}
                      variant="outline"
                      size="sm"
                    >
                      <MapPinIcon className="w-4 h-4 mr-2" />
                      Enable Location
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
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

              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-primary">{getShiftDuration()}</p>
                  <p className="text-xs text-muted-foreground">Duration</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">
                    {currentShift.totalDistanceMiles
                      ? `${Math.round(currentShift.totalDistanceMiles * 10) / 10} mi`
                      : '0 mi'}
                  </p>
                  <p className="text-xs text-muted-foreground">Distance</p>
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

              {/* Show "Enable Location" button if permission not granted */}
              {!currentLocation && (permissionState === 'prompt' || permissionState === 'unknown') && (
                <Button
                  onClick={handleRequestLocationPermission}
                  className="w-full"
                  variant="outline"
                  disabled={isRequestingPermission}
                >
                  <MapPinIcon className="w-4 h-4 mr-2" />
                  {isRequestingPermission ? 'Requesting Location...' : 'Enable Location'}
                </Button>
              )}

              <Button
                onClick={handleStartShift}
                className="w-full"
                disabled={shiftLoading || isRequestingPermission}
              >
                <PlayIcon className="w-4 h-4 mr-2" />
                Start Shift
              </Button>

              {!currentLocation && permissionState === 'denied' && (
                <div className="space-y-3">
                  <Alert variant="destructive" className="text-left">
                    <AlertTriangleIcon className="h-4 w-4" />
                    <AlertDescription className="space-y-2">
                      <p className="font-medium">Location access denied</p>
                      <p className="text-sm">Please enable location in your browser settings:</p>
                      <ol className="text-sm list-decimal list-inside space-y-1 pl-2">
                        <li>Open <strong>Settings</strong> on your device</li>
                        <li>Scroll down and tap <strong>Safari</strong></li>
                        <li>Tap <strong>Location</strong></li>
                        <li>Select <strong>Allow</strong> or <strong>Ask</strong></li>
                        <li>Return here and tap the button below</li>
                      </ol>
                    </AlertDescription>
                  </Alert>
                  <Button
                    onClick={handleRequestLocationPermission}
                    className="w-full"
                    variant="outline"
                    disabled={isRequestingPermission}
                  >
                    <MapPinIcon className="w-4 h-4 mr-2" />
                    {isRequestingPermission ? 'Checking Location...' : 'Try Again - Enable Location'}
                  </Button>
                </div>
              )}

              {!currentLocation && permissionState !== 'denied' && !isRequestingPermission && (
                <p className="text-xs text-center text-muted-foreground">
                  Tap &quot;Enable Location&quot; or &quot;Start Shift&quot; to allow location access
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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