'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  NavigationIcon, 
  TruckIcon, 
  MapPinIcon, 
  BatteryIcon,
  AlertTriangleIcon,
  ZoomInIcon,
  ZoomOutIcon,
  MaximizeIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TrackedDriver, DeliveryTracking } from '@/types/tracking';

interface LocationData {
  driverId: string;
  location: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  accuracy: number;
  speed: number;
  heading: number;
  batteryLevel?: number;
  isMoving: boolean;
  activityType: 'walking' | 'driving' | 'stationary';
  recordedAt: string;
}

interface LiveDriverMapProps {
  drivers: TrackedDriver[];
  deliveries: DeliveryTracking[];
  recentLocations: LocationData[];
  compact?: boolean;
  className?: string;
}

// Mock map implementation - replace with actual map library (Google Maps, Mapbox, Leaflet, etc.)
export default function LiveDriverMap({ 
  drivers, 
  deliveries, 
  recentLocations, 
  compact = false,
  className 
}: LiveDriverMapProps) {
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState({ lat: 37.7749, lng: -122.4194 }); // San Francisco
  const [zoom, setZoom] = useState(compact ? 10 : 12);
  const mapRef = useRef<HTMLDivElement>(null);

  // Calculate map bounds to fit all drivers
  useEffect(() => {
    if (drivers.length === 0) return;

    const locations = drivers
      .filter(d => d.lastKnownLocation)
      .map(d => d.lastKnownLocation!)
      .filter(loc => loc.coordinates && loc.coordinates.length === 2);

    if (locations.length === 0) return;

    // Calculate center point
    const avgLat = locations.reduce((sum, loc) => sum + loc.coordinates[1], 0) / locations.length;
    const avgLng = locations.reduce((sum, loc) => sum + loc.coordinates[0], 0) / locations.length;
    
    setMapCenter({ lat: avgLat, lng: avgLng });
  }, [drivers]);

  // Get driver color based on status
  const getDriverColor = (driver: TrackedDriver): string => {
    if (!driver.isOnDuty) return 'gray';
    
    const recentLocation = recentLocations.find(loc => loc.driverId === driver.id);
    if (recentLocation) {
      if (recentLocation.isMoving) return 'green';
      if (recentLocation.activityType === 'stationary') return 'yellow';
    }
    
    return 'blue';
  };

  // Get battery status
  const getBatteryStatus = (driverId: string): { level?: number; status: 'good' | 'low' | 'critical' } => {
    const location = recentLocations.find(loc => loc.driverId === driverId);
    const level = location?.batteryLevel;
    
    if (!level) return { status: 'good' };
    
    if (level <= 15) return { level, status: 'critical' };
    if (level <= 30) return { level, status: 'low' };
    return { level, status: 'good' };
  };

  // Mock map controls
  const zoomIn = () => setZoom(prev => Math.min(prev + 1, 18));
  const zoomOut = () => setZoom(prev => Math.max(prev - 1, 1));

  // Driver marker component
  const DriverMarker = ({ driver }: { driver: TrackedDriver }) => {
    const color = getDriverColor(driver);
    const battery = getBatteryStatus(driver.id);
    const isSelected = selectedDriver === driver.id;
    
    if (!driver.lastKnownLocation?.coordinates) return null;

    // Convert coordinates to mock screen position (in real implementation, use map projection)
    const x = ((driver.lastKnownLocation.coordinates[0] + 180) / 360) * 100;
    const y = ((90 - driver.lastKnownLocation.coordinates[1]) / 180) * 100;

    return (
      <div
        className={cn(
          'absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-200',
          isSelected ? 'z-20 scale-125' : 'z-10'
        )}
        style={{ left: `${x}%`, top: `${y}%` }}
        onClick={() => setSelectedDriver(isSelected ? null : driver.id)}
      >
        {/* Driver marker */}
        <div className={cn(
          'relative w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center',
          {
            'bg-green-500': color === 'green',
            'bg-yellow-500': color === 'yellow',
            'bg-blue-500': color === 'blue',
            'bg-gray-500': color === 'gray',
          }
        )}>
          <TruckIcon className="w-4 h-4 text-white" />
          
          {/* Battery indicator */}
          {battery.level && (
            <div className={cn(
              'absolute -top-1 -right-1 w-3 h-3 rounded-full border border-white flex items-center justify-center',
              {
                'bg-green-500': battery.status === 'good',
                'bg-yellow-500': battery.status === 'low',
                'bg-red-500': battery.status === 'critical',
              }
            )}>
              <div className="w-1 h-1 bg-white rounded-full" />
            </div>
          )}
        </div>

        {/* Driver info popup */}
        {isSelected && (
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 z-30">
            <Card className="w-64 shadow-lg">
              <CardContent className="p-3">
                <div className="space-y-2">
                  <div className="font-medium">Driver #{driver.employeeId}</div>
                  <div className="text-sm text-muted-foreground">
                    Vehicle: {driver.vehicleNumber || 'N/A'}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Badge variant={driver.isOnDuty ? 'default' : 'secondary'}>
                      {driver.isOnDuty ? 'On Duty' : 'Off Duty'}
                    </Badge>
                    
                    {battery.level && (
                      <div className="flex items-center space-x-1">
                        <BatteryIcon className={cn('w-4 h-4', {
                          'text-green-500': battery.status === 'good',
                          'text-yellow-500': battery.status === 'low',
                          'text-red-500': battery.status === 'critical',
                        })} />
                        <span className="text-xs">{battery.level}%</span>
                      </div>
                    )}
                  </div>

                  {driver.currentShift && (
                    <div className="text-xs text-muted-foreground">
                      <div>Deliveries: {driver.currentShift.deliveryCount || 0}</div>
                      <div>Distance: {Math.round((driver.currentShift.totalDistanceKm || 0) * 10) / 10} km</div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    );
  };

  // Delivery marker component
  const DeliveryMarker = ({ delivery }: { delivery: DeliveryTracking }) => {
    if (!delivery.deliveryLocation?.coordinates) return null;

    const x = ((delivery.deliveryLocation.coordinates[0] + 180) / 360) * 100;
    const y = ((90 - delivery.deliveryLocation.coordinates[1]) / 180) * 100;

    return (
      <div
        className="absolute transform -translate-x-1/2 -translate-y-1/2 z-5"
        style={{ left: `${x}%`, top: `${y}%` }}
      >
        <div className="w-4 h-4 bg-orange-500 rounded-full border-2 border-white shadow-md">
          <MapPinIcon className="w-3 h-3 text-white" />
        </div>
      </div>
    );
  };

  return (
    <div className={cn('relative w-full h-full bg-gray-100 rounded-lg overflow-hidden', className)}>
      {/* Map container */}
      <div ref={mapRef} className="w-full h-full relative">
        {/* Mock map background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-100 to-green-100">
          {/* Grid lines to simulate map */}
          <div className="absolute inset-0 opacity-20">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={`h-${i}`}
                className="absolute w-full border-t border-gray-400"
                style={{ top: `${i * 10}%` }}
              />
            ))}
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={`v-${i}`}
                className="absolute h-full border-l border-gray-400"
                style={{ left: `${i * 10}%` }}
              />
            ))}
          </div>
          
          {/* Mock city areas */}
          <div className="absolute top-1/4 left-1/3 w-1/4 h-1/4 bg-gray-300 opacity-30 rounded-lg" />
          <div className="absolute top-1/2 left-1/2 w-1/6 h-1/6 bg-gray-400 opacity-40 rounded-full" />
        </div>

        {/* Driver markers */}
        {drivers.map(driver => (
          <DriverMarker key={driver.id} driver={driver} />
        ))}

        {/* Delivery markers */}
        {deliveries.map(delivery => (
          <DeliveryMarker key={delivery.id} delivery={delivery} />
        ))}

        {/* No data message */}
        {drivers.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <AlertTriangleIcon className="w-12 h-12 mx-auto mb-2" />
              <p className="text-sm">No active drivers to display</p>
            </div>
          </div>
        )}
      </div>

      {/* Map controls */}
      {!compact && (
        <div className="absolute top-4 right-4 flex flex-col space-y-2">
          <Button size="sm" variant="outline" onClick={zoomIn}>
            <ZoomInIcon className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={zoomOut}>
            <ZoomOutIcon className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline">
            <MaximizeIcon className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-3">
        <div className="text-xs font-medium mb-2">Legend</div>
        <div className="space-y-1 text-xs">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full" />
            <span>Moving</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-yellow-500 rounded-full" />
            <span>Stopped</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full" />
            <span>On Duty</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-gray-500 rounded-full" />
            <span>Off Duty</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-orange-500 rounded-full" />
            <span>Delivery</span>
          </div>
        </div>
      </div>

      {/* Status info */}
      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-2">
        <div className="text-xs text-gray-600">
          {drivers.length} drivers • {recentLocations.length} updates
        </div>
      </div>
    </div>
  );
}
