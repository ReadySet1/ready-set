# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Development
pnpm dev                    # Start dev server (Next.js with 4GB Node memory)
pnpm build                  # Production build (runs prisma generate first)
pnpm lint                   # ESLint
pnpm typecheck              # TypeScript validation

# Testing
pnpm test                   # Jest unit tests
pnpm test:unit:watch        # Jest in watch mode
pnpm test:e2e               # Playwright E2E tests
pnpm test:e2e:ui            # Playwright with UI
pnpm test:all               # Run all tests (unit, integration, e2e)

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
- Always filter with `where: { deletedAt: null }` in queries

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
- Coverage threshold: 70%
- Tests in `src/**/__tests__/` or `*.test.ts`

**Playwright** (`playwright.config.ts`):
- E2E tests in `e2e/`
- Auth state cached in `.auth/` via global setup
- Base URL: `http://localhost:3000`

### External Integrations

- **CaterValley**: Catering order API (`src/app/api/cater-valley/`)
- **Cloudinary**: Image CDN (see below)
- **Stripe**: Payment processing
- **Sentry**: Error monitoring
- **SendGrid/Resend**: Email notifications
- **Mapbox**: Maps and geocoding
- **Supabase Realtime**: WebSocket-based live tracking

### Cloudinary Image CDN

Static images are served from Cloudinary CDN for optimized delivery. See [docs/cloudinary-integration.md](docs/cloudinary-integration.md) for complete documentation.

**Configuration**:
- Cloud name: `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
- Images stored under `ready-set/` folder in Cloudinary
- Module: `src/lib/cloudinary/`

**Usage**:
```typescript
import { getCloudinaryUrl } from '@/lib/cloudinary';

// Basic usage - auto optimization (WebP/AVIF, quality)
<Image src={getCloudinaryUrl('logo/logo-dark')} alt="Logo" width={140} height={30} />

// With transformations
<Image
  src={getCloudinaryUrl('hero/hero-bg', {
    width: 1920,
    height: 1080,
    crop: 'fill',
    quality: 80
  })}
  alt="Hero"
  fill
/>
```

**Path Mapping**:
- Local: `/images/logo/logo-dark.png`
- Cloudinary public ID: `logo/logo-dark`
- Full URL: `https://res.cloudinary.com/{cloud}/image/upload/f_auto,q_auto/ready-set/logo/logo-dark`

**Migration Script**: `scripts/migrate-images-to-cloudinary.ts`

### TypeScript Paths

```typescript
import { something } from '@/lib/something'     // src/lib/
import { Component } from '@components/...'     // src/components/
import { util } from '@lib/...'                 // src/lib/
```
