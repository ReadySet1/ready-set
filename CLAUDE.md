# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Prerequisites

- Node.js >=20.0.0 <23.0.0
- pnpm >=10.0.0 (enforced via `preinstall` hook)

## Environment Setup

- Copy `.env.example` to `.env.local` for local development
- Database commands use `dotenv -e .env.local` prefix
- Required: `DATABASE_URL`, `DIRECT_URL`, Supabase keys

## Build & Development Commands

```bash
# Development
pnpm dev                    # Start dev server (Next.js with 4GB Node memory)
pnpm build                  # Production build (runs prisma generate first)
pnpm lint                   # ESLint
pnpm typecheck              # TypeScript validation

# Testing
pnpm test                   # Jest unit tests
pnpm test -- path/to/test   # Run a single test file
pnpm test:unit:watch        # Jest in watch mode
pnpm test:coverage          # Jest with coverage report
pnpm test:e2e               # Playwright E2E tests
pnpm test:e2e:ui            # Playwright with UI
pnpm test:all               # Run all tests (unit, integration, e2e)

# Pre-push validation (run before PRs)
pnpm pre-push-check         # typecheck + lint + prisma validate
pnpm test:ci                # run tests with coverage

# Database
pnpm db:generate            # Generate Prisma client
pnpm studio                 # Open Prisma Studio
```

## Architecture Overview

**Stack**: Next.js 15 (App Router), PostgreSQL, Prisma 6, Supabase Auth, TanStack Query, Shadcn UI

### Directory Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (site)/            # Public pages (route group)
│   ├── (backend)/         # Protected admin/internal pages
│   ├── api/               # API routes (~50 endpoints)
│   └── actions/           # Server actions for forms
├── components/            # React components (feature-based folders)
│   └── ui/                # Shadcn UI components
├── lib/                   # Core business logic
│   ├── auth/              # Session management, token refresh, API interceptors
│   ├── cache/             # Cache invalidation utilities
│   ├── calculator/        # Pricing/delivery cost calculations
│   ├── db/                # Prisma client configurations
│   └── services/          # Business logic services
├── services/              # High-level service layer
├── utils/                 # Helper functions
│   └── supabase/          # Supabase client factories
├── contexts/              # React contexts (UserContext, ApplicationSessionContext)
├── hooks/                 # Custom React hooks
├── types/                 # TypeScript definitions
└── middleware/            # Auth and route protection
```

### Key Patterns

**Authentication Flow**: Supabase Auth with enhanced session management
- `src/contexts/UserContext.tsx` - Main auth context with `useUser()` hook
- `src/lib/auth/session-manager.ts` - Session fingerprinting & cross-tab sync
- `src/lib/auth/token-refresh-service.ts` - Automatic background refresh
- `src/utils/supabase/client.ts` - Browser client (singleton)
- `src/utils/supabase/server.ts` - Server-side client (SSR-safe)

**Database**: PostgreSQL with Prisma
- Schema: `prisma/schema.prisma`
- Soft-delete pattern: All models use `deletedAt`, `deletedBy`, `deletionReason`

**IMPORTANT - Soft Delete**: All queries MUST filter deleted records:
```typescript
// ✅ ALWAYS include soft-delete filter
prisma.profile.findMany({ where: { deletedAt: null } })

// ❌ NEVER query without filter (will include deleted records)
prisma.profile.findMany()
```

**Service Layer Hierarchy**:
```
API Route → Server Action → Service Layer → Utils → Prisma
```

**State Management**:
- Server state: TanStack Query (5min stale, 10min GC)
- Auth state: UserContext
- Minimal global state: Zustand (`src/store/`)

**Route Protection**: Role-based via middleware
- Routes: `/admin/*`, `/driver/*`, `/client/*`, `/helpdesk/*`
- Config: `src/middleware/routeProtection.ts`

### Delivery Calculator — Vendor Pricing

**Config Resolution**: DB-first with in-memory fallback
- `src/app/api/calculator/config/route.ts` queries `delivery_configurations` table first
- Falls back to in-memory configs from `src/lib/calculator/client-configurations.ts`
- Changes saved via the Adjust Vendor Pricing UI take effect immediately

**Adjust Vendor Pricing Tab** (Admin > Calculator > 4th tab):
- `src/components/calculator/VendorPricingTab.tsx` — Vendor selection + save wrapper
- `src/components/calculator/VendorPricingEditor.tsx` — Main accordion-based form editor
- Sub-components in `src/components/calculator/vendor-pricing/`:
  - `PricingTiersEditor.tsx`, `DriverPaySettingsEditor.tsx`, `BridgeTollEditor.tsx`
  - `ZeroOrderSettingsEditor.tsx`, `AdvancedFlagsEditor.tsx`
- Validation: `src/types/vendor-pricing.ts` (Zod schema) + `validateConfiguration()` from client-configurations
- API: `POST /api/calculator/configurations` with audit logging (userId, changed fields, timestamps)

**Seed Script**: `scripts/seed-delivery-configurations.ts` — Seeds in-memory configs to DB

### Internal Dashboards (QA + Tasks)

Two admin-only pages render generated JSON for cross-team visibility:

- `/admin/qa-board` — `src/app/(backend)/admin/qa-board/page.tsx`
- `/admin/tasks-board` — `src/app/(backend)/admin/tasks-board/page.tsx`
- Components: `src/components/internal-boards/{QaBoard,TasksBoard,VerdictBadge}.tsx`
- Types: `src/types/internal-boards.ts`
- Data: `src/data/{qa-board,tasks-board}.json` — **generated, do not hand-edit**

The JSON files are produced from workspace-level sources (one level up from `repos/ready-set/`):

- Tasks board source: `meetings/shared/tasks-board.json` (hand-edited)
- QA board source: `docs/ready-set/qa/YYYY-QN-test-cases.csv` (re-exported from Jira/TestRail each quarter)

Regenerate via:

```bash
node meetings/shared/build-tasks-board.mjs        # tasks board
node docs/ready-set/qa/build-qa-board.mjs         # QA board
```

Cross-link convention: tasks promoted from a QA failure carry `relatedQa: "REA-OMG-NN"` in `tasks-board.json`. The QA page renders a "Tracked as task" badge on linked failures; the Tasks page renders a "From QA" badge on linked tasks. See workspace `CLAUDE.md` "Tasks board" section for the full promotion convention.

### Testing

**Jest** (`jest.config.js`):
- Environment: jsdom
- Coverage threshold: 36% lines/statements, 30% branches/functions
- Tests in `src/**/__tests__/` or `*.test.ts`

**Playwright** (`playwright.config.ts`):
- E2E tests in `e2e/`
- Auth state cached in `.auth/` via global setup
- Base URL: `http://localhost:3000`

### TypeScript Configuration

- Strict mode enabled with `noUncheckedIndexedAccess`
- Tests excluded from build (`tsconfig.json` excludes `**/*.test.ts`)
- Run `pnpm typecheck` before commits

### Git Workflow

**IMPORTANT: All new work targets `development` first, then `development` is promoted to `main`.**

- **Branch flow:** `feature/* → development → main`. Open every PR against `development`, never directly against `main`.
- The only PRs that target `main` are periodic promotion PRs from `development` (typically named `chore/sync-main-into-development` or similar).
- Never merge directly into `main` or `development` - always create a PR first.
- PRs require passing CI checks before merge.
- Use feature branches: `feature/REA-XXX-description` (or `refactor/...`, `fix/...`, `chore/...` as appropriate).
- Run `pnpm pre-push-check` and `pnpm test:ci` before creating PRs.
- **Conventional commits required** — see Versioning section below for the prefixes that drive release-please.

### Versioning

The app's version (`package.json`) is managed by [`release-please`](https://github.com/googleapis/release-please) — humans never bump it manually. The bot watches `main`; after each dev → main sync it opens a `chore(main): release X.Y.Z` PR that:

- Bumps `package.json` `version`
- Cuts the current `## [Unreleased]` block of `CHANGELOG.md` into a `## [X.Y.Z] - YYYY-MM-DD` section
- Creates the git tag and a GitHub Release when merged

**Conventional commit prefixes → bump level:**

| Prefix | Section in CHANGELOG | Bump |
|---|---|---|
| `feat:` | Added | minor |
| `fix:` | Fixed | patch |
| `perf:` | Performance | patch |
| `security:` | Security | patch |
| `refactor:` | Changed | patch |
| `design:` | Changed | patch |
| `docs:` | Documentation | patch |
| `test:` / `chore:` / `build:` / `ci:` | (hidden) | patch |
| Any of the above with `!` (e.g. `feat!:`) or `BREAKING CHANGE:` footer | — | major |

Config lives in `release-please-config.json` + `.release-please-manifest.json`; workflow in `.github/workflows/release-please.yml`.

**Independently versioned (NOT managed by release-please):**

- **Partner API contracts** in `docs/catercow/API_CONTRACT.md` and `docs/catervalley/API_CONTRACT.md` — these are partner-facing agreements (currently v0.2 and v1.0 respectively) that evolve on their own cycle. Bumping them is a manual doc edit + changelog entry in the doc itself.
- **Database schema** — versioned implicitly by Prisma's timestamped migration filenames (`prisma/migrations/YYYYMMDDHHMMSS_*`).

`/api/health` returns the current `package.json` version as `version` — useful for verifying which build is live in a given environment.

### External Integrations

- **CaterValley**: Catering order API (`src/app/api/cater-valley/`)
- **Cloudinary**: Image CDN (see below)
- **Stripe**: Payment processing
- **Sentry**: Error monitoring
- **SendGrid/Resend**: Email notifications
- **Mapbox**: Maps and geocoding
- **Supabase Realtime**: WebSocket-based live tracking

### Real-Time Features (Supabase Realtime)

- `driver-locations` channel for live GPS updates
- Feature flags: `NEXT_PUBLIC_FF_USE_REALTIME_LOCATION_UPDATES`, `NEXT_PUBLIC_FF_USE_REALTIME_ADMIN_DASHBOARD`
- Admin dashboard: `/admin/tracking`
- Test driver simulator: `/admin/tracking/test-driver`

### Cloudinary Image CDN

See [docs/cloudinary-integration.md](docs/cloudinary-integration.md) for complete documentation.

- Module: `src/lib/cloudinary/`
- Use `getCloudinaryUrl('path/to/image')` for all static images
- Path mapping: `/images/logo/logo-dark.png` → `getCloudinaryUrl('logo/logo-dark')`

### TypeScript Paths

```typescript
import { something } from '@/lib/something'     // src/*
import { Component } from '@components/...'     // src/components/*
import { util } from '@lib/...'                 // src/lib/*
import styles from '@styles/...'                // src/styles/*
```
