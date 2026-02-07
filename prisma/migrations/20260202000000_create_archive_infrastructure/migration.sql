-- Migration: Create Archive Infrastructure for Data Archiving Strategy (REA-313)
-- This migration creates archive tables for driver location and shift data,
-- tracking tables for archive batches, and weekly summary aggregation tables.

-- ============================================================================
-- Archive Batch Tracking Table
-- ============================================================================
-- Tracks all archiving operations for audit and potential retrieval
CREATE TABLE IF NOT EXISTS "public"."archive_batches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "archive_type" VARCHAR(50) NOT NULL, -- 'driver_locations', 'driver_shifts', 'orders'
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "status" VARCHAR(20) NOT NULL DEFAULT 'in_progress', -- 'in_progress', 'completed', 'failed'
    "records_processed" INTEGER NOT NULL DEFAULT 0,
    "records_archived" INTEGER NOT NULL DEFAULT 0,
    "records_failed" INTEGER NOT NULL DEFAULT 0,
    "date_range_start" TIMESTAMPTZ(6), -- Earliest record date archived
    "date_range_end" TIMESTAMPTZ(6), -- Latest record date archived
    "retention_days" INTEGER NOT NULL, -- Retention policy applied
    "dry_run" BOOLEAN NOT NULL DEFAULT false,
    "error_message" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "archive_batches_pkey" PRIMARY KEY ("id")
);

-- Indexes for archive_batches
CREATE INDEX IF NOT EXISTS "archive_batches_archive_type_idx" ON "public"."archive_batches"("archive_type");
CREATE INDEX IF NOT EXISTS "archive_batches_status_idx" ON "public"."archive_batches"("status");
CREATE INDEX IF NOT EXISTS "archive_batches_started_at_idx" ON "public"."archive_batches"("started_at");
CREATE INDEX IF NOT EXISTS "archive_batches_archive_type_started_at_idx" ON "public"."archive_batches"("archive_type", "started_at");

-- ============================================================================
-- Driver Locations Archive Table
-- ============================================================================
-- Stores archived GPS location data older than retention period
-- Structure mirrors driver_locations but without FK constraints for performance
CREATE TABLE IF NOT EXISTS "public"."driver_locations_archive" (
    "id" UUID NOT NULL,
    "driver_id" UUID NOT NULL,
    "location" geography(Point) NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "speed" DOUBLE PRECISION,
    "heading" DOUBLE PRECISION,
    "altitude" DOUBLE PRECISION,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "source" VARCHAR(20) DEFAULT 'realtime',
    "battery_level" INTEGER,
    "is_moving" BOOLEAN DEFAULT true,
    -- Archive metadata
    "archived_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archive_batch_id" UUID NOT NULL,
    "original_deleted_at" TIMESTAMPTZ(6), -- Preserve if soft-deleted before archive

    CONSTRAINT "driver_locations_archive_pkey" PRIMARY KEY ("id")
);

-- Indexes for driver_locations_archive
-- Optimized for retrieval queries (by driver, time range)
CREATE INDEX IF NOT EXISTS "driver_locations_archive_driver_id_idx" ON "public"."driver_locations_archive"("driver_id");
CREATE INDEX IF NOT EXISTS "driver_locations_archive_recorded_at_idx" ON "public"."driver_locations_archive"("recorded_at");
CREATE INDEX IF NOT EXISTS "driver_locations_archive_driver_recorded_idx" ON "public"."driver_locations_archive"("driver_id", "recorded_at");
CREATE INDEX IF NOT EXISTS "driver_locations_archive_batch_idx" ON "public"."driver_locations_archive"("archive_batch_id");
CREATE INDEX IF NOT EXISTS "driver_locations_archive_archived_at_idx" ON "public"."driver_locations_archive"("archived_at");

-- Foreign key to archive_batches for tracking
ALTER TABLE "public"."driver_locations_archive"
    ADD CONSTRAINT "driver_locations_archive_batch_fkey"
    FOREIGN KEY ("archive_batch_id")
    REFERENCES "public"."archive_batches"("id")
    ON DELETE RESTRICT;

-- ============================================================================
-- Driver Shifts Archive Table
-- ============================================================================
-- Stores archived shift records older than retention period
CREATE TABLE IF NOT EXISTS "public"."driver_shifts_archive" (
    "id" UUID NOT NULL,
    "driver_id" UUID NOT NULL,
    "shift_start" TIMESTAMPTZ(6) NOT NULL,
    "shift_end" TIMESTAMPTZ(6),
    "planned_shift_duration" VARCHAR(255),
    "actual_shift_duration" VARCHAR(255),
    "status" VARCHAR(20) DEFAULT 'scheduled',
    "start_location" geography(Point),
    "end_location" geography(Point),
    "start_odometer" DOUBLE PRECISION,
    "end_odometer" DOUBLE PRECISION,
    "total_distance" DOUBLE PRECISION, -- Legacy km field
    "total_distance_miles" DOUBLE PRECISION,
    "gps_distance_miles" DOUBLE PRECISION,
    "reported_distance_miles" DOUBLE PRECISION,
    "mileage_source" VARCHAR(20),
    "delivery_count" INTEGER DEFAULT 0,
    "break_start" TIMESTAMPTZ(6),
    "break_end" TIMESTAMPTZ(6),
    "total_break_duration" VARCHAR(255),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    -- Archive metadata
    "archived_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archive_batch_id" UUID NOT NULL,
    "original_deleted_at" TIMESTAMPTZ(6), -- Preserve if soft-deleted before archive
    -- Store full JSONB snapshot for data integrity
    "original_data" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "driver_shifts_archive_pkey" PRIMARY KEY ("id")
);

-- Indexes for driver_shifts_archive
CREATE INDEX IF NOT EXISTS "driver_shifts_archive_driver_id_idx" ON "public"."driver_shifts_archive"("driver_id");
CREATE INDEX IF NOT EXISTS "driver_shifts_archive_shift_start_idx" ON "public"."driver_shifts_archive"("shift_start");
CREATE INDEX IF NOT EXISTS "driver_shifts_archive_driver_shift_start_idx" ON "public"."driver_shifts_archive"("driver_id", "shift_start");
CREATE INDEX IF NOT EXISTS "driver_shifts_archive_batch_idx" ON "public"."driver_shifts_archive"("archive_batch_id");
CREATE INDEX IF NOT EXISTS "driver_shifts_archive_archived_at_idx" ON "public"."driver_shifts_archive"("archived_at");

-- Foreign key to archive_batches
ALTER TABLE "public"."driver_shifts_archive"
    ADD CONSTRAINT "driver_shifts_archive_batch_fkey"
    FOREIGN KEY ("archive_batch_id")
    REFERENCES "public"."archive_batches"("id")
    ON DELETE RESTRICT;

-- ============================================================================
-- Driver Weekly Summaries Table
-- ============================================================================
-- Pre-computed weekly aggregates for fast PDF generation and reporting
CREATE TABLE IF NOT EXISTS "public"."driver_weekly_summaries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "driver_id" UUID NOT NULL,
    "week_start" DATE NOT NULL, -- Monday of the week
    "week_end" DATE NOT NULL, -- Sunday of the week
    "year" INTEGER NOT NULL,
    "week_number" INTEGER NOT NULL, -- ISO week number

    -- Shift metrics
    "total_shifts" INTEGER NOT NULL DEFAULT 0,
    "completed_shifts" INTEGER NOT NULL DEFAULT 0,
    "cancelled_shifts" INTEGER NOT NULL DEFAULT 0,
    "total_shift_hours" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "total_break_hours" DECIMAL(10, 2) NOT NULL DEFAULT 0,

    -- Delivery metrics
    "total_deliveries" INTEGER NOT NULL DEFAULT 0,
    "completed_deliveries" INTEGER NOT NULL DEFAULT 0,
    "cancelled_deliveries" INTEGER NOT NULL DEFAULT 0,

    -- Distance metrics
    "total_miles" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "gps_miles" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "reported_miles" DECIMAL(10, 2) NOT NULL DEFAULT 0,

    -- Location point count (for data density)
    "location_points_count" INTEGER NOT NULL DEFAULT 0,

    -- Data source indicators
    "data_sources" JSONB DEFAULT '{}', -- { "active": true, "archive": false }

    -- Metadata
    "generated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generation_batch_id" UUID, -- Links to archive_batches for weekly gen job

    CONSTRAINT "driver_weekly_summaries_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "driver_weekly_summaries_driver_week_unique" UNIQUE ("driver_id", "week_start")
);

-- Indexes for driver_weekly_summaries
CREATE INDEX IF NOT EXISTS "driver_weekly_summaries_driver_id_idx" ON "public"."driver_weekly_summaries"("driver_id");
CREATE INDEX IF NOT EXISTS "driver_weekly_summaries_week_start_idx" ON "public"."driver_weekly_summaries"("week_start");
CREATE INDEX IF NOT EXISTS "driver_weekly_summaries_year_week_idx" ON "public"."driver_weekly_summaries"("year", "week_number");
CREATE INDEX IF NOT EXISTS "driver_weekly_summaries_driver_year_week_idx" ON "public"."driver_weekly_summaries"("driver_id", "year", "week_number");
CREATE INDEX IF NOT EXISTS "driver_weekly_summaries_generated_at_idx" ON "public"."driver_weekly_summaries"("generated_at");

-- Foreign key to drivers (optional - allows summaries for archived drivers)
-- Note: Using ON DELETE SET NULL to preserve summaries if driver is deleted
ALTER TABLE "public"."driver_weekly_summaries"
    ADD CONSTRAINT "driver_weekly_summaries_driver_fkey"
    FOREIGN KEY ("driver_id")
    REFERENCES "public"."drivers"("id")
    ON DELETE CASCADE;

-- ============================================================================
-- Add Soft Archive Columns to Order Tables
-- ============================================================================
-- These columns mark orders as archived without moving them (soft archive)

-- CateringRequest soft archive columns
ALTER TABLE "public"."catering_requests"
    ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMPTZ(6);
ALTER TABLE "public"."catering_requests"
    ADD COLUMN IF NOT EXISTS "archive_batch_id" UUID;

-- Indexes for catering_requests archive
CREATE INDEX IF NOT EXISTS "catering_requests_archived_at_idx" ON "public"."catering_requests"("archived_at");
CREATE INDEX IF NOT EXISTS "catering_requests_archive_batch_id_idx" ON "public"."catering_requests"("archive_batch_id");
-- Partial index for active (non-archived) records - speeds up normal queries
CREATE INDEX IF NOT EXISTS "catering_requests_active_idx" ON "public"."catering_requests"("status", "created_at") WHERE "archived_at" IS NULL AND "deleted_at" IS NULL;

-- OnDemand soft archive columns
ALTER TABLE "public"."on_demand_requests"
    ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMPTZ(6);
ALTER TABLE "public"."on_demand_requests"
    ADD COLUMN IF NOT EXISTS "archive_batch_id" UUID;

-- Indexes for on_demand_requests archive
CREATE INDEX IF NOT EXISTS "on_demand_requests_archived_at_idx" ON "public"."on_demand_requests"("archived_at");
CREATE INDEX IF NOT EXISTS "on_demand_requests_archive_batch_id_idx" ON "public"."on_demand_requests"("archive_batch_id");
-- Partial index for active (non-archived) records
CREATE INDEX IF NOT EXISTS "on_demand_requests_active_idx" ON "public"."on_demand_requests"("status", "created_at") WHERE "archived_at" IS NULL AND "deleted_at" IS NULL;

-- Foreign keys to archive_batches (optional, set null on delete)
ALTER TABLE "public"."catering_requests"
    ADD CONSTRAINT "catering_requests_archive_batch_fkey"
    FOREIGN KEY ("archive_batch_id")
    REFERENCES "public"."archive_batches"("id")
    ON DELETE SET NULL;

ALTER TABLE "public"."on_demand_requests"
    ADD CONSTRAINT "on_demand_requests_archive_batch_fkey"
    FOREIGN KEY ("archive_batch_id")
    REFERENCES "public"."archive_batches"("id")
    ON DELETE SET NULL;

-- ============================================================================
-- Performance Optimization: Partial Indexes on Active Records
-- ============================================================================
-- These indexes speed up queries that filter for non-archived data

-- Driver locations - index only recent, active records
CREATE INDEX IF NOT EXISTS "driver_locations_active_recent_idx"
    ON "public"."driver_locations"("driver_id", "recorded_at" DESC)
    WHERE "deleted_at" IS NULL;

-- Driver shifts - index only non-deleted shifts
CREATE INDEX IF NOT EXISTS "driver_shifts_active_idx"
    ON "public"."driver_shifts"("driver_id", "shift_start" DESC)
    WHERE "deleted_at" IS NULL;

-- Deliveries - index only active deliveries
CREATE INDEX IF NOT EXISTS "deliveries_active_idx"
    ON "public"."deliveries"("driver_id", "assigned_at" DESC)
    WHERE "deleted_at" IS NULL;

-- ============================================================================
-- Comments for Documentation
-- ============================================================================
COMMENT ON TABLE "public"."archive_batches" IS 'Tracks all data archiving operations for audit and potential data retrieval';
COMMENT ON TABLE "public"."driver_locations_archive" IS 'Archived GPS location data older than 30 days retention period';
COMMENT ON TABLE "public"."driver_shifts_archive" IS 'Archived driver shift records older than 5 weeks retention period';
COMMENT ON TABLE "public"."driver_weekly_summaries" IS 'Pre-computed weekly aggregates for fast PDF generation and historical reporting';
COMMENT ON COLUMN "public"."catering_requests"."archived_at" IS 'Timestamp when record was soft-archived (null = active)';
COMMENT ON COLUMN "public"."on_demand_requests"."archived_at" IS 'Timestamp when record was soft-archived (null = active)';
