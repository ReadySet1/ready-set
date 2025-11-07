-- ============================================================================
-- Migration: Seed drivers table from existing Profile records
-- Date: 2025-11-07
-- Issue: REA-122 - Support for real-time driver tracking
-- ============================================================================

-- Purpose: Populate drivers table with existing driver profiles
-- This migration is idempotent (can be run multiple times safely)

-- ============================================================================
-- Insert driver records from profiles
-- ============================================================================

INSERT INTO drivers (
  id,
  user_id,
  profile_id,
  employee_id,
  vehicle_number,
  phone_number,
  is_active,
  is_on_duty,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid() as id,
  p.id as user_id,         -- profile.id is the auth.uid() in Supabase
  p.id as profile_id,
  -- Generate employee_id from email (e.g., 'driver-12345')
  'driver-' || SUBSTRING(p.id::text FROM 1 FOR 8) as employee_id,
  NULL as vehicle_number, -- To be filled later
  p."contactNumber" as phone_number,
  CASE WHEN p.status = 'ACTIVE' THEN true ELSE false END as is_active,
  false as is_on_duty, -- All drivers start as off-duty
  p."createdAt" as created_at,
  p."updatedAt" as updated_at
FROM profiles p
WHERE p.type = 'DRIVER'
  AND p."deletedAt" IS NULL
  -- Only insert if not already exists (idempotent)
  AND NOT EXISTS (
    SELECT 1 FROM drivers d WHERE d.profile_id = p.id
  );

-- ============================================================================
-- Update statistics
-- ============================================================================

-- Log the number of drivers created
DO $$
DECLARE
  driver_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO driver_count FROM drivers;
  RAISE NOTICE 'Drivers table seeded: % driver records created', driver_count;
END $$;
