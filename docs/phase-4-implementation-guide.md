# Phase 4 Implementation Guide

A comprehensive guide to the Phase 4 Driver Dashboard advanced features implementation.

---

## Overview

Phase 4 adds production-critical enhancements to the driver tracking system:

1. **Real-time Map Visualization** - Mapbox GL JS integration
2. **WebSocket Communication** - Supabase Realtime (Phoenix Channels)
3. **Customer Notifications** - Firebase Push + SendGrid Email
4. **Mileage Calculation** - GPS-based distance tracking
5. **Proof of Delivery** - Photo capture and upload
6. **Error Monitoring** - Sentry integration

---

## Prerequisites

Before implementing Phase 4 features, ensure:

- [x] Phase 1-3 complete (Database, Driver Portal, Admin Dashboard)
- [x] PostGIS tracking system operational
- [x] Driver authentication working
- [x] Offline mode with IndexedDB implemented
- [x] Supabase project configured

---

## 1. Real-time Map Visualization (Mapbox)

### Installation

```bash
pnpm add mapbox-gl @types/mapbox-gl
```

### Configuration

1. Create a Mapbox account at https://account.mapbox.com/
2. Generate an access token
3. Add to environment:

```bash
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.your_token_here
```

4. Restrict token to your domain in Mapbox dashboard

### Implementation

The main map component is `LiveDriverMap.tsx`:

```typescript
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Initialize map
const map = new mapboxgl.Map({
  container: mapContainerRef.current,
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-122.4194, 37.7749],
  zoom: 12
});

// Add driver marker
const marker = new mapboxgl.Marker({ color: '#22c55e' })
  .setLngLat([longitude, latitude])
  .setPopup(new mapboxgl.Popup().setHTML('<h3>Driver Name</h3>'))
  .addTo(map);
```

### Driver Marker Colors

| Status | Color | Hex |
|--------|-------|-----|
| Moving | Green | `#22c55e` |
| Stopped | Yellow | `#eab308` |
| On Duty | Blue | `#3b82f6` |
| Off Duty | Gray | `#6b7280` |

---

## 2. WebSocket Communication (Supabase Realtime)

### Architecture

Supabase Realtime uses Phoenix Channels over WebSocket for pub/sub messaging. No custom server required - fully serverless compatible.

### Channels

#### driver-locations
Real-time position broadcasting:

```typescript
// src/lib/realtime/channels.ts
export class DriverLocationChannel {
  private channel: RealtimeChannel;

  constructor(supabase: SupabaseClient) {
    this.channel = supabase.channel('driver-locations');
  }

  subscribe(callback: (payload: LocationPayload) => void) {
    this.channel
      .on('broadcast', { event: 'location' }, callback)
      .subscribe();
  }

  broadcast(location: LocationPayload) {
    this.channel.send({
      type: 'broadcast',
      event: 'location',
      payload: location
    });
  }
}
```

#### driver-status
Shift and availability status with presence tracking:

```typescript
export class DriverStatusChannel {
  subscribe(callbacks: {
    onJoin: (driverId: string) => void;
    onLeave: (driverId: string) => void;
    onStatusChange: (status: StatusPayload) => void;
  }) {
    this.channel
      .on('presence', { event: 'join' }, callbacks.onJoin)
      .on('presence', { event: 'leave' }, callbacks.onLeave)
      .on('broadcast', { event: 'status' }, callbacks.onStatusChange)
      .subscribe();
  }
}
```

#### admin-commands
Server-to-driver messaging:

```typescript
export class AdminCommandsChannel {
  sendCommand(driverId: string, command: AdminCommand) {
    this.channel.send({
      type: 'broadcast',
      event: 'command',
      payload: { driverId, command }
    });
  }
}
```

### Fallback Strategy

```
WebSocket (Realtime) → SSE (Server-Sent Events) → REST (Polling)
```

Controlled by feature flags:
- `NEXT_PUBLIC_FF_REALTIME_FALLBACK_TO_SSE=true`
- `NEXT_PUBLIC_FF_REALTIME_FALLBACK_TO_REST=true`

---

## 3. Customer Notifications

### Push Notifications (Firebase)

#### Setup Firebase Project

1. Go to https://console.firebase.google.com/
2. Create new project
3. Add web app
4. Copy config values to environment
5. Generate VAPID key for web push

#### Environment Variables

```bash
# Client-side
NEXT_PUBLIC_FIREBASE_API_KEY=xxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=project-id
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123:web:abc
NEXT_PUBLIC_FIREBASE_VAPID_KEY=xxx

# Server-side (from service account JSON)
FIREBASE_PROJECT_ID=project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
```

#### Service Worker

Create `/public/firebase-messaging-sw.js`:

```javascript
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: '...',
  projectId: '...',
  messagingSenderId: '...',
  appId: '...'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification;
  self.registration.showNotification(title, { body, icon });
});
```

#### Sending Notifications

```typescript
// src/services/notifications/push.ts
import { getMessaging } from 'firebase-admin/messaging';

export async function sendPushNotification(token: string, notification: Notification) {
  const messaging = getMessaging();

  await messaging.send({
    token,
    notification: {
      title: notification.title,
      body: notification.body
    },
    webpush: {
      fcmOptions: {
        link: notification.url
      }
    }
  });
}
```

### Email Notifications (SendGrid)

#### Setup

```bash
SENDGRID_API_KEY=SG.xxx
```

#### Sending Emails

```typescript
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

await sgMail.send({
  to: 'customer@example.com',
  from: 'noreply@readyset.com',
  templateId: 'd-xxx',
  dynamicTemplateData: {
    driverName: 'John',
    eta: '15 minutes'
  }
});
```

---

## 4. Mileage Calculation

### PostGIS Setup

Ensure PostGIS extension is enabled:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

### Calculation Algorithm

```typescript
// src/services/tracking/mileage.ts
export async function calculateShiftMileage(shiftId: string): Promise<MileageResult> {
  // 1. Get location points for shift
  const points = await getShiftLocations(shiftId);

  // 2. Filter low-quality points
  const filtered = points.filter(p =>
    p.accuracy < 50 && // Good GPS accuracy
    p.speed > 0.5      // Not stationary
  );

  // 3. Calculate distance using PostGIS
  const distance = await prisma.$queryRaw`
    SELECT SUM(
      ST_Distance(
        point1::geography,
        point2::geography
      )
    ) / 1609.34 as miles
    FROM consecutive_points
  `;

  return {
    totalMiles: distance,
    pointsUsed: filtered.length,
    pointsFiltered: points.length - filtered.length
  };
}
```

### Quality Filters

| Filter | Threshold | Purpose |
|--------|-----------|---------|
| Accuracy | < 50m | Remove poor GPS readings |
| Speed | > 0.5 m/s | Remove stationary points |
| Segment Speed | < 200 km/h | Remove GPS glitches |
| Outlier Distance | < 1km | Remove teleportation artifacts |

---

## 5. Proof of Delivery

### Camera Capture

```typescript
// src/components/Driver/ProofOfDeliveryCapture.tsx
const startCapture = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment' } // Back camera
  });
  videoRef.current.srcObject = stream;
};

const capturePhoto = () => {
  const canvas = document.createElement('canvas');
  canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
  const blob = canvas.toBlob(handleUpload, 'image/jpeg', 0.8);
};
```

### Image Compression

```typescript
// src/lib/utils/image-compression.ts
export async function compressImage(file: File): Promise<Blob> {
  const img = await createImageBitmap(file);
  const canvas = new OffscreenCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');

  // Resize if too large
  const maxDimension = 1920;
  const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));

  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
}
```

### Upload to Supabase Storage

```typescript
// src/utils/supabase/storage.ts
export async function uploadPODImage(
  deliveryId: string,
  file: Blob
): Promise<string> {
  const path = `pod/${deliveryId}/${Date.now()}.jpg`;

  const { data, error } = await supabase.storage
    .from('deliveries')
    .upload(path, file, {
      contentType: 'image/jpeg',
      upsert: false
    });

  if (error) throw error;

  return supabase.storage
    .from('deliveries')
    .getPublicUrl(path)
    .data.publicUrl;
}
```

---

## 6. Error Monitoring (Sentry)

### Installation

```bash
npx @sentry/wizard@latest -i nextjs
```

### Configuration

```typescript
// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs';
import { filterBenignErrors } from '@/lib/monitoring/sentry-filters';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  beforeSend: filterBenignErrors
});
```

### Error Filtering

```typescript
// src/lib/monitoring/sentry-filters.ts
export function filterBenignErrors(event: Event): Event | null {
  const message = event.exception?.values?.[0]?.value || '';

  // Filter browser extension errors
  if (message.includes('chrome-extension://')) return null;

  // Filter ResizeObserver errors
  if (message.includes('ResizeObserver')) return null;

  // Filter network errors
  if (message.includes('NetworkError')) return null;

  return event;
}
```

---

## Testing

### Run Phase 4 Tests

```bash
# Unit tests
pnpm test:unit -- --testPathPattern="(LiveDriverMap|tracking|notification)"

# E2E tests
pnpm test:e2e -- --grep "realtime-driver-tracking"
```

### Manual Testing

1. **Map Visualization:** Visit `/admin/tracking`, verify map loads
2. **WebSocket:** Start test driver at `/admin/tracking/test-driver`
3. **Push Notifications:** Grant permission, trigger test notification
4. **POD Upload:** Capture and upload test photo
5. **Sentry:** Visit `/test-sentry` to trigger test error

---

## Deployment Checklist

See [Deployment Checklist](deployment-checklist-phase-4.md) for complete pre-deployment verification.

---

## Related Documentation

- [Audit Report](driver-dashboard-audit-2025-01.md)
- [Quick Reference](driver-dashboard-quick-reference.md)
- [Mapbox Setup](setup/mapbox-integration.md)
- [WebSocket Setup](setup/websocket-setup.md)
- [Notifications Setup](setup/notifications.md)
