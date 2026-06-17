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

### Order-status auto-derive bypasses canTransitionOrder

**Priority:** P3
**Noticed on:** `fix/driver-tracking-single-source` (2026-06-17, /ship red-team)
**Status:** Open

In `PATCH /api/orders/[order_number]`, a `{driverStatus: COMPLETED}`-only request sets `updateData.status = deriveOrderStatusFromDriver(...)` without running `canTransitionOrder`, so the order-level state machine is silently violable: the driver graph permits early-finish (`any→COMPLETED`, `driver-state.ts:16`) but `ORDER_TRANSITIONS` (`order-state.ts:10`) does not (e.g. ASSIGNED→COMPLETED). In practice the driver UI advances one stage at a time, so the order always follows a valid path and the outcome is correct today — a validation-consistency nit, not a functional bug. Proper fix: reconcile `ORDER_TRANSITIONS` with the driver early-finish edges, then route the orders PATCH through the shared `transitionOrder()` (`transition.ts:32`) so one graph governs both fields. Own PR with full transition tests.

## Completed

### End-shift deadlock from a non-atomic deliveries mirror

**Completed:** `fix/driver-tracking-hardening` (2026-06-17)

The order update + `deliveries`-mirror upsert in `PATCH /api/orders/[order_number]` now run in one `prisma.$transaction`; a mirror failure rolls the order update back (retryable 500) instead of stranding a terminal order with a stale non-terminal `deliveries.status` that the end-shift guard counts as active. Regression test added.

### Remove now-dead tracking Server Actions

**Completed:** `fix/driver-tracking-hardening` (2026-06-17)

Removed `getDriverActiveDeliveries` + `updateDeliveryStatus` from `src/app/actions/tracking/delivery-actions.ts` (no production callers after the single-source change) and pruned their cases from `delivery-actions.security.test.ts`.

### Sync deliveries-mirror driver_id on reassignment

**Completed:** `fix/driver-tracking-hardening` (2026-06-17)

The mirror upsert's UPDATE branch now also sets `driverId` (when resolved), so a reassigned order's mirror stays attributed to the current driver (the end-shift guard counts by `driver_id`).
