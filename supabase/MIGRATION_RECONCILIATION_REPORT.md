# Supabase Migration Reconciliation Report
## Generated: October 14, 2025

---

## 📊 Executive Summary

**Environment Status:**
- **Production (ready-set-web)**: 22 migrations | Last migration: Oct 10, 2025
- **Development (rs-dev)**: 19 migrations | Last migration: Oct 14, 2025
- **Divergence Date**: September 11, 2025 (when dev was recreated)
- **Critical Finding**: Dev has 2 NEW tables and enhanced soft-delete features not in prod

---

## 🔍 Detailed Migration Analysis

### Production Migration Timeline
```
20250415004416 - create_public_storage_policies
20250505054709 - create_file_uploader_bucket_simplified
20250505055547 - add_bucket_policies
20250514082648 - update_status_enums
20250529034158 - enable_rls_all_tables
20250529034224 - create_rls_policies
20250529034256 - create_remaining_rls_policies
20250529034431 - add_accounts_rls_policies
20250529035106 - fix_profiles_infinite_recursion
20250529035146 - remove_admin_checks_from_rls
20250703050118 - add_pricing_tiers
20250806105943 - add_shift_tracking
20250806110001 - add_tracking_functions
20250806110016 - add_tracking_triggers
20250902033810 - add_calculator_system
20250902060923 - ready_set_food_template_fixed
20251003055313 - prod_schema_update_20251003
20251003055431 - prod_rls_policies_20251003_v3
20251003055454 - prod_performance_20251003
20251009045616 - add_delivery_configurations
20251010070432 - add_address_favorites_and_usage_tracking ⚠️
20251010070522 - fix_address_usage_context_constraint ⚠️ PROD ONLY
```

### Development Migration Timeline
```
20250911021648 - establish_baseline_schema (DEV RECREATION START)
20250911021701 - create_profiles_table
20250911021706 - create_accounts_sessions_tables
20250911021716 - create_addresses_table
20250911021720 - create_pricing_tiers_table
20250911021735 - create_catering_requests_table
20250911021741 - create_on_demand_requests_table
20250911021758 - create_remaining_tables
20250911021809 - create_job_applications_and_forms
20250911040117 - add_calculator_system
20250912035719 - add_testimonials_table
20250915062644 - create_testimonials_table (DUPLICATE?)
20250915065806 - add_calculator_system (DUPLICATE?)
20250915065822 - add_ready_set_food_template
20250929052019 - fix_calculator_permissions
20251009045718 - add_delivery_configurations
20251010062501 - add_address_favorites_and_usage_tracking ⚠️
20251014215458 - add_soft_delete_fields_and_audit_model ⚠️ DEV ONLY
20251014215531 - add_delivery_configurations (DUPLICATE?) ⚠️ DEV ONLY
```

---

## 🎯 Critical Divergence Points

### 1. **Address Favorites Feature - Timestamp Mismatch**
- **Prod**: `20251010070432` (Oct 10, 07:04 UTC)
- **Dev**: `20251010062501` (Oct 10, 06:25 UTC)
- **Impact**: Same feature, different migration versions
- **Risk Level**: MEDIUM - Both implement same tables

### 2. **Prod-Only Migration (MISSING IN DEV)**
- **Migration**: `20251010070522` - fix_address_usage_context_constraint
- **Impact**: Constraint fix applied in prod but NOT in dev
- **Risk Level**: HIGH - Data integrity issue

### 3. **Dev-Only Migrations (MISSING IN PROD)**
- **Migration 1**: `20251014215458` - add_soft_delete_fields_and_audit_model
  - Adds `user_audits` table (audit logging)
  - Adds enhanced soft-delete fields to `profiles` table
  - Risk Level: CRITICAL - New features not in prod

- **Migration 2**: `20251014215531` - add_delivery_configurations (duplicate?)
  - Possibly duplicate of `20251009045616`
  - Risk Level: MEDIUM - May be redundant

---

## 📦 Schema Differences Identified

### New Tables in Dev (Not in Prod)
1. **`user_audits`** ⚠️ CRITICAL
   - Tracks all user modifications with audit trail
   - Columns: id, userId, action, performedBy, changes, reason, metadata, createdAt
   - Foreign keys to profiles table
   - **Missing in Production**

2. **`upload_errors`** ⚠️ IMPORTANT
   - Tracks file upload error logs
   - Columns: id, correlationId, errorType, message, userMessage, details, userId, timestamp, retryable, resolved
   - **Missing in Production**

### Enhanced Columns in Dev (Not in Prod)

#### `profiles` Table
- **Prod**: Only has `deletedAt` column
- **Dev**: Has THREE soft-delete columns:
  - `deletedAt` (timestamp)
  - `deletedBy` (uuid, FK to profiles)
  - `deletionReason` (text)
- **Impact**: Enhanced audit trail for user deletions

### RLS Differences

#### `delivery_configurations` Table
- **Prod**: RLS **DISABLED**, 1 row
- **Dev**: RLS **ENABLED**, 4 rows
- **Impact**: Security policy difference

#### Multiple Tables
- **Prod**: Many tables have RLS **ENABLED**
- **Dev**: Some tables have RLS **DISABLED** (accounts, sessions, addresses, pricing_tiers, etc.)
- **Impact**: Potential security vulnerability in dev

---

## 🚨 Data Impact Assessment

### Production Data at Risk
- **63 user profiles** - Need soft-delete enhancement
- **90 addresses** - Constraint fix needed from dev
- **40 catering requests** - Active orders
- **No audit trail** - user_audits table missing

### Development Data
- **24 user profiles** - Has enhanced features
- **202 addresses** - More test data
- **32 catering requests**
- **Full audit trail** - user_audits implemented

---

## 🛡️ Recommended Reconciliation Strategy

### **Option A: Bridge Migration Approach** ✅ RECOMMENDED

Create sequential bridge migrations that:
1. Apply prod-only fixes to dev first
2. Apply dev-only features to prod second
3. Harmonize timestamps and maintain both histories

**Pros:**
- Preserves all data
- Maintains full migration history
- Non-destructive
- Easy rollback

**Cons:**
- Creates additional migrations
- Slightly more complex

### **Option B: Rebase Development** ⚠️ NOT RECOMMENDED

Drop and recreate dev from prod baseline, then replay dev-only migrations.

**Pros:**
- Clean migration history
- Perfect alignment

**Cons:**
- **DESTROYS dev data** (202 addresses, etc.)
- Complex migration replay
- High risk

### **Option C: New Baseline** 🚫 AVOID

Create a new baseline from current prod schema.

**Pros:**
- Fresh start

**Cons:**
- **LOSES all migration history**
- Makes debugging harder
- Not following best practices

---

## ✅ Proposed Solution: Bridge Migration Plan

### Phase 1: Analyze Missing Prod Migration
**Goal**: Understand what `fix_address_usage_context_constraint` does

### Phase 2: Create Prod-to-Dev Bridge Migration
**File**: `supabase/migrations/20251014220000_apply_prod_address_constraint_fix.sql`
- Apply the constraint fix from prod to dev
- Ensure data integrity for address usage context

### Phase 3: Create Dev-to-Prod Bridge Migrations

#### Migration 1: Audit System
**File**: `supabase/migrations/20251014220100_add_audit_system.sql`
- Create `user_audits` table
- Add `deletedBy` and `deletionReason` columns to profiles
- Create triggers for audit logging
- Backfill audit data where possible

#### Migration 2: Upload Error Tracking
**File**: `supabase/migrations/20251014220200_add_upload_errors_table.sql`
- Create `upload_errors` table
- Add indexes for performance

#### Migration 3: RLS Harmonization
**File**: `supabase/migrations/20251014220300_harmonize_rls_policies.sql`
- Review and align RLS policies between environments
- Document differences and reasoning

### Phase 4: Validate Delivery Configurations
- Investigate duplicate migration in dev
- Ensure delivery_configurations table is consistent

---

## 📋 Step-by-Step Execution Plan

### Pre-Migration Checklist
- [ ] Create full database backup of both environments
- [ ] Document current row counts for all tables
- [ ] Export production data for rollback
- [ ] Schedule maintenance window
- [ ] Notify team of migration

### Execution Order

#### Step 1: Backup Everything
```bash
# Production backup
supabase db dump --project-id jiasmmmmhtreoacdpiby > prod_backup_$(date +%Y%m%d_%H%M%S).sql

# Development backup
supabase db dump --project-id khvteminrbghoeuqajzm > dev_backup_$(date +%Y%m%d_%H%M%S).sql
```

#### Step 2: Run Dry-Run Validation SQL (see validation section below)

#### Step 3: Apply to Development First
```bash
# Apply prod fix to dev
supabase migration up --project-id khvteminrbghoeuqajzm

# Validate
# Run validation SQL
```

#### Step 4: Apply to Production (Maintenance Window)
```bash
# Apply dev features to prod
supabase migration up --project-id jiasmmmmhtreoacdpiby

# Validate
# Run validation SQL
```

#### Step 5: Verify Both Environments
- Check table schemas match
- Verify row counts
- Test application functionality
- Check RLS policies

---

## 🔄 Rollback Procedures

### If Migration Fails on Dev
```sql
-- Connect to dev database
-- Rollback last migration
BEGIN;
-- Restore from backup
\i dev_backup_YYYYMMDD_HHMMSS.sql
COMMIT;
```

### If Migration Fails on Prod ⚠️ CRITICAL
```sql
-- EMERGENCY ROLLBACK PROCEDURE
BEGIN;

-- Drop new tables (if created)
DROP TABLE IF EXISTS user_audits CASCADE;
DROP TABLE IF EXISTS upload_errors CASCADE;

-- Remove new columns from profiles
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS "deletedBy",
  DROP COLUMN IF EXISTS "deletionReason";

-- Restore from backup as last resort
-- \i prod_backup_YYYYMMDD_HHMMSS.sql

COMMIT;
```

### Rollback Validation
```sql
-- Verify table exists
SELECT COUNT(*) FROM public.profiles;
SELECT COUNT(*) FROM public.catering_requests;

-- Verify critical data
SELECT id, email, "deletedAt" FROM public.profiles WHERE "deletedAt" IS NOT NULL;
```

---

## 🔍 Next Steps

1. **Review this report with team**
2. **Extract and analyze the prod-only migration SQL**
3. **Create bridge migration files**
4. **Test on dev first**
5. **Schedule prod maintenance window**
6. **Execute and validate**

---

## ⚠️ Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Data loss in prod | CRITICAL | Full backup before migration |
| RLS policy gaps | HIGH | Audit and test policies |
| Constraint conflicts | MEDIUM | Dry-run validation first |
| Duplicate migrations | MEDIUM | Analyze and deduplicate |
| Application downtime | MEDIUM | Maintenance window + rollback plan |

---

## 📞 Support Contacts

- Database Admin: [Your contact]
- Dev Team Lead: [Your contact]
- On-Call Engineer: [Your contact]

---

*This report was generated automatically. Please review carefully before executing any migrations.*
