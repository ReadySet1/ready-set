# Driver Dashboard Quick Reference

A quick reference guide for the Driver Dashboard tracking system APIs, events, and configuration.

---

## API Endpoints

### Location Tracking

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/tracking/locations` | Submit driver location update |
| `GET` | `/api/tracking/drivers` | Get all active drivers |
| `GET` | `/api/tracking/drivers/[id]` | Get specific driver details |

### Deliveries

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/tracking/deliveries` | List deliveries |
| `GET` | `/api/tracking/deliveries/[id]` | Get delivery details |
| `PATCH` | `/api/tracking/deliveries/[id]` | Update delivery status |
| `POST` | `/api/tracking/deliveries/[id]/pod` | Upload proof of delivery |
| `GET` | `/api/tracking/deliveries/[id]/pod` | Get POD metadata |
| `DELETE` | `/api/tracking/deliveries/[id]/pod` | Delete POD image |

### Shifts

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/tracking/shifts` | Get shift data |
| `POST` | `/api/tracking/shifts/start` | Start a shift |
| `POST` | `/api/tracking/shifts/end` | End a shift |

### Mileage

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/tracking/mileage` | Calculate shift mileage |

### Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/notifications/push/register` | Register push token |
| `POST` | `/api/notifications/push/validate` | Validate push token |
| `GET` | `/api/notifications/preferences` | Get preferences |

---

## WebSocket Channels (Supabase Realtime)

### driver-locations
**Purpose:** Real-time driver position broadcasting

```typescript
// Subscribe
const channel = supabase.channel('driver-locations');
channel.on('broadcast', { event: 'location' }, (payload) => {
  console.log('Driver location:', payload);
});
channel.subscribe();

// Broadcast
channel.send({
  type: 'broadcast',
  event: 'location',
  payload: {
    driverId: 'uuid',
    latitude: 37.7749,
    longitude: -122.4194,
    accuracy: 10,
    speed: 25,
    heading: 180,
    batteryLevel: 85,
    timestamp: new Date().toISOString()
  }
});
```

### driver-status
**Purpose:** Driver shift and availability status

```typescript
// Events
- 'shift_start'
- 'shift_end'
- 'break_start'
- 'break_end'
- 'available'
- 'unavailable'
```

### admin-commands
**Purpose:** Admin-to-driver messaging

```typescript
// Events
- 'delivery_assigned'
- 'delivery_cancelled'
- 'message'
```

---

## Feature Flags

| Flag | Default | Description |
|------|---------|-------------|
| `NEXT_PUBLIC_FF_USE_REALTIME_LOCATION_UPDATES` | `true` | Enable WebSocket location updates |
| `NEXT_PUBLIC_FF_USE_REALTIME_ADMIN_DASHBOARD` | `true` | Enable real-time admin dashboard |
| `NEXT_PUBLIC_FF_REALTIME_FALLBACK_TO_SSE` | `true` | Fallback to SSE if WebSocket fails |
| `NEXT_PUBLIC_FF_REALTIME_FALLBACK_TO_REST` | `true` | Fallback to REST if SSE fails |

---

## Environment Variables

### Mapbox
```bash
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.xxx  # Public access token
```

### Firebase (Push Notifications)
```bash
# Client-side
NEXT_PUBLIC_FIREBASE_API_KEY=xxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxx
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:xxx:web:xxx
NEXT_PUBLIC_FIREBASE_VAPID_KEY=xxx

# Server-side
FIREBASE_PROJECT_ID=xxx
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@xxx.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
```

### SendGrid (Email)
```bash
SENDGRID_API_KEY=SG.xxx
```

### Sentry (Error Monitoring)
```bash
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_AUTH_TOKEN=sntryu_xxx
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project
```

---

## Notification Events

| Event | Description | Push | Email |
|-------|-------------|------|-------|
| `delivery:assigned` | Delivery assigned to driver | Yes | No |
| `driver:en_route` | Driver en route to pickup | Yes | Yes |
| `driver:arrived` | Driver arrived at location | Yes | Yes |
| `delivery:completed` | Delivery completed | Yes | Yes |
| `delivery:delayed` | Delivery delayed | Yes | Yes |
| `delivery:failed` | Delivery failed | Yes | Yes |

---

## Key Components

### Admin Dashboard
| Component | File | Purpose |
|-----------|------|---------|
| AdminTrackingDashboard | `src/components/Dashboard/Tracking/AdminTrackingDashboard.tsx` | Main dashboard |
| LiveDriverMap | `src/components/Dashboard/Tracking/LiveDriverMap.tsx` | Map visualization |
| AdminPODGallery | `src/components/Dashboard/Tracking/AdminPODGallery.tsx` | POD gallery |

### Driver Portal
| Component | File | Purpose |
|-----------|------|---------|
| DriverLiveMap | `src/components/Driver/DriverLiveMap.tsx` | Driver map |
| ProofOfDeliveryCapture | `src/components/Driver/ProofOfDeliveryCapture.tsx` | POD capture |
| ProofOfDeliveryViewer | `src/components/Driver/ProofOfDeliveryViewer.tsx` | POD viewer |

### Hooks
| Hook | File | Purpose |
|------|------|---------|
| useRealtimeLocationTracking | `src/hooks/tracking/useRealtimeLocationTracking.ts` | Location tracking |
| useAdminRealtimeTracking | `src/hooks/tracking/useAdminRealtimeTracking.ts` | Admin tracking |
| usePushNotifications | `src/hooks/usePushNotifications.ts` | Push notifications |
| useCameraPermission | `src/hooks/useCameraPermission.ts` | Camera access |

---

## Troubleshooting

### WebSocket Connection Issues
```bash
# Check feature flags
echo $NEXT_PUBLIC_FF_USE_REALTIME_LOCATION_UPDATES  # Should be "true"

# Verify Supabase connection
# Check browser console for "Subscribed to channel" messages
```

### Push Notifications Not Working
1. Check HTTPS is enabled (required for service workers)
2. Verify Firebase config in `.env`
3. Check browser notification permissions
4. Look for errors in `/firebase-messaging-sw.js`

### Map Not Loading
1. Verify `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` is set
2. Check Mapbox dashboard for token restrictions
3. Ensure domain is whitelisted in Mapbox settings

### POD Upload Failing
1. Check file size (max 2MB)
2. Verify file type (JPEG, PNG, WebP only)
3. Check Supabase Storage bucket permissions
4. Look for errors in browser console

### Mileage Calculation Issues
1. Ensure PostGIS extension is enabled
2. Check for sufficient GPS points in shift
3. Verify location accuracy is acceptable
4. Review GPS quality flags in response

---

## Testing URLs

| Page | URL | Purpose |
|------|-----|---------|
| Admin Dashboard | `/admin/tracking` | Live driver tracking |
| Test Driver Simulator | `/admin/tracking/test-driver` | Simulate driver |
| Sentry Test (Client) | `/test-sentry` | Test client errors |
| Sentry Test (Server) | `/api/test-sentry?type=error` | Test server errors |

---

## Related Documentation

- [Audit Report](driver-dashboard-audit-2025-01.md)
- [Implementation Guide](phase-4-implementation-guide.md)
- [Mapbox Setup](setup/mapbox-integration.md)
- [WebSocket Setup](setup/websocket-setup.md)
- [Notifications Setup](setup/notifications.md)
- [Deployment Checklist](deployment-checklist-phase-4.md)
