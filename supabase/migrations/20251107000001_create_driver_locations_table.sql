-- ============================================================================
-- Migration: Create driver_locations table
-- Date: 2025-11-07
-- Issue: REA-122 - Support for real-time driver tracking
-- ============================================================================

-- Purpose: Store historical location tracking data for drivers
-- This table supports both REST API and Realtime WebSocket location updates

-- ============================================================================
-- Create driver_locations table
-- ============================================================================

CREATE TABLE IF NOT EXISTS driver_locations (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,

  -- Location data (PostGIS geography for lat/lng)
  location GEOGRAPHY(POINT) NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,

  -- Location metadata
  accuracy DOUBLE PRECISION, -- meters
  speed DOUBLE PRECISION, -- meters per second
  heading DOUBLE PRECISION, -- degrees (0-360)
  altitude DOUBLE PRECISION, -- meters

  -- Timestamps
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Source tracking
  source VARCHAR(20) DEFAULT 'realtime', -- 'realtime', 'rest', 'manual'

  -- Additional metadata
  battery_level INTEGER, -- percentage (0-100)
  is_moving BOOLEAN DEFAULT true,

  -- Soft delete
  deleted_at TIMESTAMPTZ
);

-- ============================================================================
-- Create indexes for performance
-- ============================================================================

-- Foreign key index
CREATE INDEX IF NOT EXISTS idx_driver_locations_driver_id ON driver_locations(driver_id);

-- Time-based queries (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_driver_locations_recorded_at ON driver_locations(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_locations_created_at ON driver_locations(created_at DESC);

-- Composite index for driver + time queries
CREATE INDEX IF NOT EXISTS idx_driver_locations_driver_time
  ON driver_locations(driver_id, recorded_at DESC);

-- Geospatial index for location-based queries
CREATE INDEX IF NOT EXISTS idx_driver_locations_location
  ON driver_locations USING GIST(location);

-- Source filtering
CREATE INDEX IF NOT EXISTS idx_driver_locations_source ON driver_locations(source);

-- Active records only
CREATE INDEX IF NOT EXISTS idx_driver_locations_deleted_at
  ON driver_locations(deleted_at) WHERE deleted_at IS NULL;

-- ============================================================================
-- Create function to update driver's last known location
-- ============================================================================

CREATE OR REPLACE FUNCTION update_driver_last_location()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the driver's last known location when a new location is recorded
  UPDATE drivers
  SET
    last_known_location = NEW.location,
    last_location_update = NEW.recorded_at,
    last_known_accuracy = NEW.accuracy,
    last_known_speed = NEW.speed,
    last_known_heading = NEW.heading,
    updated_at = NOW()
  WHERE id = NEW.driver_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_driver_last_location
  AFTER INSERT ON driver_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_driver_last_location();

-- ============================================================================
-- Create function to broadcast location updates via Realtime
-- ============================================================================

CREATE OR REPLACE FUNCTION broadcast_driver_location()
RETURNS TRIGGER AS $$
DECLARE
  driver_info RECORD;
  payload JSON;
BEGIN
  -- Fetch enriched driver information
  SELECT
    d.id as driver_id,
    d.employee_id,
    d.vehicle_number,
    p.first_name || ' ' || p.last_name as driver_name,
    p.id as profile_id
  INTO driver_info
  FROM drivers d
  LEFT JOIN profiles p ON d.profile_id = p.id
  WHERE d.id = NEW.driver_id;

  -- Build enriched payload for Realtime broadcast
  payload := json_build_object(
    'driverId', driver_info.driver_id,
    'driverName', driver_info.driver_name,
    'employeeId', driver_info.employee_id,
    'vehicleNumber', driver_info.vehicle_number,
    'lat', NEW.latitude,
    'lng', NEW.longitude,
    'location', json_build_object(
      'lat', NEW.latitude,
      'lng', NEW.longitude
    ),
    'accuracy', NEW.accuracy,
    'speed', NEW.speed,
    'heading', NEW.heading,
    'altitude', NEW.altitude,
    'recordedAt', NEW.recorded_at,
    'source', NEW.source,
    'batteryLevel', NEW.battery_level,
    'isMoving', NEW.is_moving,
    'timestamp', extract(epoch from NEW.recorded_at) * 1000
  );

  -- Broadcast to driver-locations channel
  PERFORM pg_notify('driver-locations', payload::text);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_broadcast_driver_location
  AFTER INSERT ON driver_locations
  FOR EACH ROW
  EXECUTE FUNCTION broadcast_driver_location();

-- ============================================================================
-- Enable Row Level Security (RLS)
-- ============================================================================

ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;

-- Policy: Drivers can read their own location history
CREATE POLICY "Drivers can view own locations"
  ON driver_locations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM drivers
      WHERE drivers.id = driver_locations.driver_id
      AND drivers.user_id = auth.uid()
    )
  );

-- Policy: Drivers can insert their own locations
CREATE POLICY "Drivers can insert own locations"
  ON driver_locations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM drivers
      WHERE drivers.id = driver_locations.driver_id
      AND drivers.user_id = auth.uid()
    )
  );

-- Policy: Authenticated users can read all active driver locations
CREATE POLICY "Authenticated users can view all locations"
  ON driver_locations
  FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    deleted_at IS NULL
  );

-- Policy: Service role has full access
CREATE POLICY "Service role has full access"
  ON driver_locations
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- Add helpful comments
-- ============================================================================

COMMENT ON TABLE driver_locations IS 'Historical location tracking data for drivers';
COMMENT ON COLUMN driver_locations.location IS 'PostGIS geography point (lat/lng)';
COMMENT ON COLUMN driver_locations.recorded_at IS 'Timestamp when location was recorded by device';
COMMENT ON COLUMN driver_locations.created_at IS 'Timestamp when record was inserted to database';
COMMENT ON COLUMN driver_locations.source IS 'Source of location update: realtime, rest, or manual';
COMMENT ON TRIGGER trigger_update_driver_last_location ON driver_locations IS 'Updates driver.last_known_location on new location insert';
COMMENT ON TRIGGER trigger_broadcast_driver_location ON driver_locations IS 'Broadcasts location updates to Realtime channel via pg_notify';
