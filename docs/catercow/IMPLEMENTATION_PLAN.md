# CaterCow Integration — Implementation Plan

**Status:** Planning only — DO NOT implement until CaterCow approves the API contract
**Owner:** Ready Set Dev Team
**Author:** Emmanuel Alanis
**Created:** 2026-05-01

---

## Goal

Onboard **CaterCow** as a second partner on the Ready Set partner order API, reusing the existing CaterValley infrastructure rather than standing up a parallel stack. Generalize the integration so future partners can be added with config + a key, not new endpoints.

**Trigger to start work:** CaterCow signs off on `docs/catercow/API_CONTRACT.md`.

---

## Strategy

The current `src/app/api/cater-valley/*` routes are functionally partner-agnostic — they read auth headers, validate the payload, calculate pricing, and persist to `catering_requests`. The only CaterValley-specific bits are:

1. The hardcoded `partner: "catervalley"` / `x-api-key: "ready-set"` check
2. The `CV-` prefix on `orderNumber`
3. The `brokerage: "CaterValley"` value written to the DB
4. Webhook callback target (CaterValley's URL)

We will:

1. Refactor the existing routes under a **partner-agnostic namespace** (`/api/partners/*`)
2. Keep `/api/cater-valley/*` as a thin alias for backward compatibility (CaterValley is live in prod and we don't want to break them)
3. Drive partner identity from a **partner registry** (DB table or config) keyed by the `partner` header
4. Add CaterCow as a registry entry — no new route code required

---

## Phase 1 — Refactor (Partner-Agnostic Foundation)

**Estimated effort:** 2–3 days
**Risk:** Medium — touches live CaterValley flow

### 1.1 Partner registry

New table `api_partners`:

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `slug` | text unique | matches `partner` header value, e.g. `"catervalley"`, `"catercow"` |
| `display_name` | text | "CaterValley", "CaterCow" |
| `api_key_hash` | text | bcrypt-hashed `x-api-key` |
| `order_number_prefix` | text | "CV-", "CC-" |
| `webhook_url` | text nullable | partner status webhook |
| `webhook_secret` | text | HMAC signing secret |
| `is_active` | boolean default true | |
| `created_at`, `updated_at` | timestamptz | |

Seed CaterValley row at migration time using the current hardcoded values (hashed) so no behavior change.

### 1.2 Auth middleware

Replace hardcoded check in `src/app/api/cater-valley/_lib/auth-utils.ts` with a partner lookup:

```ts
async function authenticatePartner(req: Request): Promise<Partner | null> {
  const slug = req.headers.get("partner");
  const apiKey = req.headers.get("x-api-key");
  if (!slug || !apiKey) return null;

  const partner = await prisma.apiPartner.findUnique({
    where: { slug, isActive: true, deletedAt: null }
  });
  if (!partner) return null;
  if (!(await bcrypt.compare(apiKey, partner.apiKeyHash))) return null;

  return partner;
}
```

### 1.3 Move routes

- Copy `src/app/api/cater-valley/orders/{draft,update,confirm}/route.ts` → `src/app/api/partners/orders/{draft,update,confirm}/route.ts`
- Generalize:
  - `orderNumber` uses `partner.order_number_prefix + orderCode` (was hardcoded `CV-`)
  - `brokerage` field uses `partner.display_name` (was hardcoded `"CaterValley"`)
  - Webhook dispatch uses `partner.webhook_url` (was hardcoded CaterValley URL)
- Leave `src/app/api/cater-valley/*` in place but redirect internally to the new handlers (thin wrapper). This keeps CaterValley's live integration unchanged while we migrate.

### 1.4 Webhook signing

Add HMAC-SHA256 signing to outbound webhook payloads:
```ts
const signature = crypto
  .createHmac("sha256", partner.webhookSecret)
  .update(body)
  .digest("hex");
res.headers.set("x-readyset-signature", signature);
```

CaterValley currently doesn't verify signatures, so this is additive — they can opt in later.

### 1.5 Tests

- Update existing CaterValley unit/integration tests to hit the new `/api/partners/*` paths via the alias
- Add test cases:
  - Unknown partner slug → 401
  - Wrong API key → 401
  - Inactive partner → 401
  - Two partners hitting same endpoint, each gets correct prefix/brokerage

**Files affected:**
- `prisma/schema.prisma` — new `ApiPartner` model
- `src/app/api/cater-valley/_lib/auth-utils.ts` — replaced
- `src/app/api/partners/**` — new routes
- `src/app/api/cater-valley/**` — converted to aliases
- `src/lib/services/partner-registry.ts` — new
- `src/lib/services/partner-webhook.ts` — new (HMAC signing)
- Tests under `src/app/api/cater-valley/__tests__/` and new `src/app/api/partners/__tests__/`

---

## Phase 2 — CaterCow Onboarding

**Estimated effort:** 0.5 day
**Risk:** Low — pure config

### 2.1 Provision

- Generate production + staging API keys for CaterCow (`openssl rand -hex 32`)
- Run seed script to insert CaterCow `api_partners` row (staging first)
- Deliver keys + webhook secret to CaterCow via secure channel (1Password share)

### 2.2 Verify

- Bruno collection: duplicate CaterValley collection at `docs/bruno-api-tests/ReadySet-API-Tests/CaterCow/`, swap headers
- Smoke test: draft → update → confirm → simulate webhook on staging
- Confirm `orderNumber` starts with `CC-`, `brokerage = "CaterCow"`, webhook posts to CaterCow's URL with valid HMAC

### 2.3 Cutover

- Once CaterCow's team validates against staging, rotate to production keys
- Monitor first 10 production orders manually

---

## Phase 3 — Documentation & Handoff

**Estimated effort:** 0.5 day

- Promote `docs/catercow/API_CONTRACT.md` from v0.1 → v1.0
- Update `docs/catervalley/API_CONTRACT.md` with note that the underlying API is now partner-agnostic
- Add `docs/partners/README.md` describing the partner registry pattern for future onboarding
- Update `CLAUDE.md` "External Integrations" section

---

## Out of Scope (for now)

- **Pulling data from CaterCow's API** — depends on what their docs reveal. Treat as a follow-up scoped after we receive their contract.
- **Custom pricing per partner** — current pricing is global. If CaterCow negotiates different rates, add `partner.pricing_config_id` linking to a `delivery_configurations` row. Defer until needed.
- **Partner self-service portal** — admins still rotate keys via DB / Prisma Studio. Build a UI only if we onboard a third partner.

---

## Open Questions for CaterCow

These should be resolved before/during contract review (see "Onboarding Checklist" in `API_CONTRACT.md`):

1. Webhook URL — production and staging?
2. Are they OK with `partner: catercow` as the header value, or do they want something else?
3. HMAC verification on their side — yes/no? (Affects whether we generate a signing secret day one or later)
4. Volume expectation — peak orders/day? (Drives whether we need rate limit tuning)
5. Their API docs — what shape, what auth, what we get from integrating against them?

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Refactor breaks live CaterValley flow | Keep `/api/cater-valley/*` as thin aliases; full regression test before merge; deploy to staging and let CaterValley smoke test |
| API key leak | Hash at rest (bcrypt); rotate via admin script; never log raw key |
| Webhook delivery failures | Retry with exponential backoff (5 attempts / ~30 min); log failures to Sentry; expose admin retry endpoint |
| CaterCow's payload deviates from contract | Strict Zod validation at the route boundary; clear 400 errors with field-level messages |
| Two partners send same `orderCode` | Order uniqueness is per-partner; DB constraint becomes `(partner_id, orderCode)` |

---

## Success Criteria

- [ ] CaterValley's existing integration continues to work unchanged in production
- [ ] CaterCow can submit a draft → update → confirm flow on staging using their issued key
- [ ] CaterCow receives valid HMAC-signed webhook callbacks for the full status lifecycle
- [ ] Adding a third partner in the future requires only a DB row + key, no code changes
- [ ] All new routes covered by unit + integration tests; coverage thresholds maintained
- [ ] `pnpm pre-push-check` and `pnpm test:ci` pass

---

## Timeline (once approved)

| Week | Work |
|------|------|
| W1 | Phase 1 — refactor + tests + staging deploy |
| W2 | CaterValley regression validation in staging |
| W3 | Phase 2 — CaterCow staging onboarding + their integration testing |
| W4 | Phase 2 — production cutover + Phase 3 docs |

---

## Changelog

### 2026-05-01
- Initial plan drafted alongside `API_CONTRACT.md` v0.1
