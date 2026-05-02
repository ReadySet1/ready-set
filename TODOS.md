# TODOS

Design debt and follow-up work from design reviews.

## Driver Status Redesign — Design Review (2026-05-01)

### Wire up Proof of Delivery photo capture
- **What**: Connect `onPODRequest` handler in DriverDeliveries to trigger camera/upload UI before marking delivery COMPLETED.
- **Why**: Liability protection for disputes. Architecture already exists — `DeliveryStatusControl.tsx:54` checks for the handler, `Delivery.fileUploads` supports `proof_of_delivery` category.
- **Depends on**: Cloudinary upload infrastructure (already in place).
- **Files**: `src/components/Driver/DeliveryStatusControl.tsx`, `src/components/Driver/DriverDeliveries.tsx`

### Migrate driver components to M3 semantic tokens
- **What**: Replace hardcoded Tailwind color classes (`bg-amber-500`, `text-green-600`, `border-blue-400`) with M3 semantic tokens from the recent migration.
- **Why**: Driver components were added after the M3 migration (commit b6c5021e) and bypass the token system. Theme changes won't propagate.
- **Depends on**: Token guardrail script (commit 1dc82712) should catch new violations.
- **Files**: `src/app/(site)/(users)/driver/page.tsx`, `src/components/Driver/DriverDeliveries.tsx`, `src/components/Driver/DeliveryStatusControl.tsx`, `src/components/Delivery/DeliveryTimeline.tsx`, `src/components/Driver/DriverStatsCard.tsx`
- **Note**: Cockpit components (`src/components/Driver/cockpit/`) partially fixed by /design-review on `feature/redesign-driver-update-status` (2026-05-02) — hardcoded `#FBD113` replaced with `bg-brand`/`bg-cta` tokens. `driver/page.tsx` still uses `bg-amber-500`, `bg-amber-100`, etc.

## Driver Cockpit — Deferred Design Findings (2026-05-02)

### D01: DriverStatsCard error banner visible to drivers (HIGH)
- **What**: The DriverStatsCard component renders an error state ("Unable to load statistics") when the `/api/tracking/drivers` endpoint returns a permission error. Drivers see a red error banner on their dashboard.
- **Why**: The tracking API may not return data for the logged-in driver, causing a cascade of empty stats and an error card. The error banner should be hidden or the API permissions fixed so drivers can see their own stats.
- **Files**: `src/app/(site)/(users)/driver/page.tsx:299-305`, `src/components/Driver/DriverStatsCard.tsx`

### D02: Shift timer showing runaway duration (MEDIUM)
- **What**: The shift timer in the driver dashboard header displays "449+ hours" or similar extreme values when no shift is actively tracked.
- **Why**: `shiftStatus` defaults to `{ isActive: false }` but the duration calculation may use a stale startTime. The timer should reset when no active shift exists.
- **Files**: `src/app/(site)/(users)/driver/page.tsx`

### D03: Conflicting shift status indicators (MEDIUM)
- **What**: The dashboard header shows "Off Shift" while a persistent bottom bar shows "Shift Active". Both cannot be true simultaneously.
- **Why**: Two independent state sources — the local `shiftStatus` state and whatever drives the bottom bar. Need a single source of truth for shift state.
- **Files**: `src/app/(site)/(users)/driver/page.tsx`

### D04: Location Simulator dev tool visible in non-dev environments (LOW)
- **What**: The "Location Simulator" floating panel appears for logged-in drivers on production builds.
- **Why**: Should be gated behind `process.env.NODE_ENV === 'development'` or a feature flag. Non-destructive but confusing for real drivers.
- **Files**: Likely in a layout component or tracking module
