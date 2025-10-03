# Database Schema Comparison Report

**Generated:** 2025-10-03
**Dev Database:** `khvteminrbghoeuqajzm` (rs-dev, PostgreSQL 17, us-west-1)
**Prod Database:** `jiasmmmmhtreoacdpiby` (ready-set-web, PostgreSQL 15, us-east-1)

---

## 🚨 CRITICAL FINDINGS

### 1. **COMPLETE MIGRATION HISTORY DIVERGENCE**
The dev and production databases have **completely different migration histories**, indicating they evolved separately:

**Dev Migrations (15 total):**
- Started: September 11, 2025
- All migrations created in September 2025
- Database appears to have been rebuilt from scratch

**Prod Migrations (15 total):**
- Started: April 15, 2025
- Spans from April to September 2025
- Represents the original production timeline

**Impact:** This is a **MAJOR BLOCKER** for standard migration-based deployment. The databases cannot be safely merged using traditional migration tools.

---

## 2. Database Schema Differences

### Tables Present in BOTH Databases
- `profiles` ✓
- `accounts` ✓
- `sessions` ✓
- `addresses` ✓
- `catering_requests` ✓
- `dispatches` ✓
- `file_uploads` ✓
- `on_demand_requests` ✓
- `user_addresses` ✓
- `verification_tokens` ✓
- `form_submissions` ✓
- `lead_captures` ✓
- `job_applications` ✓
- `pricing_tiers` ✓
- `calculator_templates` ✓
- `pricing_rules` ✓
- `client_configurations` ✓
- `calculation_history` ✓

### Tables ONLY in Dev
- `testimonials` (10 rows)

### Tables ONLY in Prod
- `_prisma_migrations` (2 rows) - Prisma migration tracking
- `spatial_ref_sys` (8,500 rows) - PostGIS reference systems
- `drivers` (0 rows)
- `driver_locations` (0 rows)
- `driver_shifts` (0 rows)
- `shift_breaks` (0 rows)
- `deliveries` (0 rows)

---

## 3. Critical Column Differences

### `profiles` Table
**Dev has:**
- Default value for `id`: `gen_random_uuid()`
- Default timestamps on `createdAt` and `updatedAt`

**Prod missing:**
- Default value for `id` column

### `sessions` Table
**Type Mismatch:**
- Dev: `expires` is `timestamp with time zone`
- Prod: `expires` is `timestamp without time zone`

### `addresses` Table
**Column Order & Defaults Different:**
- Dev: `createdAt` has `CURRENT_TIMESTAMP` default
- Prod: `createdAt` comes before `isRestaurant` and `isShared`
- Timestamp types differ (with/without timezone)

### `catering_requests`, `dispatches`, `file_uploads`, `user_addresses`, etc.
Multiple timestamp column type mismatches between `timestamp with time zone` (dev) vs `timestamp without time zone` (prod)

---

## 4. Row Level Security (RLS) Differences

### Dev Database
**RLS Enabled Tables:**
- `profiles` only (3 policies)

**No RLS Enabled:**
- All other tables have RLS disabled

### Prod Database
**RLS Enabled Tables:**
- `profiles` (4 policies)
- `accounts` (4 policies)
- `sessions` (4 policies)
- `addresses` (4 policies)
- `catering_requests` (4 policies)
- `dispatches` (4 policies)
- `file_uploads` (4 policies)
- `on_demand_requests` (4 policies)
- `user_addresses` (4 policies)
- `verification_tokens` (1 policy)
- `form_submissions` (4 policies)
- `lead_captures` (4 policies)
- `job_applications` (4 policies)

**Impact:** Prod has comprehensive RLS coverage (48 policies), while dev has minimal RLS (3 policies). **This is a MAJOR SECURITY GAP in dev.**

---

## 5. Database Functions & Triggers

### Dev Database
- **No custom functions** in public schema
- **No triggers** in public schema

### Prod Database
- **Function:** `update_updated_at_column()` - Updates timestamp on row changes
- **Triggers on:**
  - `deliveries.update_deliveries_updated_at`
  - `driver_shifts.update_driver_shifts_updated_at`
  - `drivers.update_drivers_updated_at`

**Impact:** Prod has automated timestamp management; dev does not. This affects data consistency.

---

## 6. Extensions Comparison

### Both Have Installed:
- `plpgsql` (1.0)
- `pgcrypto` (1.3)
- `uuid-ossp` (1.1)
- `pg_graphql` (1.5.11)
- `supabase_vault`
- `pgjwt` (Prod only: 0.2.0)

### Dev Has (Prod Doesn't):
- `pg_stat_statements` (1.11) in extensions schema

### Prod Has (Dev Doesn't):
- `postgis` (3.3.7) - **Critical for geo features**
- `pgsodium` (3.1.8)
- `pg_stat_statements` (1.10) - older version, no schema specified

**Impact:** Prod has PostGIS for geolocation features. Dev lacks this critical extension.

---

## 7. Data Row Count Comparison

| Table | Dev Rows | Prod Rows | Difference |
|-------|----------|-----------|------------|
| profiles | 13 | 107 | **-94** |
| accounts | 0 | 0 | 0 |
| sessions | 0 | 0 | 0 |
| addresses | 22 | 102 | **-80** |
| catering_requests | 9 | 53 | **-44** |
| dispatches | 7 | 6 | +1 |
| file_uploads | 0 | 47 | **-47** |
| on_demand_requests | 0 | 1 | -1 |
| user_addresses | 17 | 32 | **-15** |
| pricing_tiers | 0 | 0 | 0 |
| calculator_templates | 1 | 2 | -1 |
| pricing_rules | 7 | 16 | -9 |
| job_applications | 0 | 97 | **-97** |
| testimonials | 10 | N/A | N/A |

**Impact:** Prod has significantly more production data. Dev appears to be a development environment with test data.

---

## 8. Security Advisors - Critical Issues

### Dev Database - Security Issues
1. **ERROR: RLS Disabled** on:
   - `accounts`, `sessions`, `testimonials`
   - `calculator_templates`, `pricing_rules`, `calculation_history`, `client_configurations`
2. **WARN: Leaked Password Protection Disabled** in Auth

### Prod Database - Security Issues
1. **ERROR: RLS Disabled** on:
   - `deliveries`, `pricing_tiers`, `calculator_templates`, `pricing_rules`
   - `client_configurations`, `spatial_ref_sys`, `calculation_history`
   - `drivers`, `driver_locations`, `driver_shifts`, `shift_breaks`
2. **WARN: Function Search Path Mutable** (3 functions)
3. **WARN: PostGIS Extension in Public Schema**
4. **WARN: Auth OTP Long Expiry** (> 1 hour)
5. **WARN: Leaked Password Protection Disabled**
6. **WARN: Postgres Version 15.8.1 Has Security Patches Available**

---

## 9. Performance Advisors - Notable Issues

### Both Databases
- **Multiple unindexed foreign keys** (can cause slow queries)
- **Auth RLS InitPlan Issues** - `auth.uid()` calls not optimized (should wrap in `SELECT`)
- **Many unused indexes** - candidates for removal to improve write performance

### Prod Specific
- **6 unindexed foreign keys** in critical tables
- **36+ unused indexes** wasting storage and slowing writes

---

## 10. Deployment Recommendations

### ⛔ DO NOT PROCEED WITH STANDARD MIGRATION MERGE

The divergent migration histories make it **impossible** to safely merge using traditional migration tools. Here are the options:

### Option A: Schema-Only Migration (Recommended)
1. **Backup prod database completely**
2. **Generate schema diff SQL script** comparing prod → dev structure
3. **Manually apply only new features** from dev to prod:
   - Add `testimonials` table
   - Update timestamp types to `timestamptz`
   - Add missing default values
   - Enable missing RLS policies
4. **Test thoroughly in staging clone**
5. **Apply to production during maintenance window**

### Option B: Fresh Production Database
1. **Export all production data**
2. **Deploy dev schema as new production**
3. **Migrate data with transformation scripts**
4. **High risk, requires extended downtime**

### Option C: Keep Databases Separate
1. **Continue using prod as-is**
2. **Manually port proven dev features to prod**
3. **Maintain separate code branches**
4. **Lower risk but higher maintenance**

---

## 11. Required Actions Before ANY Deployment

### Security (CRITICAL)
- [ ] Enable RLS on ALL public tables in both databases
- [ ] Review and test all 48+ RLS policies
- [ ] Enable leaked password protection in Supabase Auth
- [ ] Fix function search_path security issues
- [ ] Move PostGIS extension out of public schema

### Schema Alignment
- [ ] Standardize all timestamp columns to `timestamptz`
- [ ] Add missing default values to columns
- [ ] Decide on PostGIS: add to dev OR remove from prod
- [ ] Add `update_updated_at_column()` function to dev if needed
- [ ] Install missing triggers on dev database

### Performance
- [ ] Add indexes for unindexed foreign keys (6 in prod, 2 in dev)
- [ ] Optimize RLS policies with `(SELECT auth.uid())` pattern
- [ ] Remove unused indexes (30+ candidates)
- [ ] Upgrade Postgres 15 → 17 in prod (security patches)

### Data Integrity
- [ ] Document all data transformation requirements
- [ ] Create rollback scripts for every change
- [ ] Test in isolated staging environment
- [ ] Verify foreign key constraints after migration

---

## 12. Next Steps

1. **STOP** - Do not proceed with any automated deployment
2. **Stakeholder Decision Required** - Choose deployment strategy (A, B, or C)
3. **Create Detailed Migration Plan** - Based on chosen strategy
4. **Setup Staging Environment** - Clone prod, test changes
5. **Security Audit** - Fix all RLS and auth issues first
6. **Performance Testing** - Verify no regression
7. **Schedule Maintenance Window** - Plan for rollback capability

---

## Conclusion

The dev and prod databases have **diverged significantly** and cannot be safely merged using standard migration tools. A **manual, carefully planned migration strategy** is required. Security issues in both databases must be addressed before any production deployment.

**Recommended Timeline:**
- Week 1: Security fixes + stakeholder decision
- Week 2-3: Staging environment + migration script development
- Week 4: Testing + validation
- Week 5: Production deployment with rollback plan

**Risk Level: HIGH** ⚠️
**Estimated Effort: 3-4 weeks** ⏱️
**Downtime Required: 1-4 hours** (depending on strategy) 🕐
