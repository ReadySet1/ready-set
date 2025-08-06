-- Phase 1 Driver Tracking - Shift Management Tables
-- Add shift tracking functionality to existing driver tracking system

-- Driver shifts table for tracking work sessions
CREATE TABLE IF NOT EXISTS public.driver_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID REFERENCES public.drivers(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    start_location GEOGRAPHY(POINT, 4326),
    end_location GEOGRAPHY(POINT, 4326),
    total_distance_km FLOAT DEFAULT 0,
    delivery_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shift breaks table for tracking rest periods
CREATE TABLE IF NOT EXISTS public.shift_breaks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id UUID REFERENCES public.driver_shifts(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    break_type TEXT DEFAULT 'rest' CHECK (break_type IN ('rest', 'meal', 'fuel', 'emergency')),
    location GEOGRAPHY(POINT, 4326),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link deliveries to existing orders
ALTER TABLE public.deliveries
ADD COLUMN IF NOT EXISTS catering_request_id UUID REFERENCES public.catering_requests(id),
ADD COLUMN IF NOT EXISTS on_demand_id UUID;

-- Add shift tracking to drivers table
ALTER TABLE public.drivers
ADD COLUMN IF NOT EXISTS current_shift_id UUID REFERENCES public.driver_shifts(id),
ADD COLUMN IF NOT EXISTS shift_start_time TIMESTAMPTZ;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_driver_shifts_driver_id ON driver_shifts(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_shifts_status ON driver_shifts(status);
CREATE INDEX IF NOT EXISTS idx_driver_shifts_start_time ON driver_shifts(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_shift_breaks_shift_id ON shift_breaks(shift_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_catering_request ON deliveries(catering_request_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_on_demand ON deliveries(on_demand_id);

-- Add triggers for updated_at
CREATE TRIGGER IF NOT EXISTS update_driver_shifts_updated_at 
    BEFORE UPDATE ON driver_shifts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add function to calculate shift duration
CREATE OR REPLACE FUNCTION calculate_shift_duration(shift_id UUID)
RETURNS INTERVAL AS $$
DECLARE
    shift_record RECORD;
    total_break_time INTERVAL := '0 minutes';
BEGIN
    -- Get shift record
    SELECT start_time, end_time INTO shift_record
    FROM driver_shifts
    WHERE id = shift_id;
    
    -- Calculate total break time
    SELECT COALESCE(SUM(end_time - start_time), '0 minutes'::interval)
    INTO total_break_time
    FROM shift_breaks
    WHERE shift_id = shift_id AND end_time IS NOT NULL;
    
    -- Return working time (excluding breaks)
    IF shift_record.end_time IS NOT NULL THEN
        RETURN (shift_record.end_time - shift_record.start_time) - total_break_time;
    ELSE
        RETURN (NOW() - shift_record.start_time) - total_break_time;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Add function to get active drivers count
CREATE OR REPLACE FUNCTION get_active_drivers_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)
        FROM drivers d
        JOIN driver_shifts ds ON d.current_shift_id = ds.id
        WHERE d.is_active = true 
        AND d.is_on_duty = true 
        AND ds.status = 'active'
    );
END;
$$ LANGUAGE plpgsql;