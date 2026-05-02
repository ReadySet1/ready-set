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
