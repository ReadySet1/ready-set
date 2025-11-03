'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  NavigationIcon,
  TruckIcon,
  MapPinIcon,
  ClockIcon,
  UsersIcon,
  ActivityIcon,
  BatteryIcon,
  SignalIcon,
  AlertTriangleIcon,
  DownloadIcon,
  RefreshCwIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import DriverStatusList from './DriverStatusList';
import DeliveryAssignmentPanel from './DeliveryAssignmentPanel';
import { useAdminRealtimeTracking } from '@/hooks/tracking/useAdminRealtimeTracking';
import type { TrackedDriver, DeliveryTracking } from '@/types/tracking';

// Dynamically import LiveDriverMap to code-split Mapbox bundle (~750KB)
// This ensures the map library only loads when the tracking page is accessed
const LiveDriverMap = dynamic(() => import('./LiveDriverMap'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <div className="flex flex-col items-center gap-2">
        <RefreshCwIcon className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading map...</p>
      </div>
    </div>
  ),
});

interface AdminTrackingDashboardProps {
  className?: string;
}

export default function AdminTrackingDashboard({ className }: AdminTrackingDashboardProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const {
    activeDrivers,
    recentLocations,
    activeDeliveries,
    isConnected,
    isRealtimeConnected,
    isRealtimeEnabled,
    connectionMode,
    error,
    reconnect,
    toggleMode
  } = useAdminRealtimeTracking();

  // Calculate dashboard statistics
  const stats = {
    totalDrivers: activeDrivers.length,
    driversOnDuty: activeDrivers.filter(d => d.isOnDuty).length,
    activeDeliveries: activeDeliveries.length,
    averageSpeed: recentLocations.length > 0 
      ? Math.round(recentLocations.reduce((sum, loc) => sum + loc.speed, 0) / recentLocations.length * 2.237) // m/s to mph
      : 0,
    totalDistance: activeDrivers.reduce((sum, driver) => sum + (driver.totalDistanceKm || 0), 0)
  };

  // Update last refresh time when data changes
  useEffect(() => {
    if (activeDrivers.length > 0 || activeDeliveries.length > 0) {
      setLastUpdate(new Date());
    }
  }, [activeDrivers, activeDeliveries]);

  // Auto-refresh toggle
  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh);
  };

  // Manual refresh
  const handleManualRefresh = () => {
    reconnect();
    setLastUpdate(new Date());
  };

  // Export data
  const handleExportData = () => {
    const data = {
      timestamp: new Date().toISOString(),
      activeDrivers,
      activeDeliveries,
      recentLocations
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `driver-tracking-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={cn('w-full space-y-6 p-6', className)}>
      {/* Connection Status & Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex flex-col space-y-1">
            <div className="flex items-center space-x-2">
              <div className={cn('w-3 h-3 rounded-full', {
                'bg-green-500 animate-pulse': isConnected,
                'bg-red-500': !isConnected
              })} />
              <span className="text-sm font-medium">
                {isConnected ? 'Live Data' : 'Disconnected'}
              </span>
            </div>

            {/* Realtime connection status */}
            {isRealtimeEnabled && (
              <span className="text-xs text-muted-foreground ml-5">
                {connectionMode === 'realtime' && isRealtimeConnected && '✓ Real-time WebSocket connected'}
                {connectionMode === 'hybrid' && '⟳ Connecting to WebSocket...'}
                {connectionMode === 'sse' && 'SSE mode (polling every 5s)'}
              </span>
            )}
          </div>

          <div className="text-sm text-muted-foreground">
            Last update: {lastUpdate.toLocaleTimeString()}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Realtime mode toggle */}
          {isRealtimeEnabled && (
            <Button
              variant="outline"
              size="sm"
              onClick={toggleMode}
              className={cn({
                'bg-blue-50 border-blue-200': connectionMode === 'realtime' || connectionMode === 'hybrid',
                'bg-gray-50': connectionMode === 'sse'
              })}
            >
              <SignalIcon className="w-4 h-4 mr-2" />
              {connectionMode === 'realtime' || connectionMode === 'hybrid' ? 'WebSocket Mode' : 'SSE Mode'}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={toggleAutoRefresh}
            className={cn({
              'bg-green-50 border-green-200': autoRefresh,
              'bg-gray-50': !autoRefresh
            })}
          >
            <ActivityIcon className="w-4 h-4 mr-2" />
            {autoRefresh ? 'Auto Refresh On' : 'Auto Refresh Off'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={!isConnected}
          >
            <RefreshCwIcon className="w-4 h-4 mr-2" />
            Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportData}
          >
            <DownloadIcon className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangleIcon className="w-5 h-5 text-red-500" />
              <span className="text-red-700 font-medium">Connection Error</span>
            </div>
            <p className="text-red-600 text-sm mt-1">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={reconnect}
              className="mt-2"
            >
              Reconnect
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <UsersIcon className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.driversOnDuty}</p>
                <p className="text-sm text-muted-foreground">On Duty</p>
                <p className="text-xs text-muted-foreground">of {stats.totalDrivers} total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <TruckIcon className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.activeDeliveries}</p>
                <p className="text-sm text-muted-foreground">Active Deliveries</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <ActivityIcon className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.averageSpeed}</p>
                <p className="text-sm text-muted-foreground">Avg Speed (mph)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <NavigationIcon className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{Math.round(stats.totalDistance)}</p>
                <p className="text-sm text-muted-foreground">Total KM</p>
                <p className="text-xs text-muted-foreground">today</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <ClockIcon className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{recentLocations.length}</p>
                <p className="text-sm text-muted-foreground">GPS Updates</p>
                <p className="text-xs text-muted-foreground">last 5 min</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="map">Live Map</TabsTrigger>
          <TabsTrigger value="drivers">Drivers</TabsTrigger>
          <TabsTrigger value="deliveries">Deliveries</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Mini Map */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MapPinIcon className="w-5 h-5" />
                  <span>Driver Locations</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <LiveDriverMap
                    drivers={activeDrivers}
                    deliveries={activeDeliveries}
                    recentLocations={recentLocations}
                    compact={true}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Driver Status Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Driver Status</CardTitle>
              </CardHeader>
              <CardContent>
                <DriverStatusList
                  drivers={activeDrivers}
                  recentLocations={recentLocations}
                  compact={true}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="map" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <NavigationIcon className="w-5 h-5" />
                <span>Live Driver Tracking Map</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <LiveDriverMap
                  drivers={activeDrivers}
                  deliveries={activeDeliveries}
                  recentLocations={recentLocations}
                  compact={false}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="drivers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <UsersIcon className="w-5 h-5" />
                <span>Active Drivers ({activeDrivers.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DriverStatusList
                drivers={activeDrivers}
                recentLocations={recentLocations}
                compact={false}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deliveries" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TruckIcon className="w-5 h-5" />
                <span>Delivery Management</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DeliveryAssignmentPanel
                drivers={activeDrivers}
                deliveries={activeDeliveries}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
