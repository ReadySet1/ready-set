'use client';

import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { Card } from '@/components/ui/card';
import { AlertTriangleIcon, MapPinIcon, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MAP_CONFIG, MARKER_CONFIG } from '@/constants/tracking-config';
import { captureException, captureMessage, addSentryBreadcrumb } from '@/lib/monitoring/sentry';
import type { Address, DriverStatus } from '@/types/order';

// Import mapbox CSS
import 'mapbox-gl/dist/mapbox-gl.css';

// Ensure Mapbox token is available on the client
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN) {
  mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
}

interface DriverLocation {
  lat: number;
  lng: number;
  heading?: number;
  status?: DriverStatus;
}

interface OrderLocationMapProps {
  pickupAddress?: Address | null;
  deliveryAddress?: Address | null;
  driverLocation?: DriverLocation | null;
  className?: string;
  height?: string;
  showNavigationControls?: boolean;
}

/**
 * OrderLocationMap
 *
 * A compact map component for order details that shows:
 * - Pickup location (blue marker)
 * - Delivery location (green marker)
 * - Driver location (orange marker) when available
 *
 * Used by helpdesk/admin to visualize order locations at a glance.
 */
export default function OrderLocationMap({
  pickupAddress,
  deliveryAddress,
  driverLocation,
  className,
  height = '250px',
  showNavigationControls = true,
}: OrderLocationMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const pickupMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const deliveryMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const driverMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // Check if we have valid coordinates to display
  const hasPickupCoords = pickupAddress?.latitude && pickupAddress?.longitude;
  const hasDeliveryCoords = deliveryAddress?.latitude && deliveryAddress?.longitude;
  const hasDriverCoords = driverLocation?.lat && driverLocation?.lng;
  const hasAnyCoords = hasPickupCoords || hasDeliveryCoords || hasDriverCoords;

  // Initialize the map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    if (!hasAnyCoords) {
      return;
    }

    if (
      !process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
      process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN === 'YOUR_MAPBOX_TOKEN_HERE' ||
      process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN === 'your_mapbox_access_token'
    ) {
      const errorMessage = 'Mapbox token not configured.';
      captureMessage(errorMessage, 'warning', {
        feature: 'order-location-map',
        component: 'OrderLocationMap',
      });
      setMapError(errorMessage);
      return;
    }

    try {
      // Calculate initial center based on available coordinates
      let initialCenter: [number, number] = MAP_CONFIG.DEFAULT_CENTER;
      if (hasPickupCoords) {
        initialCenter = [pickupAddress!.longitude!, pickupAddress!.latitude!];
      } else if (hasDeliveryCoords) {
        initialCenter = [deliveryAddress!.longitude!, deliveryAddress!.latitude!];
      } else if (hasDriverCoords) {
        initialCenter = [driverLocation!.lng, driverLocation!.lat];
      }

      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: initialCenter,
        zoom: MAP_CONFIG.COMPACT_ZOOM,
        attributionControl: false,
      });

      if (showNavigationControls) {
        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');
      }

      map.on('load', () => {
        addSentryBreadcrumb('Order location map loaded', {
          feature: 'order-location-map',
        });
        setMapLoaded(true);
      });

      map.on('error', (event) => {
        captureException(event.error || new Error('Unknown Mapbox error'), {
          action: 'mapbox-error',
          feature: 'order-location-map',
          component: 'OrderLocationMap',
        });
        setMapError('Failed to load map.');
      });

      mapRef.current = map;

      return () => {
        map.remove();
        mapRef.current = null;
        pickupMarkerRef.current = null;
        deliveryMarkerRef.current = null;
        driverMarkerRef.current = null;
      };
    } catch (error) {
      captureException(error, {
        action: 'map-initialization',
        feature: 'order-location-map',
        component: 'OrderLocationMap',
      });
      setMapError('Failed to initialize map.');
    }
  }, [hasAnyCoords, hasPickupCoords, hasDeliveryCoords, hasDriverCoords, pickupAddress, deliveryAddress, driverLocation, showNavigationControls]);

  // Create and update markers when map is loaded
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) {
      return;
    }

    const bounds = new mapboxgl.LngLatBounds();
    let hasMarkers = false;

    try {
      // Pickup marker (blue)
      if (hasPickupCoords) {
        const lngLat: [number, number] = [pickupAddress!.longitude!, pickupAddress!.latitude!];

        if (pickupMarkerRef.current) {
          pickupMarkerRef.current.setLngLat(lngLat);
        } else {
          const el = createMarkerElement('#3b82f6', 'P'); // Blue with "P" for Pickup
          pickupMarkerRef.current = new mapboxgl.Marker({
            element: el,
            anchor: 'center',
          })
            .setLngLat(lngLat)
            .setPopup(new mapboxgl.Popup({ offset: 25, closeButton: false })
              .setHTML(`<div class="text-sm font-medium">Pickup</div><div class="text-xs text-gray-600">${formatAddress(pickupAddress!)}</div>`))
            .addTo(mapRef.current!);
        }
        bounds.extend(lngLat);
        hasMarkers = true;
      }

      // Delivery marker (green)
      if (hasDeliveryCoords) {
        const lngLat: [number, number] = [deliveryAddress!.longitude!, deliveryAddress!.latitude!];

        if (deliveryMarkerRef.current) {
          deliveryMarkerRef.current.setLngLat(lngLat);
        } else {
          const el = createMarkerElement('#22c55e', 'D'); // Green with "D" for Delivery
          deliveryMarkerRef.current = new mapboxgl.Marker({
            element: el,
            anchor: 'center',
          })
            .setLngLat(lngLat)
            .setPopup(new mapboxgl.Popup({ offset: 25, closeButton: false })
              .setHTML(`<div class="text-sm font-medium">Delivery</div><div class="text-xs text-gray-600">${formatAddress(deliveryAddress!)}</div>`))
            .addTo(mapRef.current!);
        }
        bounds.extend(lngLat);
        hasMarkers = true;
      }

      // Driver marker (orange)
      if (hasDriverCoords) {
        const lngLat: [number, number] = [driverLocation!.lng, driverLocation!.lat];

        if (driverMarkerRef.current) {
          driverMarkerRef.current.setLngLat(lngLat);
        } else {
          const el = createDriverMarkerElement();
          driverMarkerRef.current = new mapboxgl.Marker({
            element: el,
            anchor: 'center',
          })
            .setLngLat(lngLat)
            .setPopup(new mapboxgl.Popup({ offset: 25, closeButton: false })
              .setHTML(`<div class="text-sm font-medium">Driver Location</div>`))
            .addTo(mapRef.current!);
        }
        bounds.extend(lngLat);
        hasMarkers = true;
      } else if (driverMarkerRef.current) {
        // Remove driver marker if no longer has coordinates
        driverMarkerRef.current.remove();
        driverMarkerRef.current = null;
      }

      // Fit bounds to show all markers
      if (hasMarkers && !bounds.isEmpty()) {
        mapRef.current.fitBounds(bounds, {
          padding: MAP_CONFIG.BOUNDS_PADDING,
          maxZoom: MAP_CONFIG.MAX_AUTO_ZOOM,
          duration: MAP_CONFIG.FIT_BOUNDS_DURATION,
        });
      }
    } catch (error) {
      captureException(error, {
        action: 'update-markers',
        feature: 'order-location-map',
        component: 'OrderLocationMap',
      });
    }
  }, [mapLoaded, hasPickupCoords, hasDeliveryCoords, hasDriverCoords, pickupAddress, deliveryAddress, driverLocation]);

  // Don't render anything if no coordinates available
  if (!hasAnyCoords) {
    return (
      <Card className={cn('flex items-center justify-center bg-slate-50', className)} style={{ height }}>
        <div className="text-center text-slate-400 px-4 py-6">
          <MapPinIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No location coordinates available</p>
        </div>
      </Card>
    );
  }

  if (mapError) {
    return (
      <Card className={cn('flex items-center justify-center bg-slate-50', className)} style={{ height }}>
        <div className="text-center text-amber-600 px-4 py-6">
          <AlertTriangleIcon className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm font-medium mb-1">Map Unavailable</p>
          <p className="text-xs text-slate-500">{mapError}</p>
        </div>
      </Card>
    );
  }

  return (
    <div className={cn('relative', className)} style={{ height }}>
      <div
        ref={mapContainerRef}
        className="w-full h-full rounded-lg overflow-hidden"
        role="application"
        aria-label="Order location map"
      />
      {/* Legend */}
      <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm rounded-md px-2 py-1.5 text-xs shadow-sm">
        <div className="flex items-center gap-3">
          {hasPickupCoords && (
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-blue-500 border border-white shadow-sm" />
              <span className="text-slate-600">Pickup</span>
            </div>
          )}
          {hasDeliveryCoords && (
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-green-500 border border-white shadow-sm" />
              <span className="text-slate-600">Delivery</span>
            </div>
          )}
          {hasDriverCoords && (
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-orange-500 border border-white shadow-sm" />
              <span className="text-slate-600">Driver</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Create a styled marker element with a label
 */
function createMarkerElement(color: string, label: string): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'location-marker';
  el.style.width = `${MARKER_CONFIG.DELIVERY_MARKER_SIZE}px`;
  el.style.height = `${MARKER_CONFIG.DELIVERY_MARKER_SIZE}px`;
  el.style.borderRadius = '50%';
  el.style.backgroundColor = color;
  el.style.border = '2px solid white';
  el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  el.style.color = 'white';
  el.style.fontSize = '12px';
  el.style.fontWeight = 'bold';
  el.textContent = label;
  el.style.cursor = 'pointer';
  return el;
}

/**
 * Create a styled driver marker element
 */
function createDriverMarkerElement(): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'driver-marker';
  el.style.width = `${MARKER_CONFIG.DRIVER_MARKER_SIZE}px`;
  el.style.height = `${MARKER_CONFIG.DRIVER_MARKER_SIZE}px`;
  el.style.borderRadius = '50%';
  el.style.backgroundColor = '#f97316'; // Orange
  el.style.border = '3px solid white';
  el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.4)';
  el.style.cursor = 'pointer';

  // Add pulsing animation for active driver
  el.style.animation = 'pulse 2s infinite';

  // Add keyframes for pulse animation
  if (!document.getElementById('driver-pulse-style')) {
    const style = document.createElement('style');
    style.id = 'driver-pulse-style';
    style.textContent = `
      @keyframes pulse {
        0% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.4); }
        70% { box-shadow: 0 0 0 10px rgba(249, 115, 22, 0); }
        100% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0); }
      }
    `;
    document.head.appendChild(style);
  }

  return el;
}

/**
 * Format address for popup display
 */
function formatAddress(address: Address): string {
  const parts = [address.street1];
  if (address.city) parts.push(address.city);
  if (address.state) parts.push(address.state);
  return parts.join(', ');
}
