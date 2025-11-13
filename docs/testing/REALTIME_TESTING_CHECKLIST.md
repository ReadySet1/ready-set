# Supabase Realtime - Local Testing Checklist

**Issue**: REA-122
**Date**: 2025-11-07
**Testing Environment**: Local Development

---

## Prerequisites

### 1. Environment Configuration

- [x] Supabase project is running and accessible
- [x] Environment variables are set:
  ```bash
  NEXT_PUBLIC_SUPABASE_URL=https://[your-project].supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=[your-anon-key]
  ```

### 2. Supabase Dashboard Configuration

- [x] Navigate to Supabase Dashboard → Project Settings → API
- [x] Verify Realtime is enabled for the project
- [ ] Check Realtime configuration:
  - [ ] Max concurrent connections limit
  - [ ] Rate limiting settings
  - [ ] Channel authorization policies (if any)

### 3. Database Setup

- [ ] Run migrations if needed: `pnpm supabase db push`
- [ ] Verify `driver_locations` table exists (or equivalent)
- [ ] Check RLS policies are configured (if using)

---

## Phase 1: Feature Flag Configuration (Internal Testing Only)

### Enable Realtime Features

Create/update `.env.local` file:

```bash
# Core Realtime Features
NEXT_PUBLIC_FF_USE_REALTIME_TRACKING=true
NEXT_PUBLIC_FF_USE_REALTIME_LOCATION_UPDATES=true
NEXT_PUBLIC_FF_USE_REALTIME_ADMIN_DASHBOARD=true

# Driver Messaging (Phase 4 - not yet implemented)
# NEXT_PUBLIC_FF_USE_REALTIME_DRIVER_MESSAGING=false

# Fallback Options (keep enabled for safety)
NEXT_PUBLIC_FF_REALTIME_FALLBACK_TO_SSE=true
NEXT_PUBLIC_FF_REALTIME_FALLBACK_TO_REST=true
```

- [ ] `.env.local` file created/updated with above flags
- [ ] Restart dev server: `pnpm dev`
- [ ] Verify feature flags loaded in console logs

---

## Phase 2: Driver Location Broadcasting

### Test Driver Portal Location Updates

**Location**: `/driver/tracking` or driver tracking page

#### 2.1 Connection Status
- [ ] Open driver tracking portal
- [ ] Check browser console for Realtime connection logs
- [ ] Verify "Connected to Realtime" message or indicator
- [ ] Connection state should be `connected` (not `connecting` or `error`)

#### 2.2 Manual Location Update
- [ ] Trigger a manual location update (if there's a button)
- [ ] Check console for broadcast confirmation
- [ ] Verify no errors in console

#### 2.3 Automatic Location Updates
- [ ] Enable location tracking (if not auto-enabled)
- [ ] Move your location or use browser dev tools to simulate GPS changes
  - Chrome: DevTools → More Tools → Sensors → Location
- [ ] Verify location updates are sent every X seconds (check interval)
- [ ] Check Network tab for WebSocket connection (not REST API calls)

#### 2.4 Fallback Behavior
- [ ] Disable Realtime in Supabase Dashboard (temporarily)
- [ ] Verify fallback to REST API kicks in
- [ ] Check console for "Falling back to REST API" message
- [ ] Re-enable Realtime and verify reconnection

**Console Commands to Test:**
```javascript
// Check connection state
const client = window.__REALTIME_CLIENT__;
console.log(client?.getConnectionState('driver-locations'));

// Check if connected
console.log(client?.isConnected('driver-locations'));
```

---

## Phase 3: Admin Dashboard Real-Time Updates

### Test Admin Tracking Dashboard

**Location**: `/admin/tracking` or admin dashboard

#### 3.1 Connection Status
- [ ] Open admin dashboard in a NEW browser window/tab
- [ ] Check console for Realtime connection logs
- [ ] Verify "Real-time WebSocket connected" status indicator
- [ ] Look for connection mode indicator (SSE vs Realtime)

#### 3.2 Live Toggle Feature
- [ ] Find the Realtime/SSE toggle button (should have SignalIcon)
- [ ] Toggle OFF - should show "SSE mode (polling every 5s)"
- [ ] Toggle ON - should show "✓ Real-time WebSocket connected"
- [ ] Verify toggle persists on page refresh (check localStorage)

#### 3.3 Receive Location Updates
**Setup**: Have both driver portal and admin dashboard open side-by-side

- [ ] Send a location update from driver portal
- [ ] Admin dashboard should receive update within 2 seconds
- [ ] Check driver marker moves on admin map (if map exists)
- [ ] Verify driver info panel updates (speed, heading, accuracy, etc.)

#### 3.4 Multiple Drivers
- [ ] Open driver portal in 2-3 different browser sessions/profiles
  - Chrome: File → New Incognito Window
  - Firefox: File → New Private Window
- [ ] Each session should have different driver logged in
- [ ] Send location updates from each driver
- [ ] Admin dashboard should show all drivers updating in real-time
- [ ] Check for no duplicate updates (console should not show same update twice)

#### 3.5 Deduplication
- [ ] Open admin dashboard in 2 tabs simultaneously
- [ ] Send a driver location update
- [ ] Both tabs should receive the update
- [ ] Check console - no "duplicate update detected" warnings

---

## Phase 4: Test Driver Portal (Test Driver Simulator)

### Test Driver Simulator Page

**Location**: `/admin/tracking/test-driver`

#### 4.1 Basic Functionality
- [ ] Navigate to test driver page
- [ ] See connection status indicator
- [ ] "Connect" button should be visible

#### 4.2 Connect/Disconnect
- [ ] Click "Connect" button
- [ ] Status should change to "Connected"
- [ ] Check console for successful subscription
- [ ] Click "Disconnect" button
- [ ] Status should change to "Disconnected"

#### 4.3 Manual Broadcast
- [ ] Click "Connect"
- [ ] Click "Send Location" or "Broadcast" button
- [ ] Check console for broadcast confirmation
- [ ] Message counter should increment
- [ ] Open admin dashboard in another tab
- [ ] Verify admin dashboard receives the simulated location

#### 4.4 Auto-Broadcast
- [ ] Enable auto-broadcast (if available)
- [ ] Set interval (e.g., every 5 seconds)
- [ ] Watch message counter increment automatically
- [ ] Admin dashboard should receive continuous updates
- [ ] Disable auto-broadcast
- [ ] Counter should stop incrementing

---

## Phase 5: Connection Reliability & Error Handling

### 5.1 Network Interruption
- [ ] Open driver portal with active location tracking
- [ ] Open Chrome DevTools → Network tab
- [ ] Enable "Offline" mode
- [ ] Wait 5-10 seconds
- [ ] Disable "Offline" mode
- [ ] Verify automatic reconnection happens
- [ ] Check console for "Reconnecting..." messages
- [ ] Verify location updates resume after reconnection

### 5.2 Server Restart Simulation
- [ ] Have active Realtime connection
- [ ] Restart Supabase local instance (if using local)
- [ ] OR temporarily pause Realtime in Supabase Dashboard
- [ ] Verify exponential backoff reconnection attempts (1s, 2s, 4s, 5s max)
- [ ] Verify connection restores when server comes back

### 5.3 Authentication Expiry
- [ ] Log in as a driver
- [ ] Start location tracking
- [ ] Clear authentication token in DevTools (Application → Cookies)
- [ ] Wait for next location update attempt
- [ ] Should see authentication error in console
- [ ] Fallback to REST should handle gracefully (or redirect to login)

### 5.4 Rate Limiting
- [ ] Send 20+ location updates rapidly (spam click)
- [ ] Check if Supabase rate limiting triggers
- [ ] Verify error handling (should not crash app)
- [ ] Check console for rate limit errors

---

## Phase 6: Performance & Load Testing

### 6.1 Browser Performance
- [ ] Open Chrome DevTools → Performance tab
- [ ] Start recording
- [ ] Enable location tracking for 2-3 minutes
- [ ] Stop recording
- [ ] Check for:
  - [ ] No memory leaks (heap size should stabilize)
  - [ ] No excessive CPU usage
  - [ ] No janky frame rates

### 6.2 Memory Usage
- [ ] Open Chrome DevTools → Memory tab
- [ ] Take heap snapshot
- [ ] Enable location tracking
- [ ] Wait 5 minutes
- [ ] Take another heap snapshot
- [ ] Compare: Memory growth should be minimal (<50MB)

### 6.3 Network Efficiency
- [ ] Open Chrome DevTools → Network tab → WS (WebSocket)
- [ ] Monitor WebSocket frames
- [ ] Verify:
  - [ ] Only one WebSocket connection (not multiple)
  - [ ] Heartbeat pings every 30 seconds
  - [ ] No excessive reconnection attempts
  - [ ] Message payloads are reasonable size (<10KB per message)

### 6.4 Concurrent Connections
**Requires multiple devices or browser profiles**

- [ ] Open 5+ driver sessions simultaneously
- [ ] All drivers send location updates
- [ ] Admin dashboard receives all updates
- [ ] No performance degradation
- [ ] No connection drops

---

## Phase 7: Data Verification

### 7.1 Database Persistence
- [ ] Send location update from driver
- [ ] Open Supabase Dashboard → Table Editor
- [ ] Check `driver_locations` table
- [ ] Verify latest record matches sent location:
  - [ ] Correct latitude/longitude
  - [ ] Accurate timestamp
  - [ ] Driver ID matches
  - [ ] Accuracy, speed, heading populated

### 7.2 Broadcast Enrichment
**Admin dashboard should receive more data than driver sends**

Driver sends:
```json
{
  "lat": 40.7128,
  "lng": -74.006,
  "accuracy": 10,
  "speed": 25.5,
  "heading": 180
}
```

Admin receives:
```json
{
  "driverId": "driver-123",
  "driverName": "John Doe",
  "vehicleId": "vehicle-456",
  "lat": 40.7128,
  "lng": -74.006,
  // ... plus enriched data
}
```

- [ ] Check admin console logs
- [ ] Verify enriched payload includes driver name, vehicle info
- [ ] Enrichment happens server-side (not client-side)

---

## Phase 8: Browser Compatibility

### 8.1 Desktop Browsers
- [ ] Chrome (latest) - fully functional
- [ ] Firefox (latest) - fully functional
- [ ] Safari (latest) - fully functional
- [ ] Edge (latest) - fully functional

### 8.2 Mobile Browsers (if applicable)
- [ ] iOS Safari
- [ ] Android Chrome
- [ ] Mobile performance acceptable

### 8.3 Private/Incognito Mode
- [ ] Works in incognito/private browsing
- [ ] No localStorage issues
- [ ] Authentication persists

---

## Phase 9: Console Logs Review

### Expected Logs (No Errors)

**Driver Portal Console:**
```
✓ Realtime client initialized
✓ Subscribing to driver-locations channel
✓ Connected to driver-locations channel
✓ Location update sent: {lat: 40.7128, lng: -74.006}
✓ Heartbeat ping sent
```

**Admin Dashboard Console:**
```
✓ Realtime client initialized
✓ Subscribing to driver-locations channel
✓ Connected to driver-locations channel
✓ Received location update: {driverId: "driver-123", ...}
✓ Driver marker updated on map
```

### Check for Errors
- [ ] No `RealtimeConnectionError` messages
- [ ] No `Channel not subscribed` errors
- [ ] No `Authentication failed` errors
- [ ] No `Failed to broadcast` errors
- [ ] No React rendering warnings related to Realtime

---

## Phase 10: Known Issues & Limitations

Document any issues found during testing:

### Current Limitations (Expected)
- [ ] Delivery assignments NOT implemented (Phase 3)
- [ ] Admin-Driver messaging NOT implemented (Phase 4)
- [ ] Driver presence indicators NOT implemented (Phase 2)
- [ ] No UI for connection quality/latency
- [ ] No retry count indicator

### Issues Found (Unexpected)
_Document issues here:_

1. **Issue**: [Description]
   - **Steps to Reproduce**: [Steps]
   - **Expected**: [What should happen]
   - **Actual**: [What actually happens]
   - **Severity**: [Critical/High/Medium/Low]

---

## Phase 11: Rollback Plan

If critical issues are found:

- [ ] Turn OFF feature flags in `.env.local`:
  ```bash
  NEXT_PUBLIC_FF_USE_REALTIME_TRACKING=false
  NEXT_PUBLIC_FF_USE_REALTIME_LOCATION_UPDATES=false
  NEXT_PUBLIC_FF_USE_REALTIME_ADMIN_DASHBOARD=false
  ```
- [ ] Restart dev server
- [ ] Verify fallback to REST/SSE works
- [ ] Document issue in GitHub/Plane
- [ ] Notify team

---

## Testing Summary

**Tested By**: _________________
**Date**: _________________
**Environment**: Local Development
**Branch**: `feature/REA-122-websocket-supabase-realtime`

### Overall Status
- [ ] ✅ All critical features working
- [ ] ⚠️ Minor issues found (see Phase 10)
- [ ] ❌ Critical issues found - rollback needed

### Test Results
- **Total Tests**: _____ / 100+
- **Passed**: _____
- **Failed**: _____
- **Skipped**: _____

### Recommendation
- [ ] ✅ Ready for internal rollout (admin/test users)
- [ ] ⚠️ Needs fixes before rollout
- [ ] ❌ Not ready - significant issues

### Next Steps
_What needs to be done next:_

---

## Quick Reference Commands

```bash
# Start dev server
pnpm dev

# Run unit tests
pnpm test src/__tests__/lib/realtime/

# Type check
pnpm typecheck

# Database migrations
pnpm supabase db push

# Check Supabase status
pnpm supabase status

# View logs
pnpm supabase functions logs

# Restart everything
pnpm dev --reset-cache
```

## Useful Browser Console Commands

```javascript
// Check Realtime connection
const client = window.__REALTIME_CLIENT__;

// Get connection state
client?.getConnectionState('driver-locations');

// Check if connected
client?.isConnected('driver-locations');

// Get feature flags
console.log(window.__FEATURE_FLAGS__);

// Clear localStorage (force fresh state)
localStorage.clear();

// Reload with cache disabled
location.reload(true);
```

---

## Notes & Observations

_Add any additional notes, observations, or questions here:_

