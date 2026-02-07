# Getting Started Guide

Welcome to Ready Set! This guide will help you set up your local development environment and get the application running.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18.x or later
- **pnpm** 8.x or later (`npm install -g pnpm`)
- **Git**
- **PostgreSQL** (or access to a Supabase project)

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/ReadySet1/ready-set.git
cd ready-set

# 2. Install dependencies
pnpm install

# 3. Set up environment variables (see below)
cp .env.example .env.local

# 4. Generate Prisma client
pnpm db:generate

# 5. Start the development server
pnpm dev
```

The app should now be running at [http://localhost:3000](http://localhost:3000).

---

## Environment Setup

### Step 1: Copy Environment File

```bash
cp .env.example .env.local
```

### Step 2: Configure Required Variables

Open `.env.local` and configure these **required** variables:

#### Supabase (Required)
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
DATABASE_URL=postgresql://postgres:[password]@db.your-project.supabase.co:5432/postgres
```

Get these from your Supabase project dashboard: **Project Settings > API**.

#### Development Defaults
```env
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Step 3: Optional but Recommended Variables

These are needed for specific features:

| Variable | Feature | Where to get it |
|----------|---------|-----------------|
| `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | Live driver tracking map | [Mapbox Console](https://account.mapbox.com/) |
| `NEXT_PUBLIC_SENTRY_DSN` | Error monitoring | [Sentry.io](https://sentry.io/) |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Image CDN | [Cloudinary Console](https://cloudinary.com/console) |
| `NEXT_PUBLIC_FIREBASE_*` | Push notifications | [Firebase Console](https://console.firebase.google.com/) |

See `.env.example` for the complete list with detailed instructions.

---

## Database Setup

### Option A: Using Existing Supabase Project

If you have access to an existing Supabase project (staging/dev):

1. Get the connection string from Supabase dashboard
2. Add it to `DATABASE_URL` in `.env.local`
3. Run `pnpm db:generate` to generate Prisma client

### Option B: Setting Up a New Supabase Project

1. Create a new project at [supabase.com](https://supabase.com)
2. Wait for the database to be ready (~2 minutes)
3. Copy credentials from **Project Settings > API**
4. Run database migrations:
   ```bash
   pnpm db:push  # Push schema to database
   ```

### Prisma Studio (Database GUI)

To explore the database visually:

```bash
pnpm studio
```

This opens Prisma Studio at [http://localhost:5555](http://localhost:5555).

---

## First Run Verification

After starting the dev server (`pnpm dev`), verify everything works:

### 1. Homepage Loads
- Navigate to [http://localhost:3000](http://localhost:3000)
- You should see the Ready Set homepage

### 2. Authentication Works
- Click "Sign In"
- Try signing in with test credentials (ask team for test account)
- Or create a new account via "Sign Up"

### 3. Database Connection
- Open Prisma Studio: `pnpm studio`
- You should see all database tables
- The `profiles` table should be accessible

### 4. Build Succeeds
```bash
pnpm build
```
This should complete without errors.

### 5. Tests Pass
```bash
pnpm test           # Unit tests
pnpm typecheck      # TypeScript validation
pnpm lint           # ESLint
```

---

## Common Issues & Fixes

### "Cannot find module '@prisma/client'"

```bash
pnpm db:generate
```

### "ECONNREFUSED" database errors

- Check `DATABASE_URL` is correct in `.env.local`
- Verify Supabase project is active (not paused)
- Test connection: `npx prisma db pull`

### "Auth session missing" in console

This is **normal** for unauthenticated pages. The error appears when accessing public pages without being logged in.

### Port 3000 already in use

```bash
# Kill the process using port 3000
lsof -ti:3000 | xargs kill -9

# Or use a different port
PORT=3001 pnpm dev
```

### Prisma schema out of sync

```bash
pnpm db:generate    # Regenerate client
```

### TypeScript errors after pulling changes

```bash
pnpm install        # Install any new dependencies
pnpm db:generate    # Regenerate Prisma types
```

### "Module not found" errors

```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

---

## Development Workflow

### Daily Commands

```bash
# Start development
pnpm dev

# Before committing
pnpm pre-push-check    # Runs typecheck + lint + prisma validate

# Run tests
pnpm test              # Unit tests
pnpm test:e2e          # E2E tests (requires app running)
```

### Branch Naming

Follow this convention: `feature/REA-XXX-description`

Examples:
- `feature/REA-123-add-user-profile`
- `fix/REA-456-login-redirect-bug`
- `chore/REA-789-update-dependencies`

### Creating Pull Requests

**Never merge directly to `main`**. Always create a PR:

1. Push your branch
2. Create PR via GitHub
3. Ensure CI passes
4. Request review
5. Merge after approval

See [CONTRIBUTING.md](../CONTRIBUTING.md) for detailed guidelines.

---

## Key Documentation

| Document | Description |
|----------|-------------|
| [CLAUDE.md](../CLAUDE.md) | Architecture overview and development commands |
| [README.md](../README.md) | Project features and integrations |
| [docs/architecture/AUTHENTICATION.md](architecture/AUTHENTICATION.md) | Authentication system deep dive |
| [docs/architecture/SOFT_DELETE_PATTERN.md](architecture/SOFT_DELETE_PATTERN.md) | **Critical** - Read before touching user data |
| [docs/catervalley/API_CONTRACT.md](catervalley/API_CONTRACT.md) | CaterValley integration details |

---

## Getting Help

- **Codebase questions**: Check the `/docs` folder first
- **Architecture**: See `CLAUDE.md` for quick reference
- **Stuck on something**: Ask the team in Slack

---

## Next Steps

1. Read [CLAUDE.md](../CLAUDE.md) for architecture overview
2. Read [SOFT_DELETE_PATTERN.md](architecture/SOFT_DELETE_PATTERN.md) (very important!)
3. Read [AUTHENTICATION.md](architecture/AUTHENTICATION.md)
4. Pick up a small task from the backlog
5. Create your first PR!

Welcome to the team!
