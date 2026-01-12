'use client';

/**
 * Simulator Controls Component
 *
 * Provides controls for starting, stopping, and configuring the location simulation.
 */

import { useEffect } from 'react';
import type { UseLocationSimulatorReturn } from '@/hooks/dev/useLocationSimulator';
import { formatDistance, formatDuration } from '@/lib/dev/route-utils';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  RefreshCw,
  Power,
  PowerOff,
  Gauge,
  AlertTriangle,
  MapPin,
  User,
  Truck,
} from 'lucide-react';

interface SimulatorControlsProps {
  simulator: UseLocationSimulatorReturn;
}

const SPEED_OPTIONS = [
  { value: '0.5', label: '0.5x', description: 'Slow' },
  { value: '1', label: '1x', description: 'Normal' },
  { value: '2', label: '2x', description: 'Fast' },
  { value: '5', label: '5x', description: 'Very Fast' },
  { value: '10', label: '10x', description: 'Ultra Fast' },
];

export function SimulatorControls({ simulator }: SimulatorControlsProps) {
  const {
    status,
    isEnabled,
    progress,
    speedMultiplier,
    error,
    availableDrivers,
    selectedDriver,
    isLoadingDrivers,
    deliveries,
    selectedDelivery,
    presetRoutes,
    selectedPresetRoute,
    routeDistance,
    estimatedDuration,
    enable,
    disable,
    refreshDrivers,
    selectDriver,
    refreshDeliveries,
    selectDelivery,
    selectPresetRoute,
    setSpeed,
    start,
    stop,
    pause,
    resume,
    reset,
  } = simulator;

  // Auto-fetch deliveries when enabled
  useEffect(() => {
    if (isEnabled && deliveries.length === 0) {
      refreshDeliveries();
    }
  }, [isEnabled, deliveries.length, refreshDeliveries]);

  // DEBUG: Log what we're receiving
  console.log('[SimulatorControls] deliveries:', deliveries.length, 'presetRoutes:', presetRoutes.length);

  // Filter to active deliveries and check for valid coordinates
  const activeDeliveries = deliveries.filter(
    (d) => !['delivered', 'cancelled', 'completed'].includes(d.status.toLowerCase())
  );

  // Separate deliveries with and without valid coordinates
  const deliveriesWithCoords = activeDeliveries.filter(
    (d) => d.pickupLocation && d.deliveryLocation
  );
  const deliveriesWithoutCoords = activeDeliveries.filter(
    (d) => !d.pickupLocation || !d.deliveryLocation
  );

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-400">Mock Geolocation</span>
        <Button
          variant={isEnabled ? 'secondary' : 'outline'}
          size="sm"
          className={cn(
            'h-8 gap-2',
            isEnabled
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-slate-700 hover:bg-slate-600'
          )}
          onClick={isEnabled ? disable : enable}
        >
          {isEnabled ? (
            <>
              <Power className="h-3 w-3" />
              Enabled
            </>
          ) : (
            <>
              <PowerOff className="h-3 w-3" />
              Disabled
            </>
          )}
        </Button>
      </div>

      {/* Driver Selection - for admin users to select which driver to simulate */}
      {isEnabled && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400 flex items-center gap-1">
              <Truck className="h-3 w-3" />
              Target Driver
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-slate-400 hover:text-white"
              onClick={refreshDrivers}
              disabled={isLoadingDrivers}
            >
              <RefreshCw
                className={cn('h-3 w-3 mr-1', isLoadingDrivers && 'animate-spin')}
              />
              Refresh
            </Button>
          </div>

          <Select
            value={selectedDriver?.id || ''}
            onValueChange={(value) => {
              const driver = availableDrivers.find((d) => d.id === value);
              selectDriver(driver || null);
            }}
            disabled={status === 'running'}
          >
            <SelectTrigger className="h-9 bg-slate-800 border-slate-700 text-sm">
              <SelectValue placeholder="Select a driver to simulate..." />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700 z-[10000]" side="bottom" align="start">
              {availableDrivers.length > 0 ? (
                <SelectGroup>
                  <SelectLabel className="text-slate-400 flex items-center gap-1">
                    <User className="h-3 w-3" />
                    On-Duty Drivers
                  </SelectLabel>
                  {availableDrivers.map((driver) => (
                    <SelectItem
                      key={driver.id}
                      value={driver.id}
                      className="text-sm text-slate-200 focus:bg-slate-700 focus:text-white"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'w-2 h-2 rounded-full',
                            driver.isOnDuty ? 'bg-green-500' : 'bg-slate-500'
                          )}
                        />
                        {driver.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectGroup>
              ) : (
                <div className="px-2 py-4 text-center text-sm text-slate-400">
                  {isLoadingDrivers ? 'Loading drivers...' : 'No on-duty drivers found'}
                </div>
              )}
            </SelectContent>
          </Select>

          {selectedDriver && (
            <div className="text-xs text-green-400 flex items-center gap-1">
              <User className="h-3 w-3" />
              Simulating as: {selectedDriver.name}
            </div>
          )}

          {!selectedDriver && availableDrivers.length > 0 && (
            <div className="text-xs text-amber-400 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Select a driver to send location updates
            </div>
          )}
        </div>
      )}

      {/* Route Selection */}
      {isEnabled && (
        <>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Route</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-slate-400 hover:text-white"
                onClick={refreshDeliveries}
                disabled={status === 'loading'}
              >
                <RefreshCw
                  className={cn('h-3 w-3 mr-1', status === 'loading' && 'animate-spin')}
                />
                Refresh
              </Button>
            </div>

            <Select
              value={selectedDelivery?.id || selectedPresetRoute || ''}
              onValueChange={(value) => {
                // Check if it's a preset route
                const preset = presetRoutes.find((r) => r.name === value);
                if (preset) {
                  selectPresetRoute(preset.name);
                } else {
                  const delivery = deliveries.find((d) => d.id === value);
                  if (delivery) {
                    selectDelivery(delivery);
                  }
                }
              }}
              disabled={status === 'running'}
            >
              <SelectTrigger className="h-9 bg-slate-800 border-slate-700 text-sm">
                <SelectValue placeholder="Select a route..." />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700 z-[10000]" side="bottom" align="start">
                {/* Active Deliveries with coordinates (ready to simulate) */}
                {deliveriesWithCoords.length > 0 && (
                  <SelectGroup>
                    <SelectLabel className="text-slate-400 flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      Active Deliveries
                    </SelectLabel>
                    {deliveriesWithCoords.map((delivery) => (
                      <SelectItem
                        key={delivery.id}
                        value={delivery.id}
                        className="text-sm text-slate-200 focus:bg-slate-700 focus:text-white"
                      >
                        <div className="flex flex-col">
                          <span>
                            #{delivery.orderNumber} - {delivery.customerName || 'Customer'}
                          </span>
                          <span className="text-xs text-slate-400">
                            {delivery.status}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}

                {/* Deliveries without coordinates (can't simulate) */}
                {deliveriesWithoutCoords.length > 0 && (
                  <>
                    {deliveriesWithCoords.length > 0 && <SelectSeparator className="bg-slate-700" />}
                    <SelectGroup>
                      <SelectLabel className="text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Missing Coordinates
                      </SelectLabel>
                      {deliveriesWithoutCoords.map((delivery) => (
                        <SelectItem
                          key={delivery.id}
                          value={delivery.id}
                          className="text-sm text-slate-400 focus:bg-slate-700 focus:text-slate-300"
                          disabled
                        >
                          <div className="flex flex-col">
                            <span className="flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3 text-amber-500" />
                              #{delivery.orderNumber} - {delivery.customerName || 'Customer'}
                            </span>
                            <span className="text-xs text-slate-500">
                              No GPS coordinates - update address in order
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </>
                )}

                {(deliveriesWithCoords.length > 0 || deliveriesWithoutCoords.length > 0) && presetRoutes.length > 0 && (
                  <SelectSeparator className="bg-slate-700" />
                )}

                {/* Preset Routes */}
                {presetRoutes.length > 0 && (
                  <SelectGroup>
                    <SelectLabel className="text-slate-400">Test Routes</SelectLabel>
                    {presetRoutes.map((route) => (
                      <SelectItem
                        key={route.name}
                        value={route.name}
                        className="text-sm text-slate-200 focus:bg-slate-700 focus:text-white"
                      >
                        {route.description}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}

                {activeDeliveries.length === 0 && presetRoutes.length === 0 && (
                  <div className="px-2 py-4 text-center text-sm text-slate-400">
                    No routes available
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Route Info */}
          {(selectedDelivery || selectedPresetRoute) && routeDistance > 0 && (
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <span>Distance: {formatDistance(routeDistance)}</span>
              <span>ETA: {formatDuration(estimatedDuration)}</span>
            </div>
          )}

          {/* Speed Control */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-sm text-slate-400">
              <Gauge className="h-3 w-3" />
              Speed
            </div>
            <Select
              value={String(speedMultiplier)}
              onValueChange={(value) => setSpeed(parseFloat(value))}
            >
              <SelectTrigger className="h-8 w-24 bg-slate-800 border-slate-700 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700 z-[10000]" side="bottom" align="start">
                {SPEED_OPTIONS.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="text-sm text-slate-200 focus:bg-slate-700 focus:text-white"
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Progress Bar */}
          {(selectedDelivery || selectedPresetRoute) && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Progress</span>
                <span>{progress.toFixed(1)}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-700 overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Control Buttons */}
          <div className="flex items-center gap-2">
            {status === 'running' ? (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1 h-9 bg-amber-600 hover:bg-amber-700"
                  onClick={pause}
                >
                  <Pause className="h-4 w-4 mr-1" />
                  Pause
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-9"
                  onClick={stop}
                >
                  <Square className="h-4 w-4" />
                </Button>
              </>
            ) : status === 'paused' ? (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1 h-9 bg-green-600 hover:bg-green-700"
                  onClick={resume}
                >
                  <Play className="h-4 w-4 mr-1" />
                  Resume
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-9 bg-slate-700 hover:bg-slate-600"
                  onClick={reset}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-9"
                  onClick={stop}
                >
                  <Square className="h-4 w-4" />
                </Button>
              </>
            ) : status === 'completed' ? (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1 h-9 bg-slate-700 hover:bg-slate-600"
                  onClick={reset}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Reset
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-9 bg-green-600 hover:bg-green-700"
                  onClick={start}
                >
                  <Play className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                className="flex-1 h-9 bg-green-600 hover:bg-green-700"
                onClick={start}
                disabled={!selectedDelivery && !selectedPresetRoute}
              >
                <Play className="h-4 w-4 mr-1" />
                Start Simulation
              </Button>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="text-xs text-red-400 bg-red-900/20 rounded px-2 py-1">
              {error}
            </div>
          )}

          {/* Current Position */}
          {simulator.currentPosition && (
            <div className="text-xs text-slate-500 font-mono">
              {simulator.currentPosition.latitude.toFixed(6)},{' '}
              {simulator.currentPosition.longitude.toFixed(6)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
