# Development Database Setup Guide

This guide explains how to set up and work with the development database for the Ready Set project.

## 🎯 Overview

We use a **Docker-based PostgreSQL setup** for development to avoid Supabase project limits while maintaining compatibility with our production environment.

### Why This Approach?

- **No project limits**: Run unlimited local instances
- **Cost-effective**: Completely free for development
- **Production-like**: Same PostgreSQL features as Supabase
- **Fast iterations**: Quick database resets and seeding
- **Team-friendly**: Consistent environment across developers

## 🚀 Quick Start

1. **One-command setup**:
   ```bash
   pnpm dev:setup
   ```

2. **Start developing**:
   ```bash
   pnpm dev
   ```

That's it! The setup script handles everything automatically.

## 📋 Prerequisites

- **Docker Desktop** running
- **pnpm** installed
- **Node.js** 18+ 

## 🛠️ Manual Setup (if needed)

If you prefer manual setup or the automated script doesn't work:

### 1. Environment Configuration

Copy the environment template:
```bash
cp env.local.example .env.local
```

Update `.env.local` with your configuration:
```env
# Core database URLs
DATABASE_URL="postgresql://dev_user:dev_password@localhost:5432/ready_set_dev"
DIRECT_URL="postgresql://dev_user:dev_password@localhost:5432/ready_set_dev"
TEST_DATABASE_URL="postgresql://test_user:test_password@localhost:5433/ready_set_test"

# Add your other environment variables...
```

### 2. Start Database Services

```bash
# Start development and test databases
pnpm dev:db:start

# Verify they're running
docker ps
```

### 3. Run Migrations

```bash
# Install dependencies
pnpm install

# Generate Prisma client
pnpm prisma generate

# Apply schema to development database
pnpm dotenv -e .env.local -- prisma db push

# Apply schema to test database  
pnpm test:db:reset
```

### 4. Seed Development Data

```bash
pnpm dev:db:seed
```

## 🗄️ Database Architecture

### Development Environment

```
┌─────────────────────────────────────────┐
│                Local Dev                │
├─────────────────────────────────────────┤
│  📦 PostgreSQL Dev     (port 5432)     │
│  📦 PostgreSQL Test    (port 5433)     │
│  📦 pgAdmin           (port 8080)      │
│  📦 Redis Cache       (port 6379)      │
└─────────────────────────────────────────┘
```

### Production Environment

```
┌─────────────────────────────────────────┐
│              Supabase                   │
├─────────────────────────────────────────┤
│  🛡️  Auth System                        │
│  🗄️  PostgreSQL Database                │
│  📁 S3-compatible Storage               │
│  ⚡ Real-time Subscriptions             │
└─────────────────────────────────────────┘
```

## 📚 Available Commands

### Database Management
```bash
# Start database containers
pnpm dev:db:start

# Stop database containers  
pnpm dev:db:stop

# Restart databases
pnpm dev:db:restart

# View database logs
pnpm dev:db:logs

# Complete database reset with fresh data
pnpm dev:db:reset
```

### Development Tools
```bash
# Start pgAdmin (database GUI)
pnpm dev:pgadmin

# Start Redis cache
pnpm dev:redis

# Open Prisma Studio
pnpm studio

# Seed development data
pnpm dev:db:seed
```

### Testing
```bash
# Reset test database
pnpm test:db:reset

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch
```

## 🎭 Working with Test Data

### Seeded Data

The development database comes pre-seeded with:

- **50 user profiles** (vendors, clients, drivers, admin)
- **100 addresses** across various locations
- **75 catering requests** in different states
- **25 on-demand requests** with realistic data

### Test Credentials

- **Admin User**: `admin@readyset.local`
- **Database**: `postgresql://dev_user:dev_password@localhost:5432/ready_set_dev`
- **pgAdmin**: `http://localhost:8080` (admin@readyset.local / admin123)

### Custom Seeding

To customize the seeded data, edit `scripts/seed-dev-db.ts`:

```typescript
const SEED_CONFIG: SeedData = {
  profiles: 100,        // Increase users
  addresses: 200,       // More addresses
  cateringRequests: 150,// More catering requests
  onDemandRequests: 50, // More on-demand requests
};
```

## 🔧 Troubleshooting

### Database Connection Issues

1. **Check Docker is running**:
   ```bash
   docker info
   ```

2. **Verify containers are healthy**:
   ```bash
   docker-compose -f docker-compose.dev.yml ps
   ```

3. **Check database logs**:
   ```bash
   pnpm dev:db:logs
   ```

### Port Conflicts

If ports are already in use:

1. **Find what's using the port**:
   ```bash
   lsof -i :5432  # For PostgreSQL
   lsof -i :8080  # For pgAdmin
   ```

2. **Update docker-compose.dev.yml** to use different ports:
   ```yaml
   ports:
     - "5434:5432"  # Change host port
   ```

### Prisma Issues

1. **Regenerate client**:
   ```bash
   pnpm prisma generate
   ```

2. **Reset database schema**:
   ```bash
   pnpm dev:db:reset
   ```

### Permission Issues

1. **Make scripts executable**:
   ```bash
   chmod +x scripts/dev-setup.sh
   ```

## 🔄 Development Workflow

### Daily Development

1. **Start your day**:
   ```bash
   pnpm dev:db:start  # Start databases
   pnpm dev           # Start Next.js dev server
   ```

2. **Make schema changes**:
   ```bash
   # Edit prisma/schema.prisma
   pnpm prisma db push  # Apply changes
   ```

3. **Need fresh data?**:
   ```bash
   pnpm dev:db:seed    # Add more seed data
   # or
   pnpm dev:db:reset   # Complete reset
   ```

### Testing Workflow

1. **Before running tests**:
   ```bash
   pnpm test:db:reset  # Fresh test database
   ```

2. **Run tests**:
   ```bash
   pnpm test          # Run once
   pnpm test:watch    # Watch mode
   ```

### Database Inspection

1. **Prisma Studio** (recommended):
   ```bash
   pnpm studio
   ```

2. **pgAdmin** (full-featured):
   ```bash
   pnpm dev:pgadmin
   # Open http://localhost:8080
   ```

## 🚀 Alternative Setups

### Option 1: Supabase Local (Full Stack)

If you need the complete Supabase experience locally:

```bash
# Install Supabase CLI
npm install -g @supabase/cli

# Start full Supabase stack
supabase start

# Your app will use:
# Database: postgresql://postgres:postgres@localhost:54322/postgres
# API: http://localhost:54321
# Studio: http://localhost:54323
```

### Option 2: Cloud Development Database

For team development or if you prefer cloud hosting:

1. **PlanetScale** (recommended for MySQL-compatible setup)
2. **Railway** (PostgreSQL)
3. **Neon** (PostgreSQL with Supabase compatibility)

## 📈 Performance Tips

### Database Optimization

1. **Connection pooling** (already configured in Prisma)
2. **Query optimization** using Prisma Studio to analyze queries
3. **Index usage** - our schema includes performance indexes

### Development Speed

1. **Use database containers** instead of cloud for faster iterations
2. **Seed realistic data** for better testing
3. **Use Prisma Studio** for quick data inspection
4. **Reset databases** instead of manual cleanup

## 🔒 Security Notes

### Development Security

- Uses `trust` authentication for ease of development
- Isolated Docker network prevents external access
- Test credentials are safe for local development

### Production Differences

- Supabase handles authentication and authorization
- Row Level Security (RLS) policies in production
- Encrypted connections and secure credentials

## 🤝 Team Collaboration

### Sharing Schema Changes

1. **Commit Prisma schema changes**:
   ```bash
   git add prisma/schema.prisma
   git commit -m "feat: add user preferences table"
   ```

2. **Team members sync**:
   ```bash
   git pull
   pnpm prisma db push  # Apply schema changes
   ```

### Sharing Test Data

1. **Export specific data**:
   ```bash
   # Custom export script (can be created)
   pnpm export:test-data
   ```

2. **Import on other machines**:
   ```bash
   # Custom import script
   pnpm import:test-data
   ```

## 📞 Getting Help

1. **Check logs**: `pnpm dev:db:logs`
2. **Reset everything**: `pnpm dev:db:reset`
3. **Verify environment**: Check `.env.local` matches `env.local.example`
4. **Docker issues**: Restart Docker Desktop

---

This setup gives you a **production-like development environment** without the constraints of Supabase's free tier limits, while maintaining full compatibility with your production stack. 