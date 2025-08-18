# 📋 Workflows Archive Manifest

## 📊 Archive Summary

- **Total Workflows:** 5
- **Archive Date:** August 18, 2025
- **Archive Time:** 14:50:58
- **Archive Status:** Complete
- **Backup Location:** `backups/github-workflows-20250818-145058/`

---

## 🔍 Detailed Workflow Specifications

### 1. `ci.yml` - Continuous Integration

**File Size:** 3,694 bytes  
**Status:** Disabled  
**Last Modified:** August 18, 2025

#### 📋 Job Specifications

| Job Name   | Runs On       | Timeout    | Status      |
| ---------- | ------------- | ---------- | ----------- |
| `test`     | ubuntu-latest | 30 minutes | ❌ Disabled |
| `security` | ubuntu-latest | 15 minutes | ❌ Disabled |

#### 🚀 Triggers

- **Push Events:** `main`, `master`, `feature/*`
- **Pull Request:** `main`, `master`
- **Manual:** No

#### 🔧 Dependencies

- **Node.js:** 18
- **Package Manager:** pnpm 10.8.0
- **Database:** PostgreSQL (test environment)

#### 🔐 Environment Variables

```bash
DATABASE_URL="postgresql://test:test@localhost:5432/test"
DIRECT_URL="postgresql://test:test@localhost:5432/test"
NEXT_PUBLIC_SUPABASE_URL="https://placeholder.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="placeholder-key"
NEXTAUTH_SECRET="test-secret"
CI=true
```

#### 📝 Steps

1. Checkout repository
2. Install pnpm
3. Setup Node.js
4. Install dependencies
5. Generate Prisma Client
6. Type check
7. Lint code
8. Run tests
9. Build application
10. Security audit (high-severity only)

---

### 2. `codeql.yml` - CodeQL Security Scanning

**File Size:** 1,835 bytes  
**Status:** Disabled  
**Last Modified:** August 18, 2025

#### 📋 Job Specifications

| Job Name  | Runs On       | Timeout     | Status      |
| --------- | ------------- | ----------- | ----------- |
| `analyze` | ubuntu-latest | 360 minutes | ❌ Disabled |

#### 🚀 Triggers

- **Push Events:** `main`, `master`
- **Pull Request:** `main`, `master`
- **Schedule:** Weekly on Sundays at 3 AM UTC
- **Manual:** No

#### 🔧 Dependencies

- **Node.js:** 18
- **Package Manager:** pnpm 10.8.0
- **Languages:** TypeScript

#### 🔐 Permissions

```yaml
permissions:
  actions: read
  contents: read
  security-events: write
```

#### 📝 Steps

1. Checkout repository
2. Initialize CodeQL
3. Install pnpm
4. Setup Node.js
5. Install dependencies
6. Build Next.js application
7. Perform CodeQL Analysis

---

### 3. `deploy-production.yml` - Production Deployment

**File Size:** 11,546 bytes  
**Status:** Disabled  
**Last Modified:** August 18, 2025

#### 📋 Job Specifications

| Job Name                        | Runs On       | Timeout    | Dependencies                                          |
| ------------------------------- | ------------- | ---------- | ----------------------------------------------------- |
| `pre-production-validation`     | ubuntu-latest | 20 minutes | None                                                  |
| `production-approval`           | ubuntu-latest | No limit   | pre-production-validation                             |
| `build-production-image`        | ubuntu-latest | No limit   | pre-production-validation, production-approval        |
| `database-backup-and-migration` | ubuntu-latest | No limit   | build-production-image                                |
| `deploy-production`             | ubuntu-latest | No limit   | build-production-image, database-backup-and-migration |
| `post-deployment`               | ubuntu-latest | No limit   | deploy-production                                     |
| `rollback`                      | ubuntu-latest | No limit   | On failure                                            |

#### 🚀 Triggers

- **Push Events:** `main`
- **Manual:** Yes (workflow_dispatch)
- **Inputs:**
  - `deployment_type`: rolling, blue-green, canary
  - `skip_tests`: boolean
  - `rollback_version`: string

#### 🔧 Dependencies

- **Node.js:** 18
- **Package Manager:** pnpm 10.8.0
- **Database:** PostgreSQL (production)
- **Container Registry:** GitHub Container Registry (ghcr.io)

#### 🔐 Environment Variables

```bash
PROD_DATABASE_URL
PROD_DIRECT_URL
PROD_SUPABASE_URL
PROD_SUPABASE_ANON_KEY
PROD_NEXTAUTH_SECRET
GITHUB_TOKEN
```

#### 📝 Key Features

- Manual approval workflow
- Database backup before migration
- Health checks and load testing
- Rollback capabilities
- Comprehensive notifications

---

### 4. `test.yml` - Test Suite

**File Size:** 3,865 bytes  
**Status:** Disabled  
**Last Modified:** August 18, 2025

#### 📋 Job Specifications

| Job Name            | Runs On       | Timeout  | Dependencies |
| ------------------- | ------------- | -------- | ------------ |
| `test`              | ubuntu-latest | No limit | None         |
| `e2e-tests`         | ubuntu-latest | No limit | test         |
| `integration-tests` | ubuntu-latest | No limit | test         |

#### 🚀 Triggers

- **Push Events:** `main`, `preview-development`
- **Pull Request:** `main`, `preview-development`
- **Manual:** No

#### 🔧 Dependencies

- **Node.js:** 18, 20 (matrix)
- **Package Manager:** pnpm 10.8.0
- **Database:** PostgreSQL (test environment)
- **Browser:** Playwright (for E2E tests)

#### 🔐 Environment Variables

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/test_db"
NODE_ENV=test
CODECOV_TOKEN
```

#### 📝 Steps

1. **Test Job:**
   - Type check
   - Lint check
   - Unit tests
   - Coverage reports
   - Codecov upload

2. **E2E Tests:**
   - Install Playwright browsers
   - Build application
   - Run E2E tests
   - Upload test results

3. **Integration Tests:**
   - Setup test database
   - Run integration tests

---

### 5. `deploy-staging.yml` - Staging Deployment

**File Size:** 8,035 bytes  
**Status:** Disabled  
**Last Modified:** August 18, 2025

#### 📋 Job Specifications

| Job Name                | Runs On       | Timeout    | Dependencies                          |
| ----------------------- | ------------- | ---------- | ------------------------------------- |
| `pre-deployment-checks` | ubuntu-latest | 10 minutes | None                                  |
| `build-and-push`        | ubuntu-latest | No limit   | pre-deployment-checks                 |
| `database-migration`    | ubuntu-latest | No limit   | pre-deployment-checks, build-and-push |
| `deploy-staging`        | ubuntu-latest | No limit   | build-and-push, database-migration    |
| `notify`                | ubuntu-latest | No limit   | deploy-staging                        |

#### 🚀 Triggers

- **Push Events:** `preview-development`
- **Manual:** Yes (workflow_dispatch)
- **Inputs:**
  - `force_deploy`: boolean

#### 🔧 Dependencies

- **Node.js:** 18
- **Package Manager:** pnpm 10.8.0
- **Database:** PostgreSQL (staging)
- **Container Registry:** GitHub Container Registry (ghcr.io)

#### 🔐 Environment Variables

```bash
STAGING_DATABASE_URL
STAGING_DIRECT_URL
STAGING_SUPABASE_URL
STAGING_SUPABASE_ANON_KEY
STAGING_NEXTAUTH_SECRET
GITHUB_TOKEN
```

#### 📝 Key Features

- Pre-deployment health checks
- Database backup before migration
- Health checks and smoke tests
- Deployment notifications
- Force deploy option

---

## 🔐 Secrets Inventory

### Production Secrets

- `PROD_DATABASE_URL` - Production database connection string
- `PROD_DIRECT_URL` - Production direct database connection
- `PROD_SUPABASE_URL` - Production Supabase URL
- `PROD_SUPABASE_ANON_KEY` - Production Supabase anonymous key
- `PROD_NEXTAUTH_SECRET` - Production NextAuth secret

### Staging Secrets

- `STAGING_DATABASE_URL` - Staging database connection string
- `STAGING_DIRECT_URL` - Staging direct database connection
- `STAGING_SUPABASE_URL` - Staging Supabase URL
- `STAGING_SUPABASE_ANON_KEY` - Staging Supabase anonymous key
- `STAGING_NEXTAUTH_SECRET` - Staging NextAuth secret

### Testing Secrets

- `CODECOV_TOKEN` - Codecov coverage reporting token
- `GITHUB_TOKEN` - GitHub Actions token (automatically provided)

---

## 🚨 Re-enabling Instructions

### Quick Re-enable

1. Copy workflow file from archive to `.github/workflows/`
2. Remove `if: false` conditions
3. Ensure secrets are configured
4. Commit and push

### Full Restore

```bash
# Restore all workflows
cp -r backups/github-workflows-20250818-145058/* .github/workflows/

# Or restore specific workflow
cp backups/github-workflows-20250818-145058/deploy-production.yml .github/workflows/
```

### Selective Enable

- Each workflow can be re-enabled independently
- No dependencies between workflows
- Secrets can be configured per environment

---

## 📚 Related Files

- **Archive README:** `README.md`
- **Master Plan:** `../../GITHUB_WORKFLOWS_ARCHIVE_PLAN.md`
- **Phase 1 Assessment:** `../../backups/github-workflows-20250818-145058/PHASE1_ASSESSMENT.md`

---

**Manifest Created:** August 18, 2025  
**Manifest Status:** ✅ COMPLETED  
**Archive Phase:** Phase 2 - Archive Structure Creation
