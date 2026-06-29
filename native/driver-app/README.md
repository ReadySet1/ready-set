# Ready Set Driver — native shell (Capacitor POC)

> **Status: SCAFFOLDING / GATED.** This is a proof-of-concept skeleton, drafted
> ahead of a go/no-go. It is **not built or run yet** and is **not for merge into
> a release** until the prerequisites below are met. Tracks board card
> `persistent-gps-background` (Track D); full evaluation in
> `docs/ready-set/specs/2026-06-17-native-driver-app-background-tracking.md`.

## What this is

A **thin native wrapper** around the existing `/driver` web app so GPS keeps
recording when the screen is locked or the driver switches to Waze/Maps — the gap
web-only tracking physically cannot close (iOS suspends background JS + geolocation).

It is **not** a rewrite. The native shell loads the **deployed** `/driver` UI in a
WebView (`server.url`), and a native **background-geolocation** plugin keeps a
location service alive in the OS background, posting each fix to the **existing**
`POST /api/tracking/locations` route with the driver's Supabase token.

```
┌─────────────────────────── native app (Capacitor) ───────────────────────────┐
│  WebView → https://development.readysetllc.com/driver   (the real web UI)      │
│  Capacitor bridge injects window.Capacitor.Plugins.BackgroundGeolocation       │
│                                                                                │
│  web-integration/capacitor-tracking.ts  (added to the Next app's src/)         │
│    on shift start → BackgroundGeolocation.addWatcher(...)                       │
│      └ each fix → POST /api/tracking/locations  (Authorization: Bearer <jwt>)  │
│    on shift end  → BackgroundGeolocation.removeWatcher(...)                     │
└────────────────────────────────────────────────────────────────────────────────┘
              ▲ no backend change — withAuth() already accepts Bearer
```

**Zero backend changes.** `withAuth` already accepts `Authorization: Bearer`
(`src/lib/auth-middleware.ts`), and the location-ingest contract is unchanged.

## Prerequisites (the gate)

- [ ] **Go/no-go** decision to pursue the native app.
- [ ] **Apple Developer account** ($99/yr) — for signing + TestFlight.
- [ ] **Android keystore** (+ a Google Play account only if distributing via Play).
- [ ] A real **iPhone** and a real **Android** device (background GPS cannot be
      validated in a simulator).
- [ ] Local toolchain: Xcode + CocoaPods (iOS), Android Studio + SDK (Android),
      Node 20+.

## First-time setup (once the gate is cleared)

```bash
cd repos/ready-set/native/driver-app
npm install

# Point the shell at the environment you want to dogfood (defaults to dev):
export DRIVER_URL="https://development.readysetllc.com/driver"

# Generate the native projects (creates ios/ and android/ — gitignored):
npx cap add ios
npx cap add android
npx cap sync
```

Then add the platform permissions (see **Permissions** below) and the web-side
hook (see `web-integration/README.md`).

## Run on a device

```bash
npx cap run ios        # or: npx cap open ios     → run from Xcode on a real iPhone
npx cap run android    # or: npx cap open android → run from Android Studio
```

## On-device test (the real validation)

Reuse the `WALK-TEST-SF` seed (pickup 390 Laurel St → 500 Presidio Ave, SF; see
`docs/JOURNAL.md` 2026-06-22). On a **real device**:

1. Log in as the test driver, open the delivery, **Start shift**.
2. Grant location **"Always"** (iOS) / **"Allow all the time"** (Android).
3. Switch to **Waze/Maps** and **lock the screen**. Walk for ~5 minutes.
4. Verify:
   - `driver_locations` keeps gaining rows with advancing `recorded_at` **while
     backgrounded** (not just in the foreground).
   - `/admin/tracking` dot keeps moving.
   - **End shift** → shift mileage > 0 and reflects the full path.
5. Repeat on the **other** platform (iOS *and* Android both have to pass).

## Permissions (added to the generated native projects after `cap add`)

**iOS — `ios/App/App/Info.plist`:**
- `NSLocationWhenInUseUsageDescription` — "Ready Set tracks your location during an active delivery."
- `NSLocationAlwaysAndWhenInUseUsageDescription` — same, for background.
- `UIBackgroundModes` → `location`.

**Android — `android/app/src/main/AndroidManifest.xml`:**
- `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`,
  `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`.
- The `@capacitor-community/background-geolocation` foreground-service entry (see
  the plugin README for the exact `<service>` block).

> The hard part is **not** the code — it's the OS permission dance (iOS "Always
> Allow" is a Settings-app grant, not an in-app dialog) and Android OEM battery
> killers (Doze / aggressive task-kill). Budget device-settings help + testing
> across a few Android brands.

## Architecture notes

- **Why `server.url` (remote) instead of bundling the web build?** So the native
  app always runs the live `/driver` UI with zero duplication — ship web fixes
  without an app-store release. Capacitor still injects the bridge + plugins into
  the remote page, so the web code can call the plugin.
- **Auth bridge.** The web app already holds the Supabase session inside the
  WebView. `capacitor-tracking.ts` reads a fresh access token per post (refresh-
  aware) and sets it as the `Bearer` header — no separate native login needed for
  the POC. (A fully-native login that injects the token is a Phase-1 nicety.)
- **Throttle.** Posts are throttled to ≥5 s to match the server rate limit
  (`/api/tracking/locations` ~12/min) and the web client.

## Productionizing (Phase 1, after the POC proves out)

- Swap the free community plugin for **transistorsoft** background-geolocation
  (fleet-grade reliability + battery; ~$300–600/platform) if the community plugin's
  background reliability isn't enough.
- Permission onboarding UX (iOS "Always Allow" walkthrough, Android battery-
  optimization exemption helper).
- Offline buffering + retry in the native layer; token-refresh re-injection.
- Internal distribution: **TestFlight** (iOS) + **APK sideload** (Android) — avoids
  public-store review.

## Layout

```
native/driver-app/
├── README.md                       ← this file (runbook)
├── package.json                    ← Capacitor shell deps
├── capacitor.config.ts             ← appId + server.url + webDir
├── www/index.html                  ← fallback page (only shown if server.url is unreachable)
└── web-integration/
    ├── README.md                   ← how to wire the hook into the Next app
    └── capacitor-tracking.ts       ← the web-side bridge (copy into src/lib/tracking/ when greenlit)
```
