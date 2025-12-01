# Mapbox Integration Guide

Complete setup instructions for Mapbox GL JS integration in the Driver Dashboard.

---

## Overview

Mapbox GL JS powers the real-time driver tracking map in the admin dashboard, displaying live driver locations, delivery destinations, and route information.

**Free Tier Limits:** 50,000 map loads per month

---

## Account Setup

### 1. Create Mapbox Account

1. Go to https://account.mapbox.com/auth/signup/
2. Sign up with email or GitHub
3. Verify your email address

### 2. Generate Access Token

1. Navigate to https://account.mapbox.com/access-tokens/
2. Click **"Create a token"**
3. Name it (e.g., "Ready Set Production")
4. Leave default scopes (public scopes only needed)
5. Click **"Create token"**
6. Copy the token (starts with `pk.`)

### 3. Restrict Token (Important!)

For security, restrict your token to specific URLs:

1. Click on your token in the dashboard
2. Under **"URL restrictions"**, click **"Add URL"**
3. Add your domains:
   - `http://localhost:3000/*` (development)
   - `https://yourdomain.com/*` (production)
   - `https://*.vercel.app/*` (preview deployments)
4. Save changes

---

## Environment Configuration

Add to your environment files:

```bash
# .env.local (development)
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.eyJ1IjoieW91cnVzZXJuYW1lIiwiYSI6ImNr...

# Production (Vercel, etc.)
# Add the same variable in your hosting platform's environment settings
```

---

## Installation

The package is already installed:

```bash
# Already in package.json
"mapbox-gl": "^3.16.0"
"@types/mapbox-gl": "^3.4.1"
```

---

## Component Usage

### Basic Map

```typescript
import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

export function BasicMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-122.4194, 37.7749], // San Francisco
      zoom: 12
    });

    return () => map.current?.remove();
  }, []);

  return <div ref={mapContainer} className="h-[500px] w-full rounded-lg" />;
}
```

### Driver Markers

```typescript
// Add a driver marker
function addDriverMarker(
  map: mapboxgl.Map,
  driver: { id: string; lat: number; lng: number; name: string; status: string }
) {
  const color = getDriverColor(driver.status);

  const marker = new mapboxgl.Marker({ color })
    .setLngLat([driver.lng, driver.lat])
    .setPopup(
      new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div class="p-2">
          <h3 class="font-bold">${driver.name}</h3>
          <p class="text-sm text-gray-600">${driver.status}</p>
        </div>
      `)
    )
    .addTo(map);

  return marker;
}

// Driver status colors
function getDriverColor(status: string): string {
  switch (status) {
    case 'moving': return '#22c55e';    // Green
    case 'stopped': return '#eab308';   // Yellow
    case 'on_duty': return '#3b82f6';   // Blue
    case 'off_duty': return '#6b7280';  // Gray
    default: return '#3b82f6';
  }
}
```

### Delivery Markers

```typescript
function addDeliveryMarker(
  map: mapboxgl.Map,
  delivery: { id: string; lat: number; lng: number; address: string }
) {
  return new mapboxgl.Marker({ color: '#f97316' }) // Orange
    .setLngLat([delivery.lng, delivery.lat])
    .setPopup(
      new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div class="p-2">
          <h3 class="font-bold">Delivery</h3>
          <p class="text-sm">${delivery.address}</p>
        </div>
      `)
    )
    .addTo(map);
}
```

### Map Controls

```typescript
// Add navigation controls
map.addControl(new mapboxgl.NavigationControl(), 'top-right');

// Add fullscreen control
map.addControl(new mapboxgl.FullscreenControl(), 'top-right');

// Fit bounds to show all markers
function fitToMarkers(map: mapboxgl.Map, coordinates: [number, number][]) {
  if (coordinates.length === 0) return;

  const bounds = coordinates.reduce(
    (bounds, coord) => bounds.extend(coord),
    new mapboxgl.LngLatBounds(coordinates[0], coordinates[0])
  );

  map.fitBounds(bounds, { padding: 50, maxZoom: 15 });
}
```

### Toggle Map Style

```typescript
const mapStyles = {
  streets: 'mapbox://styles/mapbox/streets-v12',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12'
};

function toggleMapStyle(map: mapboxgl.Map, style: 'streets' | 'satellite') {
  map.setStyle(mapStyles[style]);
}
```

---

## Performance Optimization

### 1. Marker Clustering

For many drivers, use marker clustering:

```typescript
map.on('load', () => {
  // Add driver locations as a source
  map.addSource('drivers', {
    type: 'geojson',
    data: driverGeoJSON,
    cluster: true,
    clusterMaxZoom: 14,
    clusterRadius: 50
  });

  // Cluster circles
  map.addLayer({
    id: 'clusters',
    type: 'circle',
    source: 'drivers',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': '#3b82f6',
      'circle-radius': ['step', ['get', 'point_count'], 20, 10, 30, 25, 40]
    }
  });
});
```

### 2. Throttle Updates

```typescript
import { throttle } from 'lodash';

const updateMarkerPosition = throttle((marker, position) => {
  marker.setLngLat(position);
}, 500); // Max once per 500ms
```

### 3. Remove Unused Markers

```typescript
// Clean up markers for offline drivers
function cleanupMarkers(markers: Map<string, mapboxgl.Marker>, activeIds: Set<string>) {
  markers.forEach((marker, id) => {
    if (!activeIds.has(id)) {
      marker.remove();
      markers.delete(id);
    }
  });
}
```

---

## Error Handling

```typescript
// Check for token
if (!process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN) {
  console.error('Mapbox access token not configured');
  return <div>Map unavailable - configuration error</div>;
}

// Handle map load errors
map.on('error', (e) => {
  console.error('Mapbox error:', e.error);
  Sentry.captureException(e.error);
});

// Handle WebGL context loss
map.on('webglcontextlost', () => {
  console.warn('WebGL context lost, reloading map');
  map.remove();
  initializeMap();
});
```

---

## Billing & Usage

### Monitor Usage

1. Go to https://account.mapbox.com/
2. View "Statistics" for usage data
3. Set up billing alerts in "Billing" settings

### Optimize Costs

- Use marker clustering for many drivers
- Cache static map tiles
- Limit zoom levels
- Use lower-resolution satellite imagery

---

## Troubleshooting

### Map Not Loading

1. Check token is set in environment
2. Verify domain is whitelisted
3. Check browser console for errors
4. Ensure CSS is imported: `import 'mapbox-gl/dist/mapbox-gl.css'`

### Markers Not Appearing

1. Verify coordinates are [longitude, latitude] (not lat, lng)
2. Check marker is added after map 'load' event
3. Ensure map container has height set

### Performance Issues

1. Reduce marker count with clustering
2. Throttle position updates
3. Use simpler map style for mobile

---

## Related Documentation

- [LiveDriverMap Component](../../src/components/Dashboard/Tracking/LiveDriverMap.tsx)
- [Mapbox GL JS Docs](https://docs.mapbox.com/mapbox-gl-js/)
- [Driver Dashboard Audit](../driver-dashboard-audit-2025-01.md)
