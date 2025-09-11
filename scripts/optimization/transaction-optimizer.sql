-- Transaction Optimization Script for User Deletion System
-- This script provides optimized transaction configurations and database tuning

-- ============================================
-- TRANSACTION OPTIMIZATION SETTINGS
-- ============================================

-- 1. Connection Pool Optimization
-- Adjust these settings in your database configuration

-- For production environments with high concurrency
-- max_connections = 200
-- shared_buffers = '256MB'
-- effective_cache_size = '1GB'
-- work_mem = '4MB'
-- maintenance_work_mem = '64MB'

-- For development environments  
-- max_connections = 50
-- shared_buffers = '128MB'
-- effective_cache_size = '512MB'
-- work_mem = '2MB'
-- maintenance_work_mem = '32MB'

-- ============================================
-- LOCK TIMEOUT OPTIMIZATION
-- ============================================

-- Set lock timeout to prevent indefinite waits
-- This should be shorter than transaction timeout
SET lock_timeout = '8s';

-- Set statement timeout for individual queries
SET statement_timeout = '15s';

-- Set idle in transaction timeout
SET idle_in_transaction_session_timeout = '30s';

-- ============================================
-- PERFORMANCE INDEXES FOR USER DELETION
-- ============================================

-- Create indexes concurrently to avoid blocking operations
BEGIN;

-- Primary profile lookup optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_id_type 
  ON profiles(id, type);

-- Dispatch relationship indexes (split OR conditions)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dispatches_driver_id_btree 
  ON dispatches USING btree(driver_id) 
  WHERE driver_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dispatches_user_id_btree 
  ON dispatches USING btree(user_id) 
  WHERE user_id IS NOT NULL;

-- File upload optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_file_uploads_user_id_not_null 
  ON file_uploads(user_id) 
  WHERE user_id IS NOT NULL;

-- Address creation tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_addresses_created_by_not_null 
  ON addresses(created_by) 
  WHERE created_by IS NOT NULL;

-- User address relationships
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_addresses_composite 
  ON user_addresses(address_id, user_id);

-- Active orders composite indexes with partial index for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_catering_active_user_status 
  ON catering_requests(user_id, status) 
  WHERE status IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ondemand_active_user_status 
  ON on_demand(user_id, status)
  WHERE status IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS');

-- Address relationship optimization indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_catering_pickup_address_not_null 
  ON catering_requests(pickup_address_id) 
  WHERE pickup_address_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_catering_delivery_address_not_null 
  ON catering_requests(delivery_address_id) 
  WHERE delivery_address_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ondemand_pickup_address_not_null 
  ON on_demand(pickup_address_id) 
  WHERE pickup_address_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ondemand_delivery_address_not_null 
  ON on_demand(delivery_address_id) 
  WHERE delivery_address_id IS NOT NULL;

COMMIT;

-- ============================================
-- TRANSACTION ISOLATION OPTIMIZATION
-- ============================================

-- For user deletion operations, READ COMMITTED is optimal
-- It provides good performance while preventing most concurrency issues
-- This setting should be used in the application code:
-- 
-- await prisma.$transaction(async (tx) => {
--   // deletion operations
-- }, { 
--   isolationLevel: 'ReadCommitted',
--   timeout: dynamicTimeout 
-- });

-- ============================================
-- VACUUM AND ANALYZE OPTIMIZATION
-- ============================================

-- Configure auto-vacuum for optimal performance
-- These settings should be in postgresql.conf:
-- 
-- autovacuum = on
-- autovacuum_max_workers = 3
-- autovacuum_naptime = 1min
-- autovacuum_vacuum_threshold = 50
-- autovacuum_analyze_threshold = 50
-- autovacuum_vacuum_scale_factor = 0.2
-- autovacuum_analyze_scale_factor = 0.1

-- Manual analyze for immediate optimization after index creation
ANALYZE profiles;
ANALYZE dispatches;
ANALYZE file_uploads;
ANALYZE addresses;
ANALYZE user_addresses;
ANALYZE catering_requests;
ANALYZE on_demand;

-- ============================================
-- CONSTRAINT OPTIMIZATION
-- ============================================

-- Ensure foreign key constraints are properly indexed
-- Check for missing foreign key indexes

SELECT 
    tc.table_name,
    kcu.column_name,
    tc.constraint_name,
    tc.constraint_type,
    CASE 
        WHEN i.indexname IS NULL THEN 'MISSING INDEX'
        ELSE 'INDEX EXISTS: ' || i.indexname
    END as index_status
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
LEFT JOIN pg_indexes i 
    ON i.tablename = tc.table_name 
    AND i.indexdef LIKE '%' || kcu.column_name || '%'
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND tc.table_name IN (
        'accounts', 'sessions', 'user_addresses', 'dispatches', 
        'file_uploads', 'catering_requests', 'on_demand'
    )
ORDER BY tc.table_name, kcu.column_name;

-- ============================================
-- MONITORING QUERIES FOR PERFORMANCE
-- ============================================

-- Query to monitor lock waits during deletion operations
CREATE OR REPLACE VIEW user_deletion_locks AS
SELECT 
    pg_stat_activity.pid,
    pg_stat_activity.usename,
    pg_stat_activity.query,
    pg_stat_activity.state,
    pg_stat_activity.wait_event_type,
    pg_stat_activity.wait_event,
    EXTRACT(EPOCH FROM (NOW() - pg_stat_activity.query_start)) as query_duration_seconds,
    pg_locks.locktype,
    pg_locks.relation::regclass as locked_table
FROM pg_stat_activity
LEFT JOIN pg_locks ON pg_stat_activity.pid = pg_locks.pid
WHERE pg_stat_activity.query LIKE '%DELETE%' 
   OR pg_stat_activity.query LIKE '%UPDATE%'
   OR pg_stat_activity.query LIKE '%profiles%'
ORDER BY query_duration_seconds DESC;

-- Query to monitor transaction performance
CREATE OR REPLACE VIEW user_deletion_performance AS
SELECT 
    schemaname,
    tablename,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes,
    n_tup_hot_upd as hot_updates,
    n_live_tup as live_tuples,
    n_dead_tup as dead_tuples,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
WHERE tablename IN (
    'profiles', 'accounts', 'sessions', 'user_addresses',
    'dispatches', 'file_uploads', 'addresses', 
    'catering_requests', 'on_demand'
)
ORDER BY n_tup_del DESC;

-- ============================================
-- QUERY PLAN ANALYSIS FOR COMMON OPERATIONS
-- ============================================

-- Analyze query plans for common deletion operations
-- Run these during performance testing to identify bottlenecks

-- 1. Profile lookup query plan
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) 
SELECT id, type, email FROM profiles WHERE id = 'sample-uuid';

-- 2. Active orders check query plan  
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT COUNT(*) FROM catering_requests 
WHERE user_id = 'sample-uuid' 
  AND status IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS');

-- 3. Dispatch deletion query plan
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
DELETE FROM dispatches WHERE driver_id = 'sample-uuid';

-- 4. File upload update query plan
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
UPDATE file_uploads SET user_id = NULL WHERE user_id = 'sample-uuid';

-- 5. Address relationship query plan
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT a.id, 
       COUNT(ua.user_id) as user_address_count,
       COUNT(cr1.id) as catering_pickup_count,
       COUNT(cr2.id) as catering_delivery_count,
       COUNT(od1.id) as ondemand_pickup_count,
       COUNT(od2.id) as ondemand_delivery_count
FROM addresses a
LEFT JOIN user_addresses ua ON a.id = ua.address_id
LEFT JOIN catering_requests cr1 ON a.id = cr1.pickup_address_id
LEFT JOIN catering_requests cr2 ON a.id = cr2.delivery_address_id
LEFT JOIN on_demand od1 ON a.id = od1.pickup_address_id
LEFT JOIN on_demand od2 ON a.id = od2.delivery_address_id
WHERE a.created_by = 'sample-uuid'
GROUP BY a.id;

-- ============================================
-- CLEANUP AND MAINTENANCE PROCEDURES
-- ============================================

-- Procedure to clean up unused indexes
CREATE OR REPLACE FUNCTION cleanup_unused_indexes()
RETURNS TABLE(
    schemaname text,
    tablename text, 
    indexname text,
    index_size text,
    index_scans bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.schemaname::text,
        s.tablename::text,
        s.indexname::text,
        pg_size_pretty(pg_relation_size(s.indexrelid))::text as index_size,
        s.idx_scan
    FROM pg_stat_user_indexes s
    JOIN pg_index i ON s.indexrelid = i.indexrelid
    WHERE s.idx_scan < 10  -- Indexes used less than 10 times
        AND NOT i.indisunique  -- Exclude unique indexes
        AND NOT i.indisprimary  -- Exclude primary key indexes
    ORDER BY pg_relation_size(s.indexrelid) DESC;
END;
$$ LANGUAGE plpgsql;

-- Procedure to analyze table bloat
CREATE OR REPLACE FUNCTION analyze_table_bloat()
RETURNS TABLE(
    schemaname text,
    tablename text,
    live_tuples bigint,
    dead_tuples bigint,
    bloat_ratio numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.schemaname::text,
        s.tablename::text,
        s.n_live_tup,
        s.n_dead_tup,
        CASE 
            WHEN s.n_live_tup = 0 THEN 0
            ELSE ROUND(s.n_dead_tup::numeric / s.n_live_tup::numeric, 2)
        END as bloat_ratio
    FROM pg_stat_user_tables s
    WHERE s.tablename IN (
        'profiles', 'accounts', 'sessions', 'user_addresses',
        'dispatches', 'file_uploads', 'addresses',
        'catering_requests', 'on_demand'
    )
    ORDER BY bloat_ratio DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PERFORMANCE TESTING SETUP
-- ============================================

-- Create a function to test deletion performance
CREATE OR REPLACE FUNCTION test_deletion_performance(
    test_user_id uuid,
    OUT execution_time_ms integer,
    OUT records_affected jsonb
)
LANGUAGE plpgsql AS $$
DECLARE
    start_time timestamp;
    end_time timestamp;
    dispatch_count integer;
    file_count integer;
    address_count integer;
BEGIN
    start_time := clock_timestamp();
    
    -- Simulate the deletion operations (without actually deleting)
    SELECT COUNT(*) INTO dispatch_count 
    FROM dispatches 
    WHERE driver_id = test_user_id OR user_id = test_user_id;
    
    SELECT COUNT(*) INTO file_count 
    FROM file_uploads 
    WHERE user_id = test_user_id;
    
    SELECT COUNT(*) INTO address_count 
    FROM addresses 
    WHERE created_by = test_user_id;
    
    end_time := clock_timestamp();
    
    execution_time_ms := EXTRACT(MILLISECONDS FROM (end_time - start_time))::integer;
    
    records_affected := jsonb_build_object(
        'dispatches', dispatch_count,
        'file_uploads', file_count,
        'addresses', address_count
    );
END;
$$;

-- ============================================
-- CONFIGURATION RECOMMENDATIONS
-- ============================================

-- Display current configuration and recommendations
SELECT 
    name,
    setting,
    unit,
    CASE name
        WHEN 'max_connections' THEN 
            CASE 
                WHEN setting::int < 100 THEN 'Consider increasing to 200 for production'
                ELSE 'OK'
            END
        WHEN 'shared_buffers' THEN
            CASE
                WHEN pg_size_bytes(setting || COALESCE(unit, '')) < 134217728 THEN 'Consider increasing to 256MB+'
                ELSE 'OK'
            END
        WHEN 'work_mem' THEN
            CASE
                WHEN pg_size_bytes(setting || COALESCE(unit, '')) < 4194304 THEN 'Consider increasing to 4MB+'
                ELSE 'OK'
            END
        ELSE 'Check documentation'
    END as recommendation
FROM pg_settings 
WHERE name IN (
    'max_connections',
    'shared_buffers', 
    'effective_cache_size',
    'work_mem',
    'maintenance_work_mem',
    'checkpoint_completion_target',
    'wal_buffers',
    'default_statistics_target'
)
ORDER BY name;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Verify that all required indexes exist
SELECT 
    'Index Check' as check_type,
    indexname,
    tablename,
    indexdef
FROM pg_indexes 
WHERE indexname LIKE 'idx_%user%' 
   OR indexname LIKE 'idx_%dispatch%' 
   OR indexname LIKE 'idx_%address%'
   OR indexname LIKE 'idx_%catering%'
   OR indexname LIKE 'idx_%ondemand%'
ORDER BY tablename, indexname;

-- Check foreign key constraint coverage
SELECT 
    'FK Coverage' as check_type,
    tc.table_name,
    kcu.column_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_indexes i 
            WHERE i.tablename = tc.table_name 
            AND i.indexdef LIKE '%' || kcu.column_name || '%'
        ) THEN 'INDEXED'
        ELSE 'NOT INDEXED - PERFORMANCE RISK'
    END as index_status
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- Final optimization verification
SELECT 
    'Optimization Status' as status,
    'Indexes Created' as component,
    COUNT(*) as count
FROM pg_indexes 
WHERE indexname LIKE 'idx_%'
    AND schemaname = 'public'

UNION ALL

SELECT 
    'Optimization Status' as status,
    'Tables Analyzed' as component, 
    COUNT(*) as count
FROM pg_stat_user_tables 
WHERE last_analyze IS NOT NULL
    AND tablename IN (
        'profiles', 'dispatches', 'file_uploads', 
        'addresses', 'user_addresses', 'catering_requests', 'on_demand'
    );

-- ============================================
-- MAINTENANCE SCHEDULE RECOMMENDATIONS
-- ============================================

/*
RECOMMENDED MAINTENANCE SCHEDULE:

Daily:
- Monitor user_deletion_locks view for blocking queries
- Check user_deletion_performance view for table statistics

Weekly: 
- Run cleanup_unused_indexes() to identify unused indexes
- Run analyze_table_bloat() to check for table bloat
- Manual VACUUM on high-churn tables if needed

Monthly:
- Review query performance with EXPLAIN ANALYZE
- Update table statistics with ANALYZE
- Consider index reorganization if performance degrades

Quarterly:
- Full performance review and optimization
- Update configuration parameters based on usage patterns
- Review and update index strategy
*/
