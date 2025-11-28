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
import { DRIVER_STATUS_COLORS, BATTERY_STATUS_COLORS, DELIVERY_MARKER_COLOR } from '@/constants/tracking-colors';
import { MAP_CONFIG, MARKER_CONFIG, BATTERY_THRESHOLDS } from '@/constants/tracking-config';
import { captureException, captureMessage, addSentryBreadcrumb } from '@/lib/monitoring/sentry';

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
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [shouldAutoFit, setShouldAutoFit] = useState(true);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Check if Mapbox token is configured
    if (!process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
        process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN === 'YOUR_MAPBOX_TOKEN_HERE' ||
        process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN === 'your_mapbox_access_token') {
      const errorMessage = 'Mapbox token not configured. Please add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to your .env.local file.';
      captureMessage(errorMessage, 'error', {
        feature: 'live-driver-map',
        action: 'mapbox-token-check',
        component: 'LiveDriverMap'
      });
      setMapError(errorMessage);
      return;
    }

    try {
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: MAP_CONFIG.DEFAULT_CENTER,
        zoom: compact ? MAP_CONFIG.COMPACT_ZOOM : MAP_CONFIG.DEFAULT_ZOOM,
        attributionControl: true,
      });

      // Add navigation controls
      map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

      // Add scale control
      map.addControl(new mapboxgl.ScaleControl({
        maxWidth: MARKER_CONFIG.POPUP_MAX_WIDTH,
        unit: 'imperial'
      }), 'bottom-left');

      // Track user interactions (drag, zoom, rotate) to disable auto-fit
      map.on('dragstart', () => setHasUserInteracted(true));
      map.on('zoomstart', () => setHasUserInteracted(true));
      map.on('rotatestart', () => setHasUserInteracted(true));

      map.on('load', () => {
        addSentryBreadcrumb('Map loaded successfully', {
          feature: 'live-driver-map',
          compact
        });
        setMapLoaded(true);
      });

      map.on('error', (e) => {
        captureException(e, {
          feature: 'live-driver-map',
          action: 'mapbox-error',
          component: 'LiveDriverMap'
        });
        setMapError('Failed to load map. Please check your Mapbox token.');
      });

      mapRef.current = map;

      // Capture refs at the time of effect setup for cleanup
      const markersRefCurrent = markersRef.current;
      const deliveryMarkersRefCurrent = deliveryMarkersRef.current;

      return () => {
        // Clean up markers before removing map to prevent memory leaks
        // Use captured refs to avoid stale closure issues
        markersRefCurrent.forEach(marker => marker.remove());
        deliveryMarkersRefCurrent.forEach(marker => marker.remove());
        markersRefCurrent.clear();
        deliveryMarkersRefCurrent.clear();

        map.remove();
        mapRef.current = null;
      };
    } catch (error) {
      captureException(error, {
        feature: 'live-driver-map',
        action: 'map-initialization',
        component: 'LiveDriverMap'
      });
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
  const getDriverColor = useCallback((driver: TrackedDriver): string => {
    if (!driver.isOnDuty) return DRIVER_STATUS_COLORS.offDuty;

    const recentLocation = recentLocations.find(loc => loc.driverId === driver.id);
    if (recentLocation) {
      if (recentLocation.isMoving) return DRIVER_STATUS_COLORS.moving;
      if (recentLocation.activityType === 'stationary') return DRIVER_STATUS_COLORS.stationary;
    }

    return DRIVER_STATUS_COLORS.onDuty;
  }, [recentLocations]);

  // Get battery status
  const getBatteryStatus = useCallback((driverId: string): { level?: number; status: 'good' | 'low' | 'critical' } => {
    const location = recentLocations.find(loc => loc.driverId === driverId);
    const level = location?.batteryLevel;

    if (!level) return { status: 'good' };

    if (level <= BATTERY_THRESHOLDS.CRITICAL) return { level, status: 'critical' };
    if (level <= BATTERY_THRESHOLDS.LOW) return { level, status: 'low' };
    return { level, status: 'good' };
  }, [recentLocations]);

  // Create custom marker element
  const createDriverMarkerElement = useCallback((driver: TrackedDriver): HTMLDivElement => {
    const el = document.createElement('div');
    el.className = 'driver-marker';
    el.style.width = '32px';
    el.style.height = '32px';
    el.style.cursor = 'pointer';

    const color = getDriverColor(driver);
    const battery = getBatteryStatus(driver.id);

    const batteryColor = battery.status === 'good'
      ? BATTERY_STATUS_COLORS.good
      : battery.status === 'low'
      ? BATTERY_STATUS_COLORS.low
      : BATTERY_STATUS_COLORS.critical;

    el.innerHTML = `
      <div style="position: relative; width: ${MARKER_CONFIG.DRIVER_MARKER_SIZE}px; height: ${MARKER_CONFIG.DRIVER_MARKER_SIZE}px;">
        <div style="
          width: ${MARKER_CONFIG.DRIVER_MARKER_SIZE}px;
          height: ${MARKER_CONFIG.DRIVER_MARKER_SIZE}px;
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
            background-color: ${batteryColor};
            border-radius: 50%;
            border: 1px solid white;
          "></div>
        ` : ''}
      </div>
    `;

    return el;
  }, [getDriverColor, getBatteryStatus]);

  // Create delivery marker element
  const createDeliveryMarkerElement = useCallback((): HTMLDivElement => {
    const el = document.createElement('div');
    el.className = 'delivery-marker';
    el.style.width = `${MARKER_CONFIG.DELIVERY_MARKER_SIZE}px`;
    el.style.height = `${MARKER_CONFIG.DELIVERY_MARKER_SIZE}px`;

    el.innerHTML = `
      <div style="
        width: ${MARKER_CONFIG.DELIVERY_MARKER_SIZE}px;
        height: ${MARKER_CONFIG.DELIVERY_MARKER_SIZE}px;
        background-color: ${DELIVERY_MARKER_COLOR};
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3" fill="${DELIVERY_MARKER_COLOR}"/>
        </svg>
      </div>
    `;

    return el;
  }, []);

  // Create popup content
  const createPopupContent = useCallback((driver: TrackedDriver): string => {
    const battery = getBatteryStatus(driver.id);
    const batteryIcon = battery.status === 'good' ? '🔋' : battery.status === 'low' ? '🪫' : '⚠️';
    const dutyColor = driver.isOnDuty ? DRIVER_STATUS_COLORS.moving : DRIVER_STATUS_COLORS.offDuty;

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
            background-color: ${dutyColor};
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
  }, [getBatteryStatus]);

  // Store previous driver states to detect visual changes
  const previousDriverStatesRef = useRef<Map<string, { color: string; batteryStatus: string }>>(new Map());

  // Helper function to check if marker needs recreation (visual properties changed)
  const shouldRecreateMarker = useCallback((driver: TrackedDriver): boolean => {
    const currentColor = getDriverColor(driver);
    const currentBattery = getBatteryStatus(driver.id).status;
    const previousState = previousDriverStatesRef.current.get(driver.id);

    if (!previousState) return true; // First time seeing this driver

    return previousState.color !== currentColor || previousState.batteryStatus !== currentBattery;
  }, [getDriverColor, getBatteryStatus]);

  // Update driver markers
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    const currentDriverIds = new Set(drivers.map(d => d.id));

    // Remove markers for drivers that are no longer in the list
    markersRef.current.forEach((marker, driverId) => {
      if (!currentDriverIds.has(driverId)) {
        marker.remove();
        markersRef.current.delete(driverId);
        previousDriverStatesRef.current.delete(driverId);
      }
    });

    // Add or update markers for current drivers
    drivers.forEach(driver => {
      if (!driver.lastKnownLocation?.coordinates) return;

      const [lng, lat] = driver.lastKnownLocation.coordinates;

      // Update existing marker
      if (markersRef.current.has(driver.id)) {
        const marker = markersRef.current.get(driver.id)!;

        // Only recreate marker if visual properties changed (color, battery status)
        if (shouldRecreateMarker(driver)) {
          marker.remove();
          markersRef.current.delete(driver.id);

          const el = createDriverMarkerElement(driver);
          const popup = new mapboxgl.Popup({ offset: MARKER_CONFIG.POPUP_OFFSET })
            .setHTML(createPopupContent(driver));

          const newMarker = new mapboxgl.Marker({
            element: el,
            anchor: 'center'
          })
            .setLngLat([lng, lat])
            .setPopup(popup)
            .addTo(mapRef.current!);

          markersRef.current.set(driver.id, newMarker);

          // Update stored state
          previousDriverStatesRef.current.set(driver.id, {
            color: getDriverColor(driver),
            batteryStatus: getBatteryStatus(driver.id).status
          });
        } else {
          // Just update position without recreating marker (much more efficient)
          marker.setLngLat([lng, lat]);
          // Update popup content in case other details changed
          const popup = marker.getPopup();
          if (popup) {
            popup.setHTML(createPopupContent(driver));
          }
        }
      } else {
        // Create new marker
        const el = createDriverMarkerElement(driver);
        const popup = new mapboxgl.Popup({ offset: MARKER_CONFIG.POPUP_OFFSET })
          .setHTML(createPopupContent(driver));

        const marker = new mapboxgl.Marker({
          element: el,
          anchor: 'center'
        })
          .setLngLat([lng, lat])
          .setPopup(popup)
          .addTo(mapRef.current!);

        markersRef.current.set(driver.id, marker);

        // Store initial state
        previousDriverStatesRef.current.set(driver.id, {
          color: getDriverColor(driver),
          batteryStatus: getBatteryStatus(driver.id).status
        });
      }
    });

    // Auto-fit map to show all drivers only on initial load or when explicitly requested
    if (drivers.length > 0 && shouldAutoFit && !hasUserInteracted) {
      const bounds = new mapboxgl.LngLatBounds();
      let hasValidLocation = false;

      drivers.forEach(driver => {
        if (driver.lastKnownLocation?.coordinates) {
          bounds.extend(driver.lastKnownLocation.coordinates as [number, number]);
          hasValidLocation = true;
        }
      });

      // Only fit bounds if we have multiple drivers with valid locations
      if (drivers.length > 1 && hasValidLocation) {
        mapRef.current.fitBounds(bounds, {
          padding: MAP_CONFIG.BOUNDS_PADDING,
          maxZoom: MAP_CONFIG.MAX_AUTO_ZOOM,
          duration: MAP_CONFIG.FIT_BOUNDS_DURATION
        });
      }

      // Disable auto-fit after first load
      setShouldAutoFit(false);
    }
  }, [drivers, recentLocations, mapLoaded, shouldAutoFit, hasUserInteracted, shouldRecreateMarker, createDriverMarkerElement, createPopupContent, getBatteryStatus, getDriverColor]);

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
  }, [deliveries, mapLoaded, createDeliveryMarkerElement]);

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
      padding: MAP_CONFIG.BOUNDS_PADDING,
      maxZoom: MAP_CONFIG.MAX_AUTO_ZOOM,
      duration: MAP_CONFIG.FIT_BOUNDS_DURATION
    });

    // Re-enable auto-fit when user explicitly clicks fit button
    setShouldAutoFit(true);
    setHasUserInteracted(false);
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
      <div
        ref={mapContainerRef}
        className="w-full h-full"
        role="application"
        aria-label="Live driver tracking map"
      />

      {/* Map controls */}
      {!compact && (
        <div className="absolute top-4 right-4 flex flex-col space-y-2 z-10">
          <Button
            size="sm"
            variant="outline"
            className="bg-white shadow-md"
            onClick={zoomIn}
            aria-label="Zoom in"
            title="Zoom in"
          >
            <ZoomInIcon className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="bg-white shadow-md"
            onClick={zoomOut}
            aria-label="Zoom out"
            title="Zoom out"
          >
            <ZoomOutIcon className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="bg-white shadow-md"
            onClick={fitToDrivers}
            aria-label="Fit map to all drivers"
            title="Fit map to all drivers"
          >
            <MaximizeIcon className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="bg-white shadow-md"
            onClick={toggleMapStyle}
            aria-label={mapStyle === 'streets' ? 'Switch to satellite view' : 'Switch to street view'}
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
