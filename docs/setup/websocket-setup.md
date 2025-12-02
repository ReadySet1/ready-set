# WebSocket Setup Guide

Complete setup instructions for Supabase Realtime (WebSocket) integration in the Driver Dashboard.

---

## Overview

The Driver Dashboard uses **Supabase Realtime** for real-time communication between drivers, the admin dashboard, and the backend. Supabase Realtime is built on Phoenix Channels, providing WebSocket-based pub/sub messaging.

**Key Benefits:**
- No custom WebSocket server required
- Fully serverless compatible (works on Vercel)
- Built-in authentication via Supabase
- Automatic reconnection and heartbeat

---

## Architecture

```
┌─────────────────┐     WebSocket      ┌─────────────────────┐
│  Driver App     │◄──────────────────►│  Supabase Realtime  │
└─────────────────┘                    │  (Phoenix Channels) │
                                       └──────────┬──────────┘
┌─────────────────┐     WebSocket                 │
│  Admin Dashboard│◄──────────────────────────────┤
└─────────────────┘                               │
                                                  ▼
                                       ┌─────────────────────┐
                                       │    PostgreSQL       │
                                       │  (postgres_changes) │
                                       └─────────────────────┘
```

---

## Configuration

### Environment Variables

Supabase Realtime uses your existing Supabase configuration:

```bash
# Already configured for Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### Feature Flags

Control realtime features with environment variables:

```bash
# Enable WebSocket location updates (recommended: true)
NEXT_PUBLIC_FF_USE_REALTIME_LOCATION_UPDATES=true

# Enable realtime admin dashboard (recommended: true)
NEXT_PUBLIC_FF_USE_REALTIME_ADMIN_DASHBOARD=true

# Enable SSE fallback when WebSocket fails (recommended: true)
NEXT_PUBLIC_FF_REALTIME_FALLBACK_TO_SSE=true

# Enable REST fallback when SSE fails (recommended: true)
NEXT_PUBLIC_FF_REALTIME_FALLBACK_TO_REST=true
```

---

## Channel Implementation

### Realtime Client

```typescript
// src/lib/realtime/client.ts
import { createClient, RealtimeChannel } from '@supabase/supabase-js';

export class RealtimeClient {
  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  private channels: Map<string, RealtimeChannel> = new Map();

  getChannel(name: string): RealtimeChannel {
    if (!this.channels.has(name)) {
      this.channels.set(name, this.supabase.channel(name));
    }
    return this.channels.get(name)!;
  }

  removeChannel(name: string): void {
    const channel = this.channels.get(name);
    if (channel) {
      this.supabase.removeChannel(channel);
      this.channels.delete(name);
    }
  }
}
```

### Driver Location Channel

```typescript
// src/lib/realtime/channels.ts
import { RealtimeChannel } from '@supabase/supabase-js';

export interface LocationPayload {
  driverId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number | null;
  heading: number | null;
  batteryLevel: number | null;
  timestamp: string;
}

export class DriverLocationChannel {
  private channel: RealtimeChannel;

  constructor(supabase: SupabaseClient) {
    this.channel = supabase.channel('driver-locations', {
      config: {
        broadcast: { self: false } // Don't receive own broadcasts
      }
    });
  }

  subscribe(callback: (payload: LocationPayload) => void): this {
    this.channel
      .on('broadcast', { event: 'location' }, ({ payload }) => {
        callback(payload as LocationPayload);
      })
      .subscribe((status) => {
        console.log('Channel status:', status);
      });

    return this;
  }

  broadcast(location: LocationPayload): void {
    this.channel.send({
      type: 'broadcast',
      event: 'location',
      payload: location
    });
  }

  unsubscribe(): void {
    this.channel.unsubscribe();
  }
}
```

### Driver Status Channel (with Presence)

```typescript
export class DriverStatusChannel {
  private channel: RealtimeChannel;

  constructor(supabase: SupabaseClient, driverId: string) {
    this.channel = supabase.channel('driver-status', {
      config: {
        presence: { key: driverId }
      }
    });
  }

  subscribe(callbacks: {
    onJoin: (drivers: string[]) => void;
    onLeave: (drivers: string[]) => void;
    onSync: (state: PresenceState) => void;
  }): this {
    this.channel
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        callbacks.onJoin(newPresences.map(p => p.presence_ref));
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        callbacks.onLeave(leftPresences.map(p => p.presence_ref));
      })
      .on('presence', { event: 'sync' }, () => {
        callbacks.onSync(this.channel.presenceState());
      })
      .subscribe();

    return this;
  }

  track(status: { status: string; lastSeen: string }): void {
    this.channel.track(status);
  }
}
```

### Admin Commands Channel

```typescript
export class AdminCommandsChannel {
  private channel: RealtimeChannel;

  constructor(supabase: SupabaseClient) {
    this.channel = supabase.channel('admin-commands');
  }

  // Admin sends command to specific driver
  sendCommand(driverId: string, command: AdminCommand): void {
    this.channel.send({
      type: 'broadcast',
      event: 'command',
      payload: { driverId, command }
    });
  }

  // Driver listens for commands
  subscribeAsDriver(
    driverId: string,
    callback: (command: AdminCommand) => void
  ): this {
    this.channel
      .on('broadcast', { event: 'command' }, ({ payload }) => {
        if (payload.driverId === driverId) {
          callback(payload.command);
        }
      })
      .subscribe();

    return this;
  }
}

type AdminCommand =
  | { type: 'delivery_assigned'; deliveryId: string }
  | { type: 'delivery_cancelled'; deliveryId: string }
  | { type: 'message'; text: string };
```

---

## React Hooks

### useRealtimeLocationTracking

```typescript
// src/hooks/tracking/useRealtimeLocationTracking.ts
import { useEffect, useState } from 'react';
import { DriverLocationChannel, LocationPayload } from '@/lib/realtime/channels';

export function useRealtimeLocationTracking() {
  const [locations, setLocations] = useState<Map<string, LocationPayload>>(new Map());
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const channel = new DriverLocationChannel(supabase);

    channel.subscribe((payload) => {
      setLocations(prev => {
        const next = new Map(prev);
        next.set(payload.driverId, payload);
        return next;
      });
    });

    setIsConnected(true);

    return () => {
      channel.unsubscribe();
      setIsConnected(false);
    };
  }, []);

  return { locations, isConnected };
}
```

### useAdminRealtimeTracking

```typescript
// src/hooks/tracking/useAdminRealtimeTracking.ts
export function useAdminRealtimeTracking(options: {
  onDriverUpdate: (driver: DriverLocation) => void;
  fallbackToSSE?: boolean;
}) {
  const [connectionMode, setConnectionMode] = useState<'realtime' | 'sse' | 'rest'>('realtime');

  useEffect(() => {
    // Try Realtime first
    const channel = new DriverLocationChannel(supabase);

    channel.subscribe((payload) => {
      options.onDriverUpdate(payload);
    });

    // Handle connection failure
    const handleError = () => {
      if (options.fallbackToSSE) {
        setConnectionMode('sse');
        // Switch to SSE polling
      }
    };

    return () => channel.unsubscribe();
  }, []);

  return { connectionMode };
}
```

---

## Fallback Strategies

### SSE Fallback

```typescript
// If WebSocket fails, fall back to Server-Sent Events
function connectSSE(onMessage: (data: any) => void) {
  const eventSource = new EventSource('/api/tracking/sse');

  eventSource.onmessage = (event) => {
    onMessage(JSON.parse(event.data));
  };

  eventSource.onerror = () => {
    eventSource.close();
    // Fall back to REST polling
    startPolling();
  };

  return eventSource;
}
```

### REST Polling Fallback

```typescript
// Last resort: poll REST API
function startPolling(onData: (data: any) => void, interval = 5000) {
  const poll = async () => {
    const response = await fetch('/api/tracking/drivers');
    const data = await response.json();
    onData(data);
  };

  poll();
  return setInterval(poll, interval);
}
```

---

## Connection Health Monitoring

```typescript
// src/lib/realtime/health.ts
export function monitorConnectionHealth(
  channel: RealtimeChannel,
  callbacks: {
    onHealthy: () => void;
    onUnhealthy: () => void;
  }
) {
  let lastHeartbeat = Date.now();
  const TIMEOUT = 30000; // 30 seconds

  // Supabase sends heartbeats automatically
  channel.on('system', {}, () => {
    lastHeartbeat = Date.now();
    callbacks.onHealthy();
  });

  // Check for missed heartbeats
  const interval = setInterval(() => {
    if (Date.now() - lastHeartbeat > TIMEOUT) {
      callbacks.onUnhealthy();
    }
  }, 10000);

  return () => clearInterval(interval);
}
```

---

## Testing

### Test Driver Simulator

Visit `/admin/tracking/test-driver` to simulate a driver:

1. Click **"Connect to Realtime"**
2. Click **"Start Route Simulation"**
3. Watch driver appear on admin dashboard map

### Debug Logging

```typescript
// Enable verbose logging
const channel = supabase.channel('driver-locations', {
  config: {
    log_level: 'debug'
  }
});
```

---

## Troubleshooting

### Connection Not Establishing

1. Check Supabase URL and anon key are correct
2. Verify feature flags are enabled
3. Check browser console for WebSocket errors
4. Ensure Supabase project has Realtime enabled

### Messages Not Received

1. Confirm channel name matches exactly
2. Check event name in broadcast matches subscription
3. Verify `self: false` if sender shouldn't receive own messages
4. Look for rate limiting (Supabase has limits per channel)

### Presence Not Working

1. Ensure presence key is unique per user
2. Call `.track()` after subscribing
3. Check for presence sync events

---

## Rate Limits

Supabase Realtime has the following limits:

| Limit | Free Tier | Pro Tier |
|-------|-----------|----------|
| Concurrent connections | 200 | 500 |
| Messages per second | 100 | 500 |
| Presence max | 100 | 500 |
| Broadcast payload | 250KB | 250KB |

---

## Related Documentation

- [Supabase Realtime Docs](https://supabase.com/docs/guides/realtime)
- [Phoenix Channels](https://hexdocs.pm/phoenix/channels.html)
- [Driver Dashboard Audit](../driver-dashboard-audit-2025-01.md)
