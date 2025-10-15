# Supabase Migration Execution Plan
## Migration Reconciliation: Dev → Prod

**Generated**: October 14, 2025
**Status**: Ready for Review
**Risk Level**: MEDIUM
**Estimated Duration**: 30-45 minutes
**Requires Maintenance Window**: YES (recommended)

---

## 📋 Pre-Execution Checklist

### Required Personnel
- [ ] Database Administrator (primary executor)
- [ ] Backend Engineer (on standby)
- [ ] DevOps Engineer (monitoring)
- [ ] Product Manager (aware of maintenance window)

### Required Access
- [ ] Supabase production project access (`jiasmmmmhtreoacdpiby`)
- [ ] Supabase development project access (`khvteminrbghoeuqajzm`)
- [ ] GitHub repository write access (for committing migrations)
- [ ] Monitoring/alerting dashboard access
- [ ] Communication channel for team updates

### Pre-Flight Checks
- [ ] All team members notified of maintenance window
- [ ] Maintenance banner displayed on application (if applicable)
- [ ] Backup of production database completed (< 1 hour old)
- [ ] Backup of development database completed (< 1 hour old)
- [ ] Rollback plan reviewed and understood by team
- [ ] Validation SQL queries tested on development environment
- [ ] Migration files reviewed and approved by team lead

---

## 📦 Migration Artifacts

The following files have been generated and are ready for deployment:

1. **`20251014220000_bridge_add_audit_system.sql`**
   - Creates `user_audits` table with full audit logging
   - Adds `deletedBy` and `deletionReason` columns to profiles
   - Implements automatic audit triggers
   - Sets up RLS policies for security

2. **`20251014220100_bridge_add_upload_errors_table.sql`**
   - Creates `upload_errors` table for error tracking
   - Adds helper functions for logging and resolving errors
   - Creates analytics view for monitoring
   - Sets up RLS policies and cleanup procedures

3. **`VALIDATION_SQL.sql`**
   - Comprehensive validation queries
   - Pre/post migration checks
   - Data integrity verification
   - Performance validation

4. **`MIGRATION_RECONCILIATION_REPORT.md`**
   - Full analysis of divergence
   - Risk assessment
   - Schema comparison details

---

## 🚀 Execution Steps

### Phase 1: Pre-Migration Validation (10 minutes)

#### Step 1.1: Create Backups
```bash
# Set timestamp for backup files
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Backup Production
echo "Backing up production database..."
supabase db dump \
  --project-id jiasmmmmhtreoacdpiby \
  --file "backups/prod_pre_migration_${TIMESTAMP}.sql"

# Verify backup file size (should be > 100KB)
ls -lh "backups/prod_pre_migration_${TIMESTAMP}.sql"

# Backup Development (for reference)
echo "Backing up development database..."
supabase db dump \
  --project-id khvteminrbghoeuqajzm \
  --file "backups/dev_pre_migration_${TIMESTAMP}.sql"

# Verify backup file size
ls -lh "backups/dev_pre_migration_${TIMESTAMP}.sql"
```

**✅ Success Criteria:**
- Both backup files created successfully
- Production backup size > 100KB
- Backup files readable and valid SQL

**⚠️ If backups fail:** STOP. Do not proceed until backups are successful.

#### Step 1.2: Run Pre-Migration Validation
```bash
# Connect to production and run validation
psql "postgresql://postgres:[PASSWORD]@db.jiasmmmmhtreoacdpiby.supabase.co:5432/postgres" \
  -f supabase/VALIDATION_SQL.sql \
  > "validation/prod_pre_migration_${TIMESTAMP}.log" 2>&1

# Review validation results
cat "validation/prod_pre_migration_${TIMESTAMP}.log"
```

**✅ Success Criteria:**
- All baseline queries execute without errors
- Row counts documented for comparison
- No unexpected schema elements exist

#### Step 1.3: Document Current State
```bash
# Count critical tables
psql "postgresql://postgres:[PASSWORD]@db.jiasmmmmhtreoacdpiby.supabase.co:5432/postgres" \
  -c "SELECT 'profiles', COUNT(*) FROM public.profiles
      UNION ALL SELECT 'catering_requests', COUNT(*) FROM public.catering_requests
      UNION ALL SELECT 'addresses', COUNT(*) FROM public.addresses;" \
  > "validation/prod_row_counts_${TIMESTAMP}.txt"
```

---

### Phase 2: Dry-Run Test on Development (10 minutes)

**Purpose:** Verify migrations work correctly before touching production

#### Step 2.1: Test on Development First
```bash
# Apply migrations to development
cd /Users/ealanis/Development/current-projects/ready-set

# Test migration 1
echo "Testing audit system migration..."
supabase db push \
  --project-id khvteminrbghoeuqajzm \
  --file supabase/migrations/20251014220000_bridge_add_audit_system.sql \
  --dry-run

# Test migration 2
echo "Testing upload errors migration..."
supabase db push \
  --project-id khvteminrbghoeuqajzm \
  --file supabase/migrations/20251014220100_bridge_add_upload_errors_table.sql \
  --dry-run
```

**✅ Success Criteria:**
- Dry-run completes without errors
- No syntax errors reported
- Expected objects shown in output

#### Step 2.2: Apply to Development (for real)
```bash
# Actually apply migrations to dev
supabase db push \
  --project-id khvteminrbghoeuqajzm

# Run post-migration validation
psql "postgresql://postgres:[PASSWORD]@db.khvteminrbghoeuqajzm.supabase.co:6543/postgres" \
  -f supabase/VALIDATION_SQL.sql \
  > "validation/dev_post_migration_${TIMESTAMP}.log" 2>&1

# Review results
cat "validation/dev_post_migration_${TIMESTAMP}.log" | grep -E "PASS|FAIL|WARNING"
```

**✅ Success Criteria:**
- All validation checks show "✓ PASS"
- New tables exist: `user_audits`, `upload_errors`
- New columns exist in `profiles`: `deletedBy`, `deletionReason`
- Audit trigger functional (test should pass)
- No data loss (row counts match pre-migration)

**⚠️ If dev tests fail:** STOP. Fix issues before proceeding to production.

---

### Phase 3: Production Migration (15 minutes)

**⚠️ CRITICAL: This is the point of no return. Ensure all previous steps passed.**

#### Step 3.1: Enable Maintenance Mode (if applicable)
```bash
# Set maintenance mode flag (application-specific)
# Example:
# curl -X POST https://api.readyset.com/admin/maintenance -d '{"enabled":true}'

# OR update feature flag in your feature management system
```

#### Step 3.2: Notify Team
Send message to team channels:
```
🚨 PRODUCTION MAINTENANCE IN PROGRESS 🚨
Migration: Audit System & Error Tracking
Start Time: [CURRENT_TIME]
Expected Duration: 15 minutes
Status: In Progress

Do NOT make any database changes manually during this time.
```

#### Step 3.3: Apply Migrations to Production
```bash
# Navigate to project directory
cd /Users/ealanis/Development/current-projects/ready-set

# Apply migrations
echo "🚀 Applying migrations to PRODUCTION..."
echo "Migration 1: Audit System..."

supabase db push \
  --project-id jiasmmmmhtreoacdpiby \
  --file supabase/migrations/20251014220000_bridge_add_audit_system.sql

# Check for errors
if [ $? -eq 0 ]; then
    echo "✅ Migration 1 successful"
else
    echo "❌ Migration 1 FAILED - INITIATING ROLLBACK"
    exit 1
fi

echo "Migration 2: Upload Errors Table..."
supabase db push \
  --project-id jiasmmmmhtreoacdpiby \
  --file supabase/migrations/20251014220100_bridge_add_upload_errors_table.sql

# Check for errors
if [ $? -eq 0 ]; then
    echo "✅ Migration 2 successful"
else
    echo "❌ Migration 2 FAILED - INITIATING ROLLBACK"
    exit 1
fi
```

**✅ Success Criteria:**
- Both migrations complete without errors
- No foreign key violations
- No data loss

**❌ If migration fails:** Immediately proceed to ROLLBACK section below.

#### Step 3.4: Run Post-Migration Validation
```bash
# Run comprehensive validation
psql "postgresql://postgres:[PASSWORD]@db.jiasmmmmhtreoacdpiby.supabase.co:5432/postgres" \
  -f supabase/VALIDATION_SQL.sql \
  > "validation/prod_post_migration_${TIMESTAMP}.log" 2>&1

# Review critical checks
cat "validation/prod_post_migration_${TIMESTAMP}.log" | grep -E "PASS|FAIL|WARNING"

# Verify row counts match pre-migration
psql "postgresql://postgres:[PASSWORD]@db.jiasmmmmhtreoacdpiby.supabase.co:5432/postgres" \
  -c "SELECT 'profiles', COUNT(*) FROM public.profiles
      UNION ALL SELECT 'catering_requests', COUNT(*) FROM public.catering_requests
      UNION ALL SELECT 'addresses', COUNT(*) FROM public.addresses;" \
  > "validation/prod_row_counts_post_${TIMESTAMP}.txt"

# Compare row counts
diff "validation/prod_row_counts_${TIMESTAMP}.txt" "validation/prod_row_counts_post_${TIMESTAMP}.txt"
```

**✅ Success Criteria:**
- All validation checks show "✓ PASS"
- Row counts EXACTLY match pre-migration
- New tables exist and are accessible
- Triggers functional
- RLS policies active

---

### Phase 4: Application Testing (5 minutes)

#### Step 4.1: Test Critical Workflows
```bash
# Test 1: Verify profiles API still works
curl -X GET "https://api.readyset.com/api/users?limit=5" \
  -H "Authorization: Bearer [TOKEN]"

# Test 2: Verify audit logging works
# (Make a test profile update through API)

# Test 3: Check that soft deletes still work
```

**✅ Success Criteria:**
- All API endpoints respond normally
- Response times within acceptable range (< 2x baseline)
- No 500 errors in application logs
- Audit records being created (check user_audits table)

---

### Phase 5: Post-Migration Cleanup (5 minutes)

#### Step 5.1: Disable Maintenance Mode
```bash
# Disable maintenance mode
# curl -X POST https://api.readyset.com/admin/maintenance -d '{"enabled":false}'
```

#### Step 5.2: Notify Team of Success
Send message to team channels:
```
✅ PRODUCTION MAINTENANCE COMPLETE ✅
Migration: Audit System & Error Tracking
Duration: [ACTUAL_DURATION]
Status: SUCCESS

New features available:
- Full audit logging for user changes
- Upload error tracking system
- Enhanced soft-delete information

All systems operational. 🎉
```

#### Step 5.3: Generate TypeScript Types
```bash
# Generate updated TypeScript types for new tables
supabase gen types typescript \
  --project-id jiasmmmmhtreoacdpiby \
  > src/types/database.types.ts

# Commit the new types
git add src/types/database.types.ts
git commit -m "chore: update database types after audit system migration"
```

#### Step 5.4: Commit Migration Files
```bash
# Add migration files to git
git add supabase/migrations/20251014220000_bridge_add_audit_system.sql
git add supabase/migrations/20251014220100_bridge_add_upload_errors_table.sql
git add supabase/VALIDATION_SQL.sql
git add supabase/MIGRATION_RECONCILIATION_REPORT.md
git add supabase/EXECUTION_PLAN.md

# Commit with detailed message
git commit -m "feat: add audit system and error tracking to production

- Added user_audits table with automatic logging
- Added upload_errors table for error tracking
- Enhanced profiles table with deletedBy and deletionReason
- Implemented RLS policies for security
- Added helper functions and views

Migration IDs:
- 20251014220000_bridge_add_audit_system
- 20251014220100_bridge_add_upload_errors_table

Closes #[TICKET_NUMBER]"

# Push to main branch
git push origin development
```

---

## 🔄 ROLLBACK PROCEDURE

**Use this if migration fails or causes critical issues**

### Emergency Rollback Steps

#### Option A: Rollback via SQL (Fast - Use for critical failures)
```bash
# Connect to production
psql "postgresql://postgres:[PASSWORD]@db.jiasmmmmhtreoacdpiby.supabase.co:5432/postgres"
```

```sql
-- Execute rollback in a transaction for safety
BEGIN;

-- Drop trigger
DROP TRIGGER IF EXISTS trg_audit_profile_changes ON public.profiles CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS public.audit_profile_changes() CASCADE;
DROP FUNCTION IF EXISTS public.log_upload_error(TEXT, TEXT, TEXT, TEXT, TEXT, UUID, BOOLEAN) CASCADE;
DROP FUNCTION IF EXISTS public.resolve_upload_error(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_old_upload_errors(INTEGER) CASCADE;

-- Drop views
DROP VIEW IF EXISTS public.upload_error_stats CASCADE;

-- Drop indexes
DROP INDEX IF EXISTS public.idx_user_audits_userId;
DROP INDEX IF EXISTS public.idx_user_audits_performedBy;
DROP INDEX IF EXISTS public.idx_user_audits_action;
DROP INDEX IF EXISTS public.idx_user_audits_createdAt;
DROP INDEX IF EXISTS public.idx_user_audits_changes;
DROP INDEX IF EXISTS public.idx_user_audits_metadata;
DROP INDEX IF EXISTS public.idx_upload_errors_correlationId;
DROP INDEX IF EXISTS public.idx_upload_errors_userId;
DROP INDEX IF EXISTS public.idx_upload_errors_errorType;
DROP INDEX IF EXISTS public.idx_upload_errors_timestamp;
DROP INDEX IF EXISTS public.idx_upload_errors_unresolved;
DROP INDEX IF EXISTS public.idx_upload_errors_retryable;
DROP INDEX IF EXISTS public.idx_profiles_deletedBy;

-- Drop new tables
DROP TABLE IF EXISTS public.user_audits CASCADE;
DROP TABLE IF EXISTS public.upload_errors CASCADE;

-- Remove new columns from profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS "deletedBy" CASCADE;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS "deletionReason";

-- Verify rollback
SELECT 'Rollback verification:' as status;
SELECT COUNT(*) as remaining_audit_tables
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('user_audits', 'upload_errors');

-- Should return 0 if rollback successful
COMMIT;
```

#### Option B: Full Database Restore (Slow - Use if Option A fails)
```bash
# Restore from backup
psql "postgresql://postgres:[PASSWORD]@db.jiasmmmmhtreoacdpiby.supabase.co:5432/postgres" \
  < "backups/prod_pre_migration_${TIMESTAMP}.sql"

# This will restore the entire database to pre-migration state
# WARNING: This will lose any data created AFTER the backup was taken
```

### Post-Rollback Verification
```bash
# Verify tables were removed
psql "postgresql://postgres:[PASSWORD]@db.jiasmmmmhtreoacdpiby.supabase.co:5432/postgres" \
  -c "SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('user_audits', 'upload_errors');"

# Should return 0 rows

# Verify row counts match pre-migration
psql "postgresql://postgres:[PASSWORD]@db.jiasmmmmhtreoacdpiby.supabase.co:5432/postgres" \
  -c "SELECT 'profiles', COUNT(*) FROM public.profiles
      UNION ALL SELECT 'catering_requests', COUNT(*) FROM public.catering_requests;"

# Compare to pre-migration counts
```

### Notify Team of Rollback
```
⚠️ PRODUCTION ROLLBACK COMPLETED ⚠️
Migration: Audit System & Error Tracking
Status: ROLLED BACK
Reason: [DESCRIBE REASON]

Database restored to pre-migration state.
All systems should be operational.

Next Steps:
1. Review rollback reason
2. Fix issues in migration
3. Re-test on development
4. Schedule new maintenance window
```

---

## 📊 Monitoring After Migration

### Metrics to Watch (First 24 Hours)

1. **Application Performance**
   - API response times (should be < 10% increase)
   - Database query performance
   - Error rates in logs

2. **Database Health**
   - Connection pool usage
   - Query execution times
   - Table sizes (check for bloat)

3. **New Feature Adoption**
   - Audit records being created
   - Upload errors being logged
   - No constraint violations

### Monitoring Commands
```bash
# Check audit record growth
psql "postgresql://postgres:[PASSWORD]@db.jiasmmmmhtreoacdpiby.supabase.co:5432/postgres" \
  -c "SELECT
        DATE_TRUNC('hour', \"createdAt\") as hour,
        COUNT(*) as audit_count
      FROM public.user_audits
      WHERE \"createdAt\" > NOW() - INTERVAL '24 hours'
      GROUP BY hour
      ORDER BY hour DESC;"

# Check upload error stats
psql "postgresql://postgres:[PASSWORD]@db.jiasmmmmhtreoacdpiby.supabase.co:5432/postgres" \
  -c "SELECT * FROM public.upload_error_stats;"

# Check table sizes
psql "postgresql://postgres:[PASSWORD]@db.jiasmmmmhtreoacdpiby.supabase.co:5432/postgres" \
  -c "SELECT
        schemaname || '.' || tablename as table_name,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
      FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename IN ('user_audits', 'upload_errors', 'profiles')
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"
```

---

## 📝 Post-Migration Tasks

### Immediate (Day 1)
- [ ] Verify all validation checks pass
- [ ] Monitor application logs for errors
- [ ] Check database performance metrics
- [ ] Update documentation with new features
- [ ] Notify team of new audit capabilities

### Short-term (Week 1)
- [ ] Review audit logs for anomalies
- [ ] Set up dashboard for upload error tracking
- [ ] Schedule cleanup job for old errors
- [ ] Train support team on new error tracking
- [ ] Document audit query examples for team

### Long-term (Month 1)
- [ ] Analyze audit data for insights
- [ ] Review RLS policies effectiveness
- [ ] Optimize indexes based on usage
- [ ] Consider archiving strategy for old audits
- [ ] Review and update error categorization

---

## 🆘 Emergency Contacts

**During Migration:**
- Database Admin: [Name] - [Contact]
- Backend Lead: [Name] - [Contact]
- DevOps On-Call: [Name] - [Contact]

**Supabase Support:**
- Dashboard: https://app.supabase.com
- Support: support@supabase.com
- Status: https://status.supabase.com

---

## ✅ Sign-Off

**Executed By:** _____________________ **Date:** _________

**Reviewed By:** _____________________ **Date:** _________

**Approved By:** _____________________ **Date:** _________

---

*This execution plan was auto-generated by the migration reconciliation process.*
*Review carefully before execution. When in doubt, test on development first.*
