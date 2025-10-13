-- Dashboard Performance Optimization Indexes
-- Adds specific indexes for dashboard metrics queries to improve performance

-- =====================================================
-- DASHBOARD METRICS OPTIMIZATION
-- =====================================================

-- Index for revenue aggregation queries (completed orders with date filtering)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_catering_completed_revenue_date"
ON "catering_requests" ("status", "createdAt", "orderTotal")
WHERE "status" = 'COMPLETED' AND "deletedAt" IS NULL;

-- Index for request count queries by status and date range
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_catering_status_created_active"
ON "catering_requests" ("status", "createdAt")
WHERE "deletedAt" IS NULL;

-- Index for vendor counting (optimization for dashboard vendor metrics)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_profiles_vendor_active"
ON "profiles" ("type", "deletedAt")
WHERE "type" = 'VENDOR';

-- Index for user filtering in dashboard queries (when vendorId is provided)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_catering_user_created_active"
ON "catering_requests" ("userId", "createdAt")
WHERE "deletedAt" IS NULL;

-- =====================================================
-- QUERY ANALYSIS
-- =====================================================

-- Analyze tables after creating indexes for optimal query planning
ANALYZE "catering_requests";
ANALYZE "profiles";

-- Show updated index statistics for monitoring
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND tablename IN ('catering_requests', 'profiles')
ORDER BY idx_scan DESC;

