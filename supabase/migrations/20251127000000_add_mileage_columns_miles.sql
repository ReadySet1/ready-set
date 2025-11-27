-- ============================================================================
-- Migration: Add mileage tracking columns (miles-based) to driver_shifts
-- Date: 2025-11-27
-- Issue: REA-125 - Schema drift fix + km to miles conversion
--
-- This migration adds:
-- 1. total_distance_miles - Primary distance field in miles
-- 2. delivery_count - Number of deliveries completed during shift
-- 3. gps_distance_miles - GPS-calculated distance for auditing
-- 4. reported_distance_miles - Client-reported distance when provided
-- 5. mileage_source - How the final distance was determined
-- ============================================================================

BEGIN;

-- ============================================================================
-- Add new columns to driver_shifts
-- ============================================================================

-- Add total_distance_miles column (primary mileage field)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'driver_shifts' AND column_name = 'total_distance_miles'
  ) THEN
    ALTER TABLE driver_shifts ADD COLUMN total_distance_miles DOUBLE PRECISION;
    COMMENT ON COLUMN driver_shifts.total_distance_miles IS 'Total distance traveled in miles (canonical value)';
  END IF;
END $$;

-- Add delivery_count column for tracking deliveries per shift
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'driver_shifts' AND column_name = 'delivery_count'
  ) THEN
    ALTER TABLE driver_shifts ADD COLUMN delivery_count INTEGER DEFAULT 0;
    COMMENT ON COLUMN driver_shifts.delivery_count IS 'Number of deliveries completed during this shift';
  END IF;
END $$;

-- Add gps_distance_miles for auditing GPS-calculated distance
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'driver_shifts' AND column_name = 'gps_distance_miles'
  ) THEN
    ALTER TABLE driver_shifts ADD COLUMN gps_distance_miles DOUBLE PRECISION;
    COMMENT ON COLUMN driver_shifts.gps_distance_miles IS 'GPS-calculated distance in miles (for audit purposes)';
  END IF;
END $$;

-- Add reported_distance_miles for client-reported mileage
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'driver_shifts' AND column_name = 'reported_distance_miles'
  ) THEN
    ALTER TABLE driver_shifts ADD COLUMN reported_distance_miles DOUBLE PRECISION;
    COMMENT ON COLUMN driver_shifts.reported_distance_miles IS 'Client-reported distance in miles (when driver provides odometer reading)';
  END IF;
END $$;

-- Add mileage_source to track how distance was determined
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'driver_shifts' AND column_name = 'mileage_source'
  ) THEN
    ALTER TABLE driver_shifts ADD COLUMN mileage_source VARCHAR(20) DEFAULT 'gps';
    COMMENT ON COLUMN driver_shifts.mileage_source IS 'How distance was determined: gps, odometer, manual, or hybrid';
  END IF;
END $$;

-- ============================================================================
-- Migrate existing data from total_distance (km) to total_distance_miles
-- ============================================================================

-- Convert existing total_distance (assumed km) to miles (1 km = 0.621371 miles)
-- Only migrate if total_distance_miles is not already populated
UPDATE driver_shifts
SET total_distance_miles = total_distance * 0.621371
WHERE total_distance IS NOT NULL
  AND total_distance_miles IS NULL;

-- ============================================================================
-- Create trigger to auto-update delivery_count
-- ============================================================================

CREATE OR REPLACE FUNCTION update_shift_delivery_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Update delivery count when a delivery's shift_id changes or delivery is completed
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.shift_id IS NOT NULL THEN
      UPDATE driver_shifts
      SET delivery_count = (
        SELECT COUNT(*)
        FROM deliveries
        WHERE shift_id = NEW.shift_id
          AND status = 'delivered'
          AND deleted_at IS NULL
      )
      WHERE id = NEW.shift_id;
    END IF;

    -- Handle case where delivery moved from one shift to another
    IF TG_OP = 'UPDATE' AND OLD.shift_id IS NOT NULL AND OLD.shift_id != NEW.shift_id THEN
      UPDATE driver_shifts
      SET delivery_count = (
        SELECT COUNT(*)
        FROM deliveries
        WHERE shift_id = OLD.shift_id
          AND status = 'delivered'
          AND deleted_at IS NULL
      )
      WHERE id = OLD.shift_id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' AND OLD.shift_id IS NOT NULL THEN
    UPDATE driver_shifts
    SET delivery_count = (
      SELECT COUNT(*)
      FROM deliveries
      WHERE shift_id = OLD.shift_id
        AND status = 'delivered'
        AND deleted_at IS NULL
    )
    WHERE id = OLD.shift_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists, then create
DROP TRIGGER IF EXISTS trigger_update_shift_delivery_count ON deliveries;

CREATE TRIGGER trigger_update_shift_delivery_count
  AFTER INSERT OR UPDATE OR DELETE ON deliveries
  FOR EACH ROW
  EXECUTE FUNCTION update_shift_delivery_count();

COMMENT ON TRIGGER trigger_update_shift_delivery_count ON deliveries IS
  'Automatically updates driver_shifts.delivery_count when deliveries are added, updated, or removed';

-- ============================================================================
-- Backfill delivery_count for existing shifts
-- ============================================================================

UPDATE driver_shifts ds
SET delivery_count = (
  SELECT COUNT(*)
  FROM deliveries d
  WHERE d.shift_id = ds.id
    AND d.status = 'delivered'
    AND d.deleted_at IS NULL
)
WHERE delivery_count IS NULL OR delivery_count = 0;

-- ============================================================================
-- Add index for mileage queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_driver_shifts_total_distance_miles
  ON driver_shifts(total_distance_miles)
  WHERE deleted_at IS NULL;

COMMIT;

-- ============================================================================
-- Migration Notes
-- ============================================================================
--
-- **PURPOSE**: Fix schema drift + convert from kilometers to miles
--
-- **COLUMNS ADDED**:
-- - total_distance_miles: Primary distance field in miles
-- - delivery_count: Auto-updated count of completed deliveries
-- - gps_distance_miles: GPS-calculated distance for auditing
-- - reported_distance_miles: Client-reported distance when provided
-- - mileage_source: Tracks which source was used for final distance
--
-- **DATA MIGRATION**:
-- - Existing total_distance values (assumed km) converted to miles
-- - Conversion factor: 1 km = 0.621371 miles
-- - Existing delivery counts backfilled from deliveries table
--
-- **UNIT CHANGE**:
-- - OLD: Kilometers (total_distance, total_distance_km)
-- - NEW: Miles (total_distance_miles)
--
-- **TRIGGERS**:
-- - delivery_count is automatically updated when deliveries change
--
-- **BACKWARDS COMPATIBILITY**:
-- - The old total_distance column is preserved
-- - Code should be updated to use total_distance_miles
--
-- ============================================================================
