# Driver-Tracking Punch-List — Continuation / Handoff (2026-06-18)

**Status:** paused for infra migration. This doc is the durable resume point (lives in git, so it survives the move). Full design rationale is in the approved plan at `~/.claude/plans/can-we-plan-everything-replicated-flask.md` (may not migrate — the essentials are duplicated below).

**Source of the work:** the 2026-06-17 walk-test punch-list in `docs/issues-tracker/README.md` → table "2026-06-17 — validation re-test" (LM-1…LM-6, CO-1…CO-3, UX-1…UX-3).

**Strategy (decided with the user):** 3 staged PRs against `development`; design-review-first for the visual items; code fallbacks now, data backfill later.

---

## ✅ DONE — PR1 `fix/tracking-map-data` (branch off `origin/development`)

Commits:
- `5bd2a15` fix(tracking): pickup pin, driver name, mileage, offline state on admin live map — **LM-1, LM-2, LM-3, LM-4**
- `6b44cf1` fix(orders): remove duplicate delivery timeline on catering order page — **CO-3**

What landed:
- **LM-1** pickup/restaurant marker on `/admin/tracking` map — `src/components/Dashboard/Tracking/LiveDriverMap.tsx` (`createPickupMarkerElement`, `pickupMarkersRef`, pickup effect, legend) + `PICKUP_MARKER_COLOR` in `src/constants/tracking-colors.ts`.
- **LM-2** driver name + "Not set" vehicle in map popup — `LiveDriverMap.tsx` `createPopupContent`.
- **LM-3** feed emits `total_distance_miles` + `delivery_count` — `src/app/api/tracking/live/route.ts` (`ActiveDriverRow`, SELECT, mapping); popup reads top-level fields.
- **LM-4** stale→"Offline (no GPS)" state — shared `isLocationStale` in `src/lib/realtime/stale-detection.ts` (+ test `src/lib/realtime/__tests__/stale-detection.test.ts`), used by `LiveDriverMap.tsx` (`getDriverColor`, `DRIVER_STATUS_COLORS.stale`) and `DriverStatusList.tsx` (status dot + Offline badge).
- **CO-3** removed duplicate sidebar `<DeliveryTimeline>` — `src/components/Orders/SingleOrder.tsx`.

Validated: `pnpm typecheck` ✅ · `pnpm lint` ✅ (only pre-existing warnings) · 185 admin-tracking tests + 4 new `isLocationStale` tests ✅.

**LM-6** (filters): already shipped before this work — no change needed.

**Resume note:** if the PR was opened, finish review/merge. If not, `git push -u origin fix/tracking-map-data` then open a PR vs `development`.

---

## ⏳ TODO — PR2 `fix/tracking-realtime-detail` (NOT STARTED)

Branch off `origin/development`.

### CO-2 — catering page realtime stuck on "connecting" / not updating
- Root cause is **not** a missing include (the PATCH already `include`s `dispatches.driver` — `src/app/api/orders/[order_number]/route.ts` ~648-680; broadcast guard ~748-754; channel/event names match the subscriber).
- **Do:**
  1. **Polling fallback** — add TanStack Query `refetchInterval` (~20-30s, enabled while `isActiveOrder`) to the order query in `src/components/Orders/SingleOrder.tsx` so status updates even when realtime fails. (Primary fix for "not updating".)
  2. **Honest indicator** — confirm the #446 timeout in `src/hooks/tracking/useDeliveryStatusRealtime.ts` (~202-221) resolves "connecting"→"Offline"; ensure `src/hooks/tracking/useDriverRealtimeLocation.ts` also has a timeout so `secondChannelReady`/the indicator can't hang (SingleOrder gating ~234-256).
  3. **Confirm broadcast emits** with a seeded assigned+active driver (test order may simply have no dispatched driver). Only if still failing, switch the status channel to Supabase Postgres-changes (like `driver-locations`).

### LM-5 — Deliveries tab: pickup "N/A" + no detail drill-in
- **Do:**
  1. **Verify columns first** — `docs/issues-tracker/README.md` flags `proof_of_delivery`/`metadata`/`completed_at`/`catering_request_id`/`on_demand_id` in `src/app/api/tracking/deliveries/[id]/route.ts` GET as possible dead columns; reconcile vs `prisma/schema.prisma` + POD fix (#h → `delivery_photo_url`/`delivery_notes`) before exposing in UI.
  2. **View-details drawer** — add a button to `DeliveryCard` in `src/components/Dashboard/Tracking/DeliveryAssignmentPanel.tsx` (~133-307) opening a Dialog/Sheet from `src/components/ui/`, populated by `GET /api/tracking/deliveries/[id]`.
  3. **Pickup text fallback** — in the feed deliveries mapping (`src/app/api/tracking/live/route.ts` ~387-421) return pickup address *text* even when coords are null, so `formatLocation()` (`DeliveryAssignmentPanel.tsx:177`) shows the address instead of "N/A". (Full coord backfill = D1.)

---

## ⏳ TODO — PR3 `design/tracking-ux` (NOT STARTED, design-review-led)

**Step 1:** run `/design-review` on `/admin/catering-orders/[order_number]` and `/driver/deliveries/[order_number]`, then implement against findings. Pre-identified fixes to validate:
- **CO-1** catering layout — `src/components/Orders/SingleOrder.tsx`: `flex-wrap` the order-details row (~918-958); fix Assign-Driver button overlap (`ml-auto` not fixed `ml-6`, ~963-973); reflow header title+button (~896-975); responsive realtime indicator (~990-998).
- **UX-1** navigate-to-pickup — `src/components/Driver/DriverDeliveryDetail.tsx`: make `mapsHref` (~122-129) fall back to `lat/lng` when street text is empty (button currently *disappears* when address text is blank — the real walk-test symptom); raise prominence.
- **UX-2** status CTA affordance — `src/components/Driver/ui/NextAction.tsx` (~57-105): give the sticky "NEXT STEP" CTA unmistakable button chrome + explicit imperative so it doesn't read as an info banner.
- **UX-3** = net effect of UX-1/UX-2.

---

## ⏳ Deferred workstreams (tracked, not in PR1-3)
- **D1 — Data backfill (ops):** geocode existing pickup `addresses` (`latitude`/`longitude`); populate `drivers.vehicle_number` (or wire a real vehicle source). Unblocks real values behind LM-2 vehicle + LM-5 pickup.
- **D2 — Native background GPS:** "driver shows stopped when app closed" true fix needs a native wrapper / background geolocation (web suspends background GPS). See native-wrapper spec (2026-06-17). PR1 only improves admin-side presentation.
- **D3 — Server-action deploy-skew hardening:** the `IMG_0842` "Server Action … not found" error is a stale-bundle digest mismatch. Add a client error boundary that detects `failed-to-find-server-action` and auto-reloads.

---

## How to resume after migration
1. `cd repos/ready-set && git fetch origin`
2. Confirm PR1: `git log origin/fix/tracking-map-data` (or check the open PR). If unpushed, push it and open the PR.
3. Start PR2: `git checkout -b fix/tracking-realtime-detail origin/development` and work the CO-2 + LM-5 checklist above.
4. Re-read `docs/issues-tracker/README.md` (punch-list) and this file for context.
5. Pre-PR gates: `pnpm typecheck && pnpm lint && pnpm test` (scope to touched areas).
