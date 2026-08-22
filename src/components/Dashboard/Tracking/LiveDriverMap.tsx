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
import { DRIVER_STATUS_COLORS, BATTERY_STATUS_COLORS, DELIVERY_MARKER_COLOR, PICKUP_MARKER_COLOR } from '@/constants/tracking-colors';
import { MAP_CONFIG, MARKER_CONFIG, BATTERY_THRESHOLDS } from '@/constants/tracking-config';
import { isLocationStale } from '@/lib/realtime/stale-detection';
import { useTrackingSettings } from '@/hooks/tracking/useTrackingSettings';
import { captureException, captureMessage, addSentryBreadcrumb } from '@/lib/monitoring/sentry';
import { buildDriverPopupHtml } from '@/lib/tracking/driver-popup';
import {
  appendTrailPoint,
  trailLengthMiles,
  type LngLat,
  type TrailFeature,
} from '@/lib/tracking/trail-geojson';

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

const TRAIL_SOURCE_PREFIX = 'trail-';
const ROUTE_SOURCE_PREFIX = 'route-';
const ROUTE_LINE_COLOR = '#6b7280';
const TERMINAL_DELIVERY_STATUSES = new Set(['COMPLETED', 'CANCELLED', 'delivered', 'cancelled']);

interface TrailState {
  shiftId: string;
  feature: TrailFeature;
}

interface LineStyle {
  color: string;
  dashed?: boolean;
}

const resolveMapboxToken = (): string | undefined => {
  const token = mapboxgl.accessToken || process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  return token && token !== 'YOUR_MAPBOX_TOKEN_HERE' && token !== 'your_mapbox_access_token'
    ? token
    : undefined;
};

/** Add (or refresh) a GeoJSON line source + layer. Safe to call repeatedly. */
const upsertLineLayer = (
  map: mapboxgl.Map,
  id: string,
  feature: TrailFeature,
  style: LineStyle,
  visible: boolean,
): void => {
  const existing = map.getSource(id) as mapboxgl.GeoJSONSource | undefined;
  if (existing) {
    existing.setData(feature);
    return;
  }
  map.addSource(id, { type: 'geojson', data: feature });
  map.addLayer({
    id,
    type: 'line',
    source: id,
    layout: {
      'line-join': 'round',
      'line-cap': 'round',
      visibility: visible ? 'visible' : 'none',
    },
    paint: {
      'line-color': style.color,
      'line-width': style.dashed ? 3 : 4,
      'line-opacity': style.dashed ? 0.8 : 0.9,
      ...(style.dashed ? { 'line-dasharray': [2, 2] } : {}),
    },
  });
};

const removeLineLayer = (map: mapboxgl.Map, id: string): void => {
  if (map.getLayer(id)) map.removeLayer(id);
  if (map.getSource(id)) map.removeSource(id);
};

const setLineVisibility = (map: mapboxgl.Map, id: string, visible: boolean): void => {
  if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
};

const isActiveDeliveryFor = (delivery: DeliveryTracking, driver: TrackedDriver): boolean => {
  if (TERMINAL_DELIVERY_STATUSES.has(String(delivery.status))) return false;
  if (delivery.driverId === driver.id) return true;
  return Boolean(driver.userId && delivery.dispatchDriverId && delivery.dispatchDriverId === driver.userId);
};

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
  const pickupMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [mapStyle, setMapStyle] = useState<MapStyle>('streets');
  const [mapLoaded, setMapLoaded] = useState(false);
  const { settings } = useTrackingSettings();
  const staleThresholdMs = settings.staleGpsThresholdSeconds * 1000;
  const [mapError, setMapError] = useState<string | null>(null);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [shouldAutoFit, setShouldAutoFit] = useState(true);
  const [showTrails, setShowTrails] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);
  // Travelled trails keyed by driver id; planned routes keyed by delivery id.
  const trailsRef = useRef<Map<string, TrailState>>(new Map());
  const trailRequestsRef = useRef<Set<string>>(new Set());
  const seenPingsRef = useRef<Set<string>>(new Set());
  const routesRef = useRef<Map<string, TrailFeature>>(new Map());
  const routeRequestsRef = useRef<Set<string>>(new Set());
  const showTrailsRef = useRef(showTrails);
  const showRoutesRef = useRef(showRoutes);
  showTrailsRef.current = showTrails;
  showRoutesRef.current = showRoutes;
  const lineColorsRef = useRef<Map<string, string>>(new Map());
  // Keeps the newest pings reachable from the async trail fetch.
  const recentLocationsRef = useRef(recentLocations);
  recentLocationsRef.current = recentLocations;

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

      // setStyle() drops every custom source/layer; redraw the lines once the
      // new style is ready.
      map.on('style.load', () => {
        trailsRef.current.forEach((trail, driverId) => {
          upsertLineLayer(map, `${TRAIL_SOURCE_PREFIX}${driverId}`, trail.feature,
            { color: lineColorsRef.current.get(driverId) ?? DRIVER_STATUS_COLORS.onDuty }, showTrailsRef.current);
        });
        routesRef.current.forEach((feature, deliveryId) => {
          upsertLineLayer(map, `${ROUTE_SOURCE_PREFIX}${deliveryId}`, feature,
            { color: ROUTE_LINE_COLOR, dashed: true }, showRoutesRef.current);
        });
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
      const pickupMarkersRefCurrent = pickupMarkersRef.current;
      const trailsRefCurrent = trailsRef.current;
      const trailRequestsRefCurrent = trailRequestsRef.current;
      const seenPingsRefCurrent = seenPingsRef.current;
      const routesRefCurrent = routesRef.current;
      const routeRequestsRefCurrent = routeRequestsRef.current;

      return () => {
        // Clean up markers before removing map to prevent memory leaks
        // Use captured refs to avoid stale closure issues
        markersRefCurrent.forEach(marker => marker.remove());
        deliveryMarkersRefCurrent.forEach(marker => marker.remove());
        pickupMarkersRefCurrent.forEach(marker => marker.remove());
        markersRefCurrent.clear();
        deliveryMarkersRefCurrent.clear();
        pickupMarkersRefCurrent.clear();
        // map.remove() disposes sources/layers; drop our bookkeeping too.
        trailsRefCurrent.clear();
        trailRequestsRefCurrent.clear();
        seenPingsRefCurrent.clear();
        routesRefCurrent.clear();
        routeRequestsRefCurrent.clear();

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

    // On duty but no recent GPS fix (app closed / lost signal) → offline, not "stopped".
    if (isLocationStale(driver.lastLocationUpdate, staleThresholdMs))
      return DRIVER_STATUS_COLORS.stale;

    const recentLocation = recentLocations.find(loc => loc.driverId === driver.id);
    if (recentLocation) {
      if (recentLocation.isMoving) return DRIVER_STATUS_COLORS.moving;
      if (recentLocation.activityType === 'stationary') return DRIVER_STATUS_COLORS.stationary;
    }

    return DRIVER_STATUS_COLORS.onDuty;
  }, [recentLocations, staleThresholdMs]);

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

  // Create pickup (restaurant) marker element — distinct violet rounded-square
  // with a shopping-bag glyph, so it reads differently from the orange drop-off pin.
  const createPickupMarkerElement = useCallback((): HTMLDivElement => {
    const el = document.createElement('div');
    el.className = 'pickup-marker';
    el.style.width = `${MARKER_CONFIG.DELIVERY_MARKER_SIZE}px`;
    el.style.height = `${MARKER_CONFIG.DELIVERY_MARKER_SIZE}px`;

    el.innerHTML = `
      <div style="
        width: ${MARKER_CONFIG.DELIVERY_MARKER_SIZE}px;
        height: ${MARKER_CONFIG.DELIVERY_MARKER_SIZE}px;
        background-color: ${PICKUP_MARKER_COLOR};
        border-radius: 6px;
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/>
          <path d="M3 6h18"/>
          <path d="M16 10a4 4 0 0 1-8 0"/>
        </svg>
      </div>
    `;

    return el;
  }, []);

  // Create popup content
  const createPopupContent = useCallback((driver: TrackedDriver): string => {
    const activeDelivery = deliveries.find(delivery => isActiveDeliveryFor(delivery, driver));
    const trail = trailsRef.current.get(driver.id);
    return buildDriverPopupHtml({
      driver,
      battery: getBatteryStatus(driver.id),
      activeDelivery,
      trailMiles: trail ? trailLengthMiles(trail.feature) : undefined,
    });
  }, [getBatteryStatus, deliveries]);

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

  // Update pickup (restaurant) markers — one per delivery that has a known pickup point
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    const currentDeliveryIds = new Set(deliveries.map(d => d.id));

    // Remove pickup markers for deliveries that are no longer in the list
    pickupMarkersRef.current.forEach((marker, deliveryId) => {
      if (!currentDeliveryIds.has(deliveryId)) {
        marker.remove();
        pickupMarkersRef.current.delete(deliveryId);
      }
    });

    // Add or update a pickup marker for each delivery with pickup coordinates
    deliveries.forEach(delivery => {
      if (!delivery.pickupLocation?.coordinates) return;

      const [lng, lat] = delivery.pickupLocation.coordinates;

      if (pickupMarkersRef.current.has(delivery.id)) {
        const marker = pickupMarkersRef.current.get(delivery.id)!;
        marker.setLngLat([lng, lat]);
      } else {
        const el = createPickupMarkerElement();
        const popup = new mapboxgl.Popup({ offset: 15 })
          .setHTML(`
            <div style="padding: 8px;">
              <div style="font-weight: 600; margin-bottom: 4px;">Pickup Location</div>
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

        pickupMarkersRef.current.set(delivery.id, marker);
      }
    });
  }, [deliveries, mapLoaded, createPickupMarkerElement]);

  // Travelled trails: fetch each on-duty driver's active-shift trail once,
  // then keep the Mapbox source in sync. Drivers that leave the map take their
  // trail with them.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const currentDriverIds = new Set(drivers.map(d => d.id));
    trailsRef.current.forEach((_trail, driverId) => {
      if (!currentDriverIds.has(driverId)) {
        removeLineLayer(map, `${TRAIL_SOURCE_PREFIX}${driverId}`);
        trailsRef.current.delete(driverId);
        lineColorsRef.current.delete(driverId);
      }
    });

    drivers.forEach(driver => {
      const sourceId = `${TRAIL_SOURCE_PREFIX}${driver.id}`;
      const shiftId = driver.isOnDuty ? driver.currentShiftId : undefined;
      const existing = trailsRef.current.get(driver.id);

      if (!shiftId) {
        if (existing) {
          removeLineLayer(map, sourceId);
          trailsRef.current.delete(driver.id);
        }
        return;
      }

      const color = getDriverColor(driver);
      if (existing && existing.shiftId === shiftId) {
        if (lineColorsRef.current.get(driver.id) !== color) {
          lineColorsRef.current.set(driver.id, color);
          if (map.getLayer(sourceId)) map.setPaintProperty(sourceId, 'line-color', color);
        }
        return;
      }

      if (existing) {
        // New shift for the same driver: start a fresh trail.
        removeLineLayer(map, sourceId);
        trailsRef.current.delete(driver.id);
      }

      if (trailRequestsRef.current.has(shiftId) || typeof fetch !== 'function') return;
      trailRequestsRef.current.add(shiftId);

      fetch(`/api/tracking/shifts/${encodeURIComponent(shiftId)}/trail`, { credentials: 'same-origin' })
        .then(async (response) => {
          if (!response.ok) throw new Error(`Trail request failed with ${response.status}`);
          const json = await response.json();
          const feature = json?.data?.trail as TrailFeature | undefined;
          if (!feature || feature.geometry?.type !== 'LineString') return;
          const liveMap = mapRef.current;
          if (!liveMap) return;
          trailsRef.current.set(driver.id, { shiftId, feature });
          lineColorsRef.current.set(driver.id, color);
          // Pings already on screen are already persisted in the trail.
          recentLocationsRef.current
            .filter(loc => loc.driverId === driver.id)
            .forEach(loc => seenPingsRef.current.add(`${loc.driverId}:${loc.recordedAt}`));
          upsertLineLayer(liveMap, sourceId, feature, { color }, showTrailsRef.current);
        })
        .catch((error) => {
          trailRequestsRef.current.delete(shiftId);
          addSentryBreadcrumb('Trail fetch failed', {
            feature: 'live-driver-map',
            shiftId,
            message: error instanceof Error ? error.message : String(error),
          });
        });
    });
  }, [drivers, mapLoaded, getDriverColor]);

  // Append realtime pings to the trails client-side (no refetch).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const fresh = recentLocations
      .filter(loc => !seenPingsRef.current.has(`${loc.driverId}:${loc.recordedAt}`))
      .sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt));

    const touched = new Set<string>();
    fresh.forEach(loc => {
      const trail = trailsRef.current.get(loc.driverId);
      if (!trail) return; // trail not loaded yet — the fetch marks pings as seen
      seenPingsRef.current.add(`${loc.driverId}:${loc.recordedAt}`);
      const next = appendTrailPoint(trail.feature, loc.location.coordinates as LngLat);
      if (next === trail.feature) return;
      trail.feature = next;
      touched.add(loc.driverId);
    });

    touched.forEach(driverId => {
      const source = map.getSource(`${TRAIL_SOURCE_PREFIX}${driverId}`) as mapboxgl.GeoJSONSource | undefined;
      const trail = trailsRef.current.get(driverId);
      if (source && trail) source.setData(trail.feature);
    });
  }, [recentLocations, mapLoaded]);

  // Planned routes: pickup → drop-off via Mapbox Directions, cached per delivery.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const currentDeliveryIds = new Set(deliveries.map(d => d.id));
    routesRef.current.forEach((_feature, deliveryId) => {
      if (!currentDeliveryIds.has(deliveryId)) {
        removeLineLayer(map, `${ROUTE_SOURCE_PREFIX}${deliveryId}`);
        routesRef.current.delete(deliveryId);
        routeRequestsRef.current.delete(deliveryId);
      }
    });

    const token = resolveMapboxToken();
    if (!token || typeof fetch !== 'function') return;

    deliveries.forEach(delivery => {
      const pickup = delivery.pickupLocation?.coordinates;
      const dropoff = delivery.deliveryLocation?.coordinates;
      if (!pickup || !dropoff || routeRequestsRef.current.has(delivery.id)) return;
      routeRequestsRef.current.add(delivery.id);

      const coords = `${pickup[0]},${pickup[1]};${dropoff[0]},${dropoff[1]}`;
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=geojson&overview=full&access_token=${encodeURIComponent(token)}`;

      fetch(url)
        .then(async (response) => {
          if (!response.ok) throw new Error(`Directions request failed with ${response.status}`);
          const json = await response.json();
          const geometry = json?.routes?.[0]?.geometry;
          if (!geometry || geometry.type !== 'LineString' || !Array.isArray(geometry.coordinates)) return;
          const liveMap = mapRef.current;
          if (!liveMap) return;
          const feature: TrailFeature = {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: geometry.coordinates as LngLat[] },
            properties: { pointCount: geometry.coordinates.length },
          };
          routesRef.current.set(delivery.id, feature);
          upsertLineLayer(liveMap, `${ROUTE_SOURCE_PREFIX}${delivery.id}`, feature,
            { color: ROUTE_LINE_COLOR, dashed: true }, showRoutesRef.current);
        })
        .catch((error) => {
          // Silent by design: a missing route must never break the map.
          addSentryBreadcrumb('Directions fetch failed', {
            feature: 'live-driver-map',
            deliveryId: delivery.id,
            message: error instanceof Error ? error.message : String(error),
          });
        });
    });
  }, [deliveries, mapLoaded]);

  // Legend toggles.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    trailsRef.current.forEach((_trail, driverId) =>
      setLineVisibility(map, `${TRAIL_SOURCE_PREFIX}${driverId}`, showTrails));
  }, [showTrails, mapLoaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    routesRef.current.forEach((_feature, deliveryId) =>
      setLineVisibility(map, `${ROUTE_SOURCE_PREFIX}${deliveryId}`, showRoutes));
  }, [showRoutes, mapLoaded]);

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
            <div className="w-3 h-3 bg-slate-500 rounded-full" />
            <span>Offline (no GPS)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-orange-500 rounded-full" />
            <span>Delivery</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-violet-500 rounded-sm" />
            <span>Pickup</span>
          </div>
          <label className="flex items-center space-x-2 pt-1 cursor-pointer">
            <input
              type="checkbox"
              className="h-3 w-3"
              checked={showTrails}
              onChange={(e) => setShowTrails(e.target.checked)}
            />
            <span>Show trails</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              className="h-3 w-3"
              checked={showRoutes}
              onChange={(e) => setShowRoutes(e.target.checked)}
            />
            <span>Show routes</span>
          </label>
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

      {/* Drivers without GPS data info panel */}
      {mapLoaded && (() => {
        const driversWithoutGPS = drivers.filter(d => !d.lastKnownLocation?.coordinates);
        if (driversWithoutGPS.length === 0) return null;
        return (
          <div className="absolute bottom-4 right-4 bg-amber-50 border border-amber-200 rounded-lg shadow-lg p-3 z-10 max-w-xs">
            <div className="flex items-start space-x-2">
              <AlertTriangleIcon className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-amber-800">
                  {driversWithoutGPS.length} driver{driversWithoutGPS.length > 1 ? 's' : ''} without GPS data
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  {driversWithoutGPS.map(d => d.employeeId || `#${d.id.substring(0, 6)}`).join(', ')}
                </p>
              </div>
            </div>
          </div>
        );
      })()}

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
