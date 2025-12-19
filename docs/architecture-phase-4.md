# Phase 4 System Architecture

Comprehensive architecture documentation for Phase 4 Driver Dashboard features with visual diagrams.

---

## System Overview

Phase 4 integrates multiple external services to provide real-time driver tracking, notifications, and delivery management.

```mermaid
flowchart TB
    subgraph Client["Client Applications"]
        DA[Driver App]
        AD[Admin Dashboard]
        CA[Customer App]
    end

    subgraph Backend["Next.js Backend"]
        API[API Routes]
        SA[Server Actions]
        SVC[Services Layer]
    end

    subgraph External["External Services"]
        SB[(Supabase)]
        MB[Mapbox]
        FB[Firebase FCM]
        RS[Resend]
        ST[Sentry]
    end

    DA --> API
    AD --> API
    CA --> API

    API --> SVC
    SA --> SVC

    SVC --> SB
    SVC --> FB
    SVC --> RS
    SVC --> ST

    AD --> MB
    DA --> SB

    SB -->|Realtime| DA
    SB -->|Realtime| AD
```

---

## 1. WebSocket Communication Flow

Real-time bidirectional communication between drivers, admin dashboard, and the backend using Supabase Realtime (Phoenix Channels).

```mermaid
sequenceDiagram
    participant D as Driver App
    participant SR as Supabase Realtime
    participant PG as PostgreSQL
    participant AD as Admin Dashboard

    Note over D,AD: Connection Phase
    D->>SR: Connect (JWT Auth)
    SR-->>D: Connection ACK
    AD->>SR: Connect (JWT Auth)
    SR-->>AD: Connection ACK

    Note over D,AD: Subscribe to Channels
    D->>SR: Subscribe driver-locations
    D->>SR: Subscribe admin-commands
    AD->>SR: Subscribe driver-locations
    AD->>SR: Subscribe driver-status

    Note over D,AD: Location Broadcasting
    loop Every 0.5-5 seconds
        D->>SR: Broadcast location
        SR->>PG: Store location (driver_locations)
        SR->>AD: Forward location update
        AD->>AD: Update map marker
    end

    Note over D,AD: Admin Commands
    AD->>SR: Send assign-delivery command
    SR->>D: Forward command
    D->>D: Process assignment
```

### Channel Architecture

```mermaid
flowchart LR
    subgraph Channels["Supabase Realtime Channels"]
        DL[driver-locations]
        DS[driver-status]
        AC[admin-commands]
        DEL[deliveries]
    end

    subgraph Events["Event Types"]
        LOC[location broadcast]
        STAT[status change]
        PRES[presence sync]
        CMD[admin command]
        ASSIGN[delivery assigned]
    end

    DL --> LOC
    DS --> STAT
    DS --> PRES
    AC --> CMD
    DEL --> ASSIGN
```

### Fallback Strategy

```mermaid
flowchart TD
    A[Client Connection] --> B{WebSocket OK?}
    B -->|Yes| C[Use Supabase Realtime]
    B -->|No| D{SSE Enabled?}
    D -->|Yes| E[Use Server-Sent Events]
    D -->|No| F{REST Enabled?}
    F -->|Yes| G[Use REST Polling]
    F -->|No| H[Connection Failed]

    C --> I[Real-time Updates]
    E --> I
    G --> I

    style C fill:#22c55e
    style E fill:#eab308
    style G fill:#f97316
    style H fill:#ef4444
```

---

## 2. Notification Delivery Pipeline

Customer notifications via push (Firebase) and email (Resend) when delivery status changes.

```mermaid
flowchart TB
    subgraph Trigger["Status Change Trigger"]
        SC[Delivery Status Update]
    end

    subgraph Validation["Validation Layer"]
        PC{User Has<br>Preferences?}
        DD{Duplicate<br>Check}
    end

    subgraph Delivery["Delivery Channels"]
        subgraph Push["Push Notifications"]
            FCM[Firebase FCM]
            TM[Token Manager]
        end
        subgraph Email["Email Notifications"]
            RS[Resend API]
            TPL[Email Templates]
        end
    end

    subgraph Endpoints["Delivery Endpoints"]
        DEV[User Device]
        INB[Email Inbox]
    end

    SC --> PC
    PC -->|Yes| DD
    PC -->|No| SKIP[Skip Notification]

    DD -->|New| FCM
    DD -->|New| RS
    DD -->|Duplicate| SKIP

    FCM --> TM
    TM -->|Valid Token| DEV
    TM -->|Invalid| REV[Revoke Token]

    RS --> TPL
    TPL --> INB
```

### Deduplication Logic

```mermaid
flowchart LR
    A[Notification Request] --> B{In Cache?}
    B -->|Yes| C{Within 60s?}
    C -->|Yes| D[Skip - Duplicate]
    C -->|No| E[Send + Update Cache]
    B -->|No| E
    E --> F[Notification Sent]

    style D fill:#ef4444
    style F fill:#22c55e
```

### Notification Events Matrix

| Status Change | Push | Email | Customer | Driver |
|--------------|------|-------|----------|--------|
| ASSIGNED | ✓ | - | - | ✓ |
| EN_ROUTE_TO_DELIVERY | ✓ | ✓ | ✓ | - |
| ARRIVED_AT_DELIVERY | ✓ | ✓ | ✓ | - |
| DELIVERED | ✓ | ✓ | ✓ | - |
| DELAYED | ✓ | ✓ | ✓ | - |
| FAILED | ✓ | ✓ | ✓ | ✓ |

---

## 3. GPS Tracking and Mileage Calculation

Driver location tracking and mileage calculation using PostGIS for accurate distance measurement.

```mermaid
flowchart TB
    subgraph Driver["Driver Device"]
        GPS[GPS Sensor]
        BAT[Battery Monitor]
        APP[Driver App]
    end

    subgraph API["Location API"]
        VAL[Validate Payload]
        STORE[Store Location]
    end

    subgraph Database["PostGIS Database"]
        DL[(driver_locations)]
        DS[(driver_shifts)]
        DEL[(deliveries)]
    end

    subgraph Calculation["Mileage Service"]
        FETCH[Fetch Points]
        FILTER[Quality Filter]
        CALC[Calculate Distance]
        ATTR[Attribute to Deliveries]
    end

    GPS --> APP
    BAT --> APP
    APP -->|POST /api/tracking/locations| VAL
    VAL --> STORE
    STORE --> DL

    DL --> FETCH
    FETCH --> FILTER
    FILTER --> CALC
    CALC --> ATTR
    ATTR --> DS
```

### Quality Filtering Pipeline

```mermaid
flowchart LR
    A[Raw GPS Points] --> B{Accuracy < 50m?}
    B -->|No| X1[Reject]
    B -->|Yes| C{Speed > 0.5 m/s?}
    C -->|No| X2[Filter Stationary]
    C -->|Yes| D{Segment Speed < 200 km/h?}
    D -->|No| X3[Filter Glitch]
    D -->|Yes| E{Distance < 1km?}
    E -->|No| X4[Filter Teleport]
    E -->|Yes| F[Include in Calculation]

    style F fill:#22c55e
    style X1 fill:#ef4444
    style X2 fill:#eab308
    style X3 fill:#ef4444
    style X4 fill:#ef4444
```

### Mileage Calculation Query

```sql
-- PostGIS distance calculation
SELECT SUM(
    ST_Distance(
        location::geography,
        LAG(location) OVER (ORDER BY recorded_at)::geography
    )
) / 1609.34 AS miles_driven
FROM driver_locations
WHERE shift_id = $1
  AND accuracy < 50
  AND speed > 0.5
ORDER BY recorded_at;
```

---

## 4. Photo Upload and Storage Flow

Proof of delivery photo capture, compression, and storage with offline support.

```mermaid
flowchart TB
    subgraph Capture["Photo Capture"]
        CAM[Camera API]
        PREV[Preview]
        COMP[Compress Image]
    end

    subgraph Online["Online Path"]
        UP[Upload API]
        SBS[(Supabase Storage)]
        META[Store Metadata]
    end

    subgraph Offline["Offline Path"]
        IDB[(IndexedDB Queue)]
        SYNC[Background Sync]
        RETRY[Retry Logic]
    end

    subgraph Admin["Admin View"]
        GAL[POD Gallery API]
        VIEW[Image Viewer]
    end

    CAM --> PREV
    PREV --> COMP

    COMP --> NET{Online?}
    NET -->|Yes| UP
    NET -->|No| IDB

    UP --> SBS
    SBS --> META

    IDB --> SYNC
    SYNC -->|Online| UP
    SYNC -->|Failed| RETRY
    RETRY --> IDB

    META --> GAL
    GAL --> VIEW
```

### Offline Queue Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Captured: Photo taken
    Captured --> Compressing: Start compression
    Compressing --> Previewing: Show preview
    Previewing --> Uploading: User confirms
    Previewing --> Captured: User retakes

    Uploading --> Complete: Success
    Uploading --> Queued: Network error

    Queued --> Uploading: Network restored
    Queued --> Failed: Max retries (10)

    Complete --> [*]
    Failed --> Cleanup: After 7 days
    Cleanup --> [*]
```

---

## 5. External Service Dependencies

```mermaid
flowchart TB
    subgraph App["Ready Set Application"]
        BE[Backend]
        FE[Frontend]
    end

    subgraph Maps["Mapping Service"]
        MB[Mapbox GL JS]
        MBT[Map Tiles]
        MBG[Geocoding API]
    end

    subgraph Realtime["Real-time Platform"]
        SBR[Supabase Realtime]
        SBS[Supabase Storage]
        SBD[(Supabase DB)]
    end

    subgraph Notifications["Notification Services"]
        FCM[Firebase FCM]
        RES[Resend Email]
    end

    subgraph Monitoring["Error Monitoring"]
        SEN[Sentry]
        SRC[Source Maps]
    end

    FE --> MB
    MB --> MBT
    FE --> MBG

    FE --> SBR
    BE --> SBS
    BE --> SBD

    BE --> FCM
    BE --> RES

    FE --> SEN
    BE --> SEN
    BE --> SRC
```

### Service Rate Limits and Quotas

| Service | Free Tier | Rate Limit | Notes |
|---------|-----------|------------|-------|
| Mapbox | 50K loads/month | N/A | Per-view pricing |
| Supabase Realtime | 200 connections | 100 msg/sec | Per project |
| Firebase FCM | Unlimited | 1K msg/sec | Token limits apply |
| Resend | 3K emails/month | 100/day | Free tier |
| Sentry | 5K errors/month | N/A | Per project |

---

## 6. Error Handling and Monitoring

```mermaid
flowchart TB
    subgraph Sources["Error Sources"]
        API[API Errors]
        WS[WebSocket Errors]
        MAP[Map Errors]
        UP[Upload Errors]
    end

    subgraph Processing["Error Processing"]
        FILT[Filter Benign Errors]
        CTX[Add Context]
        BREAD[Add Breadcrumbs]
    end

    subgraph Sentry["Sentry Platform"]
        CAP[Capture Exception]
        ALT[Alerting]
        DASH[Dashboard]
    end

    subgraph Benign["Filtered Out"]
        EXT[Browser Extensions]
        RSO[ResizeObserver]
        NET[Network Errors*]
        RSC[RSC Errors]
    end

    API --> FILT
    WS --> FILT
    MAP --> FILT
    UP --> FILT

    FILT -->|Real Error| CTX
    FILT -->|Benign| Benign

    CTX --> BREAD
    BREAD --> CAP
    CAP --> ALT
    CAP --> DASH
```

---

## Feature Flag Decision Points

```mermaid
flowchart TD
    A[Feature Request] --> B{FF_USE_REALTIME_LOCATION_UPDATES?}
    B -->|true| C[Use WebSocket]
    B -->|false| D[Use REST Polling]

    C --> E{Connection Failed?}
    E -->|No| F[Realtime Mode]
    E -->|Yes| G{FF_REALTIME_FALLBACK_TO_SSE?}

    G -->|true| H[Use SSE]
    G -->|false| I{FF_REALTIME_FALLBACK_TO_REST?}

    H --> J{SSE Failed?}
    J -->|No| K[SSE Mode]
    J -->|Yes| I

    I -->|true| D
    I -->|false| L[Degraded Mode]

    style F fill:#22c55e
    style K fill:#eab308
    style D fill:#f97316
    style L fill:#ef4444
```

---

## Scaling Considerations

### Current Architecture Limits

| Component | Current Capacity | Scaling Strategy |
|-----------|-----------------|------------------|
| WebSocket Connections | 200 concurrent | Upgrade Supabase tier |
| Map Loads | 50K/month | Implement tile caching |
| Push Notifications | Unlimited | Token cleanup automation |
| Email Delivery | 3K/month | Upgrade Resend tier |
| GPS Points Storage | Unlimited | Archive old data |

### Recommended Optimizations

1. **Map Performance**
   - Implement marker clustering for >10 drivers
   - Cache static tiles
   - Use lower zoom levels on mobile

2. **Realtime Scaling**
   - Implement presence-based filtering
   - Reduce broadcast frequency for slow-moving drivers
   - Use room-based channels for geographic areas

3. **Storage Management**
   - Archive GPS data older than 90 days
   - Compress POD images to 1MB max
   - Implement CDN for frequently accessed images

---

## Related Documentation

- [Phase 4 Implementation Guide](phase-4-implementation-guide.md)
- [Deployment Checklist](deployment-checklist-phase-4.md)
- [Driver Dashboard Audit](driver-dashboard-audit-2025-01.md)
- [Quick Reference](driver-dashboard-quick-reference.md)
- [Test Plan](driver-dashboard-test-plan.md)

### Setup Guides

- [Mapbox Integration](setup/mapbox-integration.md)
- [WebSocket Setup](setup/websocket-setup.md)
- [Notifications Setup](setup/notifications.md)
