# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.2.1](https://github.com/ReadySet1/ready-set/compare/v2.2.0...v2.2.1) (2026-06-12)


### Fixed

* accept profile_id linkage in driver ownership checks ([8670e76](https://github.com/ReadySet1/ready-set/commit/8670e76ea94d97d9edd12e5003cdcc981b7ff184))
* backfill and sync the drivers auth-link columns ([1c5da15](https://github.com/ReadySet1/ready-set/commit/1c5da154877c01e2721f36624604d4f4d33db561))
* driver "Access denied" — ownership via profile_id linkage + tracking authz hardening ([397ea96](https://github.com/ReadySet1/ready-set/commit/397ea96f176cb785f22e026a9af83bffc3b7c447))
* keep the POD sheet open on failed status update; de-dupe banner keys ([c028a50](https://github.com/ReadySet1/ready-set/commit/c028a50c4cab6069ab2e147241ad028d0de8fc06))
* surface delivery status-update failures in the driver tracking UI ([0435f37](https://github.com/ReadySet1/ready-set/commit/0435f3717b581802e6a3bf973a679392e9f062b1))


### Security

* harden tracking authz paths from pre-landing review findings ([23c1486](https://github.com/ReadySet1/ready-set/commit/23c14862ed9f6d6ec73fc8142f93a024a1726dec))
* require caller ownership in driver tracking server actions ([83e54db](https://github.com/ReadySet1/ready-set/commit/83e54db393331ef8ecd758c6ce59b39cf7b87fd8))
* validate delivery status server-side and make completion idempotent ([7058069](https://github.com/ReadySet1/ready-set/commit/7058069a312cdc172aa443d014de7cda93350971))


### Documentation

* changelog entry for the driver ownership/authz overhaul ([8d4ee73](https://github.com/ReadySet1/ready-set/commit/8d4ee73cdb527059ae62ef87c818492b329b885c))
* document the driver-ownership authz module and server-action auth convention ([420d36f](https://github.com/ReadySet1/ready-set/commit/420d36fb589653b5f0231fa28db9ce88e5a1e789))

## [2.2.0](https://github.com/ReadySet1/ready-set/compare/v2.1.0...v2.2.0) (2026-06-09)


### Added

* add admin technical changelog page ([787de4a](https://github.com/ReadySet1/ready-set/commit/787de4a73932525de06e1576cfea23b4405c4eff))
* add automated SMS reminders for driver deliveries ([42769ac](https://github.com/ReadySet1/ready-set/commit/42769ac0b1a79e05f20bfd24cbcb14f55ac21ad7))
* add commit-trailer changelog extractor + release-please wiring ([6631f37](https://github.com/ReadySet1/ready-set/commit/6631f3709fe186b18c4fbd10eb8a0eb8568daa73))
* add public changelog page and what's new badge ([20799b6](https://github.com/ReadySet1/ready-set/commit/20799b67294ea4917059edc8fbe3cd24d67da152))
* add v2 design token foundation (additive, no visual changes) ([d5414e0](https://github.com/ReadySet1/ready-set/commit/d5414e021515ffe1ff55d42309212eb62a4b21b3))
* add v2 design token foundation (PR-A, additive, no visual changes) ([9c53fc6](https://github.com/ReadySet1/ready-set/commit/9c53fc62d063c56b20eb71192fe4303b94e6d5d3))
* **apply:** require equipment photo for driver role ([b33a2f5](https://github.com/ReadySet1/ready-set/commit/b33a2f553f20f708ae611b7fa4089a1533672c46))
* **apply:** require equipment photo for driver role (client + server) ([17954c7](https://github.com/ReadySet1/ready-set/commit/17954c7a95d513a645a09355759010b4709391f7))
* driver app mobile-first redesign ([e0e5d98](https://github.com/ReadySet1/ready-set/commit/e0e5d9849c10a66d76f9d5ad2a4248f3fd83251a))
* driver app theme foundations (scoped tokens + tailwind) ([bea97cb](https://github.com/ReadySet1/ready-set/commit/bea97cba2892fcf12dcbb86fa3ae4a68511d0051))
* driver UI primitive kit ([44ed295](https://github.com/ReadySet1/ready-set/commit/44ed295e13fff2ac638c7239dce8702804753699))
* driver-native delivery detail view ([6710c9a](https://github.com/ReadySet1/ready-set/commit/6710c9a1f7187620712f5f5388ec74356c8e1ed7))
* dual changelog — public What's New page, admin technical changelog, localStorage badge, commit-trailer automation ([e2d0aa9](https://github.com/ReadySet1/ready-set/commit/e2d0aa9bb9ea99425fd5a7de80312636f609e40b))
* implement SEO improvements (P0–P3) ([8bdb97e](https://github.com/ReadySet1/ready-set/commit/8bdb97e9f649af1c627652565eb625b22b4d7bec))
* **lib:** add devOnlyGuard() helper ([bb90e50](https://github.com/ReadySet1/ready-set/commit/bb90e500ff9d8b8d49b72d5d5fe11080f1e999e5))
* outbound partner status webhooks + GET /orders/{id} (CaterCow integration) ([e3594cf](https://github.com/ReadySet1/ready-set/commit/e3594cf17d918ebb16629150629ae83f1dd3c517))
* outbound partner status webhooks + GET /orders/{id} for partner API ([50d7887](https://github.com/ReadySet1/ready-set/commit/50d788733deaa8fab6ed69772257df8bce7a40b1))
* redesign AddressSelector with RouteBuilder, MiniMap & geocoding ([837687b](https://github.com/ReadySet1/ready-set/commit/837687b6e54e469592816bc29377a6263dfc4314))
* redesign driver app screens (home, tracking, history, training) ([38906c7](https://github.com/ReadySet1/ready-set/commit/38906c7d0e12eb17245e98133c40cec21984b259))
* **security:** gate debug + test routes with devOnlyGuard + SUPER_ADMIN ([8b99c35](https://github.com/ReadySet1/ready-set/commit/8b99c357525f8367edc0d2c4a68c2acbd3827a11))
* SEO improvements — metadata, structured data, sitemap ([5831b5e](https://github.com/ReadySet1/ready-set/commit/5831b5e225039b1eb06b51c23708f40c22423e27))


### Fixed

* **auth:** bridge SSR cookie to browser supabase-js session (REA-DRT-07) ([649d15c](https://github.com/ReadySet1/ready-set/commit/649d15c4bb39c146dfa9af1b9cf15a2baf059f51))
* **auth:** catch fire-and-forget token refresh rejections ([06afb52](https://github.com/ReadySet1/ready-set/commit/06afb522086032ae44b4fd28c477dc5071253df2))
* **auth:** catch fire-and-forget token refresh rejections and force re-auth ([83051ce](https://github.com/ReadySet1/ready-set/commit/83051ce29d98e8d58c83782369fb13162e825599))
* **auth:** drop httpOnly from Supabase auth cookies so browser session bridges (REA-DRT-07) ([a463e3f](https://github.com/ReadySet1/ready-set/commit/a463e3f0dfdc63218258e2e5230ebcc428b9e454))
* **build:** inline app version via next.config env, not JSON import ([5c22902](https://github.com/ReadySet1/ready-set/commit/5c22902d7e4a82d55f5959ac1529d778e4077014))
* bundle Prisma query engine into standalone output (GHCR image) ([a963d07](https://github.com/ReadySet1/ready-set/commit/a963d07326a389c554bb6b27c2897a0e608cc6f0))
* bundle Prisma query engine into standalone output for the GHCR image ([8c65a41](https://github.com/ReadySet1/ready-set/commit/8c65a41990f0e236827763e78d8e40a545ba079f))
* don't flash a connection error on the SSE stream's planned 50s rotation ([8f385f1](https://github.com/ReadySet1/ready-set/commit/8f385f14c5c299eb523ce88d7989e54a9c4e20eb))
* driver route resilience — error boundary + graceful history fallback ([aa05d23](https://github.com/ReadySet1/ready-set/commit/aa05d23476b8f7e228d71850f31db775de7616eb))
* driver route resilience — error boundary + graceful history fallback ([0855f33](https://github.com/ReadySet1/ready-set/commit/0855f334dbc93970ddb0228c1c93d52fb9e742c6))
* escape `*/` in CSS comment that prematurely closed the comment block ([9ed7e36](https://github.com/ReadySet1/ready-set/commit/9ed7e36798beb7346fbc146bca3a977f74ea807f))
* harden JSON-LD and correct BlogPosting datePublished ([ed4dc17](https://github.com/ReadySet1/ready-set/commit/ed4dc1723816116e568327f700ed042e9a79555a))
* **health:** read version from package.json at build time ([3efe2f0](https://github.com/ReadySet1/ready-set/commit/3efe2f03667cfbec731bf63442b8be23fe27f94e))
* rate-limit driver location writes (abuse protection) ([d8e0814](https://github.com/ReadySet1/ready-set/commit/d8e0814891780f4f925cf041fd01af680a78499c))
* read package.json once at next.config.js load time and expose just the version string via the env block (next inlines env entries as build-time string literals). /api/health now reads process.env.APP_VERSION, which is the single string '2.1.0' baked in at build time — no JSON in the bundle. ([5c22902](https://github.com/ReadySet1/ready-set/commit/5c22902d7e4a82d55f5959ac1529d778e4077014))
* **realtime:** stop calling non-existent channel.off() (REA-367) ([3735ed8](https://github.com/ReadySet1/ready-set/commit/3735ed846632c5b2a1fd6b1b56260716af622f46))
* **realtime:** stop calling non-existent channel.off(); stable broadcast dispatcher (REA-367) ([7f6d82c](https://github.com/ReadySet1/ready-set/commit/7f6d82cbab2d2f24f6b1db747fd6f107e161f905))
* retry Supabase Realtime CHANNEL_ERROR with backoff, downgrade Sentry noise ([3a8e686](https://github.com/ReadySet1/ready-set/commit/3a8e686b516129b33fde26d8e6ad1db732b21129))
* route driver-tracking endpoints through the shared pooled Prisma client ([4d4ad94](https://github.com/ReadySet1/ready-set/commit/4d4ad94f730d7ecc671e7d5cbe13ddd1a7e539d2))
* route driver-tracking endpoints through the shared pooled Prisma client ([1904914](https://github.com/ReadySet1/ready-set/commit/1904914956eea2fecf61b3bc240e8146c9be9a14))
* silence Sentry tracking noise (NEXTJS-1F) + fix 3 stale test suites ([1d96e0b](https://github.com/ReadySet1/ready-set/commit/1d96e0b938efa505eaf03166d3cbcb066ac66d20))
* silence Supabase auth lock 'steal' AbortError noise in Sentry ([67cc490](https://github.com/ReadySet1/ready-set/commit/67cc490b9630f253468b685e2cb69c8690ee1703))
* silence Supabase auth lock "steal" AbortError noise in Sentry ([42e9486](https://github.com/ReadySet1/ready-set/commit/42e9486983f9dd512ead38c659b0a5fb849f2ec0))
* single-source the driver home deliveries count and list ([1e2b304](https://github.com/ReadySet1/ready-set/commit/1e2b30485135c3c4964007390dbfa6bcb2929b9f))
* single-source the driver home deliveries count and list ([e152263](https://github.com/ReadySet1/ready-set/commit/e15226345df4330f306b8ad8f465b64018cb8a2f))
* stop /api/tracking/live SSE from hitting Vercel runtime timeout ([514a3e3](https://github.com/ReadySet1/ready-set/commit/514a3e3bcf6ed3000edabbd560e287c089bc390f))
* stop /api/tracking/live SSE from hitting Vercel runtime timeout ([fefc81d](https://github.com/ReadySet1/ready-set/commit/fefc81d499b3bfe8e108a99ce2ec5d84af9aeff5))
* tag Sentry environment correctly so dev deploys stop reporting as production ([72eb586](https://github.com/ReadySet1/ready-set/commit/72eb586f847ae605654ec1d000346207815ce48b))


### Security

* harden driver tracking routes against IDOR + SQL injection (OWASP A01/A03) ([79ac13a](https://github.com/ReadySet1/ready-set/commit/79ac13a35ee839de3d6c6b957da873e32491fd90))


### Changed

* drop no-op CHANNEL_ERROR backoff delay, correct retry comment ([7ddd862](https://github.com/ReadySet1/ready-set/commit/7ddd862a8b838e30bd6e0610136ec883764e0879))
* refit Shadcn display atoms to v2 token system (batch 1b) ([9eef4d4](https://github.com/ReadySet1/ready-set/commit/9eef4d446120d92a2d4d1c2f88d54ab3ed71047f))
* refit Shadcn form atoms to v2 token system (batch 1a) ([167a28f](https://github.com/ReadySet1/ready-set/commit/167a28fd1769396ba39c4fa1cfc22bf495ea5b12))
* remove legacy driver components superseded by the redesign ([548e3c4](https://github.com/ReadySet1/ready-set/commit/548e3c45aa90fdbbfad67cb873684d685ead3b74))


### Documentation

* **claude:** add Versioning section covering release-please flow ([b866ffc](https://github.com/ReadySet1/ready-set/commit/b866ffc864a5af52040d71d86156f1be7952a59f))
* introduce ARCHITECTURE.md + REMEDIATION_PLAN.md, mark item [#4](https://github.com/ReadySet1/ready-set/issues/4) shipped ([19b1590](https://github.com/ReadySet1/ready-set/commit/19b15907ea8116e4e49e505241a95953e9e20e7f))

## [Unreleased]

### Fixed
- **Driver "Access denied" on own deliveries**: ownership checks now accept either auth-link column (`profile_id` or legacy `user_id`) via the new `src/lib/auth/driver-ownership.ts` module — drivers whose row only carries `profile_id` (most of them) no longer get 403s on every tracking write
- Driver tracking portal surfaces failed delivery status updates with an error toast instead of silently doing nothing; the proof-of-delivery sheet stays open on failure so the capture can be retried
- Error banners in the driver portal no longer mask each other (all active location/shift/delivery errors render, keyed by source)
- Backfill migration syncs the `drivers.user_id` / `profile_id` auth-link columns both ways (guarded by FK existence checks, idempotent)
- Stale orders PATCH test assertions left behind by the earlier IDOR-hardening pass

### Security
- Driver tracking server actions (`delivery-actions.ts`, `driver-actions.ts`) now authenticate the caller and enforce owner-or-admin on every read/write; `createDelivery` / `assignDeliveryToDriver` are admin-only
- `updateDeliveryStatus` validates the status value server-side (enum) and only increments the shift `delivery_count` on a genuine transition into COMPLETED (no replay inflation)
- `updateDriverLocation` checks ownership before recording the rate limit, so a non-owner can no longer burn a victim driver's ping budget
- Delivery ownership lookups filter soft-deleted rows; `GET /api/tracking/drivers` driver-scoping matches both auth-link columns

## [2.1.0] - 2026-05-13

Periodic dev → main sync ([PR #402](https://github.com/ReadySet1/ready-set/pull/402)). 89 commits / ~25 PRs since the previous release window. First versioned release after baseline rebase — anchors retroactively to merge commit `c3803ac9`.

### Added
- **Internal QA + Tasks Dashboards**: Admin-only pages at `/admin/qa-board` and `/admin/tasks-board` for cross-team visibility into testing state and meeting action items
  - QA Board: renders quarterly Jira/TestRail test case exports grouped by folder with pass/fail/blocked/in-progress/not-run counts and expandable step tables
  - Tasks Board: kanban view of meeting action items + promoted QA failures, with cross-link badges between the two boards via `relatedQa` field
  - Data flow: workspace generator scripts (`meetings/shared/build-tasks-board.mjs`, `docs/ready-set/qa/build-qa-board.mjs`) emit normalized JSON into `src/data/`; server components import statically at build time
  - Structured `<code>` rendering via `parseDescription()` helper — no `dangerouslySetInnerHTML`, no XSS surface
  - Auth reuses existing `/admin/*` middleware gate (`src/middleware/routeProtection.ts`)
  - Sidebar adds new "Internal" section with QA Board + Tasks Board entries

- **Multi-Stop Calculator Demo (REA-318)**: Auto-distance calculation feature
  - Geocode API endpoint for address-to-coordinates conversion
  - Auto-distance calculation between stops using Haversine formula
  - Removed unused xlsx package with security vulnerabilities

- **Order Tracking Driver/Vendor Flows (REA-xxx)**: Real-time driver location tracking
  - New `/api/orders/[order_number]/driver-location` endpoint for vendor/client order views
  - `useDriverRealtimeLocation` hook for single-driver location tracking
  - Vendor access to realtime driver locations channel
  - RLS policy implementations for user-scoped and admin-managed tables
  - Driver shift mileage columns migration

- **On-Demand Order Creation (REA-155)**: Admin and client-side on-demand order creation
  - New admin order creation page at `/admin/on-demand-orders/new`
  - New client order creation page at `/client/orders/new`
  - Zod validation schemas for on-demand order forms
  - File upload support with cleanup on navigation
  - Client search/selection with combobox interface

- **Dashboard Order Metrics (REA-157)**: Enhanced dashboard with complete order status visibility
  - Added pending and cancelled order counts to Client/Vendor dashboards
  - Updated dashboard grid layout from 3 to 5 metric cards
  - Consistent styling with existing metric cards

- **Catering Orders Filter Enhancement (REA-154)**: Improved search functionality
  - Added `clientAttention` field to search filters
  - Updated search to use AND/OR query structure for better precision
  - Added support for field-specific search (order_number, client_name, amount, date)

- **EzCater GraphQL API Integration**: New delivery API client for EzCater platform
  - GraphQL client with resilience patterns (circuit breaker, exponential backoff retry)
  - Type-safe mutations for courier assignment, tracking events, and image uploads
  - Comprehensive error handling with `EzCaterApiError` class
  - Environment variables: `EZCATER_API_TOKEN`, `EZCATER_API_URL`, `EZCATER_WEBHOOK_SECRET`
  - Full test coverage for client, operations, and error handling

- **User Audit History (REA-173)**: Comprehensive audit trail for user profile changes
  - New `UserAudit` model tracking all user modifications with before/after state
  - `UserAuditService` for creating and querying audit entries
  - `useAuditHistory` hook for fetching paginated audit logs
  - CSV export functionality for audit logs
  - Audit summary statistics per user
  - Sensitive field sanitization (excludes passwords, tokens, API keys)

- **Catering Landing Page**: New responsive catering services landing page
  - `FoodSetupCarousel` component with animated image showcase
  - `CateringFeatures` component highlighting service benefits
  - Responsive design with mobile-first approach
  - Integration with `ScheduleDialog` for booking consultations

- **FoodDelivery Component Tests**: Comprehensive test coverage
  - 24 tests for `CateringFeatures` component (100% coverage)
  - Tests for responsive design, accessibility, and motion animations
  - Mocking strategy documentation in `README.md`

- **Push Notification Enhancements (REA-124)**: Analytics tracking and multi-recipient support
  - New `NotificationAnalytics` model for tracking delivery, open, and click rates
  - New `NotificationDedup` model for distributed deduplication across instances
  - Added `lastRefreshedAt` and `refreshCount` fields to `ProfilePushToken`
  - Rate limiting to prevent duplicate notifications within 60 seconds

- **Mileage System Refactor (REA-125)**: Converted from kilometers to miles
  - New `total_distance_miles`, `gps_distance_miles`, `odometer_distance_miles` columns
  - Legacy `total_distance` (km) column preserved for backwards compatibility
  - Data migration converts existing km values to miles
  - Added proper indexes for mileage queries

- **Proof of Delivery Photo Capture (REA-126)**: Driver POD functionality
  - New `delivery-proofs` Supabase storage bucket (2MB max, JPEG/PNG/WebP)
  - `ProofOfDeliveryViewer` component with full-size modal and download
  - `ProofOfDeliveryCapture` component with client-side image compression
  - API routes for upload, fetch, and delete operations
  - Driver assignment verification for upload access

- **Testing Infrastructure (REA-176, REA-177)**: Comprehensive testing improvements in Phase 5A
  - Enhanced Jest setup with complete Supabase client mocking
  - Browser API polyfills for File, Blob, FormData, ReadableStream
  - Next.js navigation hooks mocking
  - React-Hot-Toast mocking
  - Improved test coverage for modal components
  - New visual regression tests with Playwright (`e2e/visual-regression.spec.ts`)

- **Brand Color System (REA-137)**: New amber color palette
  - Created `src/styles/brand-colors.ts` with comprehensive color definitions
  - Updated Tailwind configuration with new color tokens

- **Database**: New `delivery_configurations` table migration
  - Supports client-specific pricing tiers and mileage rates
  - Includes daily drive discounts and bridge toll settings
  - JSONB fields for flexible pricing configurations

- **Testing Documentation**:
  - `TESTING_PROGRESS.md` - Detailed testing improvement tracking
  - `TEST_FAILURE_REPORT.md` - Categorized failure analysis
  - `PROGRESS_REVIEW.md` - Executive summary and metrics

- **Vendor Dashboard Metrics (REA-159)**: Revenue calculation and growth tracking
  - Total Revenue card showing completed order revenue
  - 30-Day Growth card with percentage change indicator
  - Green/red coloring for positive/negative growth trends
  - Unified dashboard for both Client and Vendor users

### Changed
- **Orders Date Display (REA-158)**: Display delivery date instead of creation date
  - `CateringOrdersTable` now shows `arrivalDateTime` instead of `createdAt`
  - `CateringOrdersPage` updated for delivery date display
  - `UserOrdersTable` updated for delivery date display
- **Build Configuration**: ESLint disabled during Vercel builds
  - Prevents 45+ minute build timeouts
  - ESLint enforced in pre-commit hooks and CI pipeline instead
- **DeliveryPartners Component**: Partner logos now clickable with external links
  - Added "Partner With Us" CTA button with ScheduleDialog integration
  - Improved accessibility with aria-labels and proper link attributes
- **FoodSetupCarousel**: Background color changed from yellow (`bg-yellow-400`) to dark gray (`#343434`)
- **Apply Page (REA-190)**: Changed 'Amazing' text from orange gradient to black
- **Catering Services Modal**: Updated modal text and added comprehensive tests
- **Console Logging (REA-127)**: Converted console statements to Sentry error tracking
  - `src/lib/calculator/delivery-cost-calculator.ts` - Uses `captureMessage` for manual review logging
  - `src/app/api/job-applications/route.ts` - Cleaned up debug prefixes from error logs
  - `src/utils/supabase/storage.ts` - POD upload/delete error tracking
  - `src/app/api/orders/[order_number]/pod/route.ts` - POD API error tracking
  - `src/app/api/tracking/deliveries/[id]/pod/route.ts` - Tracking POD error tracking
  - `src/components/Driver/ProofOfDeliveryViewer.tsx` - Download error tracking
  - `src/services/notifications/push.ts` - Push notification error tracking

### Fixed
- **Toast Auto-Dismiss**: Removed duplicate Toaster component causing toasts not to auto-dismiss
  - Root cause: Two `<Toaster />` components rendering (one from `layout.tsx`, one from page)
  - Fix: Removed redundant Toaster from affected pages

- **User Files UUID Validation**: Fixed 500 error on invalid userId format
  - Added proper UUID format validation before database query
  - Returns 400 Bad Request for malformed user IDs

- **Change Role API Tests**: Fixed test suite to support transaction-based audit logging
  - Updated mocks to include `$transaction` and `UserAuditService`
  - All 25 tests now passing

- **TypeScript**: Improved type safety in `src/lib/auth.ts`
  - Added `OAuthMetadata` interface for OAuth user metadata
  - Replaced `any` types with proper Supabase error types (`AuthError`, `PostgrestError`)

### Removed
- **Promotional Banners (REA-193)**: Permanently removed promotional banner components and tests from all pages

### Security
- Fixed high-severity `qs` vulnerability (CVE-2025-15284) via pnpm override
  - `qs@<6.14.1` → `>=6.14.1` (prototype pollution in googleapis)
- Fixed high-severity `tar` vulnerabilities via pnpm override
  - `tar@<=7.5.3` → `>=7.5.4` (GHSA-8qq5-rm4j-mr97, GHSA-r6q2-hw4h-h46w in sanity)
- Fixed 5 high-severity npm vulnerabilities via pnpm overrides
  - `node-forge@<1.3.2` → `>=1.3.2` (ASN.1 vulnerabilities in firebase-admin)
  - `valibot@>=0.31.0 <1.2.0` → `>=1.2.0` (ReDoS in next-sanity)
  - `jws@<4.0.1` → `>=4.0.1` (HMAC signature verification in firebase-admin)
- Updated `next-sanity` from 11.5.5 to 11.6.10

## Test Status

**Current Pass Rate**: 80.8% (3372/4206 tests passing)
- Unit tests are informational in CI (not blocking)
- TypeScript and ESLint checks are blocking

**Note**: Test infrastructure improvements are ongoing. Many test failures are related to mock configuration issues being addressed in subsequent phases.
