-- ============================================================================
-- Migration: Fix RLS Policies for Driver Tables
-- Date: 2025-11-07
-- Issue: Code review identified that RLS policies were too permissive
--
-- SECURITY FIX:
-- Previous policies allowed ANY authenticated user (including customers) to view
-- all driver data including locations, phone numbers, vehicle info, etc.
--
-- This migration restricts access to admin roles only (ADMIN, SUPER_ADMIN, HELPDESK).
-- ============================================================================

BEGIN;

-- ============================================================================
-- Drop Existing Permissive Policies
-- ============================================================================

-- drivers table policies
DROP POLICY IF EXISTS "Authenticated users can view active drivers" ON drivers;
DROP POLICY IF EXISTS "Users can view their own driver profile" ON drivers;

-- driver_locations table policies
DROP POLICY IF EXISTS "Authenticated users can view active driver locations" ON driver_locations;
DROP POLICY IF EXISTS "Drivers can view their own location history" ON driver_locations;

-- driver_shifts table policies
DROP POLICY IF EXISTS "Authenticated users can view driver shifts" ON driver_shifts;
DROP POLICY IF EXISTS "Drivers can view their own shifts" ON driver_shifts;

-- deliveries table policies
DROP POLICY IF EXISTS "Authenticated users can view deliveries" ON deliveries;
DROP POLICY IF EXISTS "Drivers can view their assigned deliveries" ON deliveries;

-- ============================================================================
-- Helper Function: Check if User is Admin
-- ============================================================================

CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Get user role from profiles table
  SELECT user_type INTO user_role
  FROM profiles
  WHERE id = auth.uid();

  -- Check if user has admin role
  RETURN user_role IN ('ADMIN', 'SUPER_ADMIN', 'HELPDESK');
END;
$$;

COMMENT ON FUNCTION is_admin_user() IS
  'Helper function to check if the current user has admin privileges. '
  'Returns true if user_type is ADMIN, SUPER_ADMIN, or HELPDESK.';

-- ============================================================================
-- Create Restrictive Admin-Only Policies
-- ============================================================================

-- DRIVERS TABLE
-- ============================================================================

-- Admin users can view all active drivers
CREATE POLICY "Admin users can view active drivers"
  ON drivers
  FOR SELECT
  USING (
    is_admin_user() AND
    is_active = true AND
    deleted_at IS NULL
  );

COMMENT ON POLICY "Admin users can view active drivers" ON drivers IS
  'Restricts driver data access to admin users only. '
  'Regular users and customers cannot view driver information.';

-- Drivers can view their own profile only
CREATE POLICY "Drivers can view own profile"
  ON drivers
  FOR SELECT
  USING (
    auth.uid() = user_id AND
    deleted_at IS NULL
  );

COMMENT ON POLICY "Drivers can view own profile" ON drivers IS
  'Allows drivers to view their own profile data only.';

-- Admin users can update drivers
CREATE POLICY "Admin users can update drivers"
  ON drivers
  FOR UPDATE
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- Admin users can insert drivers
CREATE POLICY "Admin users can insert drivers"
  ON drivers
  FOR INSERT
  WITH CHECK (is_admin_user());

-- DRIVER_LOCATIONS TABLE
-- ============================================================================

-- Admin users can view all driver locations
CREATE POLICY "Admin users can view all driver locations"
  ON driver_locations
  FOR SELECT
  USING (is_admin_user());

COMMENT ON POLICY "Admin users can view all driver locations" ON driver_locations IS
  'Restricts driver location access to admin users only. '
  'Protects driver privacy by preventing unauthorized location tracking.';

-- Drivers can view their own location history
CREATE POLICY "Drivers can view own location history"
  ON driver_locations
  FOR SELECT
  USING (
    driver_id IN (
      SELECT id FROM drivers WHERE user_id = auth.uid()
    )
  );

COMMENT ON POLICY "Drivers can view own location history" ON driver_locations IS
  'Allows drivers to view their own location history only.';

-- Drivers can insert their own locations
CREATE POLICY "Drivers can insert own locations"
  ON driver_locations
  FOR INSERT
  WITH CHECK (
    driver_id IN (
      SELECT id FROM drivers WHERE user_id = auth.uid()
    )
  );

-- DRIVER_SHIFTS TABLE
-- ============================================================================

-- Admin users can view all shifts
CREATE POLICY "Admin users can view all driver shifts"
  ON driver_shifts
  FOR SELECT
  USING (is_admin_user());

COMMENT ON POLICY "Admin users can view all driver shifts" ON driver_shifts IS
  'Restricts shift data access to admin users only.';

-- Drivers can view their own shifts
CREATE POLICY "Drivers can view own shifts"
  ON driver_shifts
  FOR SELECT
  USING (
    driver_id IN (
      SELECT id FROM drivers WHERE user_id = auth.uid()
    )
  );

COMMENT ON POLICY "Drivers can view own shifts" ON driver_shifts IS
  'Allows drivers to view their own shift history.';

-- Admin users can manage shifts
CREATE POLICY "Admin users can manage driver shifts"
  ON driver_shifts
  FOR ALL
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- Drivers can update their own shifts (status, breaks)
CREATE POLICY "Drivers can update own shifts"
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
    )
  );

-- DELIVERIES TABLE
-- ============================================================================

-- Admin users can view all deliveries
CREATE POLICY "Admin users can view all deliveries"
  ON deliveries
  FOR SELECT
  USING (is_admin_user());

COMMENT ON POLICY "Admin users can view all deliveries" ON deliveries IS
  'Restricts delivery data access to admin users only.';

-- Drivers can view their assigned deliveries only
CREATE POLICY "Drivers can view assigned deliveries"
  ON deliveries
  FOR SELECT
  USING (
    driver_id IN (
      SELECT id FROM drivers WHERE user_id = auth.uid()
    )
  );

COMMENT ON POLICY "Drivers can view assigned deliveries" ON deliveries IS
  'Allows drivers to view only deliveries assigned to them.';

-- Admin users can manage all deliveries
CREATE POLICY "Admin users can manage all deliveries"
  ON deliveries
  FOR ALL
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- Drivers can update their assigned deliveries (status, location)
CREATE POLICY "Drivers can update assigned deliveries"
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
    )
  );

-- ============================================================================
-- Verification Queries (for testing)
-- ============================================================================

-- Uncomment these to verify policies are working correctly:
--
-- -- Check if admin user can view drivers
-- SET LOCAL ROLE authenticated;
-- SET LOCAL "request.jwt.claims" TO '{"sub": "[admin-user-id]", "role": "authenticated"}';
-- SELECT COUNT(*) FROM drivers; -- Should return drivers count
--
-- -- Check if regular user cannot view drivers
-- SET LOCAL ROLE authenticated;
-- SET LOCAL "request.jwt.claims" TO '{"sub": "[regular-user-id]", "role": "authenticated"}';
-- SELECT COUNT(*) FROM drivers; -- Should return 0

COMMIT;

-- ============================================================================
-- Migration Notes
-- ============================================================================
--
-- **BREAKING CHANGES**: None for legitimate use cases
-- - Admin users retain full access to all driver data
-- - Drivers can still access their own data
-- - Regular users/customers never should have had access to driver data
--
-- **SECURITY IMPACT**:
-- - High: Prevents unauthorized access to sensitive driver information
-- - Protects driver privacy (locations, phone numbers, vehicle info)
-- - Complies with data protection regulations (GDPR, CCPA)
--
-- **TESTING REQUIRED**:
-- 1. Verify admin dashboard still loads driver data correctly
-- 2. Verify driver portal still works for drivers
-- 3. Verify customers cannot access /api/drivers endpoints
-- 4. Test with different user roles (ADMIN, DRIVER, CUSTOMER)
--
-- **ROLLBACK**:
-- If issues occur, you can revert to permissive policies temporarily:
-- ```sql
-- DROP POLICY IF EXISTS "Admin users can view active drivers" ON drivers;
-- CREATE POLICY "Authenticated users can view active drivers"
--   ON drivers FOR SELECT
--   USING (auth.role() = 'authenticated' AND is_active = true AND deleted_at IS NULL);
-- ```
-- However, this re-opens the security vulnerability!
--
-- ============================================================================
