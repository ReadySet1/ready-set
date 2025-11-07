-- ============================================================================
-- Migration: Create drivers table
-- Date: 2025-11-07
-- Issue: REA-122 - Support for real-time driver tracking
-- ============================================================================

-- Purpose: Create a dedicated drivers table to replace Profile-based driver storage
-- This table will be used by the SSE endpoint and Realtime tracking system

-- ============================================================================
-- Create drivers table
-- ============================================================================

CREATE TABLE IF NOT EXISTS drivers (
  -- Primary identifiers
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,

  -- Driver information
  employee_id VARCHAR(50) UNIQUE,
  vehicle_number VARCHAR(50),
  phone_number VARCHAR(20),

  -- Status fields
  is_active BOOLEAN DEFAULT true NOT NULL,
  is_on_duty BOOLEAN DEFAULT false NOT NULL,

  -- Shift tracking
  shift_start_time TIMESTAMPTZ,
  shift_end_time TIMESTAMPTZ,
  current_shift_id UUID,

  -- Location tracking (last known position)
  last_known_location GEOGRAPHY(POINT),
  last_location_update TIMESTAMPTZ,
  last_known_accuracy DOUBLE PRECISION,
  last_known_speed DOUBLE PRECISION,
  last_known_heading DOUBLE PRECISION,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMPTZ
);

-- ============================================================================
-- Create indexes for performance
-- ============================================================================

-- Foreign key indexes
CREATE INDEX IF NOT EXISTS idx_drivers_profile_id ON drivers(profile_id);
CREATE INDEX IF NOT EXISTS idx_drivers_user_id ON drivers(user_id);

-- Status filters
CREATE INDEX IF NOT EXISTS idx_drivers_is_active ON drivers(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_drivers_is_on_duty ON drivers(is_on_duty) WHERE is_on_duty = true;

-- Time-based queries
CREATE INDEX IF NOT EXISTS idx_drivers_last_location_update ON drivers(last_location_update DESC);
CREATE INDEX IF NOT EXISTS idx_drivers_shift_start_time ON drivers(shift_start_time);

-- Geospatial index for location queries (PostGIS)
CREATE INDEX IF NOT EXISTS idx_drivers_last_known_location ON drivers USING GIST(last_known_location);

-- Soft delete support
CREATE INDEX IF NOT EXISTS idx_drivers_deleted_at ON drivers(deleted_at) WHERE deleted_at IS NULL;

-- ============================================================================
-- Create updated_at trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_drivers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_drivers_updated_at
  BEFORE UPDATE ON drivers
  FOR EACH ROW
  EXECUTE FUNCTION update_drivers_updated_at();

-- ============================================================================
-- Enable Row Level Security (RLS)
-- ============================================================================

ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

-- Policy: Drivers can read their own data
CREATE POLICY "Drivers can view own data"
  ON drivers
  FOR SELECT
  USING (
    auth.uid() = user_id
  );

-- Policy: Authenticated users can read all active drivers
CREATE POLICY "Authenticated users can view active drivers"
  ON drivers
  FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    is_active = true AND
    deleted_at IS NULL
  );

-- Policy: Service role has full access
CREATE POLICY "Service role has full access"
  ON drivers
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- Add helpful comments
-- ============================================================================

COMMENT ON TABLE drivers IS 'Dedicated driver records for real-time tracking and management';
COMMENT ON COLUMN drivers.last_known_location IS 'PostGIS geography point (lat/lng) of last known location';
COMMENT ON COLUMN drivers.last_location_update IS 'Timestamp of last location update';
COMMENT ON COLUMN drivers.is_on_duty IS 'Whether driver is currently on duty/active shift';
COMMENT ON COLUMN drivers.current_shift_id IS 'Foreign key to driver_shifts table (to be created)';
