'use client';

import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { RouteResult, LatLng } from './types';
import { decodePolyline } from '@/services/routing/route-utils';

interface RouteMapProps {
  route: RouteResult | null;
  pickupCoords?: LatLng;
  dropoffCoords?: LatLng;
  waypointCoords?: LatLng[];
  className?: string;
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';

// SF Bay Area default center
const DEFAULT_CENTER: [number, number] = [-122.4194, 37.7749];
const DEFAULT_ZOOM = 11;

export default function RouteMap({
  route,
  pickupCoords,
  dropoffCoords,
  waypointCoords = [],
  className = '',
}: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!MAPBOX_TOKEN) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.on('load', () => {
      setMapReady(true);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update markers when coordinates change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Pickup marker (green)
    if (pickupCoords) {
      const el = createMarkerEl('#16a34a', 'P');
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([pickupCoords.lng, pickupCoords.lat])
        .setPopup(new mapboxgl.Popup().setText('Pickup'))
        .addTo(map);
      markersRef.current.push(marker);
    }

    // Dropoff marker (red)
    if (dropoffCoords) {
      const el = createMarkerEl('#ef4444', 'D');
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([dropoffCoords.lng, dropoffCoords.lat])
        .setPopup(new mapboxgl.Popup().setText('Drop-off'))
        .addTo(map);
      markersRef.current.push(marker);
    }

    // Waypoint markers (blue)
    waypointCoords.forEach((wp, i) => {
      const el = createMarkerEl('#3b82f6', String(i + 1));
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([wp.lng, wp.lat])
        .setPopup(new mapboxgl.Popup().setText(`Stop ${i + 1}`))
        .addTo(map);
      markersRef.current.push(marker);
    });

    // Fit bounds to all points
    const allCoords = [
      ...(pickupCoords ? [pickupCoords] : []),
      ...(dropoffCoords ? [dropoffCoords] : []),
      ...waypointCoords,
    ];

    if (allCoords.length >= 2) {
      const bounds = new mapboxgl.LngLatBounds();
      allCoords.forEach((c) => bounds.extend([c.lng, c.lat]));
      map.fitBounds(bounds, { padding: 60, maxZoom: 14 });
    } else if (allCoords.length === 1 && allCoords[0]) {
      map.flyTo({
        center: [allCoords[0].lng, allCoords[0].lat],
        zoom: 13,
      });
    }
  }, [pickupCoords, dropoffCoords, waypointCoords, mapReady]);

  // Draw route polyline when result arrives
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const sourceId = 'route-line';
    const layerId = 'route-line-layer';

    // Remove previous route layer/source if present
    if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);

    if (!route?.polyline) return;

    const points = decodePolyline(route.polyline);
    const coordinates = points.map((p) => [p.lng, p.lat] as [number, number]);

    map.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates },
      },
    });

    map.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#d97706',
        'line-width': 5,
        'line-opacity': 0.85,
      },
    });

    // Fit bounds to route
    if (route.bounds) {
      const bounds = new mapboxgl.LngLatBounds(
        [route.bounds.southwest.lng, route.bounds.southwest.lat],
        [route.bounds.northeast.lng, route.bounds.northeast.lat],
      );
      map.fitBounds(bounds, { padding: 60, maxZoom: 14 });
    }
  }, [route, mapReady]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className={`flex items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 ${className}`}>
        <p className="text-sm text-gray-500">
          Mapbox token not configured. Add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to .env.local
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`rounded-lg border border-gray-200 ${className}`}
      style={{ minHeight: 400 }}
    />
  );
}

// ─── Marker Helper ──────────────────────────────────────────────────────────

function createMarkerEl(color: string, label: string): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = `
    width: 30px; height: 30px; border-radius: 50%;
    background: ${color}; color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 700;
    border: 2.5px solid #fff;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    cursor: pointer;
  `;
  el.textContent = label;
  return el;
}
