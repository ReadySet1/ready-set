# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
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
