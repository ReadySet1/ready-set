# TODOs

Tracking item for follow-up work. Items grouped by component, sorted P0 (highest) → P4 (lowest), with a `## Completed` section at the bottom.

Format reference: see `~/.claude/skills/gstack/review/TODOS-format.md`.

## API — Orders

### Fix 500 errors in `/api/orders/[order_number]/files` authorization

**Priority:** P0
**Noticed on:** `feature/internal-qa-tasks-dashboards` (2026-05-11)
**Status:** Open
**Owner:** Fernando

14 tests in `src/__tests__/api/orders/order-files.test.ts` fail with `500` where `403` is expected. Authorization paths are throwing instead of returning the proper forbidden response. Affects DRIVER and other non-admin roles attempting to access order files.

**Error:**

```
expect(received).toBe(expected) // Object.is equality
Expected: 403
Received: 500
  at toBe (src/__tests__/helpers/api-test-helpers.ts:264:27)
  at expectErrorResponse (src/__tests__/helpers/api-test-helpers.ts:289:10)
  at Object.<anonymous> (src/__tests__/api/orders/order-files.test.ts:340:28)
```

Surfaced by `/ship` test gate; pre-existing failure, not introduced by this branch. Source last modified by Fernando 2 weeks ago; tests last modified 6 weeks ago.

## Internal Boards

### Validate generated JSON with Zod at module load

**Priority:** P2
**Noticed on:** `feature/internal-qa-tasks-dashboards` (2026-05-11)
**Status:** Open

`src/app/(backend)/admin/{qa,tasks}-board/page.tsx` use `as QaBoardData` / `as TasksBoardData` casts on imported JSON. If the workspace-level generator drifts (new verdict value, missing label, new status), the cast silently lies and the dashboard renders broken UI. Wrap with `QaBoardSchema.parse(...)` / `TasksBoardSchema.parse(...)` so drift fails fast at build/request. Zod is already a project dependency.

### Auto-assign owner colors via hash for new owners

**Priority:** P3
**Noticed on:** `feature/internal-qa-tasks-dashboards` (2026-05-11)
**Status:** Open

`OWNER_COLORS` in `src/components/internal-boards/TasksBoard.tsx` is hard-coded for `emmanuel | gary | fernando`. New owners added to `tasks-board.json` fall back to slate. Pick from a palette indexed by a stable hash of the owner key so adding an owner doesn't require code changes.

## Driver Tracking

### End-shift can deadlock if the deliveries-mirror upsert fails

**Priority:** P1
**Noticed on:** `fix/driver-tracking-single-source` (2026-06-17, /ship red-team)
**Status:** Open

In `PATCH /api/orders/[order_number]`, the order update (sets `completeDateTime` + `status=COMPLETED`) and the `deliveries` mirror upsert (`status: driverStatus`) are NOT in one transaction — the mirror runs in a swallow-all try/catch (`route.ts` ~line 670). If the mirror upsert fails transiently, the order is terminal but `deliveries.status` stays non-terminal, and the end-shift guard (`driver-actions.ts:159-162`) counts it → the driver can't end their shift (admin `force` end is the only escape). Now that the Live-Tracking single-source change made the orders PATCH the sole maintainer of `deliveries.status`, the guard is newly sensitive to this drift. Fix: wrap order-update + mirror in one `prisma.$transaction`, OR make the guard's deliveries subquery exclude rows whose linked order is already terminal (join `deliveries`→orders by `order_number`, ignore `completeDateTime IS NOT NULL`). Needs runtime-tested raw SQL — deferred from the ship to avoid rushing the critical end-shift path.

### Remove now-dead tracking Server Actions

**Priority:** P2
**Noticed on:** `fix/driver-tracking-single-source` (2026-06-17, /ship review)
**Status:** Open

After the Live-Tracking single-source change, `getDriverActiveDeliveries` and `updateDeliveryStatus` in `src/app/actions/tracking/delivery-actions.ts` have no production callers (only `assignDeliveryToDriver` remains used). Remove them + their security tests, or document why they're retained.

### Order-status auto-derive bypasses canTransitionOrder; mirror driver_id not re-synced

**Priority:** P3
**Noticed on:** `fix/driver-tracking-single-source` (2026-06-17, /ship red-team)
**Status:** Open

Two pre-existing-adjacent edges in `PATCH /api/orders/[order_number]`: (1) a `{driverStatus: COMPLETED}`-only request sets `updateData.status = deriveOrderStatusFromDriver(...)` without running `canTransitionOrder`, so the order-level state machine is silently violable (e.g. ASSIGNED→COMPLETED early-finish that `ORDER_TRANSITIONS` rejects) — route it through the shared `transitionOrder()` or validate the derived status. (2) The `deliveries` mirror upsert UPDATE branch syncs `status` but not `driver_id`, so reassignment mid-delivery can misattribute the end-shift guard's per-driver count — also set `driverId` in the update branch (only when resolved/non-null).

## Completed

_(none yet)_
