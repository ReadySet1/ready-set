# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ready Set is a multi-user delivery service platform built with Next.js 15, TypeScript, PostgreSQL (via Prisma), and Supabase authentication. The application serves vendors, clients, drivers, admins, and helpdesk users with role-based access control.

## Development Commands

### Core Development
```bash
# Install dependencies (pnpm only - enforced by preinstall hook)
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Build without type checking (for faster builds)
pnpm build:no-typecheck

# Type checking only
pnpm typecheck

# Linting
pnpm lint

# Pre-push checks (type check + Prisma generate + lint)
pnpm pre-push-check
```

### Testing
```bash
# Unit tests (Jest)
pnpm test
pnpm test:unit:watch        # Watch mode
pnpm test:coverage          # With coverage

# End-to-end tests (Playwright)
pnpm test:e2e
pnpm test:e2e:ui           # With UI
pnpm test:e2e:headed       # Non-headless mode

# All tests
pnpm test:all
```

### Database (Prisma)
```bash
# Generate Prisma client
pnpm db:generate

# Open Prisma Studio (uses .env.local)
pnpm studio

# Generate client (alias)
pnpm prisma
```

### Calculator System
The calculator system manages pricing rules and client configurations:
```bash
# Apply calculator migrations
pnpm calculator:migrate

# Force migration (bypass checks)
pnpm calculator:migrate:force

# Check migration status
pnpm calculator:migrate:status

# Migrate data
pnpm calculator:data

# Full setup (migrate + generate + data + test)
pnpm calculator:setup
```

### Utility Scripts
```bash
# Test address creation
pnpm test:address

# Test nested forms
pnpm test:forms

# List Coolify resources
pnpm env:list

# Sync environment variables
pnpm env:sync
```

## Architecture

### Application Structure

**Next.js 15 App Router** - The project uses the new App Router with route groups:
- `src/app/(site)/` - Public-facing site pages (marketing, blog, etc.)
- `src/app/(backend)/` - Backend routes (dashboard, profile management)
- `src/app/api/` - API routes organized by resource
- `src/app/actions/` - Server actions for mutations

**Key Directories:**
- `src/components/` - React components organized by feature (AddressManager, Auth, Admin, CateringRequest, etc.)
- `src/lib/` - Shared utilities, API clients, auth logic
- `src/hooks/` - Custom React hooks
- `src/types/` - TypeScript type definitions
- `src/utils/` - Utility functions
- `src/middleware/` - Server middleware functions
- `src/contexts/` - React Context providers

### Authentication System

**Supabase Authentication** with enhanced session management:
- Uses `@supabase/ssr` for server-side auth
- Session management with automatic token refresh
- Device fingerprinting for session integrity
- Cross-tab synchronization via BroadcastChannel API
- Role-based access control (VENDOR, CLIENT, DRIVER, ADMIN, HELPDESK, SUPER_ADMIN)

**Protected Routes** (defined in `src/middleware.ts:7-18`):
- `/admin/*` - Admin, Super Admin, Helpdesk only
- `/dashboard` - All authenticated users
- `/client/*`, `/driver/*`, `/vendor/*`, `/helpdesk/*` - Role-specific
- `/profile` - Authenticated users

**Auth Flow:**
1. User signs in via `/sign-in` or OAuth
2. Middleware (`src/middleware.ts`) validates session on protected routes
3. Session manager (`src/lib/auth/session-manager.ts`) handles token refresh
4. API interceptor (`src/lib/auth/api-interceptor.ts`) automatically adds auth headers

**Important:** Session fingerprinting requires browser environment - it's disabled in middleware to prevent server-side errors.

### Database Schema (Prisma)

**Core Models:**
- `Profile` - User profiles with role (type field), soft deletes (deletedAt)
- `CateringRequest` - Catering orders with pricing tiers and driver assignments
- `OnDemand` - On-demand delivery requests
- `Address` - Shared addresses with geocoding (latitude/longitude)
- `PricingTier` - Tiered pricing based on headcount and food cost
- `CalculatorTemplate` - Configurable pricing calculator templates
- `PricingRule` - Rules for customer charges and driver payments
- `ClientConfiguration` - Client-specific calculator overrides
- `JobApplication` - Driver/staff applications with file uploads

**Key Relationships:**
- Profiles → CateringRequests (userId)
- CateringRequests → Addresses (pickup/delivery)
- CateringRequests → PricingTier (pricing calculation)
- Dispatches link drivers to orders (CateringRequest or OnDemand)

**Performance Indexes:** Dashboard queries have optimized indexes on `status + createdAt` and `type + deletedAt`.

### State Management

- **React Context** for user authentication state (`src/contexts/UserContext`)
- **React Query** (@tanstack/react-query) for server state management
- **Zustand** for lightweight client state
- **Form State** via React Hook Form with Zod validation

### Styling

- **Tailwind CSS** for utility-first styling
- **Shadcn UI** components (`src/components/ui/`)
- **Radix UI** primitives for accessible components
- **Framer Motion** for animations

## Important Patterns

### API Routes

API routes follow a consistent pattern:
```typescript
// src/app/api/[resource]/route.ts
export async function GET(request: NextRequest) {
  // 1. Get authenticated user via Supabase
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // 2. Validate authorization
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 3. Query database via Prisma
  const data = await prisma.resource.findMany({ where: { userId: user.id } });

  // 4. Return response
  return NextResponse.json(data);
}
```

### Type Safety

- **Strict TypeScript** enabled
- **Prisma types** auto-generated from schema
- **Zod schemas** for runtime validation
- Type definitions in `src/types/` organized by domain

### Error Handling

- API routes return structured errors: `{ error: string, details?: any }`
- UI uses `react-hot-toast` for user-facing error messages
- Enhanced auth error handler (`src/lib/auth/error-handler.ts`) with automatic recovery
- Upload errors tracked in `UploadError` table with correlation IDs

### File Uploads

File uploads use multi-step process:
1. Client uploads to storage (Supabase Storage or S3)
2. API route records metadata in `FileUpload` table
3. Temporary files cleaned up after processing
4. Errors logged to `UploadError` table

## Testing Strategy

### Unit Tests (Jest)
- Located in `src/__tests__/`
- Uses `@swc/jest` for fast TypeScript compilation
- Mocks for Supabase, Prisma, and Next.js APIs
- Run with `pnpm test`

### E2E Tests (Playwright)
- Located in `e2e/`
- Tests authentication flows, admin management, client/vendor dashboards
- Tests against development server (auto-started)
- Run with `pnpm test:e2e`

### Coverage Requirements
- 70% coverage threshold for branches, functions, lines, statements
- Excludes layout files, loading states, and Sanity CMS code

## Build Configuration

### TypeScript
- **Build-time type checking disabled** (`ignoreBuildErrors: true`) to prevent deployment failures
- Use `pnpm typecheck` for type checking during development
- Pre-push hooks run type checks automatically

### Prisma
- Client auto-generated on install (unless `PRISMA_SKIP_POSTINSTALL_GENERATE=true`)
- Must run `prisma generate` before build
- Uses connection pooling via `directUrl` for migrations

### Webpack
- Server-side: Prisma client bundled, pg externalized
- Prisma binaries copied to `.next/server/` in production builds
- Standalone output mode for containerization

## Role-Based Access Control (RBAC)

User roles determine access:
- **SUPER_ADMIN** - Full system access
- **ADMIN** - Admin dashboard, user management
- **HELPDESK** - Support functions, limited admin access
- **VENDOR** - Vendor dashboard, order management
- **CLIENT** - Client dashboard, place orders
- **DRIVER** - Driver dashboard, delivery management

**Middleware enforcement:** Admin routes check profile.type (case-insensitive) in `src/middleware.ts:74-98`.

**Component-level:** Use `useUser()` hook to check roles in UI components.

## Environment Variables

Key environment variables (see `.env.example`):
- `DATABASE_URL` - Prisma database connection (pooled)
- `DIRECT_URL` - Direct database connection (for migrations)
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Server-side Supabase admin key

## Common Gotchas

1. **Supabase Client Creation**: Always use `createClient()` from `@/utils/supabase/server` for server components/API routes, and `createBrowserClient()` from `@/utils/supabase/client` for client components.

2. **Soft Deletes**: Profile and Address models use `deletedAt` for soft deletes. Always filter `WHERE deletedAt IS NULL` when querying.

3. **Session Fingerprinting**: Only works in browser environment. Don't use in middleware or server components.

4. **Protected Routes**: Middleware redirects unauthenticated users to `/sign-in?returnTo=[original-path]`. Handle `returnTo` param in sign-in flow.

5. **Prisma Enums**: Enum values in database are UPPERCASE (e.g., `VENDOR`, `ADMIN`), but middleware checks are case-insensitive.

6. **Dashboard Metrics**: Use optimized queries with proper indexes. See `src/app/api/dashboard-metrics/` for examples.

7. **Calculator System**: Pricing rules stored in database, not hardcoded. Use `CalculatorTemplate` and `PricingRule` models for pricing logic.

8. **pnpm Only**: Project enforces pnpm via preinstall hook. Don't use npm or yarn.

## CI/CD

**GitHub Actions workflows are currently disabled** (archived in `.github/workflows-archive/`). The project uses manual deployment.

To restore workflows:
```bash
# Copy from archive
cp .github/workflows-archive/[workflow].yml .github/workflows/

# Remove any "if: false" conditions
# Commit and push
```

## Documentation

Comprehensive documentation in `docs/` organized by topic:
- `docs/api/` - API specifications
- `docs/authentication/` - Auth architecture
- `docs/deployment/` - Deployment guides
- `docs/testing/` - Test documentation
- `docs/to-implement/` - Feature planning

See `docs/README.md` for full documentation structure.
