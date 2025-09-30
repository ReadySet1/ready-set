-- Performance Optimization Indexes
-- Phase 3: Database & Performance
-- Adds missing indexes identified from query analysis

-- =====================================================
-- COMPOSITE INDEXES FOR COMPLEX QUERIES
-- =====================================================

-- CateringRequest: Frequently queried by user + status + date
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_catering_request_user_status_date"
ON "catering_requests" ("userId", "status", "pickupDateTime");

-- CateringRequest: Dashboard queries by status + date range
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_catering_request_status_created"
ON "catering_requests" ("status", "createdAt") WHERE "deletedAt" IS NULL;

-- OnDemand: User + status + date for similar patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_on_demand_user_status_date"
ON "on_demand_requests" ("userId", "status", "pickupDateTime");

-- OnDemand: Dashboard queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_on_demand_status_created"
ON "on_demand_requests" ("status", "createdAt") WHERE "deletedAt" IS NULL;

-- =====================================================
-- SEARCH AND FILTERING INDEXES
-- =====================================================

-- Profile: Search by name (case-insensitive)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_profiles_name_search"
ON "profiles" USING gin(to_tsvector('english', COALESCE("name", '')));

-- Profile: Search by company name
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_profiles_company_search"
ON "profiles" USING gin(to_tsvector('english', COALESCE("companyName", '')));

-- CateringRequest: Order number search (case-insensitive)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_catering_request_order_number_search"
ON "catering_requests" USING gin(to_tsvector('english', "orderNumber"));

-- OnDemand: Order number search
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_on_demand_order_number_search"
ON "on_demand_requests" USING gin(to_tsvector('english', "orderNumber"));

-- =====================================================
-- FILE UPLOAD OPTIMIZATION
-- =====================================================

-- FileUpload: Frequently queried by entity type and category
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_file_uploads_entity_category"
ON "file_uploads" ("cateringRequestId", "category") WHERE "cateringRequestId" IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_file_uploads_ondemand_category"
ON "file_uploads" ("onDemandId", "category") WHERE "onDemandId" IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_file_uploads_job_category"
ON "file_uploads" ("jobApplicationId", "category") WHERE "jobApplicationId" IS NOT NULL;

-- FileUpload: User files with category
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_file_uploads_user_category"
ON "file_uploads" ("userId", "category") WHERE "userId" IS NOT NULL;

-- =====================================================
-- DASHBOARD AND ANALYTICS OPTIMIZATION
-- =====================================================

-- Profile: Vendor counting for admin dashboard
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_profiles_type_active"
ON "profiles" ("type", "status") WHERE "deletedAt" IS NULL;

-- Address: Location-based queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_addresses_location"
ON "addresses" ("city", "state", "county") WHERE "deletedAt" IS NULL;

-- =====================================================
-- PAGINATION AND SORTING OPTIMIZATION
-- =====================================================

-- CateringRequest: Common sort fields with pagination
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_catering_request_pickup_desc"
ON "catering_requests" ("pickupDateTime" DESC) WHERE "deletedAt" IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_catering_request_total_desc"
ON "catering_requests" ("orderTotal" DESC) WHERE "deletedAt" IS NULL;

-- OnDemand: Similar sorting patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_on_demand_pickup_desc"
ON "on_demand_requests" ("pickupDateTime" DESC) WHERE "deletedAt" IS NULL;

-- JobApplication: Status and date sorting
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_job_applications_status_created"
ON "job_applications" ("status", "createdAt") WHERE "deletedAt" IS NULL;

-- =====================================================
-- RELATIONSHIP OPTIMIZATION
-- =====================================================

-- UserAddress: User to address relationships
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_user_addresses_user_default"
ON "user_addresses" ("userId", "isDefault");

-- Dispatch: Driver assignment queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_dispatches_driver_created"
ON "dispatches" ("driverId", "createdAt");

-- =====================================================
-- SOFT DELETE OPTIMIZATION
-- =====================================================

-- Optimize queries that filter by deletedAt IS NULL
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_profiles_active"
ON "profiles" ("id") WHERE "deletedAt" IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_addresses_active"
ON "addresses" ("id") WHERE "deletedAt" IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_catering_requests_active"
ON "catering_requests" ("id") WHERE "deletedAt" IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_on_demand_requests_active"
ON "on_demand_requests" ("id") WHERE "deletedAt" IS NULL;

-- =====================================================
-- SPECIALIZED INDEXES FOR HEAVY QUERIES
-- =====================================================

-- Revenue calculation queries (completed orders only)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_catering_revenue"
ON "catering_requests" ("orderTotal", "createdAt")
WHERE "status" = 'COMPLETED' AND "deletedAt" IS NULL;

-- Dashboard metrics optimization - revenue aggregation with date filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_catering_completed_revenue_date"
ON "catering_requests" ("status", "createdAt", "orderTotal")
WHERE "status" = 'COMPLETED' AND "deletedAt" IS NULL;

-- Dashboard metrics optimization - request counts by status and date
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_catering_status_created_active"
ON "catering_requests" ("status", "createdAt")
WHERE "deletedAt" IS NULL;

-- Dashboard metrics optimization - vendor counting (already exists but ensuring it's optimized)
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_profiles_vendor_active"
-- ON "profiles" ("type", "deletedAt")
-- WHERE "type" = 'VENDOR';

-- User authentication and session queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_sessions_user_expires"
ON "sessions" ("userId", "expires");

-- =====================================================
-- TRACKING SYSTEM SPATIAL INDEXES
-- =====================================================

-- Note: These apply to the tracking system tables
-- PostGIS spatial indexes for driver location queries
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_driver_locations_spatial"
-- ON "driver_locations" USING GIST(location);

-- CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_drivers_last_location"
-- ON "drivers" USING GIST(last_known_location);

-- Time-based location queries
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_driver_locations_time"
-- ON "driver_locations" ("driver_id", "recorded_at");

-- =====================================================
-- ANALYSIS QUERIES
-- =====================================================

-- After creating indexes, analyze tables for optimal query planning
ANALYZE "profiles";
ANALYZE "catering_requests";
ANALYZE "on_demand_requests";
ANALYZE "file_uploads";
ANALYZE "addresses";
ANALYZE "job_applications";
ANALYZE "user_addresses";
ANALYZE "dispatches";
ANALYZE "sessions";

-- Show index usage statistics (for monitoring)
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC
LIMIT 20; 