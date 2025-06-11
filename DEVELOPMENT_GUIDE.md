# 🚀 Local Development Setup Guide

This guide ensures you can run the Ready Set project locally without touching any production services.

## ⚠️ **CRITICAL: Verify Local Setup Before Development**

**Always run this verification before starting development:**

```bash
# Run the local setup verification
pnpm verify:local
```

This script will check:
- ✅ Database URLs point to localhost
- ✅ Supabase is configured for local development  
- ✅ Docker containers are running
- ✅ Environment variables are set correctly
- ✅ No production services are being accessed

## 🛠️ **Step-by-Step Setup**

### 1. **Clone and Install Dependencies**

```bash
git clone <repository-url>
cd ready-set
pnpm install
```

### 2. **Set Up Environment Variables**

```bash
# Copy the example environment file
cp env.local.example .env.local

# Edit .env.local with your local configuration
```

**Critical Environment Variables for Local Development:**

```bash
# Local PostgreSQL Database (Docker)
DATABASE_URL="postgresql://dev_user:dev_password@localhost:5432/ready_set_dev"
DIRECT_URL="postgresql://dev_user:dev_password@localhost:5432/ready_set_dev"

# Test Database  
TEST_DATABASE_URL="postgresql://test_user:test_password@localhost:5433/ready_set_test"

# Local Supabase (if using supabase start)
NEXT_PUBLIC_SUPABASE_URL="http://localhost:54321"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-local-anon-key"

# Development Environment
NODE_ENV="development"
NEXTAUTH_URL="http://localhost:3000"
```

### 3. **Start Local Database Services**

```bash
# Start PostgreSQL databases
pnpm dev:db:start

# Verify containers are running
docker ps
```

You should see:
- `ready-set-postgres-dev` on port 5432
- `ready-set-postgres-test` on port 5433

### 4. **Initialize Database Schema**

```bash
# Generate Prisma client
pnpm db:generate

# Reset and seed the database
pnpm dev:db:reset
```

### 5. **Verify Local Setup**

```bash
# Run verification script
pnpm verify:local
```

**Expected Output:**
```
🎉 ALL CHECKS PASSED!
Your local development environment is properly configured.
You can safely run your application without touching production services.
```

### 6. **Start Development Server**

```bash
# Start the Next.js development server
pnpm dev
```

Visit: `http://localhost:3000`

## 🔍 **Verification Checklist**

Before any development session, ensure:

- [ ] `pnpm verify:local` passes all checks
- [ ] DATABASE_URL contains `localhost:5432` 
- [ ] NEXT_PUBLIC_SUPABASE_URL contains `localhost` or is for development
- [ ] NODE_ENV is set to `development`
- [ ] Docker containers are running
- [ ] No production URLs in environment variables

## 🐳 **Docker Services**

### Available Services:

```bash
# PostgreSQL Databases
pnpm dev:db:start      # Start databases
pnpm dev:db:stop       # Stop databases
pnpm dev:db:restart    # Restart databases
pnpm dev:db:logs       # View logs

# Optional Services
pnpm dev:pgadmin       # Database management UI (localhost:8080)
pnpm dev:redis         # Redis cache (localhost:6379)
```

### Database Access:

**Development Database:**
- Host: `localhost:5432`
- Database: `ready_set_dev`
- User: `dev_user`
- Password: `dev_password`

**Test Database:**
- Host: `localhost:5433`  
- Database: `ready_set_test`
- User: `test_user`
- Password: `test_password`

## 🧪 **Testing Your Setup**

### 1. **Database Connection Test**

```bash
# Open Prisma Studio
pnpm studio

# Should open on localhost:5555 showing your local database
```

### 2. **User Sync Test**

Add this component to any page to test user synchronization:

```typescript
import { UserSyncTest } from '@/components/test/UserSyncTest'

export default function TestPage() {
  return (
    <div>
      <h1>Local Development Test</h1>
      <UserSyncTest />
    </div>
  )
}
```

### 3. **Run Tests**

```bash
# Run tests against local test database
pnpm test

# Watch mode
pnpm test:watch
```

## 🚨 **Safety Measures**

### Environment Isolation:

- **Local Development**: Uses `.env.local` file
- **Production**: Uses environment variables in deployment platform
- **Never commit**: `.env.local` is in `.gitignore`

### Database Isolation:

- **Development**: `localhost:5432/ready_set_dev`
- **Test**: `localhost:5433/ready_set_test` 
- **Production**: Remote PostgreSQL (only in deployment)

### Supabase Isolation:

- **Local**: `http://localhost:54321` (if using local Supabase)
- **Development**: Development Supabase project
- **Production**: Production Supabase project

## 🔧 **Troubleshooting**

### Common Issues:

**1. Database Connection Failed**
```bash
# Check if containers are running
docker ps

# Restart databases
pnpm dev:db:restart

# Check logs
pnpm dev:db:logs
```

**2. Environment Variables Not Loading**
```bash
# Verify .env.local exists
ls -la .env.local

# Run verification
pnpm verify:local
```

**3. Prisma Client Issues**
```bash
# Regenerate Prisma client
pnpm db:generate

# Reset database
pnpm dev:db:reset
```

**4. Port Conflicts**
```bash
# Check what's using port 5432
lsof -i :5432

# Stop conflicting services
brew services stop postgresql  # If using Homebrew Postgres
```

## ✅ **Pre-Push Checklist**

Before pushing any code:

1. [ ] Run `pnpm verify:local` - all checks pass
2. [ ] Run `pnpm test` - all tests pass
3. [ ] Run `pnpm typecheck` - no TypeScript errors
4. [ ] Run `pnpm lint` - no linting errors
5. [ ] Verify no production URLs in code
6. [ ] Test user sync functionality locally

## 🚀 **Ready to Develop!**

Once all checks pass, you can safely:

- Develop new features
- Test user authentication and sync
- Run database migrations
- Create and test API endpoints
- Write and run tests

All operations will run against your local services, ensuring production data and services remain untouched.

---

**Questions? Issues?** 
- Check the troubleshooting section above
- Run `pnpm verify:local` to diagnose problems
- Ensure Docker is running and containers are healthy 