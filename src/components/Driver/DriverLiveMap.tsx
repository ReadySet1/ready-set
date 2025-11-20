'use client';

import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { Card } from '@/components/ui/card';
import { AlertTriangleIcon } from 'lucide-react';
import type { DeliveryTracking, LocationUpdate } from '@/types/tracking';
import { cn } from '@/lib/utils';
import { MAP_CONFIG, MARKER_CONFIG } from '@/constants/tracking-config';
import { captureException, captureMessage, addSentryBreadcrumb } from '@/lib/monitoring/sentry';

// Ensure Mapbox token is available on the client
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN) {
  mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
}

interface DriverLiveMapProps {
  currentLocation: LocationUpdate | null;
  activeDeliveries: DeliveryTracking[];
  className?: string;
}

/**
 * DriverLiveMap
 *
 * Lightweight Mapbox map for the driver dashboard.
 * - Shows the driver's current location in real time.
 * - Optionally shows active delivery destinations.
 * - Maintains a short trail for the current session to visualize movement.
 *
 * This component intentionally reuses the same Mapbox + Sentry patterns as
 * `LiveDriverMap` on the admin dashboard, but is scoped to a single driver.
 */
export default function DriverLiveMap({
  currentLocation,
  activeDeliveries,
  className,
}: DriverLiveMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const driverMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // Maintain an in-memory trail of recent coordinates for the session
  const trailRef = useRef<[number, number][]>([]);

  // Initialize the map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    if (
      !process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
      process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN === 'YOUR_MAPBOX_TOKEN_HERE' ||
      process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN === 'your_mapbox_access_token'
    ) {
      const errorMessage =
        'Mapbox token not configured. Please add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to your .env.local file.';
      captureMessage(errorMessage, 'error', {
        feature: 'driver-live-map',
        component: 'DriverLiveMap',
      });
      setMapError(errorMessage);
      return;
    }

    try {
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: MAP_CONFIG.DEFAULT_CENTER,
        zoom: MAP_CONFIG.DEFAULT_ZOOM,
        attributionControl: true,
      });

      map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

      map.on('load', () => {
        addSentryBreadcrumb('Driver map loaded', {
          feature: 'driver-live-map',
        });
        setMapLoaded(true);

        // Initialize empty source/layer for the driver trail
        map.addSource('driver-trail', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: [],
            },
          },
        });

        map.addLayer({
          id: 'driver-trail-line',
          type: 'line',
          source: 'driver-trail',
          paint: {
            'line-color': '#2563eb',
            'line-width': 4,
            'line-opacity': 0.8,
          },
        });
      });

      map.on('error', (event) => {
        captureException(event.error || new Error('Unknown Mapbox error'), {
          action: 'mapbox-error',
          feature: 'driver-live-map',
          component: 'DriverLiveMap',
        });
        setMapError('Failed to load map. Please check your Mapbox token.');
      });

      mapRef.current = map;

      return () => {
        map.remove();
        mapRef.current = null;
        driverMarkerRef.current = null;
        trailRef.current = [];
      };
    } catch (error) {
      captureException(error, {
        action: 'map-initialization',
        feature: 'driver-live-map',
        component: 'DriverLiveMap',
      });
      setMapError('Failed to initialize map. Please check console for details.');
    }
  }, []);

  // Update driver marker and trail when location changes
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !currentLocation) {
      return;
    }

    const { lng, lat } = {
      lng: currentLocation.coordinates.lng,
      lat: currentLocation.coordinates.lat,
    };

    try {
      // Update or create the driver marker
      if (driverMarkerRef.current) {
        driverMarkerRef.current.setLngLat([lng, lat]);
      } else {
        const el = document.createElement('div');
        el.className = 'driver-marker';
        el.style.width = `${MARKER_CONFIG.DRIVER_MARKER_SIZE}px`;
        el.style.height = `${MARKER_CONFIG.DRIVER_MARKER_SIZE}px`;
        el.style.borderRadius = '50%';
        el.style.backgroundColor = '#22c55e'; // green
        el.style.border = '2px solid white';
        el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';

        driverMarkerRef.current = new mapboxgl.Marker({
          element: el,
          anchor: 'center',
        })
          .setLngLat([lng, lat])
          .addTo(mapRef.current);
      }

      // Update the in-memory trail (cap length for performance)
      trailRef.current.push([lng, lat]);
      if (trailRef.current.length > 200) {
        trailRef.current.shift();
      }

      const source = mapRef.current.getSource('driver-trail') as mapboxgl.GeoJSONSource | undefined;
      if (source) {
        source.setData({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: trailRef.current,
          },
        });
      }

      // Center/zoom on the driver the first time we get a valid location
      if (trailRef.current.length === 1) {
        mapRef.current.easeTo({
          center: [lng, lat],
          zoom: MAP_CONFIG.DRIVER_VIEW_ZOOM ?? 14,
          duration: MAP_CONFIG.FIT_BOUNDS_DURATION,
        });
      }
    } catch (error) {
      captureException(error, {
        action: 'update-driver-location',
        feature: 'driver-live-map',
        component: 'DriverLiveMap',
        metadata: {
          lat,
          lng,
        },
      });
    }
  }, [currentLocation, mapLoaded]);

  // Optional: show delivery markers for active deliveries
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) {
      return;
    }

    // Remove any existing delivery layer/source and recreate from scratch
    try {
      if (mapRef.current.getLayer('driver-deliveries')) {
        mapRef.current.removeLayer('driver-deliveries');
      }
      if (mapRef.current.getSource('driver-deliveries')) {
        mapRef.current.removeSource('driver-deliveries');
      }

      if (activeDeliveries.length === 0) {
        return;
      }

      const features = activeDeliveries
        .filter((delivery) => delivery.deliveryLocation?.coordinates)
        .map((delivery) => ({
          type: 'Feature' as const,
          properties: {
            id: delivery.id,
          },
          geometry: {
            type: 'Point' as const,
            coordinates: delivery.deliveryLocation.coordinates,
          },
        }));

      if (features.length === 0) {
        return;
      }

      mapRef.current.addSource('driver-deliveries', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features,
        },
      });

      mapRef.current.addLayer({
        id: 'driver-deliveries',
        type: 'circle',
        source: 'driver-deliveries',
        paint: {
          'circle-radius': 6,
          'circle-color': '#f97316', // orange
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
      });
    } catch (error) {
      captureException(error, {
        action: 'update-delivery-markers',
        feature: 'driver-live-map',
        component: 'DriverLiveMap',
      });
    }
  }, [activeDeliveries, mapLoaded]);

  if (mapError) {
    return (
      <Card className={cn('w-full h-full flex items-center justify-center bg-gray-50', className)}>
        <div className="text-center text-red-500 px-4 py-6">
          <AlertTriangleIcon className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm font-medium mb-1">Map Error</p>
          <p className="text-xs text-gray-600 max-w-xs mx-auto">{mapError}</p>
        </div>
      </Card>
    );
  }

  return (
    <div
      ref={mapContainerRef}
      className={cn('w-full h-full rounded-lg overflow-hidden', className)}
      role="application"
      aria-label="Driver live map"
    />
  );
}


