# Architecture Remediation Plan

> **Status:** actionable plan (forward-looking). Pair with the strictly-descriptive [`ARCHITECTURE.md`](../ARCHITECTURE.md), specifically §10 "Known gaps & red flags."
> **Source:** external review of `ARCHITECTURE.md` captured in [`../feedback.md`](../feedback.md) — 2026-05-19.
> **Scope:** the five highest-impact gaps in the main app's architecture. Excludes feature work, performance tuning, and the in-flight tracking state-machine work.

---

## How to use this document

- Each item is an independent unit of work — they can be picked up in any order, though §0 sequences them by recommended priority.
- Each item carries an **acceptance criteria** block. Don't mark an item "done" until every criterion is verifiable in code (typecheck, test, grep, or runtime check).
- When an item lands, move it from this doc into a closed-items appendix and append a `JOURNAL.md` bullet noting the PR and the verification used.
- This is not a Gantt chart. Effort estimates are coarse calendar days for one engineer; treat them as comparative, not exact.

---

## 0. Sequencing & priority

| # | Item                                       | Risk if ignored                                                              | Effort  | Order | Why this order                                                                  |
| - | ------------------------------------------ | ---------------------------------------------------------------------------- | ------- | ----- | ------------------------------------------------------------------------------- |
| 2 | Soft-delete enforcement via Prisma extension | Silent data leakage of deleted users/orders to UI; the doc already flags drift | ~2–3 days | **1** | Catastrophic if it fires. Mechanism is well-understood. Ship before more routes accumulate. |
| 5 | ESLint boundary rules                       | Architectural decay continues, harder to undo later                          | ~1 day  | **2** | Prevents regression in #2 *and* future-proofs the lib/services split. No runtime risk. |
| 3 | DriverLocation scalability (partition / dedup / CHECK) | Table bloat → slow tracking dashboard; duplicate inserts; bad coordinates land  | ~3–5 days | **3** | Pure DB work, needs a migration plan and coordination with archival. Retention answer is in. |
| 1 | Distributed rate limiting & circuit breaker | Effective limits multiplied by instance count; circuit breaker never trips globally | ~3–5 days | **4** | Highest variance — requires infra decision (Upstash vs DB function) before estimating. Defer until that decision is made. |

Item #4 (Gate debug & test routes) shipped 2026-05-19 — see **Appendix A: Shipped** at the bottom of this doc.

Items #5 (ESLint boundaries) has no infra prerequisites and no dependency on #2 — could be picked up in parallel by a separate contributor.

---

## 1. Distributed rate limiting & circuit breaker

### Current state (from ARCHITECTURE.md §5.5 and §10)

`src/lib/rate-limiting/location-rate-limiter.ts` uses an in-memory `Map`. The email circuit breaker in `src/services/email-notification.ts` is also in-memory. On a multi-instance deployment (Vercel serverless or N containers), each instance has its own counter. Effective rate limit per driver = `N × intended_limit`; circuit breaker for outbound email will not trip globally when SendGrid/Resend is down.

`src/app/api/application-sessions/route.ts` already carries an explicit `TODO: Implement database function for atomic rate limiting`.

### Decision required first

Pick the shared-state backend before estimating in detail:

| Option         | Pros                                                                    | Cons                                                                                          |
| -------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Upstash Redis (REST)** | Lowest latency for serverless; per-request HTTP; usually free at our volume; already used by partner-idempotency (see PR #392) | New SaaS dependency, new secret to rotate, another vendor in the auth chain                  |
| **Postgres function** | No new infra; uses the DB we already own; atomic via row-level locks or advisory locks | Adds load to Supabase Postgres; ~5–10 ms per call vs ~1 ms Redis; cron required for cleanup |

**Recommendation:** Upstash if partner-idempotency is already there (consistency); Postgres function if we want to avoid adding to the vendor surface. Either is acceptable.

### Proposed fix

1. Introduce `src/lib/rate-limiting/sliding-window.ts` exposing a single `checkAndIncrement(key, limit, windowMs)` returning `{ allowed: boolean, retryAfterMs?: number }`. Backend is the chosen primitive; callers do not know which.
2. Replace the in-memory `Map` in `location-rate-limiter.ts` with the new primitive.
3. Replace the in-memory state in the email circuit breaker with a key like `circuit:email:resend` storing `{ state, openedAt, halfOpenAttempts }` (TTL-bounded).
4. Resolve the `application-sessions/route.ts` TODO using the same primitive.
5. Add a `pnpm tsx scripts/test-rate-limiter.ts` smoke script that fires N parallel requests across two simulated instances and asserts the combined count never exceeds the limit.

### Acceptance criteria

- `grep -r "new Map()" src/lib/rate-limiting src/services/email-notification.ts` returns no in-memory rate-limit or circuit-breaker state.
- Smoke script demonstrates correct behavior across two simulated callers.
- Unit tests cover: under-limit, at-limit, over-limit, window rollover, retry-after correctness.
- `TODO` removed from `application-sessions/route.ts`.

### Out of scope here

Rate limiting strategy beyond sliding window (e.g., token bucket for burst tolerance). Migrate later if needed.

---

## 2. Soft-delete enforcement via Prisma Client Extension

### Current state (from ARCHITECTURE.md §5.4 and [SOFT_DELETE_PATTERN.md](./SOFT_DELETE_PATTERN.md))

Every soft-deletable model carries `deletedAt`, `deletedBy`, `deletionReason`. The rule "always filter `deletedAt: null`" is convention only — no Prisma middleware, no client extension, no schema constraint. The doc already notes spot-checks show older `findMany()` calls without the filter.

### Proposed fix

Implement a Prisma Client Extension that auto-injects the soft-delete filter on read operations. Prisma 6 supports `$extends` with a `query` component; this is the modern replacement for the deprecated `$use` middleware.

**Models to cover** (matches §6 soft-delete matrix):

`Profile`, `Driver`, `DriverLocation`, `DriverShift`, `Delivery`, `Address`, `CateringRequest`, `OnDemand`, `JobApplication`, `ApiPartner`.

**Operations to intercept:**

`findFirst`, `findFirstOrThrow`, `findMany`, `findUnique`, `findUniqueOrThrow`, `count`, `aggregate`, `groupBy` — plus relational `include` / `select` recursively.

**Opt-out mechanism (required):**

Some internal paths legitimately need to see deleted rows:

- `userSoftDeleteService` and `userBulkOperationsService` (restore/purge flows)
- `UserAudit` views showing historical deletions
- Admin "deleted users" UI if/when it exists
- Data archival jobs (`/api/admin/data-archiving`)

Two acceptable opt-out patterns; pick one:

| Pattern                              | How                                                                                                | Tradeoff                                  |
| ------------------------------------ | -------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| **Separate raw client**              | Export `prismaRaw` alongside extended `prisma`; admin code imports `prismaRaw`.                    | Explicit; visible in PR review.           |
| **Per-query escape hatch**           | Pass `{ includeSoftDeleted: true }` in extra args that the extension respects.                     | Easier to add per-call; easier to abuse.  |

**Recommendation:** separate raw client. It's a one-character grep target (`prismaRaw`) for security review.

### Migration steps

1. Implement the extension in `src/lib/db/soft-delete-extension.ts` with comprehensive tests.
2. Export both `prisma` (extended) and `prismaRaw` (unextended) from `src/lib/db/index.ts`.
3. Land the extension behind a feature flag that defaults to `off` for one deploy cycle so production data can be observed for any behavior changes.
4. Flip to `on`; audit admin paths that broke; switch those to `prismaRaw`.
5. Remove the flag and the unextended export from the default `prisma` import path so future code can't accidentally use the raw client.

### Acceptance criteria

- Extension implementation + unit tests covering every intercepted operation including relational `include`/`select`.
- All callers of `prisma` on soft-deletable models verified via test (or grep) to either inherit the filter or use `prismaRaw` deliberately.
- An e2e test creates a `Profile`, soft-deletes it, calls `findMany()` via extended client, asserts the row is absent. Same test asserts `prismaRaw.profile.findMany()` returns it.
- `JOURNAL.md` bullet documents the audit of `prismaRaw` callers and the rationale for each.

### Risk during rollout

The extension is "fail-closed" by nature — it hides rows. If an admin UI was relying on seeing deleted users *and* was not migrated to `prismaRaw`, it will silently return empty results. Mitigation: feature flag (step 3) and a one-week monitoring window with Sentry breadcrumbs on every extension-injected filter.

---

## 3. DriverLocation scalability

### Current state (from ARCHITECTURE.md §4.3 and §10)

`DriverLocation` is a PostGIS-backed table receiving GPS points from drivers. It has no automatic TTL, no partitioning, no schema-level coordinate validation, and no dedup. Archival is manual via `/api/admin/data-archiving`. No reconnect handler, no backpressure on ingestion. The doc separately flags that a retrying mobile app will create duplicate rows.

### Proposed fix

Three independently-shippable changes; tackle in the order listed.

#### 3a. Schema-level coordinate validation

Add `CHECK` constraints so invalid points cannot land via any path (route, Studio, raw SQL):

```sql
ALTER TABLE driver_locations
  ADD CONSTRAINT driver_locations_lat_range
    CHECK (ST_Y(location::geometry) BETWEEN -90 AND 90),
  ADD CONSTRAINT driver_locations_lng_range
    CHECK (ST_X(location::geometry) BETWEEN -180 AND 180);
```

Effort: <½ day including migration + test.

#### 3b. Deterministic deduplication

Mobile app generates a hash from `(driverId, recordedAt_iso, lat_round_5, lng_round_5)` and includes it as `client_dedup_key` in the POST body. Schema adds a unique index on `(driver_id, client_dedup_key)`. Server-side: insert with `ON CONFLICT DO NOTHING`. The endpoint returns 200 either way so the client doesn't retry.

Effort: ~1 day server-side + coordinated mobile-app release (separate from this plan but blocking).

#### 3c. Native PostgreSQL partitioning

Convert `driver_locations` to a partitioned table by `recorded_at` (daily partitions). Steps:

1. Create `driver_locations_partitioned` (PARTITION BY RANGE on `recorded_at`).
2. Backfill from `driver_locations` in batches.
3. Atomically swap names in a maintenance window.
4. Adopt `pg_partman` or a nightly cron to create the next 14 days' partitions and detach partitions older than the retention window (**resolved 2026-05-19: 30 days hot**, then cold storage via the existing `ArchiveBatch` flow).
5. Update `ArchiveBatch` flow to drop detached partitions instead of `DELETE`ing rows individually.

Effort: ~3–5 days because of the swap + the partman cron + coordination with the existing archival job. Retention answer is in (30 days hot).

### Acceptance criteria

- 3a: insert with lat=999 fails with a constraint violation in a test. `prisma db push` reflects the constraints.
- 3b: integration test fires the same POST twice in <100 ms apart; only one row lands. Endpoint returns 200 both times.
- 3c: `\d+ driver_locations` shows partitioning; nightly cron creates tomorrow's partition; dropping a partition takes <100 ms vs the current `DELETE` baseline; `ArchiveBatch` flow updated and exercised end-to-end.
- Retention policy written into ARCHITECTURE.md §4.3 once decided.

### Out of scope here

- Realtime reconnect handler on `RealtimeClient`. Track separately — it's a client-SDK config change, not a schema change.
- Backpressure / load-shedding on the ingestion route. Becomes relevant only after partitioning makes ingestion not the bottleneck.

---

## 4. Gate debug & test routes — **SHIPPED 2026-05-19**

Moved to [Appendix A: Shipped](#appendix-a-shipped) at the bottom of this doc.

---

## 5. Enforce architectural boundaries via ESLint

### Current state (from ARCHITECTURE.md §3 and §10)

The intended layering is `app/api/* and app/actions/*  →  services/*  →  lib/*  →  Prisma`. This is convention only; older routes still import Prisma directly.

### Proposed fix

Use `no-restricted-imports` (built into ESLint, no plugin dependency) to forbid the wrong-direction imports:

```js
// .eslintrc additions (sketch — adapt to actual config format)
{
  files: ['src/app/api/**/*.ts', 'src/app/actions/**/*.ts'],
  rules: {
    'no-restricted-imports': ['error', {
      paths: [
        { name: '@prisma/client', message: 'API routes and actions must call services, not Prisma directly.' },
      ],
      patterns: [
        { group: ['@/lib/db', '@/lib/db/*'], message: 'API routes and actions must call services, not Prisma directly.' },
      ],
    }],
  },
}
```

**Migration with eslint-disable budget:** existing offenders get a one-time `// eslint-disable-next-line no-restricted-imports -- LEGACY (REA-XXX): migrate to service` comment so CI stays green. New code can't add violations. Existing offenders close over time as touched files get refactored.

For finer-grained rules later (e.g. forbid `lib/*` from importing `services/*`, or feature-folder isolation), reach for `eslint-plugin-boundaries`. Not needed for v1.

### Acceptance criteria

- `.eslintrc` (or `eslint.config.js`) includes the rule scoped to `src/app/api/**` and `src/app/actions/**`.
- `pnpm lint` flags zero violations after the one-time exemption pass.
- All legacy exemptions are commented with a ticket ID and the reason.
- ARCHITECTURE.md §3 updated to note that the layering is now lint-enforced (not just convention).

### Out of scope here

Cyclic-dependency detection, feature-folder isolation, banned-globals enforcement — separate concerns.

---

## Items intentionally left out of this plan

These are real gaps in ARCHITECTURE.md but not addressed here, either because they need a separate discussion or they belong in feature work:

- **Mapbox central wiring.** No code-quality fix; needs a feature-owner to decide on a unified client.
- **Stripe partial wiring.** Investigation task, not a remediation. Could be dead code; could be one missing import. Triage before planning.
- **Realtime reconnect handler.** Belongs with the in-flight tracking state-machine work (REA-DRT-07 line in `STATUS.md`).
- **Test debt (~30 TODOs in test files).** Belongs in a separate test-debt sprint, not this plan.
- **Calculator role check TODO** in `src/app/api/calculator/templates/route.ts`. Becomes trivial once #2 (Prisma extension) is in — same auth surface change.

---

## Open questions to resolve before scheduling

1. **Item #1:** Upstash or Postgres function? (Affects effort and a new vendor decision.)
2. **Item #2:** Do we have any production code path that *intentionally* reads soft-deleted rows today and is not on the obvious "admin / restore" list? An hour of grep before starting will save a rollback.

_Resolved questions (kept for traceability):_

- ~~**Item #3c:** Hot-retention window for `DriverLocation`?~~ → **30 days** (decision 2026-05-19). Captured in item #3c above.

---

## Appendix A: Shipped

Items that have landed. Kept here (not deleted) so the doc remains a complete record of remediation work.

### #4 — Gate debug & test routes

- **Shipped:** 2026-05-19, PR `chore(security): gate debug & test routes [remediation #1]` against `development`.
- **Original problem:** `src/app/api/debug/env`, `src/app/api/debug/feature-flags`, `src/app/api/debug/users`, several `src/app/api/test-*` routes, and `src/app/highlight-ssr-test/` had no auth checks and were reachable in production.

**What landed:**

- New helper `src/lib/auth/dev-only-guard.ts` exporting `devOnlyGuard(): NextResponse | null` — returns a 404 when `NODE_ENV === 'production'`, null otherwise. Pattern for handlers: `const blocked = devOnlyGuard(); if (blocked) return blocked;` followed by `withAuth({ allowedRoles: ['SUPER_ADMIN'], requireAuth: true })`.
- **Deleted** (zero callers in `src/`, `e2e/`, `scripts/`): `src/app/api/debug/env/route.ts`, `src/app/api/debug/users/route.ts`.
- **Gated with `devOnlyGuard()` + `withAuth({ allowedRoles: ['SUPER_ADMIN'] })`:** `src/app/api/order/debug/route.ts`, `src/app/api/tracking/test/route.ts` (GET + POST), `src/app/api/test/catervalley-webhook/route.ts` (GET + POST; also `sentHeaders` / `headers` are routed through `redactHeaders` from `src/app/api/cater-valley/_lib/debug-guard.ts` so the `x-api-key` is never echoed even when the route runs), `src/app/api/test-sentry/route.ts` (existing `NODE_ENV` check replaced with the helper + added SUPER_ADMIN gate for defense in depth), `src/app/api/test-email/route.ts`.
- **Gated with `devOnlyGuard()` only:** `src/app/api/test-umami/route.ts` (low-sensitivity CORS check — no auth gain from SUPER_ADMIN).
- **Page gate:** `src/app/highlight-ssr-test/page.tsx` calls `notFound()` from `next/navigation` when `NODE_ENV === 'production'`.
- **Tests:** new `src/__tests__/lib/auth/dev-only-guard.test.ts` (4 cases) and two new cases added to `src/__tests__/api/order/debug.test.ts` covering 404-in-prod and 403-when-not-SUPER_ADMIN. The existing `cater-valley/debug` test still passes unchanged.
- **Untouched (already correctly gated):** `src/app/api/debug/feature-flags/route.ts` (NODE_ENV + ADMIN/SUPER_ADMIN), `src/app/api/cater-valley/debug/route.ts` (already uses `isDebugEnabled` + `redactHeaders`), `src/app/(backend)/test-sentry/page.tsx` (NODE_ENV-gated page).
- **Out of scope (confirmed during discovery):** `src/app/api/admin/sms-reminders/preview` and `src/app/api/drives-pipeline/preview` turned out to be production features called from admin client components, both already auth'd via `authorizeSmsAdmin()` / inline role check.

**Verification used:**

- `pnpm typecheck` ✅
- `pnpm lint` ✅
- `pnpm test src/__tests__/lib/auth/dev-only-guard.test.ts src/__tests__/api/order/debug.test.ts src/__tests__/api/cater-valley/debug.test.ts` ✅
- `grep -rn "api/debug/env\|api/debug/users" src e2e scripts` → 0 matches
- Production-build smoke: `NODE_ENV=production pnpm build && NODE_ENV=production pnpm start`, then `curl` against each formerly-open route returns `404`.
