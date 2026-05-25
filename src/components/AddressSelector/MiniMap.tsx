'use client';

import { useRef, useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import type { MiniMapProps } from '@/types/address-selector';
import { cn } from '@/lib/utils';

export function MiniMap({ pickup, delivery }: MiniMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapError, setMapError] = useState(false);

  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const hasValidToken =
    token &&
    token !== 'your_mapbox_access_token' &&
    token !== 'YOUR_MAPBOX_TOKEN_HERE';

  const hasCoords = pickup != null || delivery != null;

  useEffect(() => {
    if (!hasValidToken || !hasCoords || !mapContainerRef.current) return;

    let map: mapboxgl.Map;

    const initMap = async () => {
      try {
        const mapboxgl = (await import('mapbox-gl')).default;
        // CSS is globally imported in src/styles/index.css

        mapboxgl.accessToken = token!;

        // Determine center and zoom
        let center: [number, number];
        let zoom = 11;

        if (pickup && delivery) {
          center = [
            (pickup.lng + delivery.lng) / 2,
            (pickup.lat + delivery.lat) / 2,
          ];
        } else if (pickup) {
          center = [pickup.lng, pickup.lat];
        } else {
          center = [delivery!.lng, delivery!.lat];
        }

        map = new mapboxgl.Map({
          container: mapContainerRef.current!,
          style: 'mapbox://styles/mapbox/streets-v12',
          center,
          zoom,
          interactive: false,
          attributionControl: false,
        });

        mapRef.current = map;

        map.on('load', () => {
          // Clear old markers
          markersRef.current.forEach((m) => m.remove());
          markersRef.current = [];

          // Add pickup marker (green)
          if (pickup) {
            const el = document.createElement('div');
            el.className = 'flex items-center justify-center';
            el.style.width = '24px';
            el.style.height = '24px';
            el.style.borderRadius = '50%';
            el.style.backgroundColor = '#16a34a';
            el.style.color = 'white';
            el.style.fontSize = '11px';
            el.style.fontWeight = '700';
            el.textContent = 'P';

            const marker = new mapboxgl.Marker({ element: el })
              .setLngLat([pickup.lng, pickup.lat])
              .addTo(map);
            markersRef.current.push(marker);
          }

          // Add delivery marker (blue)
          if (delivery) {
            const el = document.createElement('div');
            el.className = 'flex items-center justify-center';
            el.style.width = '24px';
            el.style.height = '24px';
            el.style.borderRadius = '50%';
            el.style.backgroundColor = '#2563eb';
            el.style.color = 'white';
            el.style.fontSize = '11px';
            el.style.fontWeight = '700';
            el.textContent = 'D';

            const marker = new mapboxgl.Marker({ element: el })
              .setLngLat([delivery.lng, delivery.lat])
              .addTo(map);
            markersRef.current.push(marker);
          }

          // Fit bounds when both are present
          if (pickup && delivery) {
            const bounds = new mapboxgl.LngLatBounds();
            bounds.extend([pickup.lng, pickup.lat]);
            bounds.extend([delivery.lng, delivery.lat]);
            map.fitBounds(bounds, { padding: 30, maxZoom: 13 });
          }
        });
      } catch {
        setMapError(true);
      }
    };

    initMap();

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [pickup, delivery, hasValidToken, hasCoords, token]);

  // Placeholder when no coords or no token
  if (!hasValidToken || !hasCoords || mapError) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50',
          'h-full min-h-[60px]',
        )}
      >
        <div className="text-center">
          <MapPin className="mx-auto h-5 w-5 text-slate-300" />
          <p className="mt-1 text-[10px] text-slate-400">
            {!hasCoords ? 'No coordinates' : 'Map unavailable'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={mapContainerRef}
      className="h-full min-h-[60px] w-full rounded-lg overflow-hidden"
    />
  );
}
