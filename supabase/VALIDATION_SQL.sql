-- ============================================================================
-- Supabase Migration Validation SQL
-- ============================================================================
-- Description: Comprehensive validation queries for migration reconciliation
-- Purpose: Verify schema consistency between prod and dev environments
-- Usage: Run these queries BEFORE and AFTER migration to verify success
-- ============================================================================

-- ============================================================================
-- SECTION 1: Pre-Migration Validation
-- ============================================================================
-- Run these BEFORE applying migrations to establish baseline

-- 1.1: Count rows in all tables (baseline for comparison)
-- ============================================================================
SELECT
    'profiles' as table_name,
    COUNT(*) as row_count,
    COUNT(*) FILTER (WHERE "deletedAt" IS NOT NULL) as soft_deleted_count
FROM public.profiles
UNION ALL
SELECT
    'addresses',
    COUNT(*),
    COUNT(*) FILTER (WHERE "deletedAt" IS NOT NULL)
FROM public.addresses
UNION ALL
SELECT
    'catering_requests',
    COUNT(*),
    COUNT(*) FILTER (WHERE "deletedAt" IS NOT NULL)
FROM public.catering_requests
UNION ALL
SELECT
    'on_demand_requests',
    COUNT(*),
    COUNT(*) FILTER (WHERE "deletedAt" IS NOT NULL)
FROM public.on_demand_requests
UNION ALL
SELECT
    'job_applications',
    COUNT(*),
    COUNT(*) FILTER (WHERE "deletedAt" IS NOT NULL)
FROM public.job_applications
UNION ALL
SELECT
    'delivery_configurations',
    COUNT(*),
    NULL
FROM public.delivery_configurations
UNION ALL
SELECT
    'address_favorites',
    COUNT(*),
    NULL
FROM public.address_favorites
UNION ALL
SELECT
    'address_usage_history',
    COUNT(*),
    NULL
FROM public.address_usage_history
ORDER BY table_name;

-- 1.2: Check for NEW tables that should exist after migration
-- ============================================================================
SELECT
    table_name,
    CASE
        WHEN table_name = 'user_audits' THEN 'Should be created by migration'
        WHEN table_name = 'upload_errors' THEN 'Should be created by migration'
        ELSE 'Should already exist'
    END as status
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('user_audits', 'upload_errors', 'profiles', 'addresses')
ORDER BY table_name;

-- 1.3: Check for NEW columns in profiles table
-- ============================================================================
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default,
    CASE
        WHEN column_name = 'deletedBy' THEN 'Should be created by migration'
        WHEN column_name = 'deletionReason' THEN 'Should be created by migration'
        WHEN column_name = 'deletedAt' THEN 'Should already exist'
        ELSE 'Existing column'
    END as status
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'profiles'
AND column_name IN ('deletedAt', 'deletedBy', 'deletionReason')
ORDER BY column_name;

-- 1.4: Verify constraints on address_usage_history
-- ============================================================================
SELECT
    con.conname AS constraint_name,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE rel.relname = 'address_usage_history'
AND nsp.nspname = 'public'
AND con.contype = 'c' -- CHECK constraints
ORDER BY con.conname;

-- ============================================================================
-- SECTION 2: Migration Dry-Run Validation
-- ============================================================================
-- Run these in a TRANSACTION with ROLLBACK to test without committing

-- 2.1: Test user_audits table creation (DRY RUN)
-- ============================================================================
DO $$
BEGIN
    -- Check if table will be created successfully
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'user_audits'
    ) THEN
        RAISE NOTICE 'user_audits table already exists - migration will skip creation';
    ELSE
        RAISE NOTICE 'user_audits table will be created';
    END IF;
END $$;

-- 2.2: Test profiles column additions (DRY RUN)
-- ============================================================================
DO $$
BEGIN
    -- Check deletedBy column
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'deletedBy'
    ) THEN
        RAISE NOTICE 'deletedBy column already exists - migration will skip';
    ELSE
        RAISE NOTICE 'deletedBy column will be added';
    END IF;

    -- Check deletionReason column
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'deletionReason'
    ) THEN
        RAISE NOTICE 'deletionReason column already exists - migration will skip';
    ELSE
        RAISE NOTICE 'deletionReason column will be added';
    END IF;
END $$;

-- 2.3: Validate foreign key integrity before migration
-- ============================================================================
-- Check for any orphaned records that would break FK constraints
SELECT
    'profiles with invalid deletedBy' as issue,
    COUNT(*) as problem_count
FROM public.profiles p1
WHERE p1."deletedBy" IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM public.profiles p2
    WHERE p2.id = p1."deletedBy"
);

-- ============================================================================
-- SECTION 3: Post-Migration Validation
-- ============================================================================
-- Run these AFTER applying migrations to verify success

-- 3.1: Verify user_audits table was created
-- ============================================================================
SELECT
    'user_audits table exists' as check_name,
    CASE
        WHEN COUNT(*) = 1 THEN '✓ PASS'
        ELSE '✗ FAIL - table not found'
    END as result
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'user_audits';

-- 3.2: Verify user_audits columns are correct
-- ============================================================================
SELECT
    'user_audits has all required columns' as check_name,
    CASE
        WHEN COUNT(*) = 8 THEN '✓ PASS'
        ELSE '✗ FAIL - expected 8 columns, found ' || COUNT(*)
    END as result
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'user_audits'
AND column_name IN (
    'id', 'userId', 'action', 'performedBy',
    'changes', 'reason', 'metadata', 'createdAt'
);

-- 3.3: Verify user_audits indexes were created
-- ============================================================================
SELECT
    'user_audits has all required indexes' as check_name,
    CASE
        WHEN COUNT(*) >= 6 THEN '✓ PASS - ' || COUNT(*) || ' indexes found'
        ELSE '✗ FAIL - expected at least 6 indexes, found ' || COUNT(*)
    END as result
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename = 'user_audits';

-- 3.4: Verify upload_errors table was created
-- ============================================================================
SELECT
    'upload_errors table exists' as check_name,
    CASE
        WHEN COUNT(*) = 1 THEN '✓ PASS'
        ELSE '✗ FAIL - table not found'
    END as result
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'upload_errors';

-- 3.5: Verify upload_errors columns are correct
-- ============================================================================
SELECT
    'upload_errors has all required columns' as check_name,
    CASE
        WHEN COUNT(*) = 10 THEN '✓ PASS'
        ELSE '✗ FAIL - expected 10 columns, found ' || COUNT(*)
    END as result
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'upload_errors'
AND column_name IN (
    'id', 'correlationId', 'errorType', 'message',
    'userMessage', 'details', 'userId', 'timestamp',
    'retryable', 'resolved'
);

-- 3.6: Verify profiles table has new columns
-- ============================================================================
SELECT
    column_name,
    data_type,
    is_nullable,
    '✓ Column exists' as result
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'profiles'
AND column_name IN ('deletedAt', 'deletedBy', 'deletionReason')
ORDER BY column_name;

-- 3.7: Verify audit trigger was created
-- ============================================================================
SELECT
    'audit trigger exists on profiles' as check_name,
    CASE
        WHEN COUNT(*) = 1 THEN '✓ PASS'
        ELSE '✗ FAIL - trigger not found'
    END as result
FROM information_schema.triggers
WHERE event_object_schema = 'public'
AND event_object_table = 'profiles'
AND trigger_name = 'trg_audit_profile_changes';

-- 3.8: Verify audit trigger function was created
-- ============================================================================
SELECT
    'audit trigger function exists' as check_name,
    CASE
        WHEN COUNT(*) = 1 THEN '✓ PASS'
        ELSE '✗ FAIL - function not found'
    END as result
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'audit_profile_changes';

-- 3.9: Verify RLS policies were created on user_audits
-- ============================================================================
SELECT
    'RLS policies exist on user_audits' as check_name,
    CASE
        WHEN COUNT(*) >= 3 THEN '✓ PASS - ' || COUNT(*) || ' policies found'
        ELSE '✗ FAIL - expected at least 3 policies, found ' || COUNT(*)
    END as result
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'user_audits';

-- 3.10: Verify RLS policies were created on upload_errors
-- ============================================================================
SELECT
    'RLS policies exist on upload_errors' as check_name,
    CASE
        WHEN COUNT(*) >= 3 THEN '✓ PASS - ' || COUNT(*) || ' policies found'
        ELSE '✗ FAIL - expected at least 3 policies, found ' || COUNT(*)
    END as result
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'upload_errors';

-- 3.11: Verify backfill of audit data for soft-deleted users
-- ============================================================================
SELECT
    'audit records exist for soft-deleted users' as check_name,
    CASE
        WHEN COUNT(*) > 0 THEN '✓ PASS - ' || COUNT(*) || ' historical records created'
        WHEN (SELECT COUNT(*) FROM public.profiles WHERE "deletedAt" IS NOT NULL) = 0
            THEN '✓ PASS - no soft-deleted users to backfill'
        ELSE '⚠ WARNING - no audit records but ' ||
             (SELECT COUNT(*) FROM public.profiles WHERE "deletedAt" IS NOT NULL) ||
             ' soft-deleted users exist'
    END as result
FROM public.user_audits
WHERE reason LIKE '%Historical deletion%';

-- 3.12: Test audit logging functionality
-- ============================================================================
-- This test updates a profile and checks if audit record was created
DO $$
DECLARE
    v_test_user_id UUID;
    v_audit_count INTEGER;
    v_original_name TEXT;
BEGIN
    -- Find a test user (non-deleted)
    SELECT id, name INTO v_test_user_id, v_original_name
    FROM public.profiles
    WHERE "deletedAt" IS NULL
    LIMIT 1;

    IF v_test_user_id IS NOT NULL THEN
        -- Count audits before test
        SELECT COUNT(*) INTO v_audit_count
        FROM public.user_audits
        WHERE "userId" = v_test_user_id;

        -- Make a trivial update (set name to itself) to trigger audit
        UPDATE public.profiles
        SET name = name
        WHERE id = v_test_user_id;

        -- Check if audit record was created
        IF (SELECT COUNT(*) FROM public.user_audits WHERE "userId" = v_test_user_id) > v_audit_count THEN
            RAISE NOTICE '✓ PASS - Audit trigger is working correctly';
        ELSE
            RAISE WARNING '✗ FAIL - Audit trigger did not create record';
        END IF;
    ELSE
        RAISE NOTICE '⚠ SKIP - No users available for audit trigger test';
    END IF;
END $$;

-- ============================================================================
-- SECTION 4: Data Integrity Validation
-- ============================================================================

-- 4.1: Check for NULL values in NOT NULL columns
-- ============================================================================
SELECT
    'user_audits data integrity' as check_name,
    CASE
        WHEN COUNT(*) = 0 THEN '✓ PASS - all required fields populated'
        ELSE '✗ FAIL - ' || COUNT(*) || ' records with NULL in required fields'
    END as result
FROM public.user_audits
WHERE "userId" IS NULL
OR action IS NULL
OR "createdAt" IS NULL;

-- 4.2: Check foreign key integrity
-- ============================================================================
SELECT
    'user_audits foreign keys valid' as check_name,
    CASE
        WHEN orphaned_userId_count = 0 AND orphaned_performedBy_count = 0
            THEN '✓ PASS - all foreign keys valid'
        ELSE '✗ FAIL - found ' || orphaned_userId_count || ' orphaned userId and ' ||
             orphaned_performedBy_count || ' orphaned performedBy'
    END as result
FROM (
    SELECT
        (SELECT COUNT(*) FROM public.user_audits ua
         WHERE ua."userId" IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = ua."userId")
        ) as orphaned_userId_count,
        (SELECT COUNT(*) FROM public.user_audits ua
         WHERE ua."performedBy" IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = ua."performedBy")
        ) as orphaned_performedBy_count
) counts;

-- ============================================================================
-- SECTION 5: Performance Validation
-- ============================================================================

-- 5.1: Check index usage (run after some time with traffic)
-- ============================================================================
SELECT
    schemaname || '.' || tablename as table_name,
    indexname,
    idx_scan as times_used,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    CASE
        WHEN idx_scan = 0 THEN '⚠ WARNING - Index never used'
        WHEN idx_scan < 10 THEN '⚠ Low usage'
        ELSE '✓ Good usage'
    END as usage_status
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
AND tablename IN ('user_audits', 'upload_errors', 'profiles')
ORDER BY tablename, indexname;

-- 5.2: Check table sizes after migration
-- ============================================================================
SELECT
    schemaname || '.' || tablename as table_name,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) -
                   pg_relation_size(schemaname||'.'||tablename)) as indexes_size
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('user_audits', 'upload_errors', 'profiles', 'addresses')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ============================================================================
-- SECTION 6: Summary Validation Report
-- ============================================================================

SELECT
    '=========================' as separator
UNION ALL
SELECT
    'MIGRATION VALIDATION SUMMARY'
UNION ALL
SELECT
    '========================='
UNION ALL
SELECT
    'Tables Created: ' || (
        SELECT COUNT(*)::TEXT
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN ('user_audits', 'upload_errors')
    )
UNION ALL
SELECT
    'New Columns Added: ' || (
        SELECT COUNT(*)::TEXT
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name IN ('deletedBy', 'deletionReason')
    )
UNION ALL
SELECT
    'Triggers Created: ' || (
        SELECT COUNT(*)::TEXT
        FROM information_schema.triggers
        WHERE event_object_schema = 'public'
        AND trigger_name LIKE '%audit%'
    )
UNION ALL
SELECT
    'RLS Policies Created: ' || (
        SELECT COUNT(*)::TEXT
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename IN ('user_audits', 'upload_errors')
    )
UNION ALL
SELECT
    'Audit Records Backfilled: ' || (
        SELECT COUNT(*)::TEXT
        FROM public.user_audits
        WHERE reason LIKE '%Historical deletion%'
    )
UNION ALL
SELECT
    '========================='
UNION ALL
SELECT
    'Status: VALIDATION COMPLETE';

-- ============================================================================
-- END OF VALIDATION
-- ============================================================================
