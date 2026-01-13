'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  NavigationIcon, 
  TruckIcon, 
  ClockIcon, 
  BatteryIcon,
  SignalIcon,
  PhoneIcon,
  MapPinIcon,
  ActivityIcon,
  SearchIcon,
  FilterIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TrackedDriver } from '@/types/tracking';

interface LocationData {
  driverId: string;
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
  accuracy: number;
  speed: number;
  heading: number;
  batteryLevel?: number;
  isMoving: boolean;
  activityType: 'walking' | 'driving' | 'stationary';
  recordedAt: string;
}

interface DriverStatusListProps {
  drivers: TrackedDriver[];
  recentLocations: LocationData[];
  compact?: boolean;
  className?: string;
}

export default function DriverStatusList({ 
  drivers, 
  recentLocations, 
  compact = false,
  className 
}: DriverStatusListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'on_duty' | 'off_duty' | 'moving'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'distance' | 'deliveries'>('status');

  // Filter and sort drivers
  const filteredDrivers = drivers
    .filter(driver => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = 
          driver.employeeId.toLowerCase().includes(searchLower) ||
          driver.vehicleNumber?.toLowerCase().includes(searchLower) ||
          driver.phoneNumber?.includes(searchTerm);
        
        if (!matchesSearch) return false;
      }

      // Status filter
      switch (statusFilter) {
        case 'on_duty':
          return driver.isOnDuty;
        case 'off_duty':
          return !driver.isOnDuty;
        case 'moving':
          const location = recentLocations.find(loc => loc.driverId === driver.id);
          return location?.isMoving || false;
        default:
          return true;
      }
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.employeeId.localeCompare(b.employeeId);
        case 'status':
          if (a.isOnDuty && !b.isOnDuty) return -1;
          if (!a.isOnDuty && b.isOnDuty) return 1;
          return 0;
        case 'distance':
          return (b.totalDistanceMiles || 0) - (a.totalDistanceMiles || 0);
        case 'deliveries':
          return (b.deliveryCount || 0) - (a.deliveryCount || 0);
        default:
          return 0;
      }
    });

  // Get recent location data for a driver
  const getLocationData = (driverId: string) => {
    return recentLocations.find(loc => loc.driverId === driverId);
  };

  // Calculate time since last update
  const getTimeSinceUpdate = (driver: TrackedDriver): string => {
    if (!driver.lastLocationUpdate) return 'Never';
    
    const now = new Date();
    const lastUpdate = new Date(driver.lastLocationUpdate);
    const diffMs = now.getTime() - lastUpdate.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  // Get signal strength based on GPS accuracy
  const getSignalStrength = (accuracy?: number): 'excellent' | 'good' | 'fair' | 'poor' => {
    if (!accuracy) return 'poor';
    if (accuracy <= 10) return 'excellent';
    if (accuracy <= 30) return 'good';
    if (accuracy <= 100) return 'fair';
    return 'poor';
  };

  const DriverCard = ({ driver }: { driver: TrackedDriver }) => {
    const locationData = getLocationData(driver.id);
    const timeSinceUpdate = getTimeSinceUpdate(driver);
    const signalStrength = getSignalStrength(locationData?.accuracy);

    return (
      <Card className={cn('transition-all duration-200 hover:shadow-md', {
        'border-green-200 bg-green-50': driver.isOnDuty,
        'border-gray-200': !driver.isOnDuty
      })}>
        <CardContent className={cn('p-4', compact && 'p-3')}>
          <div className="flex items-start justify-between">
            {/* Driver info */}
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <div className={cn('w-3 h-3 rounded-full', {
                  'bg-green-500 animate-pulse': driver.isOnDuty && locationData?.isMoving,
                  'bg-yellow-500': driver.isOnDuty && !locationData?.isMoving,
                  'bg-gray-400': !driver.isOnDuty
                })} />
                
                <div>
                  <h4 className="font-medium">
                    {driver.name || `Driver #${driver.employeeId || 'Unknown'}`}
                  </h4>
                  {!compact && (
                    <div className="text-sm text-muted-foreground">
                      {driver.vehicleNumber && `Vehicle: ${driver.vehicleNumber}`}
                    </div>
                  )}
                </div>
              </div>

              {/* Status badges */}
              <div className="flex items-center space-x-2 mb-2">
                <Badge variant={driver.isOnDuty ? 'default' : 'secondary'}>
                  {driver.isOnDuty ? 'On Duty' : 'Off Duty'}
                </Badge>
                
                {locationData && (
                  <Badge variant="outline" className="text-xs">
                    {locationData.activityType === 'driving' && '🚗 Driving'}
                    {locationData.activityType === 'walking' && '🚶 Walking'}
                    {locationData.activityType === 'stationary' && '⏸️ Stopped'}
                  </Badge>
                )}
              </div>

              {/* Metrics */}
              {!compact && driver.isOnDuty && (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Deliveries</div>
                    <div className="font-medium">{driver.deliveryCount || 0}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Distance</div>
                    <div className="font-medium">{Math.round((driver.totalDistanceMiles || 0) * 10) / 10} mi</div>
                  </div>
                </div>
              )}
            </div>

            {/* Status indicators */}
            <div className="flex flex-col items-end space-y-2">
              {/* Signal strength */}
              <div className="flex items-center space-x-1">
                <SignalIcon className={cn('w-4 h-4', {
                  'text-green-500': signalStrength === 'excellent',
                  'text-blue-500': signalStrength === 'good',
                  'text-yellow-500': signalStrength === 'fair',
                  'text-red-500': signalStrength === 'poor'
                })} />
                {locationData?.accuracy && (
                  <span className="text-xs text-muted-foreground">
                    {Math.round(locationData.accuracy)}m
                  </span>
                )}
              </div>

              {/* Battery level */}
              {locationData?.batteryLevel && (
                <div className="flex items-center space-x-1">
                  <BatteryIcon className={cn('w-4 h-4', {
                    'text-green-500': locationData.batteryLevel > 30,
                    'text-yellow-500': locationData.batteryLevel > 15,
                    'text-red-500': locationData.batteryLevel <= 15
                  })} />
                  <span className="text-xs">{locationData.batteryLevel}%</span>
                </div>
              )}

              {/* Speed */}
              {locationData?.speed !== undefined && locationData.speed > 0 && (
                <div className="flex items-center space-x-1">
                  <ActivityIcon className="w-4 h-4 text-blue-500" />
                  <span className="text-xs">{Math.round(locationData.speed * 2.237)} mph</span>
                </div>
              )}

              {/* Last update */}
              <div className="text-xs text-muted-foreground">
                {timeSinceUpdate}
              </div>
            </div>
          </div>

          {/* Contact info */}
          {!compact && driver.phoneNumber && (
            <div className="mt-3 pt-3 border-t">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <PhoneIcon className="w-4 h-4" />
                  <span>{driver.phoneNumber}</span>
                </div>
                
                <Button size="sm" variant="outline">
                  <PhoneIcon className="w-4 h-4 mr-1" />
                  Call
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className={cn('w-full space-y-4', className)}>
      {/* Search and filters */}
      {!compact && (
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search drivers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-3 py-2 border rounded-md text-sm"
          >
            <option value="all">All Drivers</option>
            <option value="on_duty">On Duty</option>
            <option value="off_duty">Off Duty</option>
            <option value="moving">Moving</option>
          </select>
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="px-3 py-2 border rounded-md text-sm"
          >
            <option value="status">Sort by Status</option>
            <option value="name">Sort by Name</option>
            <option value="distance">Sort by Distance</option>
            <option value="deliveries">Sort by Deliveries</option>
          </select>
        </div>
      )}

      {/* Driver list */}
      <div className={cn('space-y-3', compact && 'space-y-2')}>
        {filteredDrivers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <TruckIcon className="w-12 h-12 mx-auto mb-2" />
            <p>No drivers match your criteria</p>
          </div>
        ) : (
          filteredDrivers.map(driver => (
            <DriverCard key={driver.id} driver={driver} />
          ))
        )}
      </div>

      {/* Summary */}
      {!compact && (
        <div className="text-sm text-muted-foreground text-center">
          Showing {filteredDrivers.length} of {drivers.length} drivers
        </div>
      )}
    </div>
  );
}
