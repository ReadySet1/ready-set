# Driver App — Issues Tracker (2026-06-16 walk test)

First real-device GPS walk test (Emmanuel, CDMX, `development` → rs-dev). Screenshots in this folder (`IMG_0825`–`0835`, `Driver Tracking Portal …png`) are the evidence; **`IMG_0835` shows the POD upload failure** ("Failed to upload proof of delivery", only "Try Again"). Full plan: `~/.claude/plans/awesome-we-have-a-crispy-bird.md`.

**Branches:** PR1 (blocking bugs) = `fix/driver-walk-test-blockers`. PR2 (perf/persistence) + signature = follow-ups.

Legend: ✅ fixed (PR1) · 🔜 PR2 · ⏸️ deferred (awaiting design) · 📝 follow-up

| # | Issue (reporter words) | Surface | Root cause | Fix | Status |
|---|---|---|---|---|---|
| a | "Dashboard shows *En route to Resto* even before the driver starts the shift" | Admin order/status views | Informal "Resto" copy; status display reflects the stored `driverStatus`, and stale test rows carried `EN_ROUTE_TO_VENDOR` | Copy "Resto" → "Restaurant" (`delivery-status-transitions.ts`, `Orders/DriverStatus.tsx`, `useDeliveryStatusRealtime.ts`); stale rows cleaned in rs-dev | ✅ |
| b | "Blank squares appear when the driver has no info" | Driver Home (stats/cards) | `StatTile` rendered `value` raw → null/NaN = blank tile; `DriverStatsPanel` called `.toFixed()`/`Math.round()` on possibly-undefined stats | `StatTile` "—" fallback; coalesce stats `?? 0`; `DeliveryCard` stop-name fallback | ✅ |
| c | "App feels sluggish — loading things all the time" | Whole driver flow | 60s poll **+** refetch on every `visibilitychange` (storm) replacing content with spinners; uncached mount fetches | Background refetch + debounce/TanStack-Query migration; consolidate mount fetches | 🔜 PR2 |
| d | "Driver app shows *Assigned – In progress*" | Driver delivery timeline | `StatusTimeline` showed "In progress now" on the active step even when that step is ASSIGNED (not started) | ASSIGNED active step now reads "Awaiting start" | ✅ |
| e | "Driver status shows *Connecting…* on /admin/catering-orders/[order]" | Admin order detail | `useDeliveryStatusRealtime` subscribed with **no pre-auth check and no timeout** → hangs `isConnecting=true` forever when the browser has no session (REA-DRT-07) | Pre-connect `getSession()` check + 12s timeout → resolves to "Offline" (clickable to reconnect) | ✅ |
| f | "Tab switch sometimes errors; switching apps stops tracking" | Driver tracking | Visibility handlers don't re-arm `watchPosition` / reconnect a disconnected channel; mobile suspends background GPS; handlers can fire against torn-down refs | Re-arm watch + reconnect on visible; guard handlers; optional wake-lock; document web background-GPS limits | 🔜 PR2 |
| g | "Recipient signature + printed name not implemented" | POD | Photo-only POD; schema has unused `deliverySignatureUrl`/`signatureRequired`/`photoRequired` but no `recipient_name` | Signature-pad + name capture, `recipient_name` migration, storage + upload | ⏸️ awaiting Claude Design (own PR) |
| h | "POD photo upload errors with no skip; couldn't finish delivery — yet could still end the shift" | Driver POD + shift | (1) POD route wrote dead `proof_of_delivery`/`metadata` columns → 500; (2) POD hard-gated with no fallback; (3) `endDriverShift` had no active-delivery guard | (1) Use real `delivery_photo_url`/`delivery_notes` (+pod-gallery); (2) "Complete anyway — upload later" via `usePODOfflineQueue`; (3) end-shift blocks on active deliveries (admin `force`) | ✅ |

## Also found / deferred
- **Live location not persisting** — with realtime on, GPS broadcasts over WebSocket (admin "Live Data") but `driver_locations` got 0 writes → no history/trail/mileage. Dual-write fix → **🔜 PR2**.
- **Dead-column landmines (same class as #h, NOT in the walk path):** `/api/tracking/deliveries/[id]` GET/PATCH and the base-route `POST /api/tracking/deliveries` still reference `proof_of_delivery`/`metadata`/`catering_request_id`/`on_demand_id`/`completed_at`. No UI callers (the portal uses server actions), so they don't block the driver — **📝 follow-up** to align them (and the `createDelivery` server action) with the real schema.
