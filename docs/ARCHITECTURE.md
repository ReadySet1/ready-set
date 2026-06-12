# Architecture

> **Status:** descriptive — reflects the codebase as of 2026-05-18.
> **Scope:** the Ready-Set Next.js application at `repos/ready-set/`. Sibling apps (`destino-sf`, `vp-logistics`) are out of scope.
> **Not in here:** roadmap, "should-be" architecture, refactor plans. Those belong in separate docs.

---

## 1. Purpose

This document is the **map of what exists today**. Two audiences:

1. **A new engineer** opening the repo for the first time. They should be able to read this end-to-end and know where to look for anything.
2. **The current team**, as a written contract. From here on, "architecture decisions" mean changes to this document — anything not described here is either undocumented (a gap to close) or an inconsistency (a gap to fix).

If you find code that contradicts this doc, the doc is wrong (or stale). Update it in the same PR that changes the behavior.

Existing deep-dives this document references (do not duplicate):

- [`docs/architecture/AUTHENTICATION.md`](./architecture/AUTHENTICATION.md) — session manager, token refresh, API interceptor internals
- [`docs/architecture/SOFT_DELETE_PATTERN.md`](./architecture/SOFT_DELETE_PATTERN.md) — the soft-delete contract in full
- [`docs/BUSINESS_RULES.md`](./BUSINESS_RULES.md) — pricing, dispatch, and order-flow business rules
- [`docs/CALCULATOR_ROADMAP.md`](./CALCULATOR_ROADMAP.md) — calculator-specific forward-looking notes
- [`docs/cloudinary-integration.md`](./cloudinary-integration.md) — image CDN

---

## 2. Stack at a glance

| Layer            | Choice                                                                 |
| ---------------- | ---------------------------------------------------------------------- |
| Framework        | Next.js 15 (App Router, React Server Components + Server Actions)      |
| Language         | TypeScript (strict, `noUncheckedIndexedAccess`)                        |
| Database         | PostgreSQL via Supabase                                                |
| ORM              | Prisma 6 (`prisma/schema.prisma`)                                      |
| Auth             | Supabase Auth (JWT) wrapped by an in-house `SessionManager`            |
| Realtime         | Supabase Realtime (WebSocket channels)                                 |
| Server state     | TanStack Query (5 min stale, 10 min GC)                                |
| Client state     | React Context + minimal Zustand (`src/store/`)                         |
| UI               | Shadcn UI on Tailwind                                                  |
| Forms            | React Hook Form + Zod                                                  |
| Maps / geocoding | Mapbox (client) + Google Directions (server, via `src/services/routing/`) |
| Email            | Resend (primary) → SendGrid (fallback) behind a circuit breaker        |
| Push             | Firebase Cloud Messaging                                               |
| SMS              | Twilio (inbound webhook + outbound via reminders pipeline)             |
| Images / CDN     | Cloudinary (`getCloudinaryUrl(path)`)                                  |
| Payments         | Stripe (partial — see §10)                                             |
| Errors           | Sentry                                                                 |
| Analytics        | Umami                                                                  |
| Tests            | Jest (unit, jsdom) + Playwright (e2e)                                  |
| Runtime          | Node ≥20 <23, pnpm ≥10                                                 |

There is **one runtime** (the Next.js server) and **one database**. No microservices, no message bus, no worker fleet. Background-ish work runs as cron-style API routes or scheduled actions on the Next.js process.

---

## 3. Repo layout

```
src/
├── app/                    Next.js App Router
│   ├── (site)/             Public marketing + auth pages (~30 routes)
│   ├── (backend)/          Role-gated admin/driver/vendor/client pages (~32 routes)
│   ├── api/                REST endpoints (~175 routes, grouped by domain)
│   ├── actions/            Server actions for forms and mutations
│   ├── studio/             Sanity CMS preview
│   └── helpdesk/           Legacy; middleware redirects helpdesk users to /admin
├── components/             Feature-folder React components
│   └── ui/                 Shadcn primitives
├── contexts/               React contexts (UserContext, ApplicationSessionContext)
├── hooks/                  Custom React hooks
├── lib/                    Low-level building blocks (see below)
├── services/               High-level domain services (see below)
├── store/                  Zustand stores (currently just loadingStore)
├── middleware/             Route protection rules
├── types/                  Shared TypeScript types
├── utils/                  Helper functions (incl. Supabase client factories)
└── data/                   Generated JSON imported by admin dashboards
                            (qa-board.json, tasks-board.json — DO NOT hand-edit)
prisma/
└── schema.prisma           Single source of truth for the data model
e2e/                        Playwright specs (~29 files)
```

### Route groups

- `(site)` is **public**. The middleware never gates it (with a small allowlist exception for `/sign-in` etc. used by the auth flow itself).
- `(backend)` is **role-gated**. Every page under it requires a session and a role check (see §5.1).
- Two route groups are **dev-only and ungated** and should not be relied on in production: `highlight-ssr-test/`, several `api/debug/*` routes, `api/test-*` routes. See §10.

### `lib/` vs `services/` — the split

| Folder         | What lives here                                                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/`     | Stateless utilities, framework-adjacent code, and clients for external systems. Imported freely by both routes and services.             |
| `src/services/`| Domain logic that orchestrates `lib/` building blocks and Prisma. One service per business capability. Routes call services, not Prisma directly. |

The intended dependency direction is:

```
app/api/* and app/actions/*    →    services/*    →    lib/*    →    Prisma / Supabase
```

This is **the convention, not a hard-enforced rule**. Some older API routes still touch Prisma directly; treat that as tech debt and move logic into a service on next touch.

---

## 4. Domains

### 4.1 Users & Auth

- **Models:** `Profile` (the core user record — every other user-bearing table joins through this), `Account`, `Session`, `EmailPreferences`, `VerificationToken`, `UserAudit`.
- **Roles:** `VENDOR`, `CLIENT`, `DRIVER`, `ADMIN`, `HELPDESK`, `SUPER_ADMIN` (`UserType` enum).
- **Statuses:** `ACTIVE`, `PENDING`, `DELETED` (`UserStatus` enum). `Profile.deletedAt` is the authoritative soft-delete signal; `UserStatus.DELETED` is a display-layer convenience.
- **Services:** `userService`, `userAuditService`, `userSoftDeleteService` (cascades soft-deletes through related records), `userBulkOperationsService` (admin import/export/role-change).
- **API surface:** ~18 routes under `/api/auth/*`, `/api/users/*`, plus `/api/register`, `/api/profile`, `/api/complete-profile`.
- **Audit:** Every mutating action on a `Profile` writes a row to `UserAudit` with `performedBy`, `changes` (JSON diff), `reason`, and request metadata. **Do not bypass it** — use `userService.updateProfile()` rather than touching Prisma directly.

Full auth flow: see [`docs/architecture/AUTHENTICATION.md`](./architecture/AUTHENTICATION.md) and §5.1 below.

### 4.2 Orders & Dispatch

Two parallel order types share most of the surface:

| Model             | Purpose                                                                       |
| ----------------- | ----------------------------------------------------------------------------- |
| `CateringRequest` | Scheduled catering orders; carries `headcount`, `pricingTierId`, `needHost`.  |
| `OnDemand`        | On-demand deliveries; carries `vehicleType` and parcel dimensions.            |
| `Dispatch`        | Bridge table linking exactly one driver to either a CateringRequest or an OnDemand. |
| `Address`         | Shared geocoded address; reused via `UserAddress` aliases. Soft-deletable.    |
| `PricingTier`     | Catering pricing brackets by headcount × food cost.                           |

Both order types are **soft-deletable** and **archivable** (`archivedAt`, `archiveBatchId` — see §4.6 and `ArchiveBatch`).

Status enums are domain-specific (`CateringStatus`, `OnDemandStatus`) but converge on the same lifecycle: `ACTIVE → ASSIGNED → IN_PROGRESS → COMPLETED` (with `CANCELLED`, `PENDING`, `CONFIRMED`, `DELIVERED` as variants).

API surface: 15 routes under `/api/orders/*`, `/api/dispatch/*`, `/api/on-demand/*`, `/api/catering-requests`. Server actions cover form submissions (`src/app/actions/`).

### 4.3 Driver Tracking & Realtime

This is the busiest domain and the one most actively under refactor. **If you are touching anything here, read this section in full before changing code.**

**Models:**

| Model                 | Purpose                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `Driver`              | The driver record. Holds denormalized "last known" location/speed/heading for fast reads without scanning `DriverLocation`.    |
| `DriverLocation`      | Raw GPS points (PostGIS geography). Soft-deletable. Grows fast — see "Retention" below.                                        |
| `DriverShift`         | A driver's shift (start/end odometer, GPS-derived distance, reported distance).                                                |
| `Delivery`            | A delivery within a shift. Records timestamps for `assignedAt`, `pickedUpAt`, `enRouteAt`, `arrivedAtClientAt`, `deliveredAt`. |
| `DriverWeeklySummary` | Pre-computed aggregates (miles, deliveries, location-point count) used to generate weekly PDFs without re-aggregating raw points. |

**Location ingestion path:**

```
mobile app  →  POST /api/tracking/locations
                ├── validate payload (zod)
                ├── verify driver exists & is_active
                ├── INSERT into driver_locations (PostGIS POINT)
                ├── UPDATE drivers.last_known_*
                └── broadcast on `driver-locations` channel
```

Source: `src/app/api/tracking/locations/route.ts`. The simulator at `/admin/tracking/test-driver` posts to the same endpoint.

**Driver ownership / authz:** the `drivers` table carries two auth-link columns in one id space — `profile_id` (canonical, FK to `profiles.id`) and `user_id` (legacy, NULL on most rows). Every ownership check must accept either column; checking `user_id` alone 403s most real drivers. `src/lib/auth/driver-ownership.ts` is the single home for these checks (`driverOwnershipCondition()` for raw-SQL embedding, `userOwnsDriver()`, `getDriverForUser()`, `callerMayActOnDriver()`) — never inline `user_id = $n` in a route. Tracking **server actions** (`src/app/actions/tracking/*`) authenticate their own caller via `getActionCaller()`: `createDelivery` / `assignDeliveryToDriver` are admin-only; all other reads/writes are owner-or-admin. A guarded, idempotent migration (`prisma/migrations/20260611000000_backfill_driver_user_id`) syncs the two columns both ways until `user_id` can be dropped.

**State machine:** order/driver state transitions live in `src/lib/state-machine/`:

- `driver-state.ts` — valid `DriverStatus` transitions.
- `order-state.ts` — valid `CateringStatus` / `OnDemandStatus` transitions.
- `transition.ts` — generic `assertTransition(graph, from, to)`.

Driver status graph:

```
null → ASSIGNED → EN_ROUTE_TO_VENDOR → ARRIVED_AT_VENDOR → PICKED_UP
                                                              ↓
                       EN_ROUTE_TO_CLIENT → ARRIVED_TO_CLIENT → COMPLETED
```

Any state can jump directly to `COMPLETED` (early finish is allowed). `DRIVER_TO_ORDER` in `driver-state.ts` maps driver status onto order status (the "intermediate" driver states all collapse to `Order.status = IN_PROGRESS`).

**Realtime client:** `src/lib/realtime/client.ts` — a singleton `RealtimeClient` wrapping the Supabase Realtime SDK.

Channels (`REALTIME_CHANNELS` in `src/lib/realtime/types.ts`):

| Channel             | Producers           | Consumers                                  |
| ------------------- | ------------------- | ------------------------------------------ |
| `driver-locations`  | location POST route | Admin tracking dashboard, driver-self views|
| `driver-status`     | status update routes | Admin dashboard, dispatch views           |
| `admin-commands`    | admin UIs           | Driver app (e.g. assignment push)          |
| `deliveries`        | delivery mutations  | Admin + driver views                       |

Authorization is enforced in two places:

- `CHANNEL_ACCESS_RULES` — who can `subscribe` to each channel.
- `BROADCAST_ACCESS_RULES` — who can `send` each event type (e.g. only `DRIVER` can broadcast `driver:location`; only `ADMIN`/`SUPER_ADMIN` can broadcast `admin:assign-delivery`).

Connection state is a small FSM: `IDLE → CONNECTING → CONNECTED → DISCONNECTING → DISCONNECTED`, with `FAILED → retry` on errors. Exponential backoff configured in `src/constants/realtime-config.ts`.

**Retention:** `DriverLocation` rows accumulate indefinitely. Manual archival via `/api/admin/data-archiving` writes an `ArchiveBatch` and tags rows with `archiveBatchId`. There is **no automatic TTL or partitioning** today — see §10.

API surface: 11 routes under `/api/tracking/*` plus `/api/driver-deliveries`, `/api/dispatch/*`.

### 4.4 Delivery Calculator

A vendor-aware pricing engine. **Config resolution is DB-first with in-memory fallback** — this is intentional and non-obvious:

1. `GET /api/calculator/config` queries `delivery_configurations` (the `DeliveryConfiguration` model) for the requested vendor.
2. If no row exists, it falls back to the in-memory template in `src/lib/calculator/client-configurations.ts`.
3. Changes saved via the **Adjust Vendor Pricing** UI (`/admin/calculator`, 4th tab) take effect immediately because they write to the DB; the in-memory file is only a seed.

**Models:** `DeliveryConfiguration`, `CalculatorTemplate`, `PricingRule`, `ClientConfiguration`, `CalculationHistory` (audit of every calculation).

**Validation:** Zod schema in `src/types/vendor-pricing.ts` plus `validateConfiguration()` exported from `client-configurations.ts`.

**Seed script:** `scripts/seed-delivery-configurations.ts` writes the in-memory templates into the DB.

**UI:** `src/components/calculator/VendorPricingTab.tsx` (shell) + `VendorPricingEditor.tsx` (form) + sub-editors in `src/components/calculator/vendor-pricing/`.

API surface: 8 routes under `/api/calculator/*` plus `/api/pricing/*`.

See [`docs/CALCULATOR_ROADMAP.md`](./CALCULATOR_ROADMAP.md) for forward-looking calculator notes.

### 4.5 Notifications

Three channels, separately wired:

| Channel | Models / files                                                                                                                                 | Notes                                                                                       |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Push    | `ProfilePushToken`, `NotificationAnalytics`, `NotificationDedup`; `src/app/api/notifications/push/*` (6 routes); FCM config endpoint           | FCM. `NotificationDedup` is a distributed-dedup table preventing multi-instance duplicates. |
| Email   | `src/services/email-notification.ts`, `src/app/actions/email.ts`, `EmailPreferences` model                                                     | Resend primary, SendGrid fallback. Circuit breaker in `src/lib/rate-limiting/`.             |
| SMS     | `SmsReminderBatch`, `SmsReminderLog`; `src/services/sms-reminders/`; outbound via Twilio; inbound webhook at `/api/webhooks/twilio`            | Batch send pipeline driven by admin UI at `/admin/sms-reminders`.                           |

### 4.6 File uploads & data archival

- **Files:** `FileUpload` model stores metadata for everything uploaded (driver docs, job application files, order attachments). Linked optionally to `CateringRequest`, `OnDemand`, or `JobApplication`. Upload errors land in `UploadError` with a `correlationId` for support traceability.
- **Storage backend:** Supabase Storage. Routes live under `/api/file-uploads/*`, `/api/storage/*`, `/api/uploads/image`.
- **Cloudinary:** image *delivery* (not storage) via `getCloudinaryUrl(path)`. See [`docs/cloudinary-integration.md`](./cloudinary-integration.md).
- **Archival:** `ArchiveBatch` tracks data archival jobs (driver locations, completed orders). Triggered manually via `/api/admin/data-archiving`. There is no scheduled archival.

### 4.7 Partner APIs

Inbound integrations from third-party platforms that send us orders:

| Partner      | Inbound                                                              | Outbound                                                                |
| ------------ | -------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| CaterValley  | `/api/cater-valley/*` (6 routes) — order create/update/confirm       | `src/services/caterValleyService.ts` — HMAC-signed status webhooks back |
| EZCater      | `/api/ezcater/events` — courier event webhooks                       | None today                                                              |
| Generic partners | `/api/partners/orders/*` (draft/confirm/update) gated by `ApiPartner` | n/a                                                                  |

`ApiPartner` is the registry: per-partner API key hash, webhook URL/secret, rate limits. New partner = new `ApiPartner` row + a slug-routed handler.

HMAC signing & SSRF guards: `src/lib/security/`.

---

## 5. Cross-cutting concerns

### 5.1 Authentication & route protection

End-to-end flow:

```
sign-in form ─► server action ─► supabase.auth.signInWithPassword
                                          │
                                          ▼
                            JWT + refresh token (localStorage)
                                          │
                                          ▼
   UserContext hydrates ─► SessionManager fingerprints session
                                          │
                                          ▼
        TokenRefreshService runs in background, refreshes before expiry
                                          │
                                          ▼
        APIInterceptor injects Authorization header into outbound fetch
```

**Server-side guarding** happens in `src/middleware/routeProtection.ts`, invoked from the root `middleware.ts`. For each request it:

1. Resolves the user from the Supabase cookie.
2. Loads the profile (with `deletedAt` check — a soft-deleted profile is treated as unauthenticated).
3. Matches the pathname against `PROTECTED_ROUTES` and checks the role.
4. Redirects to `/sign-in` on failure.

**Role → route prefix:**

| Role          | Allowed prefixes                                                          |
| ------------- | ------------------------------------------------------------------------- |
| `SUPER_ADMIN` | `/admin/*`, all admin-commands realtime channels                          |
| `ADMIN`       | `/admin/*`                                                                |
| `HELPDESK`    | `/admin/*` (UI is a subset; `/helpdesk/*` redirects here)                 |
| `DRIVER`      | `/driver/*`, `driver-*` realtime channels                                 |
| `VENDOR`      | `/vendor/*`                                                               |
| `CLIENT`      | `/client/*`                                                               |

Full session-manager / refresh internals: [`docs/architecture/AUTHENTICATION.md`](./architecture/AUTHENTICATION.md).

**Dev-only routes** (anything under `src/app/api/debug/`, `/api/test-*`, `/api/test/`, plus the `/highlight-ssr-test/` page) must be gated by the `devOnlyGuard()` helper at `src/lib/auth/dev-only-guard.ts` — returns a 404 when `NODE_ENV === 'production'` — *plus* a `withAuth({ allowedRoles: ['SUPER_ADMIN'] })` check. The middleware does not run for `/api/*` so each route is responsible for both gates.

### 5.2 Realtime client & channel access

Covered in §4.3. The two rules you must not break:

- **Producers** broadcast only the events allowed for their role (`BROADCAST_ACCESS_RULES`).
- **Consumers** subscribe only to channels allowed for their role (`CHANNEL_ACCESS_RULES`).

Adding a channel or event type? Update **both** rule maps in `src/lib/realtime/types.ts` and add Zod payload schemas in `src/lib/realtime/schemas.ts`.

### 5.3 State machines

Three live in `src/lib/state-machine/`:

- `driver-state.ts` — `DriverStatus` graph (§4.3) and `DRIVER_TO_ORDER` mapping.
- `order-state.ts` — `CateringStatus` / `OnDemandStatus` graphs.
- `transition.ts` — `assertTransition(graph, from, to)` used by both.

**Rule:** any mutation that changes a `DriverStatus`, `CateringStatus`, or `OnDemandStatus` field **must** go through `assertDriverTransition()` / `assertOrderTransition()`. Direct `prisma.driver.update({ status: ... })` calls are bugs.

The order status is **derived from driver status** via `deriveOrderStatusFromDriver()`; do not set both independently.

### 5.4 Soft-delete

Every user-owned or business-record model carries `deletedAt`, `deletedBy`, `deletionReason`:

`Profile`, `JobApplication`, `Driver`, `DriverLocation`, `DriverShift`, `Delivery`, `Address`, `CateringRequest`, `OnDemand`, `ApiPartner`.

**Hard rule** (also stated in [`CLAUDE.md`](../CLAUDE.md)): every Prisma query against these models **must** include `where: { deletedAt: null }`. There is no Prisma middleware enforcing this — it is convention only. Full pattern and helpers: [`docs/architecture/SOFT_DELETE_PATTERN.md`](./architecture/SOFT_DELETE_PATTERN.md).

### 5.5 Rate limiting

| Surface                    | Implementation                                                          | Distributed? |
| -------------------------- | ----------------------------------------------------------------------- | ------------ |
| `POST /api/tracking/locations` | `src/lib/rate-limiting/location-rate-limiter.ts` — in-memory `Map`  | **No**       |
| Email sending              | Circuit breaker in `src/services/email-notification.ts` (in-memory)     | **No**       |
| Application sessions       | `TODO` in `src/app/api/application-sessions/route.ts` ("implement DB function for atomic rate limiting") | n/a |
| Partner APIs               | `ApiPartner.rateLimitPerMin` column exists; enforcement varies          | Per-row config |

See §10 — multi-instance correctness for these is a known gap.

### 5.6 Error handling & observability

- **Sentry** is wired at app boot (`src/lib/monitoring/sentry.ts`), in `middleware.ts`, and in `UserContext` (`setSentryUser` on login). Use `captureException(err, { extra })` for unexpected errors; `captureMessage` for noteworthy non-errors.
- **Structured logging** lives in `src/lib/logging/` (separate loggers for auth, realtime, API).
- **Error boundaries:** `AuthErrorBoundary` and similar wrap critical UI subtrees.
- **No central error dashboard** beyond Sentry. The "alerts" routes (`/api/health/*`) return health-check data; nothing consumes them on a schedule.

---

## 6. Data layer

### Models by domain

| Domain                | Models                                                                                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Users & Auth          | `Profile`, `Account`, `Session`, `EmailPreferences`, `VerificationToken`, `UserAudit`                                                                                    |
| Driver Tracking       | `Driver`, `DriverLocation`, `DriverShift`, `Delivery`, `DriverWeeklySummary`                                                                                             |
| Orders & Dispatch     | `CateringRequest`, `OnDemand`, `Dispatch`, `Address`, `UserAddress`, `PricingTier`                                                                                       |
| Calculator            | `DeliveryConfiguration`, `CalculatorTemplate`, `PricingRule`, `ClientConfiguration`, `CalculationHistory`                                                                |
| Files & Archival      | `FileUpload`, `UploadError`, `ArchiveBatch`                                                                                                                              |
| Notifications         | `ProfilePushToken`, `NotificationAnalytics`, `NotificationDedup`, `EmailPreferences`                                                                                     |
| SMS                   | `SmsReminderBatch`, `SmsReminderLog`                                                                                                                                     |
| Job Applications      | `JobApplication`                                                                                                                                                         |
| Partners              | `ApiPartner`                                                                                                                                                             |
| Content               | `Testimonial`                                                                                                                                                            |

### Soft-delete matrix

| Model            | `deletedAt` | `deletedBy` | `deletionReason` | Cascading? |
| ---------------- | ----------- | ----------- | ---------------- | ---------- |
| `Profile`        | ✅          | ✅          | ✅               | yes, via `userSoftDeleteService` |
| `Driver`         | ✅          | ✅          | ✅               | yes        |
| `DriverLocation` | ✅          | ✅          | ✅               | n/a        |
| `DriverShift`    | ✅          | ✅          | ✅               | n/a        |
| `Delivery`       | ✅          | ✅          | ✅               | n/a        |
| `Address`        | ✅          | ✅          | ✅               | n/a        |
| `CateringRequest`| ✅          | ✅          | ✅               | n/a        |
| `OnDemand`       | ✅          | ✅          | ✅               | n/a        |
| `JobApplication` | ✅          | ✅          | ✅               | n/a        |
| `ApiPartner`     | ✅          | ✅          | ✅               | n/a        |

### Enum reference

| Enum                  | Values                                                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `UserType`            | `VENDOR`, `CLIENT`, `DRIVER`, `ADMIN`, `HELPDESK`, `SUPER_ADMIN`                                                        |
| `UserStatus`          | `ACTIVE`, `PENDING`, `DELETED`                                                                                          |
| `DriverStatus`        | `ASSIGNED`, `EN_ROUTE_TO_VENDOR`, `ARRIVED_AT_VENDOR`, `PICKED_UP`, `EN_ROUTE_TO_CLIENT`, `ARRIVED_TO_CLIENT`, `COMPLETED` |
| `CateringStatus`      | `ACTIVE`, `ASSIGNED`, `CANCELLED`, `COMPLETED`, `PENDING`, `CONFIRMED`, `IN_PROGRESS`, `DELIVERED`                      |
| `OnDemandStatus`      | (same values as `CateringStatus`)                                                                                       |
| `VehicleType`         | `CAR`, `VAN`, `TRUCK`                                                                                                   |
| `ApplicationStatus`   | `PENDING`, `APPROVED`, `REJECTED`, `INTERVIEWING`                                                                       |
| `FormType`            | `FOOD`, `FLOWER`, `BAKERY`, `SPECIALTY`                                                                                 |
| `TestimonialCategory` | `CLIENTS`, `VENDORS`, `DRIVERS`                                                                                         |

---

## 7. External integrations

| Integration         | Direction       | Entry points                                                                                          |
| ------------------- | --------------- | ----------------------------------------------------------------------------------------------------- |
| Supabase Auth       | bidirectional   | `src/utils/supabase/{client,server}.ts`, `src/lib/auth/*`                                             |
| Supabase Realtime   | bidirectional   | `src/lib/realtime/*`, `src/constants/realtime-config.ts`                                              |
| Supabase Storage    | outbound        | `src/app/api/storage/*`, `src/app/api/file-uploads/*`                                                 |
| CaterValley         | bidirectional   | inbound `src/app/api/cater-valley/*`; outbound `src/services/caterValleyService.ts`                   |
| EZCater             | inbound         | `src/app/api/ezcater/events`, `src/services/ezcater/`                                                 |
| Cloudinary          | outbound        | `src/lib/cloudinary/`                                                                                 |
| Stripe              | outbound        | `src/stripe/` (partial — see §10)                                                                     |
| Sentry              | outbound        | `src/lib/monitoring/sentry.ts`, `middleware.ts`                                                       |
| Resend / SendGrid   | outbound        | `src/services/email-notification.ts`, `src/app/actions/email.ts`                                      |
| Firebase Cloud Messaging | outbound   | `src/app/api/notifications/push/*`                                                                    |
| Twilio              | bidirectional   | inbound `src/app/api/webhooks/twilio`; outbound via `src/services/sms-reminders/`                     |
| Mapbox              | outbound (client) | Used in client map components — no central wiring file; see §10                                     |
| Google Directions   | outbound        | `src/services/routing/google-directions.ts`                                                           |
| Google Sheets       | outbound (read) | `src/lib/google-sheets/`                                                                              |
| Umami               | outbound        | analytics script in `app/layout.tsx`                                                                  |

---

## 8. Client-side state

| Mechanism            | Used for                                                                                                          | Where                                              |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| TanStack Query       | All server data fetching (orders, drivers, calculator configs, …). 5 min stale, 10 min GC.                        | QueryClient configured in providers wrapper        |
| React Context        | Auth (`UserContext`), application-session sync (`ApplicationSessionContext`)                                       | `src/contexts/`                                    |
| Zustand              | Global loading indicator only (`loadingStore`)                                                                    | `src/store/`                                       |
| React Hook Form      | All form state                                                                                                    | per-form                                           |
| URL / search params  | Filter / pagination state in admin tables                                                                         | per-page                                           |

Zustand is intentionally minimal. Anything that's server state goes through TanStack Query, not a store.

---

## 9. Testing posture

### Jest (~392 test files)

| Area               | Coverage   |
| ------------------ | ---------- |
| Calculator         | Heavy — engine, scenarios, vendor-specific regressions, CaterValley integration |
| State machine      | Full — driver/order transitions, parity checks, snapshots                       |
| Services           | Moderate — `userAudit`, `userBulkOperations`, `email-notification`, `ezcater`   |
| Auth               | Moderate — hydration tests, token refresh (mocked)                              |
| Realtime           | Minimal — `channels.test.ts`, `client.test.ts`, schema tests                    |
| Tracking services  | Minimal — no dedicated tracking-service tests                                   |
| Components         | Inconsistent — several skipped due to mocking complexity (REA-266, 269, 281)    |
| Webhooks (non-EZCater) | None                                                                        |
| Mapbox / Stripe    | None                                                                            |

Coverage thresholds (`jest.config.js`): 36% lines/statements, 30% branches/functions.

### Playwright (~29 specs)

Covered user flows:

- Calculator: `demo-calculator.spec.ts`, `calculator-ui.spec.ts`
- Tracking: `realtime-driver-tracking.spec.ts`, `driver-shift-workflow.spec.ts`, `driver-history-export.spec.ts`, `mileage-calculator.spec.ts`
- Orders: `edit-order.spec.ts`, `order-url-encoding.spec.ts`, `rea-293-order-management-demo.spec.ts`
- Users: `bulk-user-operations.spec.ts`, `user-edit-workflow.spec.ts`
- Vendor dashboard, visual regression, data separation, offline sync

Auth state is cached in `.auth/` via a Playwright global setup.

### Commands

- `pnpm test` — Jest
- `pnpm test:e2e` — Playwright
- `pnpm test:ci` — coverage run for CI
- `pnpm pre-push-check` — typecheck + lint + prisma validate (run before any PR)

---

## 10. Known gaps & red flags

Listed factually. Each item is a real observation from the current code, not a recommendation.

> **Remediations** for the highest-impact items below are tracked in [`architecture/REMEDIATION_PLAN.md`](./architecture/REMEDIATION_PLAN.md) (sequencing, effort, acceptance criteria). This section stays descriptive — when an item ships, remove it from here in the same PR that updates the plan.

**Security / access control**

- `src/app/helpdesk/` is reachable but middleware redirects to `/admin` — dead code or pending feature, unclear.

_Previously listed here and resolved by remediation #1 (see `architecture/REMEDIATION_PLAN.md` → Shipped): `/api/debug/{env,users}` deleted; `/api/debug/feature-flags` was already gated; `/api/order/debug`, `/api/tracking/test`, `/api/test/catervalley-webhook`, `/api/test-sentry`, `/api/test-umami`, `/api/test-email`, `/highlight-ssr-test/` are now gated via `devOnlyGuard()` + `withAuth({ allowedRoles: ['SUPER_ADMIN'] })`._

**Multi-instance correctness**

- `src/lib/rate-limiting/location-rate-limiter.ts` uses an in-memory `Map`. Each Next.js instance gets its own counter, so the effective limit per driver is `N × intended_limit` where `N` is the instance count.
- Email circuit breaker (`src/services/email-notification.ts`) is similarly in-memory.
- `src/app/api/application-sessions/route.ts` carries an explicit `TODO: Implement database function for atomic rate limiting`.

**Realtime / tracking**

- No explicit reconnect handler is registered on channel subscriptions — relies entirely on the Supabase SDK's defaults.
- No deduplication on inbound `DriverLocation` rows; a driver app retrying a POST will insert duplicates.
- No backpressure: if a client sends faster than the DB can ingest, the route still accepts.
- `DriverLocation` has no TTL or partitioning. Archival is manual via `/api/admin/data-archiving`.

**Schema-level validation**

- Coordinates are validated in the route handler but there are no `CHECK` constraints on `DriverLocation.location`. A direct DB write (e.g. via Studio) can land invalid points.

**Integrations partially wired**

- **Mapbox** is referenced in `CLAUDE.md` and used in client components, but there is no central `src/lib/mapbox/` entry point. New developers cannot find a single file to read for "how do we use Mapbox?"
- **Stripe** lives at `src/stripe/` but no API routes or server actions visibly invoke it. Either dead or wired in a place I did not find.
- **Google Sheets** is read-only — no write paths.

**Test debt**

~30 `TODO` comments in test files, most tied to specific Jira tickets (REA-211, REA-266, REA-269, REA-281) describing mocking complexity around `AddressManager`, `CateringOrderForm`, and `SingleOrder`. Three application-code TODOs worth surfacing:

- `src/app/api/calculator/templates/route.ts` — "Implement proper role checking with Supabase user metadata."
- `src/app/api/application-sessions/route.ts` — "Implement database function for atomic rate limiting."
- `src/app/(backend)/admin/carriers/[carrierId]/logs/page.tsx` — "Implement webhook logging table to track real webhook activity."

**Patterns at risk**

- Some older API routes call Prisma directly instead of going through a service. The intended layering (§3) is convention, not enforced.
- Soft-delete filtering is convention only. Spot-checks of older routes show `findMany()` calls without `deletedAt: null`. There is no Prisma middleware to backstop this.

---

## 11. Where things go

A decision matrix for new contributors. "I'm adding X — where does it live?"

| If you are adding…                                  | Put it in…                                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------------------------- |
| A new public marketing page                         | `src/app/(site)/<route>/page.tsx`                                                     |
| A new admin/driver/vendor/client page               | `src/app/(backend)/<role>/<route>/page.tsx` + role rule in `src/middleware/routeProtection.ts` |
| A new REST endpoint                                 | `src/app/api/<domain>/<route>/route.ts` — call a service, not Prisma directly         |
| A new form mutation                                 | `src/app/actions/<domain>/<action>.ts`                                                |
| New business logic spanning multiple models         | A new function in `src/services/<domain>Service.ts`                                   |
| A stateless utility / external client wrapper       | `src/lib/<area>/`                                                                     |
| A new Prisma model                                  | `prisma/schema.prisma` + migration + soft-delete columns if user-owned + service to mediate access |
| A new realtime channel or event                     | Update `CHANNEL_ACCESS_RULES` **and** `BROADCAST_ACCESS_RULES` in `src/lib/realtime/types.ts`, plus a Zod schema in `schemas.ts` |
| A new role                                          | Extend `UserType` enum + add row(s) to `PROTECTED_ROUTES` + audit `CHANNEL_ACCESS_RULES` |
| A new state transition for drivers/orders           | Extend the graph in `src/lib/state-machine/{driver,order}-state.ts`; do not bypass `assertTransition` |
| A new partner integration                           | Insert an `ApiPartner` row + a slug-routed handler under `src/app/api/partners/` or `src/app/api/cater-valley/` style |
| A scheduled / cron-style job                        | An API route under `/api/admin/<job>` invoked by an external scheduler (no in-process scheduler exists) |
| Tests for any of the above                          | Colocate Jest tests in `src/**/__tests__/` or as `*.test.ts`. E2E for new flows in `e2e/<flow>.spec.ts` |
| A new doc                                           | `docs/<topic>.md` for general topics, `docs/architecture/<TOPIC>.md` for deep architecture dives |
