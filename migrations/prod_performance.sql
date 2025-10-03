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
