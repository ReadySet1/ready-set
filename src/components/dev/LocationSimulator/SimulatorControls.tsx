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
    deliveries,
    selectedDelivery,
    presetRoutes,
    selectedPresetRoute,
    routeDistance,
    estimatedDuration,
    enable,
    disable,
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

  const activeDeliveries = deliveries.filter(
    (d) => !['delivered', 'cancelled'].includes(d.status.toLowerCase())
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
                {/* Active Deliveries */}
                {activeDeliveries.length > 0 && (
                  <SelectGroup>
                    <SelectLabel className="text-slate-400">Active Deliveries</SelectLabel>
                    {activeDeliveries.map((delivery) => (
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

                {activeDeliveries.length > 0 && presetRoutes.length > 0 && (
                  <SelectSeparator className="bg-slate-700" />
                )}

                {/* Preset Routes */}
                {presetRoutes.length > 0 && (
                  <SelectGroup>
                    <SelectLabel className="text-slate-400">Preset Routes</SelectLabel>
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
