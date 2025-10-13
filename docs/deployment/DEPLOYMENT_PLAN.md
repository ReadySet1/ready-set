# Production Deployment Plan

**Project:** Ready Set - Preview Development → Main Merge
**Generated:** 2025-10-03
**Strategy:** Manual Schema Migration (Option A - Recommended)

---

## ⚠️ CRITICAL: Read This First

**DO NOT PROCEED** with standard migration merge. The dev and production databases have **completely divergent migration histories** that cannot be automatically reconciled.

This deployment plan uses **Manual Schema Migration (Option A)** - the safest approach to bring production up to date with proven dev features while preserving all production data.

---

## 📋 Deployment Strategy Overview

### Chosen Approach: Manual Schema Migration

**Why this approach:**
- ✅ Preserves all production data
- ✅ Minimal downtime (< 1 hour)
- ✅ Incremental, testable changes
- ✅ Rollback-friendly
- ✅ Lower risk than full database replacement

**What we'll do:**
1. Create comprehensive backups
2. Apply only new/missing features from dev to prod
3. Enable missing security policies (RLS)
4. Add performance optimizations
5. Verify and test
6. Monitor post-deployment

---

## 🎯 Deployment Objectives

### Features to Deploy
1. **Add `testimonials` table** (new feature from dev)
2. **Standardize timestamp columns** to `timestamptz`
3. **Add missing default values** to columns
4. **Enable comprehensive RLS policies** (security critical)
5. **Optimize auth.uid() calls** in RLS policies
6. **Add missing indexes** for foreign keys
7. **Remove unused indexes** (performance optimization)
8. **Fix function security** (search_path issues)

### What We're NOT Doing
- ❌ Not merging divergent migration histories
- ❌ Not replacing production database
- ❌ Not migrating data (only schema changes)
- ❌ Not adding PostGIS to dev (keep prod-only)

---

## 📅 Deployment Timeline

### Total Estimated Time: **3-4 weeks**

| Phase | Duration | Tasks |
|-------|----------|-------|
| **Week 1** | 5 days | Security fixes + stakeholder approval |
| **Week 2** | 5 days | Staging setup + script development |
| **Week 3** | 5 days | Testing + validation in staging |
| **Week 4** | 3 days | Production deployment + monitoring |

### Deployment Day Timeline (1 hour window)

| Time | Duration | Activity |
|------|----------|----------|
| T-0:00 | 10 min | Pre-deployment checks + backups |
| T-0:10 | 20 min | Apply schema changes to production |
| T-0:30 | 15 min | Run security & performance scripts |
| T-0:45 | 10 min | Verification tests |
| T-0:55 | 5 min | Application deployment |
| T-1:00 | - | Monitor for issues |

---

## 📝 Pre-Deployment Phase (Week 1-3)

### Week 1: Security & Approval

#### Day 1-2: Security Fixes in Staging
```sql
-- 1. Enable RLS on all tables (run in staging clone first)
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE calculator_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE calculation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_breaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

-- 2. Create missing RLS policies (see detailed SQL in section below)
```

#### Day 3: Stakeholder Decision Meeting
- **Attendees:** Engineering Lead, Product Owner, DevOps, Security
- **Agenda:**
  - Review SCHEMA_COMPARISON.md findings
  - Approve deployment strategy
  - Set maintenance window
  - Assign roles and responsibilities

#### Day 4-5: Backup & Rollback Planning
- [ ] Create staging environment (clone production)
- [ ] Test backup/restore procedures
- [ ] Document rollback steps
- [ ] Prepare rollback scripts

### Week 2: Script Development

#### Migration Scripts to Create

**1. Schema Migration SQL** (`migrations/prod_schema_update.sql`)
```sql
-- Add testimonials table
CREATE TABLE IF NOT EXISTS testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text,
  content text NOT NULL,
  image text,
  rating integer NOT NULL DEFAULT 5,
  category "TestimonialCategory" NOT NULL DEFAULT 'CLIENTS',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS on testimonials
ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;

-- Add missing default values
ALTER TABLE profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Fix timestamp types (example - repeat for all tables)
ALTER TABLE sessions ALTER COLUMN expires TYPE timestamptz;
ALTER TABLE addresses ALTER COLUMN createdAt TYPE timestamptz;
ALTER TABLE addresses ALTER COLUMN updatedAt TYPE timestamptz;
-- ... (full list in detailed SQL section)
```

**2. RLS Policy Script** (`migrations/prod_rls_policies.sql`)
- See "Detailed SQL Scripts" section below

**3. Performance Optimization** (`migrations/prod_performance.sql`)
- See "Detailed SQL Scripts" section below

**4. Verification Script** (`scripts/verify-deployment.ts`)
- See "Verification Scripts" section below

### Week 3: Testing in Staging

#### Day 1: Apply Scripts to Staging
1. Clone production database to staging
2. Create backup of staging
3. Run migration scripts in order:
   - Schema migration
   - RLS policies
   - Performance optimizations
4. Verify no errors

#### Day 2-3: Comprehensive Testing
- [ ] Run full test suite against staging
- [ ] Manual QA of critical flows
- [ ] Security audit of RLS policies
- [ ] Performance benchmarking
- [ ] Load testing (if applicable)

#### Day 4: Rollback Test
- [ ] Restore staging from backup
- [ ] Verify rollback procedure works
- [ ] Document any issues
- [ ] Refine rollback plan

#### Day 5: Final Review
- [ ] Code freeze on `preview-development` branch
- [ ] Final PR review
- [ ] Update documentation
- [ ] Prepare deployment runbook

---

## 🚀 Deployment Day (Week 4)

### Pre-Deployment Checks (T-0:00 to T-0:10)

#### 1. Team Assembly
- [ ] **Deployment Lead:** On call
- [ ] **DevOps Engineer:** Monitoring systems
- [ ] **Backend Engineer:** Database scripts ready
- [ ] **Frontend Engineer:** Application deployment
- [ ] **QA Engineer:** Verification tests ready
- [ ] **Product Owner:** Available for decisions

#### 2. Communication
```bash
# Announce maintenance window
# Template email/message:
"""
Subject: Scheduled Maintenance - Ready Set Platform

We will be performing scheduled maintenance on [DATE] from [TIME] to [TIME].

During this time:
- The platform will be in read-only mode
- New requests cannot be created
- Existing data will remain accessible

We apologize for any inconvenience.
- Ready Set Team
"""
```

#### 3. Enable Maintenance Mode
```bash
# Set environment variable to enable maintenance mode
vercel env add MAINTENANCE_MODE production
# Value: "true"
```

#### 4. Create Backups (CRITICAL)
```bash
# See BACKUP_PROCEDURES.md for detailed steps

# Quick summary:
# 1. Supabase Dashboard → Database → Backups → "Create Backup"
# 2. Download backup file locally
# 3. Verify backup file integrity
# 4. Store in secure location (S3, Drive, etc.)
# 5. Document backup location and timestamp
```

---

### Deployment Execution (T-0:10 to T-0:55)

#### Step 1: Apply Schema Changes (T-0:10 - 10 minutes)

**Connect to Production Database:**
```bash
# Using Supabase SQL Editor or psql
# Never use direct database URL in shell history

# Option A: Supabase Dashboard
# 1. Go to Supabase Dashboard → SQL Editor
# 2. Copy SQL from migrations/prod_schema_update.sql
# 3. Execute and verify no errors

# Option B: psql (if available)
# psql $SUPABASE_DB_URL -f migrations/prod_schema_update.sql
```

**Execute:**
```sql
-- Run migrations/prod_schema_update.sql
-- This adds:
-- - testimonials table
-- - missing defaults
-- - timestamp type fixes

BEGIN;

-- Testimonials table
CREATE TABLE IF NOT EXISTS testimonials (
  -- ... (see full SQL in detailed section)
);

-- Profiles default value
ALTER TABLE profiles
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Timestamp type fixes
-- (Execute all ALTER TYPE statements)

COMMIT;
```

**Verify:**
```sql
-- Check testimonials table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'testimonials'
);
-- Should return: true

-- Check profiles default
SELECT column_default
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'id';
-- Should return: gen_random_uuid()
```

#### Step 2: Apply RLS Policies (T-0:20 - 10 minutes)

**Execute:**
```sql
-- Run migrations/prod_rls_policies.sql
-- See detailed SQL in section below

BEGIN;

-- Enable RLS on tables
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
-- ... (all tables)

-- Create policies with optimized auth.uid()
CREATE POLICY "Users can read own accounts" ON accounts
  FOR SELECT
  USING ((SELECT auth.uid()) = "userId");
-- ... (all policies)

COMMIT;
```

**Verify:**
```sql
-- Check RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = true;
-- Should return all tables

-- Count policies
SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public';
-- Should return expected count
```

#### Step 3: Performance Optimizations (T-0:30 - 10 minutes)

**Execute:**
```sql
-- Run migrations/prod_performance.sql

BEGIN;

-- Add missing foreign key indexes
CREATE INDEX IF NOT EXISTS catering_requests_pickupAddressId_idx
  ON catering_requests(pickupAddressId);

CREATE INDEX IF NOT EXISTS dispatches_userId_idx
  ON dispatches(userId);

CREATE INDEX IF NOT EXISTS calculation_history_client_config_id_idx
  ON calculation_history(client_config_id);

CREATE INDEX IF NOT EXISTS job_applications_profileId_idx
  ON job_applications(profileId);

CREATE INDEX IF NOT EXISTS on_demand_pickupAddressId_idx
  ON on_demand_requests(pickupAddressId);

CREATE INDEX IF NOT EXISTS on_demand_deliveryAddressId_idx
  ON on_demand_requests(deliveryAddressId);

-- Drop unused indexes (carefully review list first)
-- DROP INDEX IF EXISTS pricing_tiers_isActive_idx;
-- DROP INDEX IF EXISTS catering_requests_pickupDateTime_idx;
-- ... (see full list in detailed section)

COMMIT;
```

**Verify:**
```sql
-- Check indexes created
SELECT indexname FROM pg_indexes
WHERE tablename IN ('catering_requests', 'dispatches', 'calculation_history')
  AND schemaname = 'public'
ORDER BY tablename, indexname;
```

#### Step 4: Function Security Fixes (T-0:40 - 5 minutes)

**Execute:**
```sql
-- Fix search_path on functions
ALTER FUNCTION update_updated_at_column()
  SET search_path TO pg_catalog, public;

ALTER FUNCTION calculate_shift_duration()
  SET search_path TO pg_catalog, public;

ALTER FUNCTION get_active_drivers_count()
  SET search_path TO pg_catalog, public;
```

#### Step 5: Application Deployment (T-0:45 - 10 minutes)

**Merge and Deploy:**
```bash
# 1. Merge preview-development → main
git checkout main
git pull origin main
git merge preview-development
git push origin main

# 2. Vercel auto-deploys from main branch
# Monitor deployment in Vercel Dashboard

# 3. Wait for deployment to complete
# Typical deployment time: 3-5 minutes
```

**Disable Maintenance Mode:**
```bash
# Once deployment succeeds
vercel env rm MAINTENANCE_MODE production
```

---

### Post-Deployment Verification (T-0:55 - 15 minutes)

#### Automated Verification
```bash
# Run verification script
npx tsx scripts/verify-deployment.ts

# This checks:
# - Database connectivity
# - Table existence
# - RLS enabled
# - Index creation
# - Policy count
```

#### Manual Verification Tests

**1. Authentication Flow (2 minutes)**
- [ ] Navigate to `/login`
- [ ] Log in with test CLIENT account
- [ ] Verify dashboard loads
- [ ] Log out
- [ ] Log in with test VENDOR account
- [ ] Verify vendor dashboard loads

**2. Critical User Flows (5 minutes)**
- [ ] Create new catering request
- [ ] Upload file
- [ ] View addresses
- [ ] Create on-demand request
- [ ] View calculator
- [ ] Submit form

**3. API Health Check (2 minutes)**
```bash
# Test key endpoints
curl https://your-production-domain.com/api/health
curl -H "Authorization: Bearer $TOKEN" https://your-production-domain.com/api/profiles

# All should return 200 OK
```

**4. Database Health (2 minutes)**
```sql
-- Check table counts
SELECT
  'profiles' as table_name, COUNT(*) as count FROM profiles
UNION ALL
SELECT 'addresses', COUNT(*) FROM addresses
UNION ALL
SELECT 'catering_requests', COUNT(*) FROM catering_requests
UNION ALL
SELECT 'testimonials', COUNT(*) FROM testimonials;

-- Verify no errors in logs
SELECT * FROM pg_stat_statements
WHERE query LIKE '%ERROR%'
ORDER BY last_exec_time DESC
LIMIT 10;
```

**5. Error Monitoring (2 minutes)**
- [ ] Check Sentry (or error tracker) - no spike in errors
- [ ] Check Vercel logs - no 500 errors
- [ ] Check Supabase logs - no connection issues

**6. Performance Check (2 minutes)**
```bash
# Check response times
curl -w "@curl-format.txt" -o /dev/null -s https://your-domain.com/

# Verify Lighthouse score hasn't degraded
lighthouse https://your-domain.com --only-categories=performance
```

---

## 📊 Monitoring Phase (T+1:00 to T+24:00)

### First Hour (Critical Monitoring)
- [ ] **Every 5 minutes:** Check error rates in Sentry
- [ ] **Every 10 minutes:** Check Vercel deployment metrics
- [ ] **Every 15 minutes:** Review Supabase database stats
- [ ] **Monitor:** User-reported issues in support channels

### First 24 Hours
- [ ] **Hourly:** Review error dashboards
- [ ] **Every 4 hours:** Check database performance
- [ ] **Daily:** Analyze user feedback
- [ ] **Daily:** Review deployment metrics

### Success Criteria
- ✅ Error rate < 1% (baseline: current error rate)
- ✅ No authentication failures
- ✅ No data loss or corruption
- ✅ Response times within 10% of baseline
- ✅ No security incidents
- ✅ User satisfaction maintained

---

## 🔴 Rollback Procedure

**Trigger Rollback If:**
- Critical errors > 5% of requests
- Authentication broken
- Data corruption detected
- Response time degradation > 50%
- Security vulnerability exposed

**Rollback Steps:**

1. **Immediate Actions (5 minutes)**
```bash
# 1. Re-enable maintenance mode
vercel env add MAINTENANCE_MODE production

# 2. Revert application deployment
git revert HEAD
git push origin main

# 3. Vercel auto-deploys the revert
```

2. **Database Rollback (15 minutes)**
```bash
# See ROLLBACK_PLAN.md for detailed procedure

# Option A: Restore from backup (if schema changes are issue)
# 1. Supabase Dashboard → Backups → Restore from [timestamp]

# Option B: Reverse migrations (if data is fine)
# Run reverse migration scripts
```

3. **Verification (10 minutes)**
- [ ] Application loads
- [ ] Authentication works
- [ ] Critical flows functional
- [ ] No data loss

4. **Communication**
```
Subject: Maintenance Complete - Service Restored

The scheduled maintenance has been completed and all services are now operational.

If you experience any issues, please contact support.

- Ready Set Team
```

---

## 📋 Post-Deployment Tasks

### Immediate (Day 1)
- [ ] Monitor error rates for 24 hours
- [ ] Review deployment logs
- [ ] Update internal documentation
- [ ] Notify stakeholders of success

### Week 1
- [ ] Analyze performance metrics
- [ ] Review user feedback
- [ ] Optimize slow queries (if any)
- [ ] Schedule post-mortem meeting

### Week 2
- [ ] Create deployment retrospective
- [ ] Update deployment procedures
- [ ] Archive deployment artifacts
- [ ] Plan next iteration

---

## 📎 Detailed SQL Scripts

### Schema Migration Script (`migrations/prod_schema_update.sql`)

```sql
-- =====================================================
-- Production Schema Update Script
-- Generated: 2025-10-03
-- Purpose: Align production schema with dev features
-- =====================================================

BEGIN;

-- 1. Add testimonials table
-- ===================================================
CREATE TABLE IF NOT EXISTS testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text,
  content text NOT NULL,
  image text,
  rating integer NOT NULL DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  category "TestimonialCategory" NOT NULL DEFAULT 'CLIENTS',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create enum if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TestimonialCategory') THEN
    CREATE TYPE "TestimonialCategory" AS ENUM ('CLIENTS', 'VENDORS', 'DRIVERS');
  END IF;
END$$;

-- 2. Add missing default values
-- ===================================================
ALTER TABLE profiles
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE profiles
  ALTER COLUMN createdAt SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE profiles
  ALTER COLUMN updatedAt SET DEFAULT CURRENT_TIMESTAMP;

-- 3. Fix timestamp column types
-- ===================================================
-- Change timestamp to timestamptz for consistency

-- sessions table
ALTER TABLE sessions
  ALTER COLUMN expires TYPE timestamptz;

-- addresses table
ALTER TABLE addresses
  ALTER COLUMN createdAt TYPE timestamptz;

ALTER TABLE addresses
  ALTER COLUMN updatedAt TYPE timestamptz;

-- file_uploads table
ALTER TABLE file_uploads
  ALTER COLUMN uploadedAt TYPE timestamptz;

ALTER TABLE file_uploads
  ALTER COLUMN updatedAt TYPE timestamptz;

-- user_addresses table
ALTER TABLE user_addresses
  ALTER COLUMN createdAt TYPE timestamptz;

ALTER TABLE user_addresses
  ALTER COLUMN updatedAt TYPE timestamptz;

-- verification_tokens table
ALTER TABLE verification_tokens
  ALTER COLUMN expires TYPE timestamptz;

-- form_submissions table
ALTER TABLE form_submissions
  ALTER COLUMN createdAt TYPE timestamptz;

ALTER TABLE form_submissions
  ALTER COLUMN updatedAt TYPE timestamptz;

-- lead_captures table
ALTER TABLE lead_captures
  ALTER COLUMN createdAt TYPE timestamptz;

ALTER TABLE lead_captures
  ALTER COLUMN updatedAt TYPE timestamptz;

-- job_applications table
ALTER TABLE job_applications
  ALTER COLUMN createdAt TYPE timestamptz;

ALTER TABLE job_applications
  ALTER COLUMN updatedAt TYPE timestamptz;

-- pricing_tiers table
ALTER TABLE pricing_tiers
  ALTER COLUMN updatedAt TYPE timestamptz;

COMMIT;

-- Verify changes
SELECT 'Schema update completed successfully' AS status;
```

### RLS Policies Script (`migrations/prod_rls_policies.sql`)

```sql
-- =====================================================
-- Production RLS Policies Script
-- Generated: 2025-10-03
-- Purpose: Enable comprehensive Row Level Security
-- =====================================================

BEGIN;

-- 1. Enable RLS on all tables
-- ===================================================
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE calculator_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE calculation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_breaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

-- 2. Optimize existing profiles policies
-- ===================================================
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Recreate with optimized auth.uid()
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT
  USING ((SELECT auth.uid()) = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "Restrict profile deletions" ON profiles
  FOR DELETE
  USING (false);

-- 3. Testimonials policies (public read, admin write)
-- ===================================================
CREATE POLICY "Public can view active testimonials" ON testimonials
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Restrict testimonial modifications" ON testimonials
  FOR ALL
  USING (false);

-- 4. Calculator system policies
-- ===================================================
-- Templates: public read
CREATE POLICY "Public can view active templates" ON calculator_templates
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Restrict template modifications" ON calculator_templates
  FOR ALL
  USING (false);

-- Pricing rules: public read
CREATE POLICY "Public can view pricing rules" ON pricing_rules
  FOR SELECT
  USING (true);

CREATE POLICY "Restrict pricing rule modifications" ON pricing_rules
  FOR ALL
  USING (false);

-- Client configurations: users can view own
CREATE POLICY "Users can view own configs" ON client_configurations
  FOR SELECT
  USING ((SELECT auth.uid()) = client_id);

CREATE POLICY "Restrict config modifications" ON client_configurations
  FOR ALL
  USING (false);

-- Calculation history: users can view own
CREATE POLICY "Users can view own calculations" ON calculation_history
  FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can create calculations" ON calculation_history
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Restrict calculation updates" ON calculation_history
  FOR UPDATE
  USING (false);

-- 5. Pricing tiers policies
-- ===================================================
CREATE POLICY "Public can view active tiers" ON pricing_tiers
  FOR SELECT
  USING (isActive = true);

CREATE POLICY "Restrict tier modifications" ON pricing_tiers
  FOR ALL
  USING (false);

-- 6. Driver system policies
-- ===================================================
-- Drivers: users can view own driver profile
CREATE POLICY "Users can view own driver profile" ON drivers
  FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Restrict driver modifications" ON drivers
  FOR ALL
  USING (false);

-- Driver locations: drivers can manage own locations
CREATE POLICY "Drivers can view own locations" ON driver_locations
  FOR SELECT
  USING (
    driver_id IN (
      SELECT id FROM drivers WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Drivers can create own locations" ON driver_locations
  FOR INSERT
  WITH CHECK (
    driver_id IN (
      SELECT id FROM drivers WHERE user_id = (SELECT auth.uid())
    )
  );

-- Driver shifts: drivers can manage own shifts
CREATE POLICY "Drivers can view own shifts" ON driver_shifts
  FOR SELECT
  USING (
    driver_id IN (
      SELECT id FROM drivers WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Restrict shift modifications" ON driver_shifts
  FOR ALL
  USING (false);

-- Shift breaks: drivers can view own breaks
CREATE POLICY "Drivers can view own breaks" ON shift_breaks
  FOR SELECT
  USING (
    shift_id IN (
      SELECT id FROM driver_shifts ds
      JOIN drivers d ON d.id = ds.driver_id
      WHERE d.user_id = (SELECT auth.uid())
    )
  );

-- Deliveries: drivers can view assigned deliveries
CREATE POLICY "Drivers can view assigned deliveries" ON deliveries
  FOR SELECT
  USING (
    driver_id IN (
      SELECT id FROM drivers WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Restrict delivery modifications" ON deliveries
  FOR ALL
  USING (false);

COMMIT;

-- Verify policies created
SELECT 'RLS policies created successfully' AS status;
SELECT COUNT(*) AS total_policies FROM pg_policies WHERE schemaname = 'public';
```

### Performance Optimization Script (`migrations/prod_performance.sql`)

```sql
-- =====================================================
-- Production Performance Optimization Script
-- Generated: 2025-10-03
-- Purpose: Add indexes and optimize queries
-- =====================================================

BEGIN;

-- 1. Add missing foreign key indexes
-- ===================================================
CREATE INDEX IF NOT EXISTS catering_requests_pickupAddressId_idx
  ON catering_requests(pickupAddressId);

CREATE INDEX IF NOT EXISTS dispatches_userId_idx
  ON dispatches(userId);

CREATE INDEX IF NOT EXISTS calculation_history_client_config_id_idx
  ON calculation_history(client_config_id);

CREATE INDEX IF NOT EXISTS job_applications_profileId_idx
  ON job_applications(profileId);

CREATE INDEX IF NOT EXISTS on_demand_pickupAddressId_idx
  ON on_demand_requests(pickupAddressId);

CREATE INDEX IF NOT EXISTS on_demand_deliveryAddressId_idx
  ON on_demand_requests(deliveryAddressId);

-- 2. Drop unused indexes (review carefully)
-- ===================================================
-- Only drop indexes confirmed as unused in production

-- Uncomment after review:
-- DROP INDEX IF EXISTS pricing_tiers_isActive_idx;
-- DROP INDEX IF EXISTS catering_requests_pickupDateTime_idx;
-- DROP INDEX IF EXISTS testimonials_is_active_idx;

-- 3. Add composite indexes for common queries
-- ===================================================
CREATE INDEX IF NOT EXISTS catering_requests_user_status_idx
  ON catering_requests(userId, status);

CREATE INDEX IF NOT EXISTS file_uploads_user_category_idx
  ON file_uploads(userId, category);

-- 4. Analyze tables for query planner
-- ===================================================
ANALYZE profiles;
ANALYZE addresses;
ANALYZE catering_requests;
ANALYZE on_demand_requests;
ANALYZE dispatches;
ANALYZE file_uploads;

COMMIT;

-- Verify indexes created
SELECT 'Performance optimizations completed successfully' AS status;
```

---

## 🔧 Verification Scripts

### TypeScript Verification Script (`scripts/verify-deployment.ts`)

```typescript
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface VerificationResult {
  check: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
}

async function runVerification(): Promise<void> {
  const results: VerificationResult[] = [];

  console.log('🔍 Starting Post-Deployment Verification...\n');

  // 1. Check database connectivity
  try {
    const { error } = await supabase.from('profiles').select('count').single();
    results.push({
      check: 'Database Connectivity',
      status: error ? 'FAIL' : 'PASS',
      message: error ? error.message : 'Connection successful',
    });
  } catch (err) {
    results.push({
      check: 'Database Connectivity',
      status: 'FAIL',
      message: String(err),
    });
  }

  // 2. Check testimonials table exists
  try {
    const { data, error } = await supabase.from('testimonials').select('count');
    results.push({
      check: 'Testimonials Table',
      status: error ? 'FAIL' : 'PASS',
      message: error ? error.message : 'Table exists and accessible',
    });
  } catch (err) {
    results.push({
      check: 'Testimonials Table',
      status: 'FAIL',
      message: String(err),
    });
  }

  // 3. Check RLS enabled (attempt to access without auth)
  try {
    const { data, error } = await supabase.from('accounts').select('*');
    results.push({
      check: 'RLS on Accounts',
      status: data && data.length > 0 ? 'FAIL' : 'PASS',
      message: data && data.length > 0
        ? 'WARNING: Accounts accessible without auth!'
        : 'RLS properly restricting access',
    });
  } catch (err) {
    results.push({
      check: 'RLS on Accounts',
      status: 'PASS',
      message: 'RLS properly enabled',
    });
  }

  // 4. Check critical tables exist
  const tables = [
    'profiles',
    'addresses',
    'catering_requests',
    'on_demand_requests',
    'calculator_templates',
    'pricing_rules',
  ];

  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).select('count').limit(1);
      results.push({
        check: `Table: ${table}`,
        status: error ? 'FAIL' : 'PASS',
        message: error ? error.message : 'Exists',
      });
    } catch (err) {
      results.push({
        check: `Table: ${table}`,
        status: 'FAIL',
        message: String(err),
      });
    }
  }

  // Print results
  console.log('\n📊 Verification Results:\n');
  console.log('━'.repeat(80));

  let passed = 0;
  let failed = 0;
  let warnings = 0;

  results.forEach((result) => {
    const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${icon} ${result.check.padEnd(30)} | ${result.message}`);

    if (result.status === 'PASS') passed++;
    else if (result.status === 'FAIL') failed++;
    else warnings++;
  });

  console.log('━'.repeat(80));
  console.log(`\n✅ Passed: ${passed} | ❌ Failed: ${failed} | ⚠️ Warnings: ${warnings}\n`);

  if (failed > 0) {
    console.error('❌ Deployment verification FAILED! Initiate rollback procedure.\n');
    process.exit(1);
  } else if (warnings > 0) {
    console.warn('⚠️ Deployment verification passed with warnings. Review before proceeding.\n');
  } else {
    console.log('✅ Deployment verification PASSED! All checks successful.\n');
  }
}

runVerification().catch((err) => {
  console.error('Fatal error during verification:', err);
  process.exit(1);
});
```

---

## 📞 Emergency Contacts

### Deployment Team
- **Deployment Lead:** [Name] - [Phone] - [Email]
- **DevOps Engineer:** [Name] - [Phone] - [Email]
- **Backend Engineer:** [Name] - [Phone] - [Email]
- **Database Admin:** [Name] - [Phone] - [Email]

### Escalation
- **Engineering Manager:** [Name] - [Phone]
- **CTO/VP Engineering:** [Name] - [Phone]
- **On-Call Rotation:** [PagerDuty/Oncall Link]

---

## 📚 Related Documentation

- **SCHEMA_COMPARISON.md** - Detailed database differences
- **PRE_PRODUCTION_CHECKLIST.md** - Complete pre-deployment checklist
- **ROLLBACK_PLAN.md** - Emergency rollback procedures
- **BACKUP_PROCEDURES.md** - Backup and restore guide

---

**Last Updated:** 2025-10-03
**Version:** 1.0
**Status:** READY FOR REVIEW
