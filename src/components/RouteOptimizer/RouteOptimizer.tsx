'use client';

import React, { useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Navigation,
  Plus,
  Trash2,
  Loader2,
  RotateCcw,
  ArrowRightLeft,
} from 'lucide-react';
import LocationInput from './LocationInput';
import RouteMap from './RouteMap';
import RouteResults from './RouteResults';
import type { RouteResult, LatLng, RouteStatus } from './types';

interface WaypointState {
  address: string;
  coords?: LatLng;
}

export default function RouteOptimizer() {
  // ── Form State ──────────────────────────────────────
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupCoords, setPickupCoords] = useState<LatLng>();
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [dropoffCoords, setDropoffCoords] = useState<LatLng>();
  const [waypoints, setWaypoints] = useState<WaypointState[]>([]);
  const [optimizeWaypoints, setOptimizeWaypoints] = useState(false);
  const [avoidTolls, setAvoidTolls] = useState(false);
  const [avoidHighways, setAvoidHighways] = useState(false);

  // ── Result State ────────────────────────────────────
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [status, setStatus] = useState<RouteStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const canCalculate =
    pickupAddress.length >= 3 && dropoffAddress.length >= 3;

  // ── Handlers ──────────────────────────────────────

  const handleCalculate = useCallback(async () => {
    if (!canCalculate) return;
    setStatus('loading');
    setErrorMsg('');
    setRoute(null);

    try {
      const body: Record<string, unknown> = {
        pickup: { address: pickupAddress },
        dropoff: { address: dropoffAddress },
        avoidTolls,
        avoidHighways,
      };

      if (waypoints.length > 0) {
        body.waypoints = waypoints
          .filter((wp) => wp.address.length >= 3)
          .map((wp) => ({ address: wp.address }));
        body.optimizeWaypoints = optimizeWaypoints;
      }

      const res = await fetch('/api/routes/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'Route calculation failed');
      }

      setRoute(data.data as RouteResult);
      setStatus('success');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'An unexpected error occurred',
      );
      setStatus('error');
    }
  }, [
    canCalculate,
    pickupAddress,
    dropoffAddress,
    waypoints,
    optimizeWaypoints,
    avoidTolls,
    avoidHighways,
  ]);

  const addWaypoint = () => {
    setWaypoints((prev) => [...prev, { address: '' }]);
  };

  const removeWaypoint = (index: number) => {
    setWaypoints((prev) => prev.filter((_, i) => i !== index));
  };

  const updateWaypointAddress = (index: number, address: string) => {
    setWaypoints((prev) =>
      prev.map((wp, i) => (i === index ? { ...wp, address } : wp)),
    );
  };

  const updateWaypointCoords = (index: number, lat: number, lng: number) => {
    setWaypoints((prev) =>
      prev.map((wp, i) =>
        i === index ? { ...wp, coords: { lat, lng } } : wp,
      ),
    );
  };

  const swapOriginDestination = () => {
    const tmpAddr = pickupAddress;
    const tmpCoords = pickupCoords;
    setPickupAddress(dropoffAddress);
    setPickupCoords(dropoffCoords);
    setDropoffAddress(tmpAddr);
    setDropoffCoords(tmpCoords);
  };

  const resetForm = () => {
    setPickupAddress('');
    setPickupCoords(undefined);
    setDropoffAddress('');
    setDropoffCoords(undefined);
    setWaypoints([]);
    setOptimizeWaypoints(false);
    setAvoidTolls(false);
    setAvoidHighways(false);
    setRoute(null);
    setStatus('idle');
    setErrorMsg('');
  };

  // ── Render ────────────────────────────────────────

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Left column: Form */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Navigation className="h-5 w-5 text-amber-600" />
              Route Optimizer
            </CardTitle>
            <CardDescription>
              Calculate the optimal driving route between locations
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Pickup */}
            <LocationInput
              label="Pickup Location"
              placeholder="Enter pickup address..."
              value={pickupAddress}
              onChange={setPickupAddress}
              onCoordinatesResolved={(lat, lng) =>
                setPickupCoords({ lat, lng })
              }
              icon="pickup"
            />

            {/* Swap Button */}
            <div className="flex justify-center">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={swapOriginDestination}
                aria-label="Swap pickup and drop-off"
              >
                <ArrowRightLeft className="h-4 w-4 text-gray-400" />
              </Button>
            </div>

            {/* Drop-off */}
            <LocationInput
              label="Drop-off Location"
              placeholder="Enter drop-off address..."
              value={dropoffAddress}
              onChange={setDropoffAddress}
              onCoordinatesResolved={(lat, lng) =>
                setDropoffCoords({ lat, lng })
              }
              icon="dropoff"
            />

            {/* Waypoints */}
            {waypoints.map((wp, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <div className="flex-1">
                  <LocationInput
                    label={`Stop ${idx + 1}`}
                    placeholder="Enter waypoint address..."
                    value={wp.address}
                    onChange={(addr) => updateWaypointAddress(idx, addr)}
                    onCoordinatesResolved={(lat, lng) =>
                      updateWaypointCoords(idx, lat, lng)
                    }
                    icon="waypoint"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mt-7 h-9 w-9 text-gray-400 hover:text-red-500"
                  onClick={() => removeWaypoint(idx)}
                  aria-label={`Remove stop ${idx + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full border-dashed"
              onClick={addWaypoint}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Add Waypoint
            </Button>

            {/* Route preferences */}
            <div className="space-y-3 rounded-lg border border-gray-200 p-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Route Preferences
              </p>

              {waypoints.length > 0 && (
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="optimize-wp"
                    className="text-sm text-gray-700"
                  >
                    Optimize waypoint order
                  </Label>
                  <Switch
                    id="optimize-wp"
                    checked={optimizeWaypoints}
                    onCheckedChange={setOptimizeWaypoints}
                  />
                </div>
              )}

              <div className="flex items-center justify-between">
                <Label htmlFor="avoid-tolls" className="text-sm text-gray-700">
                  Avoid tolls
                </Label>
                <Switch
                  id="avoid-tolls"
                  checked={avoidTolls}
                  onCheckedChange={setAvoidTolls}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label
                  htmlFor="avoid-highways"
                  className="text-sm text-gray-700"
                >
                  Avoid highways
                </Label>
                <Switch
                  id="avoid-highways"
                  checked={avoidHighways}
                  onCheckedChange={setAvoidHighways}
                />
              </div>
            </div>

            {/* Error message */}
            {status === 'error' && errorMsg && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                {errorMsg}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
              <Button
                type="button"
                className="flex-1"
                disabled={!canCalculate || status === 'loading'}
                onClick={handleCalculate}
              >
                {status === 'loading' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Calculating...
                  </>
                ) : (
                  <>
                    <Navigation className="mr-2 h-4 w-4" />
                    Calculate Route
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={resetForm}
                aria-label="Reset form"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results below form on mobile */}
        {route && (
          <div className="lg:hidden">
            <RouteResults route={route} />
          </div>
        )}
      </div>

      {/* Right column: Map + Results (desktop) */}
      <div className="space-y-4">
        <RouteMap
          route={route}
          pickupCoords={pickupCoords}
          dropoffCoords={dropoffCoords}
          waypointCoords={waypoints
            .filter((wp) => wp.coords != null)
            .map((wp) => wp.coords as LatLng)}
          className="h-[400px]"
        />

        {route && (
          <div className="hidden lg:block">
            <RouteResults route={route} />
          </div>
        )}
      </div>
    </div>
  );
}
