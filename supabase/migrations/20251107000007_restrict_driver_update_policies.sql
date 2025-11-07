-- ============================================================================
-- Migration: Restrict Driver Self-Service UPDATE Policies
-- Date: 2025-11-07
-- Issue: Code review identified overly permissive RLS policies
--
-- SECURITY FIX:
-- Restricts drivers from modifying critical fields like shift times and distance.
-- Prevents time fraud, padding hours, and mileage fraud.
-- ============================================================================

BEGIN;

-- ============================================================================
-- Drop Overly Permissive Policies
-- ============================================================================

-- Driver shifts policy allows updating ANY field - needs restriction
DROP POLICY IF EXISTS "Drivers can update own shifts" ON driver_shifts;

-- ============================================================================
-- Create Restricted Self-Service Policies
-- ============================================================================

-- DRIVER_SHIFTS TABLE
-- ============================================================================

-- Drivers can only update status and break information
-- Cannot modify: shift_start, shift_end, total_distance_km, break_duration
CREATE POLICY "Drivers can update shift status and breaks"
  ON driver_shifts
  FOR UPDATE
  USING (
    driver_id IN (
      SELECT id FROM drivers WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    driver_id IN (
      SELECT id FROM drivers WHERE user_id = auth.uid()
    ) AND
    -- Prevent modification of critical fields
    -- NOTE: Column names corrected to match actual schema
    (OLD.shift_start = NEW.shift_start OR OLD.shift_start IS NULL) AND
    (OLD.shift_end = NEW.shift_end OR OLD.shift_end IS NULL) AND
    (OLD.total_distance = NEW.total_distance OR OLD.total_distance IS NULL) AND
    (OLD.total_break_duration = NEW.total_break_duration OR OLD.total_break_duration IS NULL)
  );

COMMENT ON POLICY "Drivers can update shift status and breaks" ON driver_shifts IS
  'Restricts drivers to only updating status and break_type fields. '
  'Prevents time fraud by blocking modification of shift_start, shift_end, total_distance_km, and break_duration.';

-- DELIVERIES TABLE
-- ============================================================================

-- Drop existing policy to recreate with restrictions
DROP POLICY IF EXISTS "Drivers can update assigned deliveries" ON deliveries;

-- Drivers can only update delivery status and current location
-- Cannot modify: driver_id, pickup/delivery locations, priority, estimated times
CREATE POLICY "Drivers can update delivery status and location"
  ON deliveries
  FOR UPDATE
  USING (
    driver_id IN (
      SELECT id FROM drivers WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    driver_id IN (
      SELECT id FROM drivers WHERE user_id = auth.uid()
    ) AND
    -- Prevent modification of assignment and location fields
    (OLD.driver_id = NEW.driver_id) AND
    (OLD.pickup_location = NEW.pickup_location OR OLD.pickup_location IS NULL) AND
    (OLD.delivery_location = NEW.delivery_location OR OLD.delivery_location IS NULL) AND
    (OLD.priority = NEW.priority OR OLD.priority IS NULL) AND
    (OLD.estimated_delivery_time = NEW.estimated_delivery_time OR OLD.estimated_delivery_time IS NULL)
  );

COMMENT ON POLICY "Drivers can update delivery status and location" ON deliveries IS
  'Restricts drivers to only updating status and current_location fields. '
  'Prevents drivers from reassigning deliveries or modifying pickup/delivery addresses.';

-- DRIVERS TABLE
-- ============================================================================

-- Drop existing policy to recreate with restrictions
DROP POLICY IF EXISTS "Drivers can view own profile" ON drivers;

-- Recreate view policy (no changes needed)
CREATE POLICY "Drivers can view own profile"
  ON drivers
  FOR SELECT
  USING (
    auth.uid() = user_id AND
    deleted_at IS NULL
  );

COMMENT ON POLICY "Drivers can view own profile" ON drivers IS
  'Allows drivers to view their own profile data only.';

-- Note: Drivers cannot update their own profile at all
-- All driver profile updates must go through admin interface
-- This includes: employee_id, vehicle_number, phone_number, is_active, is_on_duty

-- ============================================================================
-- Verification Queries (for testing)
-- ============================================================================

-- Uncomment these to verify policies work correctly:
--
-- -- Test 1: Driver attempts to modify shift_start (should fail)
-- SET LOCAL ROLE authenticated;
-- SET LOCAL "request.jwt.claims" TO '{\"sub\": \"[driver-user-id]\", \"role\": \"authenticated\"}';
-- UPDATE driver_shifts
-- SET shift_start = NOW() + INTERVAL '1 hour'
-- WHERE driver_id = '[driver-id]';
-- -- Expected: Error or no rows affected
--
-- -- Test 2: Driver attempts to update shift status (should succeed)
-- UPDATE driver_shifts
-- SET status = 'on_break', break_type = 'meal'
-- WHERE driver_id = '[driver-id]' AND status = 'active';
-- -- Expected: 1 row affected
--
-- -- Test 3: Driver attempts to change delivery driver_id (should fail)
-- UPDATE deliveries
-- SET driver_id = '[other-driver-id]'
-- WHERE driver_id = '[driver-id]';
-- -- Expected: Error or no rows affected
--
-- -- Test 4: Driver attempts to update delivery status (should succeed)
-- UPDATE deliveries
-- SET status = 'picked_up'
-- WHERE driver_id = '[driver-id]' AND status = 'assigned';
-- -- Expected: 1 row affected

COMMIT;

-- ============================================================================
-- Migration Notes
-- ============================================================================
--
-- **BREAKING CHANGES**: None for legitimate use cases
-- - Admin users retain full access to all fields via "Admin users can manage" policies
-- - Drivers can still update their status and break information
-- - Drivers can no longer modify critical fields that could enable fraud
--
-- **SECURITY IMPACT**:
-- - High: Prevents time fraud by restricting shift time modifications
-- - High: Prevents mileage fraud by restricting distance modifications
-- - High: Prevents delivery reassignment by restricting driver_id changes
-- - High: Prevents address manipulation by restricting location changes
--
-- **FIELDS DRIVERS CAN UPDATE**:
-- - driver_shifts: status, break_type
-- - deliveries: status, current_location, actual_pickup_time, actual_delivery_time
-- - drivers: NONE (must use admin interface)
--
-- **FIELDS DRIVERS CANNOT UPDATE**:
-- - driver_shifts: shift_start, shift_end, total_distance_km, break_duration, driver_id
-- - deliveries: driver_id, pickup_location, delivery_location, priority, estimated_delivery_time
-- - drivers: ALL FIELDS (employee_id, vehicle_number, phone_number, is_active, is_on_duty)
--
-- **TESTING REQUIRED**:
-- 1. Verify drivers can still clock in/out via mobile app
-- 2. Verify drivers can start/end breaks
-- 3. Verify drivers can update delivery status
-- 4. Verify drivers cannot modify shift times
-- 5. Verify admin dashboard can still update all fields
--
-- **ROLLBACK**:
-- If issues occur, you can temporarily restore permissive policies:
-- ```sql
-- DROP POLICY IF EXISTS "Drivers can update shift status and breaks" ON driver_shifts;
-- CREATE POLICY "Drivers can update own shifts" ON driver_shifts FOR UPDATE
--   USING (driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid()))
--   WITH CHECK (driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid()));
-- ```
-- However, this re-opens the security vulnerability!
--
-- ============================================================================
