# Pre-Merge Audit: development → main

**Date**: 2026-04-11
**Branch**: `development` (8 commits ahead of `main`)
**Auditor**: Claude Code + Emmanuel Alanis

---

## Commits Being Merged

| SHA | Description |
|-----|-------------|
| `9218467` | Merge PR #356 — replace axios with native fetch |
| `9f4e003` | Fix: add missing error handling for fetch non-ok responses |
| `c89740b` | chore(deps): replace axios with native fetch |
| `8ddae59` | Merge PR #357 — fix QA bugs from PR #354 (BUG-01–BUG-05) |
| `2d23b7f` | fix: resolve 5 QA bugs from PR #354 |
| `16d57e2` | Merge PR #355 — fix layout shift in FoodHeader |
| `e709c21` | Fix layout shift in FoodHeader |
| `792d352` | chore: remove unused pulse-gentle CSS animation |

**Files changed**: 16 | **+428 / -528 lines**

---

## 1. Security

### 1.1 CRITICAL — npm Vulnerabilities (CI-blocking)

The Security workflow fails on `development` due to **2 critical** axios CVEs. All are transitive dependencies with patches available.

| Package | Severity | Current | Fix | Pulled in by |
|---------|----------|---------|-----|--------------|
| **axios** | Critical | 1.13.6 | >=1.15.0 | `@sendgrid/client`, `twilio` |
| **axios** | Critical | 1.13.6 | >=1.15.0 | `@sendgrid/client`, `twilio` |
| **next** | High | 15.5.14 | >=15.5.15 | direct dependency |
| **basic-ftp** | High (x2) | 5.2.0 | >=5.2.2 | `vercel` → `proxy-agent` |
| **vite** | High (x2) + Moderate | 7.3.1 | >=7.3.2 | `sanity` → `vite` |
| **defu** | High | 6.1.4 | >=6.1.5 | `prisma` → `c12` → `defu` |

**Action — add pnpm overrides + bump next**:
```jsonc
// package.json — pnpm.overrides
"axios@<1.15.0": ">=1.15.0",
"basic-ftp@<5.2.2": ">=5.2.2",
"vite@>=7.0.0 <7.3.2": ">=7.3.2",
"defu@<6.1.5": ">=6.1.5"

// package.json — dependencies
"next": "^15.5.15"
```

### 1.2 MEDIUM — CORS Wildcard on Tracking Endpoint

- **File**: `src/app/api/tracking/live/route.ts`
- **Issue**: `Access-Control-Allow-Origin: *` on an endpoint that may expose driver GPS data.
- **Action**: Review whether this should be restricted to the app's own origin.

### 1.3 MEDIUM — Verify Cron Endpoint Auth

- **File**: `vercel.json` — 4 cron jobs (`quarantine-cleanup`, `mileage-recalculation`, `data-archiving`, `driver-summary-generation`)
- **Action**: Verify each route checks `CRON_SECRET` header to prevent unauthorized invocation.

### 1.4 OK — Auth, Rate Limiting, Input Validation

- Rate limiting: implemented (`src/lib/rate-limiting.ts`) — 5 req/min on auth, 100/15min on API.
- Input validation: Zod schemas on auth and form endpoints.
- SQL injection: All raw queries use parameterized `$1::type` placeholders.
- Middleware: Role-based route protection with soft-delete user detection.
- Secrets: `.env`/`.env.local` properly gitignored and NOT in version control.

---

## 2. Performance

### 2.1 HIGH — N+1 Query Patterns

| Location | Issue | Impact |
|----------|-------|--------|
| `src/app/api/admin/job-applications/route.ts:187-225` | Signed URL generation per file inside `Promise.all(applications.map(...))` | O(n*m) Supabase storage calls |
| `src/app/api/tracking/shifts/route.ts:72-86` | Per-shift breaks query inside `Promise.all(shifts.map(...))` | 1+N DB queries per request |
| `src/services/userBulkOperationsService.ts:63-113` | Individual `canModifyUser()` + `findUnique()` per user in loop | 2N queries for N users |

**Action**: Batch-fetch with `findMany({ where: { id: { in: ids } } })`, use JOINs for shifts+breaks.

### 2.2 HIGH — Unbounded Queries / Over-fetching

| Location | Issue |
|----------|-------|
| `src/app/api/file-uploads/update-entity/route.ts:53-99` | `findMany()` with no `take` limit |
| `src/lib/services/order.ts:108-131` | `fetchLimit = limit * 10` fetches up to 500+ rows |
| `src/app/api/orders/route.ts:125-150` | Two parallel `findMany()` without pagination |

**Action**: Add server-side pagination with bounded `take` values; use `select` instead of `include` where possible.

### 2.3 MEDIUM — Missing Indexes on Delivery Timestamps

Migration `20260217195526_add_delivery_stage_timestamps` added `arrived_at_vendor_at`, `en_route_at`, `arrived_at_client_at` but no indexes on these columns.

**Action**: Add composite index `@@index([status, arrivedAtVendorAt])` if these columns are queried.

---

## 3. Bugs & Code Quality

### 3.1 HIGH — Test Failures

- **4 failed test suites**, **15 failed tests** in signup API tests.
- Failures involve edge cases: special-character emails, unicode names, long passwords, missing `user` property in response.
- **Action**: Fix signup route validation or update tests to match current behavior. Must pass before merge.

### 3.2 MEDIUM — React Hook Dependency

- **File**: `src/hooks/use-upload-file.ts:516-528`
- `useCallback` uses `uploadedFiles` but depends on `uploadedFiles.length` — stale closure risk.
- **Action**: Use the full `uploadedFiles` reference in the dependency array.

### 3.3 LOW — Missing Event Listener Cleanup

- **File**: `src/hooks/tracking/useLocationTracking.ts:555`
- Permission status `change` event listener added without corresponding `removeEventListener` in cleanup.
- **Action**: Store listener ref and remove on unmount.

### 3.4 LOW — Silent Error Swallowing

- `src/app/api/orders/[order_number]/route.ts:227-257` — delivery timestamp lookup silently warns on failure.
- **Action**: Acceptable for non-critical data, but consider surfacing to the client as a partial response.

---

## 4. Database Maintenance & Tuning

### 4.1 HIGH — Missing Indexes

| Model | Field(s) | Why |
|-------|----------|-----|
| `Dispatch` | `userId` | FK used in UserDispatch relation — no index |
| `NotificationAnalytics` | `orderId`, `dispatchId` | Nullable FKs queried for notification lookups |
| `CateringRequest` | `pickupAddressId` | FK with no index — vendor/restaurant queries |
| `Address` | `isRestaurant` | Boolean filter used in vendor queries |
| `Delivery` | `arrivedAtVendorAt`, `enRouteAt`, `arrivedAtClientAt` | New timestamp columns (Feb 2026 migration) |

**Action — create migration**:
```sql
CREATE INDEX idx_dispatch_user_id ON "Dispatch" ("userId");
CREATE INDEX idx_notification_analytics_order_id ON "NotificationAnalytics" ("orderId");
CREATE INDEX idx_notification_analytics_dispatch_id ON "NotificationAnalytics" ("dispatchId");
CREATE INDEX idx_catering_request_pickup_address ON "CateringRequest" ("pickupAddressId");
CREATE INDEX idx_address_is_restaurant ON "Address" ("isRestaurant");
CREATE INDEX idx_delivery_arrived_vendor ON "Delivery" ("arrivedAtVendorAt") WHERE "arrivedAtVendorAt" IS NOT NULL;
```

### 4.2 MEDIUM — Models Missing Soft-Delete Fields

The soft-delete extension covers 9 models, but these audit-relevant models lack `deletedAt`/`deletedBy`/`deletionReason`:

| Priority | Models |
|----------|--------|
| High | `Dispatch`, `FileUpload`, `FormSubmission` |
| Medium | `LeadCapture`, `Testimonial`, `DeliveryConfiguration` |
| Low | `CalculatorTemplate`, `PricingRule`, `ClientConfiguration`, `CalculationHistory` |

**Action**: Add soft-delete fields to high-priority models in a future migration. Update the soft-delete extension to include them.

### 4.3 MEDIUM — Bulk Operations Not Wrapped in Transactions

- `src/app/api/users/bulk/` — status changes, role changes, and deletes execute individual updates.
- **Action**: Wrap in `prisma.$transaction()` for atomicity.

### 4.4 OK — Connection Pooling & Client Config

- Pooling: production=20, dev=10 connections (`src/lib/db/prisma-pooled.ts:28`)
- Timeouts: query=30s, transaction=60s
- Pgbouncer: enabled for Supabase with statement cache disabled
- Singleton pattern prevents connection leaks
- Graceful shutdown handlers in place
- Connection retry with exponential backoff

---

## 5. Pre-Merge Checklist

### Blockers (must fix)

- [x] **Fix npm critical vulnerabilities** — added pnpm overrides for axios>=1.15.0, basic-ftp>=5.2.2, vite>=7.3.2, defu>=6.1.5; bumped next to 15.5.15 (2026-04-11)
- [x] **Run `pnpm install`** and verify `pnpm audit` shows 0 critical, 0 high, 0 moderate (2026-04-11)
- [x] **Fix failing tests** — fixed 15 failures: signup tests (mock `findFirst` + rate-limit mock), orders test (driver select shape), drivers test (soft-delete filter), FoodHeader test (Tailwind responsive classes) (2026-04-11)
- [x] **Run full CI** — `pnpm pre-push-check` passes, `pnpm test:ci` passes (352 suites, 7684 tests, 0 failures) (2026-04-11)
- [ ] **Verify Security workflow passes** on the PR

### Should fix (this sprint)

- [ ] Add missing database indexes (Section 4.1)
- [ ] Fix N+1 query in `job-applications/route.ts`
- [ ] Fix `useCallback` dependency in `use-upload-file.ts`
- [ ] Review CORS wildcard on `/api/tracking/live`
- [ ] Verify cron endpoints check `CRON_SECRET`

### Track for later

- [ ] Add soft-delete fields to Dispatch, FileUpload, FormSubmission
- [ ] Batch-optimize remaining N+1 patterns (shifts, bulk ops)
- [ ] Add server-side pagination to unbounded queries
- [ ] Fix event listener cleanup in `useLocationTracking.ts`
- [ ] Enable Prisma query metrics in production

---

## 6. Recommended Merge Strategy

1. Create a `fix/pre-merge-audit-security` branch from `development`
2. Apply the npm vulnerability fixes (overrides + next bump)
3. Fix or address test failures
4. Open PR → `development`, verify CI passes
5. Merge to `development`, then open PR `development` → `main`
6. Schedule database index migration for post-merge deployment
