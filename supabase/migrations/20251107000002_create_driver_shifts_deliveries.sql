-- ============================================================================
-- Migration: Create driver_shifts and deliveries tables
-- Date: 2025-11-07
-- Issue: REA-122 - Support for real-time driver tracking
-- ============================================================================

-- Purpose: Create driver_shifts table for shift management
-- and deliveries table for delivery tracking

-- ============================================================================
-- Create driver_shifts table
-- ============================================================================

CREATE TABLE IF NOT EXISTS driver_shifts (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,

  -- Shift timing
  shift_start TIMESTAMPTZ NOT NULL,
  shift_end TIMESTAMPTZ,
  planned_shift_duration INTERVAL,
  actual_shift_duration INTERVAL,

  -- Shift status
  status VARCHAR(20) DEFAULT 'scheduled' NOT NULL,
  -- Possible values: 'scheduled', 'active', 'completed', 'cancelled'

  -- Location tracking
  start_location GEOGRAPHY(POINT),
  end_location GEOGRAPHY(POINT),
  start_odometer DOUBLE PRECISION,
  end_odometer DOUBLE PRECISION,
  total_distance DOUBLE PRECISION, -- kilometers

  -- Break tracking
  break_start TIMESTAMPTZ,
  break_end TIMESTAMPTZ,
  total_break_duration INTERVAL,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMPTZ
);

-- ============================================================================
-- Create deliveries table
-- ============================================================================

CREATE TABLE IF NOT EXISTS deliveries (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
  shift_id UUID REFERENCES driver_shifts(id) ON DELETE SET NULL,
  assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Delivery information
  order_number VARCHAR(100) UNIQUE,
  customer_name VARCHAR(255),
  customer_phone VARCHAR(20),

  -- Addresses
  pickup_address TEXT,
  pickup_location GEOGRAPHY(POINT),
  delivery_address TEXT NOT NULL,
  delivery_location GEOGRAPHY(POINT),

  -- Status and timing
  status VARCHAR(20) DEFAULT 'pending' NOT NULL,
  -- Possible values: 'pending', 'assigned', 'accepted', 'picked_up', 'in_transit', 'delivered', 'cancelled'

  assigned_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,

  -- Estimated times
  estimated_pickup_time TIMESTAMPTZ,
  estimated_delivery_time TIMESTAMPTZ,

  -- Delivery details
  priority VARCHAR(20) DEFAULT 'normal',
  -- Possible values: 'low', 'normal', 'high', 'urgent'

  delivery_instructions TEXT,
  signature_required BOOLEAN DEFAULT false,
  photo_required BOOLEAN DEFAULT false,

  -- Proof of delivery
  delivery_signature_url TEXT,
  delivery_photo_url TEXT,
  delivery_notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMPTZ
);

-- ============================================================================
-- Create indexes for driver_shifts
-- ============================================================================

-- Foreign key indexes
CREATE INDEX IF NOT EXISTS idx_driver_shifts_driver_id ON driver_shifts(driver_id);

-- Status and time queries
CREATE INDEX IF NOT EXISTS idx_driver_shifts_status ON driver_shifts(status);
CREATE INDEX IF NOT EXISTS idx_driver_shifts_shift_start ON driver_shifts(shift_start DESC);
CREATE INDEX IF NOT EXISTS idx_driver_shifts_shift_end ON driver_shifts(shift_end DESC);

-- Active shifts
CREATE INDEX IF NOT EXISTS idx_driver_shifts_active
  ON driver_shifts(driver_id, status)
  WHERE status = 'active' AND deleted_at IS NULL;

-- Soft delete
CREATE INDEX IF NOT EXISTS idx_driver_shifts_deleted_at
  ON driver_shifts(deleted_at) WHERE deleted_at IS NULL;

-- ============================================================================
-- Create indexes for deliveries
-- ============================================================================

-- Foreign key indexes
CREATE INDEX IF NOT EXISTS idx_deliveries_driver_id ON deliveries(driver_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_shift_id ON deliveries(shift_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_assigned_by ON deliveries(assigned_by);

-- Status queries
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);

-- Time-based queries
CREATE INDEX IF NOT EXISTS idx_deliveries_assigned_at ON deliveries(assigned_at DESC);
CREATE INDEX IF NOT EXISTS idx_deliveries_delivered_at ON deliveries(delivered_at DESC);
CREATE INDEX IF NOT EXISTS idx_deliveries_estimated_delivery_time ON deliveries(estimated_delivery_time);

-- Priority filtering
CREATE INDEX IF NOT EXISTS idx_deliveries_priority ON deliveries(priority);

-- Order lookup
CREATE INDEX IF NOT EXISTS idx_deliveries_order_number ON deliveries(order_number);

-- Geospatial indexes
CREATE INDEX IF NOT EXISTS idx_deliveries_pickup_location
  ON deliveries USING GIST(pickup_location);
CREATE INDEX IF NOT EXISTS idx_deliveries_delivery_location
  ON deliveries USING GIST(delivery_location);

-- Active deliveries for a driver
CREATE INDEX IF NOT EXISTS idx_deliveries_driver_active
  ON deliveries(driver_id, status)
  WHERE status IN ('assigned', 'accepted', 'picked_up', 'in_transit')
  AND deleted_at IS NULL;

-- Soft delete
CREATE INDEX IF NOT EXISTS idx_deliveries_deleted_at
  ON deliveries(deleted_at) WHERE deleted_at IS NULL;

-- ============================================================================
-- Create updated_at triggers
-- ============================================================================

CREATE OR REPLACE FUNCTION update_driver_shifts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_driver_shifts_updated_at
  BEFORE UPDATE ON driver_shifts
  FOR EACH ROW
  EXECUTE FUNCTION update_driver_shifts_updated_at();

CREATE OR REPLACE FUNCTION update_deliveries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_deliveries_updated_at
  BEFORE UPDATE ON deliveries
  FOR EACH ROW
  EXECUTE FUNCTION update_deliveries_updated_at();

-- ============================================================================
-- Create function to update drivers.current_shift_id
-- ============================================================================

CREATE OR REPLACE FUNCTION update_driver_current_shift()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'active' THEN
    -- Set this shift as the driver's current shift
    UPDATE drivers
    SET
      current_shift_id = NEW.id,
      is_on_duty = true,
      shift_start_time = NEW.shift_start,
      updated_at = NOW()
    WHERE id = NEW.driver_id;
  ELSIF NEW.status IN ('completed', 'cancelled') AND OLD.status = 'active' THEN
    -- Clear the current shift
    UPDATE drivers
    SET
      current_shift_id = NULL,
      is_on_duty = false,
      shift_end_time = NEW.shift_end,
      updated_at = NOW()
    WHERE id = NEW.driver_id AND current_shift_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_driver_current_shift
  AFTER INSERT OR UPDATE ON driver_shifts
  FOR EACH ROW
  EXECUTE FUNCTION update_driver_current_shift();

-- ============================================================================
-- Enable Row Level Security (RLS)
-- ============================================================================

ALTER TABLE driver_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

-- Policies for driver_shifts
CREATE POLICY "Drivers can view own shifts"
  ON driver_shifts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM drivers
      WHERE drivers.id = driver_shifts.driver_id
      AND drivers.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can view all shifts"
  ON driver_shifts
  FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    deleted_at IS NULL
  );

-- REMOVED: Service role policy for shifts (redundant)
-- Service role ALWAYS bypasses RLS in Supabase, explicit policy not needed

-- Policies for deliveries
CREATE POLICY "Drivers can view own deliveries"
  ON deliveries
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM drivers
      WHERE drivers.id = deliveries.driver_id
      AND drivers.user_id = auth.uid()
    )
  );

CREATE POLICY "Drivers can update assigned deliveries"
  ON deliveries
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM drivers
      WHERE drivers.id = deliveries.driver_id
      AND drivers.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can view all deliveries"
  ON deliveries
  FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    deleted_at IS NULL
  );

-- REMOVED: Service role policy for deliveries (redundant)
-- Service role ALWAYS bypasses RLS in Supabase, explicit policy not needed

-- ============================================================================
-- Add helpful comments
-- ============================================================================

COMMENT ON TABLE driver_shifts IS 'Driver shift management and tracking';
COMMENT ON COLUMN driver_shifts.status IS 'Shift status: scheduled, active, completed, cancelled';
COMMENT ON COLUMN driver_shifts.total_distance IS 'Total distance traveled during shift in kilometers';

COMMENT ON TABLE deliveries IS 'Delivery orders assigned to drivers';
COMMENT ON COLUMN deliveries.status IS 'Delivery status: pending, assigned, accepted, picked_up, in_transit, delivered, cancelled';
COMMENT ON COLUMN deliveries.priority IS 'Delivery priority: low, normal, high, urgent';
COMMENT ON TRIGGER trigger_update_driver_current_shift ON driver_shifts IS 'Updates driver.current_shift_id when shift becomes active';
