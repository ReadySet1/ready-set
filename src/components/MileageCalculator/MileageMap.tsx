'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card, CardContent } from '@/components/ui/card';
import { Map as MapIcon } from 'lucide-react';
import { decodePolyline } from '@/services/routing/route-utils';
import type { MileageCalculation } from '@/types/mileage';

interface MileageMapProps {
  calculation: MileageCalculation | null;
  className?: string;
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';

const DEFAULT_CENTER: [number, number] = [-97.7431, 30.2672]; // Austin, TX
const DEFAULT_ZOOM = 10;

const ROUTE_SOURCE_ID = 'mileage-route';
const ROUTE_LAYER_ID = 'mileage-route-layer';
const ROUTE_OUTLINE_LAYER_ID = 'mileage-route-outline';

export default function MileageMap({
  calculation,
  className = '',
}: MileageMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current || !MAPBOX_TOKEN) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.addControl(new mapboxgl.ScaleControl(), 'bottom-left');

    map.on('load', () => setMapReady(true));

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  const clearMap = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (map.getLayer(ROUTE_OUTLINE_LAYER_ID)) map.removeLayer(ROUTE_OUTLINE_LAYER_ID);
    if (map.getLayer(ROUTE_LAYER_ID)) map.removeLayer(ROUTE_LAYER_ID);
    if (map.getSource(ROUTE_SOURCE_ID)) map.removeSource(ROUTE_SOURCE_ID);
  }, []);

  // Draw route + markers when calculation changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    clearMap();

    if (!calculation) return;

    const { pickup, dropoffs, polyline } = calculation;

    // Draw polyline
    if (polyline) {
      const points = decodePolyline(polyline);
      const coordinates = points.map(
        (p) => [p.lng, p.lat] as [number, number],
      );

      map.addSource(ROUTE_SOURCE_ID, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates },
        },
      });

      // Route outline for visual depth
      map.addLayer({
        id: ROUTE_OUTLINE_LAYER_ID,
        type: 'line',
        source: ROUTE_SOURCE_ID,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#1e40af',
          'line-width': 8,
          'line-opacity': 0.25,
        },
      });

      map.addLayer({
        id: ROUTE_LAYER_ID,
        type: 'line',
        source: ROUTE_SOURCE_ID,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#3b82f6',
          'line-width': 4,
          'line-opacity': 0.9,
        },
      });
    }

    // Collect all marker coordinates for bounds fitting
    const boundsCoords: [number, number][] = [];

    // Pickup marker (emerald)
    if (pickup.lat != null && pickup.lng != null) {
      const el = createMarkerEl('#059669', 'P');
      const popup = new mapboxgl.Popup({ offset: 25, closeButton: false }).setHTML(
        `<div style="font-size:13px"><strong>Pickup</strong><br/>${escapeHtml(truncate(pickup.address, 60))}</div>`,
      );
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([pickup.lng, pickup.lat])
        .setPopup(popup)
        .addTo(map);
      markersRef.current.push(marker);
      boundsCoords.push([pickup.lng, pickup.lat]);
    }

    // Drop-off markers (red, numbered)
    dropoffs.forEach((stop, i) => {
      if (stop.lat == null || stop.lng == null) return;
      const label = dropoffs.length === 1 ? 'D' : String(i + 1);
      const el = createMarkerEl('#dc2626', label);
      const popup = new mapboxgl.Popup({ offset: 25, closeButton: false }).setHTML(
        `<div style="font-size:13px"><strong>Drop-off${dropoffs.length > 1 ? ` ${i + 1}` : ''}</strong><br/>${escapeHtml(truncate(stop.address, 60))}</div>`,
      );
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([stop.lng, stop.lat])
        .setPopup(popup)
        .addTo(map);
      markersRef.current.push(marker);
      boundsCoords.push([stop.lng, stop.lat]);
    });

    // If we have a polyline but no marker coords, derive bounds from the polyline endpoints
    if (boundsCoords.length === 0 && polyline) {
      const points = decodePolyline(polyline);
      const first = points[0];
      const last = points[points.length - 1];
      if (first) boundsCoords.push([first.lng, first.lat]);
      if (last) boundsCoords.push([last.lng, last.lat]);
    }

    // Fit map to bounds
    if (boundsCoords.length >= 2) {
      const bounds = new mapboxgl.LngLatBounds();
      boundsCoords.forEach((c) => bounds.extend(c));
      map.fitBounds(bounds, { padding: 70, maxZoom: 14, duration: 800 });
    } else if (boundsCoords.length === 1 && boundsCoords[0]) {
      map.flyTo({ center: boundsCoords[0], zoom: 13, duration: 800 });
    }
  }, [calculation, mapReady, clearMap]);

  // No token fallback
  if (!MAPBOX_TOKEN) {
    return (
      <Card className={`border-0 shadow-sm rounded-2xl bg-white/80 ${className}`}>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <MapIcon className="h-8 w-8 text-slate-300 mb-3" />
          <p className="text-sm text-slate-500">
            Map unavailable. Add{' '}
            <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">
              NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
            </code>{' '}
            to .env.local
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border-0 shadow-sm rounded-2xl overflow-hidden ${className}`}>
      <div
        ref={containerRef}
        className="w-full"
        style={{ minHeight: 420 }}
      />
      {calculation && (
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>
            Route: {calculation.totalDistanceMiles.toFixed(1)} mi
          </span>
          <span>
            Powered by Mapbox + Google Maps
          </span>
        </div>
      )}
    </Card>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createMarkerEl(color: string, label: string): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = `
    width: 32px; height: 32px; border-radius: 50%;
    background: ${color}; color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 700;
    border: 2.5px solid #fff;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    cursor: pointer;
    transition: transform 0.15s ease;
  `;
  el.addEventListener('mouseenter', () => {
    el.style.transform = 'scale(1.15)';
  });
  el.addEventListener('mouseleave', () => {
    el.style.transform = 'scale(1)';
  });
  el.textContent = label;
  return el;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '...' : text;
}
