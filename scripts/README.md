# Ready Set Scripts

This directory contains utility scripts for development, testing, deployment, and maintenance tasks.

## 📁 Directory Structure

### 🔨 Build Scripts (`build/`)

- Build-related utilities and automation scripts

### 🧪 Test Scripts (`test/`)

- Testing utilities and test automation scripts

### 🛠️ Utility Scripts (`utils/`)

- General utility scripts for common tasks

## 🚀 Available Scripts

### Build & Development

- `rebuild.sh` - Complete project rebuild with cache clearing
- `check-build.sh` - Verify build will succeed in production environment
- `type-check.js` - TypeScript type checking utility
- `vercel-build-simulation.js` - Simulate Vercel build environment

### Database Management

- `prisma-setup.js` - Prisma database setup and configuration
- `fix-prisma-imports.js` - Fix Prisma import issues
- `db-sync.ts` - Database synchronization utilities
- `db-full-sync.ts` - Complete database synchronization
- `backup-db.ts` - Database backup utilities
- `restore-backup.sh` - Database restore from backup
- `backup-production.sh` - Production database backup
- `apply-performance-indexes.ts` - Apply database performance indexes
- `db-tasks.ts` - Database maintenance tasks

### User Management

- `fix-admin-user.ts` - Fix admin user permissions
- `test-admin-access.ts` - Test admin access functionality
- `create-admin-user.ts` - Create new admin users
- `check-user-type.ts` - Check user type and permissions
- `check-current-user.ts` - Check current user session
- `fix-user-types.ts` - Fix user type assignments
- `import-users.ts` - Import users from external sources

### Testing & Quality Assurance

- `test-bug-fixes.ts` - Test bug fix implementations
- `test-db-connection.ts` - Test database connectivity
- `test-timezone-fix.js` - Test timezone handling fixes
- `test-url-encoding.sh` - Test URL encoding functionality
- `test-api-endpoint.sh` - Test API endpoint functionality
- `test-webhook-connectivity.sh` - Test webhook connectivity
- `test-catervalley-integration.sh` - Test CaterValley integration
- `check-integrity.ts` - Check system integrity

### Environment & Configuration

- `sync-env.ts` - Synchronize environment variables
- `list-coolify-resources.ts` - List Coolify deployment resources
- `setup-tracking-test.sh` - Setup tracking test environment
- `start-tracking-dev.sh` - Start tracking development environment

### Data Management

- `seed-pricing-tiers.ts` - Seed pricing tier data
- `fix-file-record.ts` - Fix file record issues
- `load-test.js` - Load testing utilities

## 🎯 Usage Examples

### Development Workflow

```bash
# Rebuild the project
./scripts/rebuild.sh

# Check if build will succeed
./scripts/check-build.sh

# Run type checking
node scripts/type-check.js
```

### Database Operations

```bash
# Setup Prisma
node scripts/prisma-setup.js

# Backup database
npx tsx scripts/backup-db.ts

# Sync database
npx tsx scripts/db-sync.ts
```

### Testing

```bash
# Test webhook connectivity
./scripts/test-webhook-connectivity.sh

# Test CaterValley integration
./scripts/test-catervalley-integration.sh

# Test API endpoints
./scripts/test-api-endpoint.sh
```

### User Management

```bash
# Create admin user
npx tsx scripts/create-admin-user.ts

# Check user access
npx tsx scripts/test-admin-access.ts

# Fix user types
npx tsx scripts/fix-user-types.ts
```

## 🔧 Script Categories

### 🔨 Build Scripts

Scripts for building, compiling, and preparing the application for deployment.

### 🧪 Test Scripts

Scripts for testing functionality, integrations, and system health.

### 🛠️ Utility Scripts

General-purpose scripts for common development and maintenance tasks.

## 📋 Best Practices

1. **Always backup before running scripts** - Some scripts modify production data
2. **Test in development first** - Run scripts in development environment before production
3. **Check script documentation** - Each script should have inline documentation
4. **Use appropriate permissions** - Some scripts require specific user permissions
5. **Monitor script output** - Pay attention to error messages and warnings

## 🚨 Important Notes

- **Production scripts** - Some scripts are designed for production use only
- **Database scripts** - Always backup before running database modification scripts
- **Environment variables** - Many scripts require specific environment variables
- **Dependencies** - Some scripts require additional tools (curl, jq, etc.)

## 🔍 Troubleshooting

### Common Issues

1. **Permission denied** - Make scripts executable: `chmod +x script.sh`
2. **Missing dependencies** - Install required tools: `brew install jq` (macOS)
3. **Environment variables** - Check `.env` file and environment setup
4. **Database connection** - Verify database connectivity and credentials

### Getting Help

1. Check script inline documentation
2. Review error messages carefully
3. Check related documentation in `/docs` directory
4. Contact development team for complex issues

---

_Last updated: January 2025_
