# Emergency Rollback Plan

**Project:** Ready Set - Production Deployment
**Generated:** 2025-10-03
**Purpose:** Procedures to safely revert production deployment if critical issues arise

---

## 🚨 WHEN TO INITIATE ROLLBACK

### Immediate Rollback Triggers (No Discussion Needed)
- **Authentication System Down** - Users cannot log in
- **Data Corruption Detected** - Database integrity compromised
- **Security Breach** - Vulnerability actively exploited
- **Complete Service Outage** - Application completely inaccessible
- **Database Connection Failures** - Cannot connect to database

### Critical Rollback Triggers (Team Decision <5 minutes)
- **Error Rate > 10%** - Significant spike in application errors
- **Performance Degradation > 75%** - Response times severely impacted
- **Payment Processing Failure** - (if applicable) Payments not processing
- **Data Loss Detected** - Missing records or incorrect data
- **RLS Policy Breach** - Unauthorized data access occurring

### Warning Level (Monitor closely, prepare for rollback)
- **Error Rate 5-10%** - Moderate error increase
- **Performance Degradation 50-75%** - Noticeable slowdown
- **Isolated Feature Failures** - Non-critical features broken
- **User Reports Increasing** - Multiple user complaints

---

## 📋 Rollback Decision Matrix

| Trigger | Severity | Action | Decision Time |
|---------|----------|--------|---------------|
| Authentication Down | CRITICAL | **Immediate Rollback** | 0 minutes |
| Data Corruption | CRITICAL | **Immediate Rollback** | 0 minutes |
| Security Breach | CRITICAL | **Immediate Rollback** | 0 minutes |
| Error Rate > 10% | HIGH | **Team Decision** | < 5 minutes |
| Performance > 75% degraded | HIGH | **Team Decision** | < 5 minutes |
| Error Rate 5-10% | MEDIUM | **Monitor + Prepare** | 15-30 minutes |
| Isolated Feature Failure | LOW | **Fix Forward** | Continue monitoring |

---

## 🔄 Rollback Types

### Type 1: Application-Only Rollback (Fastest - 5 minutes)
**When:** No database schema changes were made, or they're backward compatible

**Steps:**
1. Revert application code
2. Redeploy previous version
3. Verify functionality

**Recovery Time:** 5-10 minutes

---

### Type 2: Application + Database Rollback (Moderate - 15 minutes)
**When:** Schema changes made but no data migration

**Steps:**
1. Revert application code
2. Reverse database migrations
3. Verify integrity
4. Redeploy

**Recovery Time:** 15-30 minutes

---

### Type 3: Full Database Restore (Slowest - 30-60 minutes)
**When:** Data corruption or irreversible schema changes

**Steps:**
1. Stop all writes
2. Restore database from backup
3. Revert application code
4. Verify data integrity
5. Resume operations

**Recovery Time:** 30-60 minutes

---

## 🚀 Type 1: Application-Only Rollback

### Prerequisites
- [ ] Deployment lead on call
- [ ] DevOps engineer available
- [ ] Backup still available
- [ ] Rollback decision confirmed

### Step-by-Step Procedure

#### 1. Enable Maintenance Mode (30 seconds)
```bash
# Prevent new writes
vercel env add MAINTENANCE_MODE production
# Value: "true"

# Verify maintenance page shows
curl https://your-production-domain.com
# Should return maintenance message
```

#### 2. Revert Git Repository (1 minute)
```bash
# Option A: Revert last commit
git checkout main
git pull origin main
git revert HEAD --no-edit
git push origin main

# Option B: Reset to specific commit (if multiple commits merged)
git checkout main
git reset --hard <previous-stable-commit-sha>
git push --force origin main

# Recommended: Use revert for cleaner history
```

#### 3. Trigger Vercel Deployment (3 minutes)
```bash
# Vercel auto-deploys from main branch
# Monitor deployment in dashboard

# Or trigger manually:
vercel --prod

# Wait for deployment to complete
vercel inspect <deployment-url>
```

#### 4. Verify Rollback (2 minutes)
```bash
# Test critical endpoints
curl https://your-production-domain.com/api/health
# Should return: {"status": "ok"}

# Test authentication
curl -X POST https://your-production-domain.com/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
# Should return: user session or appropriate error

# Check error rates
# Sentry dashboard: errors should drop significantly
```

#### 5. Disable Maintenance Mode (30 seconds)
```bash
# Resume normal operations
vercel env rm MAINTENANCE_MODE production

# Announce service restored
```

#### 6. Post-Rollback Monitoring (15 minutes)
- [ ] Monitor error rates for 15 minutes
- [ ] Verify no spike in new errors
- [ ] Check user login success rate
- [ ] Review database connection status
- [ ] Confirm critical flows working

---

## 🗄️ Type 2: Application + Database Rollback

### Prerequisites
- [ ] Database backup verified and accessible
- [ ] Reverse migration scripts prepared
- [ ] Team consensus on rollback
- [ ] Communication plan ready

### Step-by-Step Procedure

#### 1. Enable Maintenance Mode (30 seconds)
```bash
vercel env add MAINTENANCE_MODE production
```

#### 2. Stop Background Jobs (1 minute)
```bash
# If using any background workers/cron jobs
# Stop them to prevent write conflicts

# Supabase: Disable pg_cron jobs (if any)
# Execute in SQL Editor:
SELECT cron.unschedule('job_name');

# Or disable all cron jobs temporarily
UPDATE cron.job SET active = false;
```

#### 3. Create Emergency Backup (2 minutes)
```bash
# Create snapshot before rollback (safety net)
# Supabase Dashboard → Database → Backups → Create Backup
# Label: "pre-rollback-snapshot-[timestamp]"

# Or via API if configured:
curl -X POST https://api.supabase.com/v1/projects/{project-id}/database/backups \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

#### 4. Reverse Database Migrations (5-10 minutes)

**4a. Prepare Reverse Scripts**

Create `rollback_schema.sql`:
```sql
-- =====================================================
-- ROLLBACK SCRIPT
-- Reverses changes from prod_schema_update.sql
-- =====================================================

BEGIN;

-- 1. Drop testimonials table (if no data to preserve)
DROP TABLE IF EXISTS testimonials CASCADE;

-- 2. Revert default values
ALTER TABLE profiles ALTER COLUMN id DROP DEFAULT;
ALTER TABLE profiles ALTER COLUMN createdAt DROP DEFAULT;
ALTER TABLE profiles ALTER COLUMN updatedAt DROP DEFAULT;

-- 3. Revert timestamp types (back to timestamp without timezone)
ALTER TABLE sessions ALTER COLUMN expires TYPE timestamp;
ALTER TABLE addresses ALTER COLUMN createdAt TYPE timestamp;
ALTER TABLE addresses ALTER COLUMN updatedAt TYPE timestamp;
ALTER TABLE file_uploads ALTER COLUMN uploadedAt TYPE timestamp;
ALTER TABLE file_uploads ALTER COLUMN updatedAt TYPE timestamp;
ALTER TABLE user_addresses ALTER COLUMN createdAt TYPE timestamp;
ALTER TABLE user_addresses ALTER COLUMN updatedAt TYPE timestamp;
ALTER TABLE verification_tokens ALTER COLUMN expires TYPE timestamp;
ALTER TABLE form_submissions ALTER COLUMN createdAt TYPE timestamp;
ALTER TABLE form_submissions ALTER COLUMN updatedAt TYPE timestamp;
ALTER TABLE lead_captures ALTER COLUMN createdAt TYPE timestamp;
ALTER TABLE lead_captures ALTER COLUMN updatedAt TYPE timestamp;
ALTER TABLE job_applications ALTER COLUMN createdAt TYPE timestamp;
ALTER TABLE job_applications ALTER COLUMN updatedAt TYPE timestamp;
ALTER TABLE pricing_tiers ALTER COLUMN updatedAt TYPE timestamp;

COMMIT;

SELECT 'Schema rollback completed' AS status;
```

**4b. Reverse RLS Policies**

Create `rollback_rls.sql`:
```sql
-- =====================================================
-- ROLLBACK RLS POLICIES
-- Removes policies added during deployment
-- =====================================================

BEGIN;

-- 1. Disable RLS on tables where it was added
ALTER TABLE accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE calculator_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_rules DISABLE ROW LEVEL SECURITY;
ALTER TABLE calculation_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE client_configurations DISABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_tiers DISABLE ROW LEVEL SECURITY;
ALTER TABLE drivers DISABLE ROW LEVEL SECURITY;
ALTER TABLE driver_locations DISABLE ROW LEVEL SECURITY;
ALTER TABLE driver_shifts DISABLE ROW LEVEL SECURITY;
ALTER TABLE shift_breaks DISABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries DISABLE ROW LEVEL SECURITY;

-- 2. Restore original profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Restrict profile deletions" ON profiles;

-- Recreate original policies (without SELECT wrapper)
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

COMMIT;

SELECT 'RLS rollback completed' AS status;
```

**4c. Reverse Performance Changes**

Create `rollback_performance.sql`:
```sql
-- =====================================================
-- ROLLBACK PERFORMANCE CHANGES
-- Removes indexes added during deployment
-- =====================================================

BEGIN;

-- Drop indexes added
DROP INDEX IF EXISTS catering_requests_pickupAddressId_idx;
DROP INDEX IF EXISTS dispatches_userId_idx;
DROP INDEX IF EXISTS calculation_history_client_config_id_idx;
DROP INDEX IF EXISTS job_applications_profileId_idx;
DROP INDEX IF EXISTS on_demand_pickupAddressId_idx;
DROP INDEX IF EXISTS on_demand_deliveryAddressId_idx;
DROP INDEX IF EXISTS catering_requests_user_status_idx;
DROP INDEX IF EXISTS file_uploads_user_category_idx;

-- Re-create any dropped indexes (if documented)
-- (List any indexes that were dropped during deployment)

COMMIT;

SELECT 'Performance rollback completed' AS status;
```

**4d. Execute Rollback Scripts**
```bash
# Connect to Supabase and execute
# Supabase Dashboard → SQL Editor → New Query

# Copy and run each script in order:
# 1. rollback_performance.sql
# 2. rollback_rls.sql
# 3. rollback_schema.sql

# Verify no errors
```

#### 5. Revert Application Code (3 minutes)
```bash
# Same as Type 1 rollback
git checkout main
git revert HEAD --no-edit
git push origin main

# Wait for Vercel deployment
```

#### 6. Verify Database & Application (5 minutes)
```sql
-- Check table existence
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Verify testimonials removed (or kept if data preserved)
-- Verify RLS status
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Check policy count
SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public';
-- Should match pre-deployment count
```

```bash
# Test application
curl https://your-production-domain.com/api/health

# Test auth flow
# Manual browser test: Login → Dashboard → Logout
```

#### 7. Re-enable Services (1 minute)
```bash
# Re-enable cron jobs if disabled
UPDATE cron.job SET active = true;

# Disable maintenance mode
vercel env rm MAINTENANCE_MODE production
```

#### 8. Monitor & Communicate (30 minutes)
- [ ] Monitor error rates closely
- [ ] Verify user flows working
- [ ] Check database performance
- [ ] Notify stakeholders of rollback completion
- [ ] Document issues that triggered rollback

---

## 💾 Type 3: Full Database Restore

### ⚠️ WARNING: Data Loss Risk
This option will lose any data created between backup and rollback.
**Use only when absolutely necessary.**

### Prerequisites
- [ ] Database backup file verified
- [ ] Backup timestamp documented
- [ ] Data loss impact assessed and approved
- [ ] All team members notified

### Step-by-Step Procedure

#### 1. Enable Maintenance & Stop All Writes (1 minute)
```bash
# Enable maintenance mode
vercel env add MAINTENANCE_MODE production

# Stop all background jobs
# (See Type 2, Step 2)

# If using read replicas, stop replication
```

#### 2. Document Current State (2 minutes)
```sql
-- Record current row counts
SELECT
  'profiles' as table, COUNT(*) as count FROM profiles
UNION ALL
SELECT 'addresses', COUNT(*) FROM addresses
UNION ALL
SELECT 'catering_requests', COUNT(*) FROM catering_requests
-- ... (all tables)
;

-- Save this output for data loss assessment
```

#### 3. Download Backup File (If Not Already Local) (3 minutes)
```bash
# Supabase Dashboard → Database → Backups
# Download backup file: backup-prod-[timestamp].sql

# Or via CLI if configured:
supabase db dump -f backup-restore.sql --project-ref jiasmmmmhtreoacdpiby

# Verify file integrity
ls -lh backup-restore.sql
# Should show file size > 0
```

#### 4. Restore Database from Backup (10-30 minutes)
```bash
# OPTION A: Supabase Dashboard (Recommended)
# 1. Supabase Dashboard → Database → Backups
# 2. Find backup from before deployment
# 3. Click "Restore" button
# 4. Confirm restore action
# 5. Wait for completion (10-30 minutes depending on size)

# OPTION B: Manual restore via psql (if needed)
# WARNING: This will drop and recreate all tables
# psql $DATABASE_URL < backup-restore.sql
```

#### 5. Verify Database Restoration (5 minutes)
```sql
-- Check table existence
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Verify row counts match backup timestamp
SELECT
  'profiles' as table, COUNT(*) as count FROM profiles
UNION ALL
SELECT 'addresses', COUNT(*) FROM addresses
-- Compare with pre-restore counts

-- Verify RLS status
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public';

-- Check foreign key constraints
SELECT COUNT(*) FROM information_schema.table_constraints
WHERE constraint_type = 'FOREIGN KEY';
```

#### 6. Revert Application Code (3 minutes)
```bash
# Same as Type 1 & Type 2
git checkout main
git revert HEAD --no-edit
git push origin main
```

#### 7. Verify Application (5 minutes)
```bash
# Health check
curl https://your-production-domain.com/api/health

# Manual testing
# - Login with test user
# - View dashboard
# - Check critical flows
# - Verify no errors
```

#### 8. Re-enable Services (2 minutes)
```bash
# Re-enable background jobs
UPDATE cron.job SET active = true;

# Re-enable read replicas (if applicable)

# Disable maintenance mode
vercel env rm MAINTENANCE_MODE production
```

#### 9. Assess Data Loss (10 minutes)
```sql
-- Compare row counts
-- Document data created during deployment window
-- Notify affected users (if necessary)

-- Example: Find users created after backup
SELECT * FROM profiles
WHERE createdAt > '[backup-timestamp]';
```

#### 10. Communication & Post-Mortem (30 minutes)
```
Subject: Service Restored - Database Rollback Completed

The production deployment has been rolled back due to [issue description].

Impact:
- Service downtime: [duration]
- Data loss: [description of lost data]
- Affected users: [count/list]

Current status:
- All systems operational
- Data integrity verified
- Monitoring in progress

Next steps:
- Root cause analysis scheduled
- Affected users will be contacted
- Deployment process will be reviewed

Thank you for your patience.
- Ready Set Team
```

---

## 📊 Post-Rollback Procedures

### Immediate (Within 1 hour)
- [ ] Verify all systems operational
- [ ] Monitor error rates closely
- [ ] Check user feedback channels
- [ ] Document issues encountered
- [ ] Update status page

### Short-term (Within 24 hours)
- [ ] Analyze root cause
- [ ] Create incident report
- [ ] Notify all stakeholders
- [ ] Review deployment process
- [ ] Plan fix-forward strategy

### Long-term (Within 1 week)
- [ ] Conduct post-mortem meeting
- [ ] Update deployment procedures
- [ ] Improve testing strategy
- [ ] Enhance monitoring/alerts
- [ ] Train team on lessons learned

---

## 🔍 Verification Checklist

After any rollback type, verify:

### Application Health
- [ ] `/api/health` returns 200 OK
- [ ] Login/logout works
- [ ] Dashboard loads
- [ ] Critical features functional
- [ ] No console errors

### Database Health
- [ ] Connection pool normal
- [ ] Query response times normal
- [ ] No locks or deadlocks
- [ ] Backup job running
- [ ] No replication lag (if applicable)

### Monitoring
- [ ] Error rate < 1%
- [ ] Response time < 500ms p95
- [ ] No spike in 500 errors
- [ ] Database CPU < 70%
- [ ] Memory usage normal

### Security
- [ ] RLS policies active (or as expected)
- [ ] Authentication working
- [ ] Authorization correct
- [ ] No exposed data
- [ ] API rate limits active

---

## 📞 Emergency Contacts

### Rollback Decision Makers
- **Deployment Lead:** [Name] - [Phone]
- **Engineering Manager:** [Name] - [Phone]
- **CTO:** [Name] - [Phone]

### Technical Team
- **DevOps:** [Name] - [Phone]
- **Backend Lead:** [Name] - [Phone]
- **Database Admin:** [Name] - [Phone]

### Communication Team
- **Product Owner:** [Name] - [Phone]
- **Customer Success:** [Name] - [Phone]

---

## 📝 Rollback Logging Template

Use this template to document rollback execution:

```markdown
# Rollback Incident Report

**Date:** [YYYY-MM-DD]
**Time Started:** [HH:MM UTC]
**Time Completed:** [HH:MM UTC]
**Total Downtime:** [X minutes]

## Trigger Event
- **What happened:** [Description]
- **Who detected:** [Name]
- **Detection time:** [HH:MM]
- **Severity:** [CRITICAL/HIGH/MEDIUM]

## Rollback Execution
- **Rollback Type:** [1/2/3]
- **Decision Maker:** [Name]
- **Decision Time:** [HH:MM]
- **Execution Team:** [Names]

## Steps Executed
- [x] Step 1: [Description] - [Duration]
- [x] Step 2: [Description] - [Duration]
- [ ] Step 3: [Description] - [Duration]

## Issues Encountered
1. [Issue description]
   - **Resolution:** [How fixed]
   - **Time to resolve:** [X minutes]

## Data Impact
- **Data loss:** [Yes/No]
- **Rows affected:** [Count]
- **Users impacted:** [Count]
- **Recovery plan:** [Description]

## Lessons Learned
1. [Lesson 1]
2. [Lesson 2]

## Action Items
- [ ] [Action 1] - Owner: [Name] - Due: [Date]
- [ ] [Action 2] - Owner: [Name] - Due: [Date]

## Sign-off
- **Technical Lead:** [Name] - [Timestamp]
- **Engineering Manager:** [Name] - [Timestamp]
```

---

## 🛡️ Prevention & Future Improvements

### Deployment Process
- [ ] Add staging environment mandatory step
- [ ] Implement canary deployments
- [ ] Add automated rollback triggers
- [ ] Improve smoke test coverage
- [ ] Add database migration dry-run

### Monitoring
- [ ] Add real-time error rate alerts
- [ ] Implement automatic health checks
- [ ] Add database performance monitors
- [ ] Set up user impact dashboards

### Testing
- [ ] Expand integration test suite
- [ ] Add database migration tests
- [ ] Implement load testing
- [ ] Add RLS policy tests

---

**Last Updated:** 2025-10-03
**Version:** 1.0
**Review Schedule:** After each rollback event
