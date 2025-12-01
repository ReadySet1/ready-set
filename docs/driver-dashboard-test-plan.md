# Driver Dashboard Test Plan

Comprehensive testing plan for Phase 4 Driver Dashboard features.

---

## Overview

This test plan covers all Phase 4 features:
1. Real-time Map Visualization (Mapbox)
2. WebSocket Communication (Supabase Realtime)
3. Customer Notifications (Firebase + SendGrid)
4. Mileage Calculation
5. Proof of Delivery Photos
6. Error Monitoring (Sentry)

---

## Test Categories

### 1. Unit Tests

#### Map Visualization

| Test | File | Status |
|------|------|--------|
| Map renders without token error | `LiveDriverMap.test.tsx` | Pass |
| Driver markers display correctly | `LiveDriverMap.test.tsx` | Pass |
| Marker colors match driver status | `LiveDriverMap.helpers.test.tsx` | Pass |
| Map controls function properly | `LiveDriverMap.test.tsx` | Pass |
| Popup content renders | `LiveDriverMap.test.tsx` | Pass |

```bash
pnpm test:unit -- src/components/Dashboard/Tracking/__tests__/LiveDriverMap.test.tsx
```

#### Tracking APIs

| Test | File | Status |
|------|------|--------|
| GET /api/tracking/deliveries returns data | `tracking-deliveries.test.ts` | Pass |
| POST /api/tracking/deliveries creates record | `tracking-deliveries.test.ts` | Pass |
| GET /api/tracking/deliveries/[id] returns details | `tracking-deliveries-id.test.ts` | Pass |
| PATCH /api/tracking/deliveries/[id] updates status | `tracking-deliveries-id.test.ts` | Pass |
| POD upload validates file type | `tracking-deliveries-id.test.ts` | Pass |
| POD upload validates file size | `tracking-deliveries-id.test.ts` | Pass |

```bash
pnpm test:unit -- src/__tests__/api/tracking/
```

#### Notifications

| Test | File | Status |
|------|------|--------|
| Push token registration | `route.test.ts` | Pass |
| Push token validation | `route.test.ts` | Pass |
| Deduplication prevents duplicates | `dedup.test.ts` | Pass |
| Deduplication allows after TTL | `dedup.test.ts` | Pass |

```bash
pnpm test:unit -- src/app/api/notifications/push/register/route.test.ts
pnpm test:unit -- src/services/notifications/__tests__/dedup.test.ts
```

#### Sentry Filters

| Test | File | Status |
|------|------|--------|
| Filters browser extension errors | `sentry.test.ts` | Pass |
| Filters ResizeObserver errors | `sentry.test.ts` | Pass |
| Filters network errors | `sentry.test.ts` | Pass |
| Passes through real errors | `sentry.test.ts` | Pass |

```bash
pnpm test:unit -- src/__tests__/lib/monitoring/sentry.test.ts
```

---

### 2. Integration Tests

#### Tracking System Integration

| Test | File | Status |
|------|------|--------|
| Full tracking flow works | `tracking-system.test.tsx` | Pass |
| Driver portal integration | `DriverTrackingPortal.test.tsx` | Pass |

```bash
pnpm test:unit -- src/__tests__/integration/tracking-system.test.tsx
pnpm test:unit -- src/__tests__/components/Driver/DriverTrackingPortal.test.tsx
```

---

### 3. E2E Tests

#### Realtime Driver Tracking

| Test | File | Status |
|------|------|--------|
| WebSocket connection established | `realtime-driver-tracking.spec.ts` | Pass |
| Driver simulation works | `realtime-driver-tracking.spec.ts` | Pass |
| Admin receives updates | `realtime-driver-tracking.spec.ts` | Pass |

```bash
pnpm test:e2e -- --grep "realtime-driver-tracking"
```

---

## Manual Test Procedures

### TC-001: Map Visualization

**Preconditions:**
- Mapbox token configured
- At least one active driver

**Steps:**
1. Navigate to `/admin/tracking`
2. Verify map loads with street view
3. Click satellite toggle, verify view changes
4. Click zoom in/out buttons
5. Click "Fit to drivers" button
6. Click on a driver marker
7. Verify popup shows driver details

**Expected Results:**
- Map loads within 2 seconds
- View toggles work
- Zoom controls function
- Popup displays correct information

---

### TC-002: Real-time Updates

**Preconditions:**
- WebSocket feature flag enabled
- Admin dashboard open

**Steps:**
1. Open `/admin/tracking` in browser A
2. Open `/admin/tracking/test-driver` in browser B
3. In browser B, click "Connect to Realtime"
4. In browser B, click "Start Route Simulation"
5. Observe browser A for marker movement

**Expected Results:**
- Driver appears on map within 2 seconds
- Position updates smoothly
- No lag > 2 seconds between updates

---

### TC-003: Push Notifications

**Preconditions:**
- Firebase configured
- HTTPS enabled

**Steps:**
1. Navigate to app in Chrome/Edge
2. Click "Enable Notifications" when prompted
3. Grant permission in browser dialog
4. Trigger test notification via API
5. Observe notification appears

**Expected Results:**
- Permission prompt appears
- Notification displays with correct title/body
- Click opens correct URL

---

### TC-004: Email Notifications

**Preconditions:**
- SendGrid configured
- Valid email address

**Steps:**
1. Trigger delivery status change
2. Check email inbox
3. Verify email content
4. Click links in email

**Expected Results:**
- Email arrives within 1 minute
- Template renders correctly
- Links work

---

### TC-005: POD Photo Upload

**Preconditions:**
- Mobile device or camera-enabled browser
- Active delivery assigned

**Steps:**
1. Navigate to driver portal
2. Open active delivery
3. Click "Capture Photo"
4. Grant camera permission
5. Take photo
6. Review preview
7. Click "Upload"
8. Verify in admin gallery

**Expected Results:**
- Camera opens (back camera on mobile)
- Preview displays clearly
- Upload completes < 5 seconds
- Image visible in admin view

---

### TC-006: Mileage Calculation

**Preconditions:**
- Completed shift with GPS data
- PostGIS enabled

**Steps:**
1. Complete a driver shift with movement
2. Call mileage API for shift
3. Verify response includes mileage
4. Compare with expected distance

**Expected Results:**
- API returns mileage value
- Value within ±10% of actual distance
- Quality metrics included

---

### TC-007: Sentry Error Tracking

**Preconditions:**
- Sentry configured
- Test endpoints accessible

**Steps:**
1. Navigate to `/test-sentry`
2. Click "Trigger Client Error"
3. Navigate to `/api/test-sentry?type=error`
4. Check Sentry dashboard

**Expected Results:**
- Errors appear in Sentry
- Stack traces readable
- User context attached

---

## Performance Tests

### PT-001: Map Load Time

**Target:** < 2 seconds

**Procedure:**
1. Clear browser cache
2. Navigate to `/admin/tracking`
3. Measure time to interactive map

### PT-002: WebSocket Latency

**Target:** < 500ms

**Procedure:**
1. Connect driver to realtime
2. Measure round-trip time for location update
3. Average over 100 updates

### PT-003: POD Upload Time

**Target:** < 5 seconds for 2MB image

**Procedure:**
1. Capture 2MB image
2. Time from upload start to completion
3. Average over 10 uploads

---

## Regression Tests

Run after any Phase 4 changes:

```bash
# Full Phase 4 test suite
pnpm test:unit -- --testPathPattern="(LiveDriverMap|tracking|notification|mileage|sentry)"

# Typecheck
pnpm typecheck

# Lint
pnpm lint
```

---

## Test Data

### Test Driver Accounts
- `driver-test-1@readyset.com` - Active driver
- `driver-test-2@readyset.com` - Inactive driver

### Test Delivery IDs
- Use `/admin/tracking/test-driver` to create test data

### Test Push Token
- Register via `/api/notifications/push/register` with test user

---

## Bug Reporting Template

```markdown
## Bug Report

**Feature:** [Map/Realtime/Notifications/Mileage/POD/Sentry]
**Severity:** [Critical/High/Medium/Low]
**Environment:** [Production/Staging/Development]

### Description
[Clear description of the issue]

### Steps to Reproduce
1. Step one
2. Step two
3. Step three

### Expected Behavior
[What should happen]

### Actual Behavior
[What actually happens]

### Screenshots/Logs
[Attach relevant screenshots or error logs]

### Device/Browser
- Device: [e.g., iPhone 14, Desktop]
- Browser: [e.g., Chrome 120, Safari 17]
- OS: [e.g., iOS 17, Windows 11]
```

---

## Test Coverage Goals

| Component | Target | Current |
|-----------|--------|---------|
| Map components | 70% | TBD |
| Tracking APIs | 80% | TBD |
| Notification service | 75% | TBD |
| Mileage calculation | 80% | TBD |
| POD upload | 70% | TBD |

---

## Related Documentation

- [Audit Report](driver-dashboard-audit-2025-01.md)
- [Quick Reference](driver-dashboard-quick-reference.md)
- [Implementation Guide](phase-4-implementation-guide.md)
- [Deployment Checklist](deployment-checklist-phase-4.md)
