-- Add performance optimization indexes for soft delete queries
-- This migration adds indexes to improve query performance when filtering by deletedAt, type, and status

-- Composite index for filtered queries on profiles table
-- This index will optimize queries that filter by deletedAt, type, and status
CREATE INDEX IF NOT EXISTS "profiles_deleted_at_type_status_idx"
ON "profiles" ("deletedAt", "type", "status");

-- Partial index for non-deleted users
-- This index will optimize queries that only need active (non-deleted) users
CREATE INDEX IF NOT EXISTS "profiles_active_users_idx"
ON "profiles" ("id", "email", "type", "status")
WHERE "deletedAt" IS NULL;

-- Index for soft delete queries on addresses table
-- This will help with queries filtering addresses by deletion status
CREATE INDEX IF NOT EXISTS "addresses_deleted_at_idx"
ON "addresses" ("deletedAt");

-- Index for soft delete queries on catering_requests table
-- This will help with queries filtering catering requests by deletion status
CREATE INDEX IF NOT EXISTS "catering_requests_deleted_at_idx"
ON "catering_requests" ("deletedAt");

-- Index for soft delete queries on on_demand_requests table
-- This will help with queries filtering on-demand requests by deletion status
CREATE INDEX IF NOT EXISTS "on_demand_requests_deleted_at_idx"
ON "on_demand_requests" ("deletedAt");

-- Index for soft delete queries on job_applications table
-- This will help with queries filtering job applications by deletion status
CREATE INDEX IF NOT EXISTS "job_applications_deleted_at_idx"
ON "job_applications" ("deletedAt");
