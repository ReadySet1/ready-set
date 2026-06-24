# Web-side integration — wiring the native GPS bridge into the Next app

`capacitor-tracking.ts` runs inside the WebView (where Capacitor injects the
plugin bridge). It is **drafted here, not yet wired into the live app** — the
native track is gated (see `../README.md`). When greenlit, do the following.

## 1. Add the dependencies (Next app)

```bash
cd repos/ready-set
pnpm add @capacitor/core @capacitor-community/background-geolocation
```

Both are tree-shakeable and the module is feature-detected, so plain web builds
are unaffected (every export no-ops off-device).

## 2. Copy the bridge into the app

```bash
cp native/driver-app/web-integration/capacitor-tracking.ts \
   src/lib/tracking/capacitor-tracking.ts
```

## 3. Drive it from the shift lifecycle

The driver app already starts/stops GPS on shift start/end in
`src/contexts/DriverTrackingContext.tsx`. Add the native bridge alongside the
existing web tracking — it **supplements**, it doesn't replace it (web tracking
still runs in the foreground; the native plugin is what survives backgrounding).

```ts
// src/contexts/DriverTrackingContext.tsx (sketch)
import {
  startNativeShiftTracking,
  stopNativeShiftTracking,
} from '@/lib/tracking/capacitor-tracking';
import { createClient } from '@/utils/supabase/client';

const supabase = createClient();

// in the startShift wrapper, after the existing startTracking():
await startNativeShiftTracking({
  driverId,                       // the driver's id (already resolved for tracking)
  getAccessToken: async () =>
    (await supabase.auth.getSession()).data.session?.access_token ?? null,
});

// in the endShift wrapper, before/after the existing stopTracking():
await stopNativeShiftTracking();
```

`getAccessToken` is called per-post so token refreshes are picked up
automatically — no separate native login is needed for the POC.

## 4. Permissions

Add the location permission strings to the generated native projects — see
`../README.md` → **Permissions** (iOS `Info.plist`, Android `AndroidManifest.xml`).

## How it fits the existing backend

- Posts to the **existing** `POST /api/tracking/locations` with
  `Authorization: Bearer <jwt>` — `withAuth` already accepts Bearer
  (`src/lib/auth-middleware.ts`), so **no API/route/schema change**.
- Same body shape the web client sends (`driver_id`, `latitude`, `longitude`,
  `accuracy`, `speed`, `heading`, `altitude`, `is_moving`), so it lands in
  `driver_locations` and feeds shift mileage exactly like the foreground path.
- Throttled to ≥5 s to respect the server rate limit.
