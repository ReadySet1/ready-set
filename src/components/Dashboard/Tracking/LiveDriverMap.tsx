'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  TruckIcon,
  MapPinIcon,
  BatteryIcon,
  AlertTriangleIcon,
  ZoomInIcon,
  ZoomOutIcon,
  MaximizeIcon,
  MapIcon,
  SatelliteIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TrackedDriver, DeliveryTracking } from '@/types/tracking';

// Ensure Mapbox token is available
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN) {
  mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
}

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

type MapStyle = 'streets' | 'satellite';

export default function LiveDriverMap({
  drivers,
  deliveries,
  recentLocations,
  compact = false,
  className
}: LiveDriverMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const deliveryMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [mapStyle, setMapStyle] = useState<MapStyle>('streets');
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Check if Mapbox token is configured
    if (!process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
        process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN === 'YOUR_MAPBOX_TOKEN_HERE') {
      setMapError('Mapbox token not configured. Please add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to your .env.local file.');
      return;
    }

    try {
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [-118.2437, 34.0522], // Los Angeles
        zoom: compact ? 10 : 12,
        attributionControl: true,
      });

      // Add navigation controls
      map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

      // Add scale control
      map.addControl(new mapboxgl.ScaleControl({
        maxWidth: 100,
        unit: 'imperial'
      }), 'bottom-left');

      map.on('load', () => {
        setMapLoaded(true);
      });

      map.on('error', (e) => {
        console.error('Mapbox error:', e);
        setMapError('Failed to load map. Please check your Mapbox token.');
      });

      mapRef.current = map;

      return () => {
        map.remove();
        mapRef.current = null;
      };
    } catch (error) {
      console.error('Error initializing Mapbox:', error);
      setMapError('Failed to initialize map. Please check console for details.');
    }
  }, [compact]);

  // Toggle map style
  const toggleMapStyle = useCallback(() => {
    if (!mapRef.current) return;

    const newStyle = mapStyle === 'streets' ? 'satellite' : 'streets';
    const styleUrl = newStyle === 'streets'
      ? 'mapbox://styles/mapbox/streets-v12'
      : 'mapbox://styles/mapbox/satellite-streets-v12';

    mapRef.current.setStyle(styleUrl);
    setMapStyle(newStyle);
  }, [mapStyle]);

  // Get driver color based on status
  const getDriverColor = (driver: TrackedDriver): string => {
    if (!driver.isOnDuty) return '#94a3b8'; // gray-400

    const recentLocation = recentLocations.find(loc => loc.driverId === driver.id);
    if (recentLocation) {
      if (recentLocation.isMoving) return '#22c55e'; // green-500
      if (recentLocation.activityType === 'stationary') return '#eab308'; // yellow-500
    }

    return '#3b82f6'; // blue-500
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

  // Create custom marker element
  const createDriverMarkerElement = (driver: TrackedDriver): HTMLDivElement => {
    const el = document.createElement('div');
    el.className = 'driver-marker';
    el.style.width = '32px';
    el.style.height = '32px';
    el.style.cursor = 'pointer';

    const color = getDriverColor(driver);
    const battery = getBatteryStatus(driver.id);

    el.innerHTML = `
      <div style="position: relative; width: 32px; height: 32px;">
        <div style="
          width: 32px;
          height: 32px;
          background-color: ${color};
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
            <path d="M14 16H9m10-5.5V12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-5.5M5.2 4h13.6c.5 0 1.1.2 1.4.6.3.3.4.8.4 1.4v8c0 .5-.1 1-.4 1.4-.3.3-.9.6-1.4.6H5.2c-.5 0-1.1-.2-1.4-.6-.3-.3-.4-.8-.4-1.4V6c0-.5.1-1 .4-1.4C4.1 4.2 4.7 4 5.2 4z"/>
          </svg>
        </div>
        ${battery.level ? `
          <div style="
            position: absolute;
            top: -4px;
            right: -4px;
            width: 12px;
            height: 12px;
            background-color: ${battery.status === 'good' ? '#22c55e' : battery.status === 'low' ? '#eab308' : '#ef4444'};
            border-radius: 50%;
            border: 1px solid white;
          "></div>
        ` : ''}
      </div>
    `;

    return el;
  };

  // Create delivery marker element
  const createDeliveryMarkerElement = (): HTMLDivElement => {
    const el = document.createElement('div');
    el.className = 'delivery-marker';
    el.style.width = '24px';
    el.style.height = '24px';

    el.innerHTML = `
      <div style="
        width: 24px;
        height: 24px;
        background-color: #f97316;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3" fill="#f97316"/>
        </svg>
      </div>
    `;

    return el;
  };

  // Create popup content
  const createPopupContent = (driver: TrackedDriver): string => {
    const battery = getBatteryStatus(driver.id);
    const batteryIcon = battery.status === 'good' ? '🔋' : battery.status === 'low' ? '🪫' : '⚠️';

    return `
      <div style="padding: 8px; min-width: 200px;">
        <div style="font-weight: 600; margin-bottom: 8px;">Driver #${driver.employeeId}</div>
        <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">
          Vehicle: ${driver.vehicleNumber || 'N/A'}
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <span style="
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            background-color: ${driver.isOnDuty ? '#22c55e' : '#94a3b8'};
            color: white;
          ">
            ${driver.isOnDuty ? 'On Duty' : 'Off Duty'}
          </span>
          ${battery.level ? `
            <span style="font-size: 11px;">
              ${batteryIcon} ${battery.level}%
            </span>
          ` : ''}
        </div>
        ${driver.currentShift ? `
          <div style="font-size: 11px; color: #6b7280;">
            <div>Deliveries: ${driver.currentShift.deliveryCount || 0}</div>
            <div>Distance: ${Math.round((driver.currentShift.totalDistanceKm || 0) * 10) / 10} km</div>
          </div>
        ` : ''}
      </div>
    `;
  };

  // Update driver markers
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    // Helper functions are stable and don't need to be in dependencies
    const buildDriverMarkerElement = createDriverMarkerElement;
    const buildPopupContent = createPopupContent;

    const currentDriverIds = new Set(drivers.map(d => d.id));

    // Remove markers for drivers that are no longer in the list
    markersRef.current.forEach((marker, driverId) => {
      if (!currentDriverIds.has(driverId)) {
        marker.remove();
        markersRef.current.delete(driverId);
      }
    });

    // Add or update markers for current drivers
    drivers.forEach(driver => {
      if (!driver.lastKnownLocation?.coordinates) return;

      const [lng, lat] = driver.lastKnownLocation.coordinates;

      // Update existing marker or create new one
      if (markersRef.current.has(driver.id)) {
        const marker = markersRef.current.get(driver.id)!;
        marker.setLngLat([lng, lat]);

        // Remove old marker and create new one (Mapbox markers can't update elements directly)
        marker.remove();
        markersRef.current.delete(driver.id);

        const el = buildDriverMarkerElement(driver);
        const popup = new mapboxgl.Popup({ offset: 25 })
          .setHTML(buildPopupContent(driver));

        const newMarker = new mapboxgl.Marker({
          element: el,
          anchor: 'center'
        })
          .setLngLat([lng, lat])
          .setPopup(popup)
          .addTo(mapRef.current!);

        markersRef.current.set(driver.id, newMarker);
      } else {
        const el = buildDriverMarkerElement(driver);
        const popup = new mapboxgl.Popup({ offset: 25 })
          .setHTML(buildPopupContent(driver));

        const marker = new mapboxgl.Marker({
          element: el,
          anchor: 'center'
        })
          .setLngLat([lng, lat])
          .setPopup(popup)
          .addTo(mapRef.current!);

        markersRef.current.set(driver.id, marker);
      }
    });

    // Fit map to show all drivers
    if (drivers.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();

      drivers.forEach(driver => {
        if (driver.lastKnownLocation?.coordinates) {
          bounds.extend(driver.lastKnownLocation.coordinates as [number, number]);
        }
      });

      // Only fit bounds if we have multiple drivers, otherwise it might zoom too much
      if (drivers.length > 1) {
        mapRef.current.fitBounds(bounds, {
          padding: 50,
          maxZoom: 15,
          duration: 1000
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drivers, recentLocations, mapLoaded]);

  // Update delivery markers
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    const currentDeliveryIds = new Set(deliveries.map(d => d.id));

    // Remove markers for deliveries that are no longer in the list
    deliveryMarkersRef.current.forEach((marker, deliveryId) => {
      if (!currentDeliveryIds.has(deliveryId)) {
        marker.remove();
        deliveryMarkersRef.current.delete(deliveryId);
      }
    });

    // Add or update markers for current deliveries
    deliveries.forEach(delivery => {
      if (!delivery.deliveryLocation?.coordinates) return;

      const [lng, lat] = delivery.deliveryLocation.coordinates;

      if (deliveryMarkersRef.current.has(delivery.id)) {
        const marker = deliveryMarkersRef.current.get(delivery.id)!;
        marker.setLngLat([lng, lat]);
      } else {
        const el = createDeliveryMarkerElement();
        const popup = new mapboxgl.Popup({ offset: 15 })
          .setHTML(`
            <div style="padding: 8px;">
              <div style="font-weight: 600; margin-bottom: 4px;">Delivery Location</div>
              <div style="font-size: 12px; color: #6b7280;">
                Order #${delivery.id.substring(0, 8)}
              </div>
            </div>
          `);

        const marker = new mapboxgl.Marker({
          element: el,
          anchor: 'center'
        })
          .setLngLat([lng, lat])
          .setPopup(popup)
          .addTo(mapRef.current!);

        deliveryMarkersRef.current.set(delivery.id, marker);
      }
    });
  }, [deliveries, mapLoaded]);

  // Zoom controls
  const zoomIn = () => {
    mapRef.current?.zoomIn();
  };

  const zoomOut = () => {
    mapRef.current?.zoomOut();
  };

  const fitToDrivers = () => {
    if (!mapRef.current || drivers.length === 0) return;

    const bounds = new mapboxgl.LngLatBounds();
    drivers.forEach(driver => {
      if (driver.lastKnownLocation?.coordinates) {
        bounds.extend(driver.lastKnownLocation.coordinates as [number, number]);
      }
    });

    mapRef.current.fitBounds(bounds, {
      padding: 50,
      maxZoom: 15,
      duration: 1000
    });
  };

  // Error state
  if (mapError) {
    return (
      <div className={cn('relative w-full h-full bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center', className)}>
        <div className="text-center text-red-500 p-4">
          <AlertTriangleIcon className="w-12 h-12 mx-auto mb-2" />
          <p className="text-sm font-medium mb-2">Map Error</p>
          <p className="text-xs text-gray-600 max-w-md">{mapError}</p>
          <p className="text-xs text-gray-500 mt-2">
            Get your token from:{' '}
            <a
              href="https://account.mapbox.com/access-tokens/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 underline"
            >
              Mapbox Dashboard
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('relative w-full h-full rounded-lg overflow-hidden', className)}>
      {/* Map container */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Map controls */}
      {!compact && (
        <div className="absolute top-4 right-4 flex flex-col space-y-2 z-10">
          <Button size="sm" variant="outline" className="bg-white shadow-md" onClick={zoomIn}>
            <ZoomInIcon className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline" className="bg-white shadow-md" onClick={zoomOut}>
            <ZoomOutIcon className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline" className="bg-white shadow-md" onClick={fitToDrivers}>
            <MaximizeIcon className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="bg-white shadow-md"
            onClick={toggleMapStyle}
            title="Toggle map style"
          >
            {mapStyle === 'streets' ? (
              <SatelliteIcon className="w-4 h-4" />
            ) : (
              <MapIcon className="w-4 h-4" />
            )}
          </Button>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-3 z-10">
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
            <div className="w-3 h-3 bg-gray-400 rounded-full" />
            <span>Off Duty</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-orange-500 rounded-full" />
            <span>Delivery</span>
          </div>
        </div>
      </div>

      {/* Status info */}
      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-2 z-10">
        <div className="text-xs text-gray-600">
          {drivers.length} drivers • {recentLocations.length} updates
        </div>
      </div>

      {/* No data message */}
      {drivers.length === 0 && mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="text-center text-gray-500 bg-white rounded-lg shadow-lg p-4">
            <AlertTriangleIcon className="w-12 h-12 mx-auto mb-2" />
            <p className="text-sm">No active drivers to display</p>
          </div>
        </div>
      )}

      {/* Loading state */}
      {!mapLoaded && !mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
          <div className="text-center text-gray-600">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-2" />
            <p className="text-sm">Loading map...</p>
          </div>
        </div>
      )}
    </div>
  );
}
