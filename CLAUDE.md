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

**IMPORTANT: Always create a Pull Request before merging into `main`.**

- Never merge directly into `main` - always create a PR first
- PRs require passing CI checks before merge
- Use feature branches: `feature/REA-XXX-description`
- Run `pnpm pre-push-check` and `pnpm test:ci` before creating PRs

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
