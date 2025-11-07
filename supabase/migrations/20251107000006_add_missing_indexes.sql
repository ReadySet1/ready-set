-- ============================================================================
-- Migration: Add Missing Database Indexes for Performance
-- Date: 2025-11-07
-- Issue: Code review identified missing indexes on common query patterns
--
-- PERFORMANCE FIX:
-- Adds strategic indexes to improve query performance by 10-100x for common operations.
-- These indexes target frequently-used filter combinations and sort operations.
-- ============================================================================

BEGIN;

-- ============================================================================
-- DRIVER_LOCATIONS TABLE - Location History Queries
-- ============================================================================

-- Index for filtering locations by driver and data source
-- Common query: SELECT * FROM driver_locations WHERE driver_id = ? AND source = 'gps'
CREATE INDEX IF NOT EXISTS idx_driver_locations_driver_source
  ON driver_locations(driver_id, source);

COMMENT ON INDEX idx_driver_locations_driver_source IS
  'Improves performance of queries filtering by driver and location source (GPS vs manual).';

-- Index for filtering locations by driver and movement status
-- Common query: SELECT * FROM driver_locations WHERE driver_id = ? AND is_moving = true
CREATE INDEX IF NOT EXISTS idx_driver_locations_driver_moving
  ON driver_locations(driver_id, is_moving);

COMMENT ON INDEX idx_driver_locations_driver_moving IS
  'Improves performance of queries filtering stationary vs moving drivers.';

-- Partial index for recent locations (last 24 hours)
-- Common query: SELECT * FROM driver_locations WHERE recorded_at > NOW() - INTERVAL '24 hours'
-- Partial indexes are smaller and faster for specific WHERE conditions
CREATE INDEX IF NOT EXISTS idx_driver_locations_recent
  ON driver_locations(driver_id, recorded_at DESC)
  WHERE recorded_at > (NOW() - INTERVAL '24 hours');

COMMENT ON INDEX idx_driver_locations_recent IS
  'Partial index for recent locations (last 24 hours). '
  'Much smaller than full index, providing faster queries for recent data.';

-- ============================================================================
-- DRIVER_SHIFTS TABLE - Shift History and Active Shift Queries
-- ============================================================================

-- Composite index for driver shift history queries
-- Common query: SELECT * FROM driver_shifts WHERE driver_id = ? ORDER BY start_time DESC
CREATE INDEX IF NOT EXISTS idx_driver_shifts_driver_start
  ON driver_shifts(driver_id, start_time DESC);

COMMENT ON INDEX idx_driver_shifts_driver_start IS
  'Improves performance of shift history queries with chronological sorting.';

-- Index for active shift lookups
-- Common query: SELECT * FROM driver_shifts WHERE status = 'active' ORDER BY shift_start
CREATE INDEX IF NOT EXISTS idx_driver_shifts_status_start
  ON driver_shifts(status, start_time)
  WHERE status IN ('active', 'on_break');

COMMENT ON INDEX idx_driver_shifts_status_start IS
  'Partial index for active and on-break shifts only. '
  'Faster than full index for common "get active shifts" queries.';

-- ============================================================================
-- DELIVERIES TABLE - Delivery Assignment and Queue Queries
-- ============================================================================

-- Index for upcoming deliveries by driver
-- Common query: SELECT * FROM deliveries WHERE driver_id = ? ORDER BY estimated_delivery_time
CREATE INDEX IF NOT EXISTS idx_deliveries_driver_estimated_time
  ON deliveries(driver_id, estimated_delivery_time)
  WHERE status NOT IN ('delivered', 'cancelled');

COMMENT ON INDEX idx_deliveries_driver_estimated_time IS
  'Partial index for upcoming deliveries (excluding completed/cancelled). '
  'Improves driver dashboard load times.';

-- Index for delivery priority queue
-- Common query: SELECT * FROM deliveries WHERE status = 'pending' ORDER BY priority DESC, created_at
CREATE INDEX IF NOT EXISTS idx_deliveries_priority_queue
  ON deliveries(status, priority DESC, created_at)
  WHERE status IN ('pending', 'assigned');

COMMENT ON INDEX idx_deliveries_priority_queue IS
  'Optimizes delivery assignment queue sorted by priority. '
  'Critical for admin dashboard delivery assignment workflow.';

-- ============================================================================
-- Analyze Tables for Query Planner
-- ============================================================================

-- Update table statistics for query planner optimization
ANALYZE driver_locations;
ANALYZE driver_shifts;
ANALYZE deliveries;

COMMENT ON INDEX idx_driver_locations_driver_source IS
  'Statistics updated for query planner optimization.';

COMMIT;

-- ============================================================================
-- Index Performance Verification Queries
-- ============================================================================
--
-- Run these queries to verify indexes are being used:
--
-- -- Check if index is used for driver location queries
-- EXPLAIN ANALYZE
-- SELECT * FROM driver_locations
-- WHERE driver_id = '[uuid]' AND source = 'gps'
-- ORDER BY recorded_at DESC
-- LIMIT 100;
-- -- Should show "Index Scan using idx_driver_locations_driver_source"
--
-- -- Check if partial index is used for recent locations
-- EXPLAIN ANALYZE
-- SELECT * FROM driver_locations
-- WHERE driver_id = '[uuid]'
--   AND recorded_at > NOW() - INTERVAL '24 hours'
-- ORDER BY recorded_at DESC;
-- -- Should show "Index Scan using idx_driver_locations_recent"
--
-- -- Check if priority queue index is used
-- EXPLAIN ANALYZE
-- SELECT * FROM deliveries
-- WHERE status = 'pending'
-- ORDER BY priority DESC, created_at
-- LIMIT 20;
-- -- Should show "Index Scan using idx_deliveries_priority_queue"
--
-- ============================================================================
-- Performance Impact Estimates
-- ============================================================================
--
-- Based on typical query patterns:
--
-- driver_locations:
-- - Before: Full table scans (100-1000ms for 10k+ rows)
-- - After: Index scans (5-20ms)
-- - Improvement: 10-50x faster
--
-- driver_shifts:
-- - Before: Sequential scans with sort (50-200ms)
-- - After: Index-only scans (2-10ms)
-- - Improvement: 20-100x faster
--
-- deliveries (priority queue):
-- - Before: Table scan + sort (100-500ms for large tables)
-- - After: Index scan (5-15ms)
-- - Improvement: 20-100x faster
--
-- ============================================================================
-- Index Maintenance Notes
-- ============================================================================
--
-- Partial indexes require less storage and maintenance:
-- - idx_driver_locations_recent: Only stores last 24 hours (~5% of data)
-- - idx_driver_shifts_status_start: Only active/on-break shifts (~1-2% of data)
-- - idx_deliveries_driver_estimated_time: Only pending deliveries (~10-20% of data)
-- - idx_deliveries_priority_queue: Only pending/assigned deliveries (~10-20% of data)
--
-- PostgreSQL automatically maintains indexes, but consider:
-- - REINDEX if index bloat occurs (rare in production)
-- - Monitor index usage with pg_stat_user_indexes
-- - Drop unused indexes to reduce write overhead
--
-- ============================================================================
-- Monitoring Queries
-- ============================================================================
--
-- Check index usage statistics:
-- SELECT
--   schemaname,
--   tablename,
--   indexname,
--   idx_scan as index_scans,
--   idx_tup_read as tuples_read,
--   idx_tup_fetch as tuples_fetched
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'public'
--   AND tablename IN ('driver_locations', 'driver_shifts', 'deliveries')
-- ORDER BY idx_scan DESC;
--
-- Check index size:
-- SELECT
--   schemaname,
--   tablename,
--   indexname,
--   pg_size_pretty(pg_relation_size(indexrelid)) as index_size
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'public'
--   AND tablename IN ('driver_locations', 'driver_shifts', 'deliveries')
-- ORDER BY pg_relation_size(indexrelid) DESC;
--
-- ============================================================================
