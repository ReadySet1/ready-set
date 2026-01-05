-- ============================================================================
-- Migration: Enable RLS on User-Scoped Tables
-- Date: 2025-12-22
-- Issue: Supabase Security Advisor - RLS disabled on tables
-- ============================================================================
--
-- Description:
--   Enables Row Level Security and creates policies for tables where users
--   can only access their own data, with admin override capabilities.
--
-- Tables:
--   - accounts: OAuth account connections (legacy NextAuth)
--   - sessions: User sessions (legacy NextAuth)
--   - addresses: Delivery/pickup addresses (shared resource)
--   - client_configurations: Client-specific pricing settings
--   - calculation_history: Audit trail of price calculations
--   - notification_analytics: Push/email notification analytics
--
-- Access Pattern:
--   - Users can READ/WRITE their own records
--   - Admin users can READ all records (for support/debugging)
--
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. accounts (Legacy NextAuth OAuth accounts)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE tablename = 'accounts'
    AND schemaname = 'public'
    AND rowsecurity = true
  ) THEN
    ALTER TABLE IF EXISTS accounts ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Policy: Users manage their own OAuth accounts
DROP POLICY IF EXISTS "Users manage own accounts" ON accounts;
CREATE POLICY "Users manage own accounts"
  ON accounts
  FOR ALL
  TO authenticated
  USING (auth.uid() = "userId")
  WITH CHECK (auth.uid() = "userId");

-- Policy: Admin can view all accounts (support)
DROP POLICY IF EXISTS "Admin can view all accounts" ON accounts;
CREATE POLICY "Admin can view all accounts"
  ON accounts
  FOR SELECT
  TO authenticated
  USING (is_admin_user());

GRANT SELECT, INSERT, UPDATE, DELETE ON accounts TO authenticated;

-- ============================================================================
-- 2. sessions (Legacy NextAuth sessions)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE tablename = 'sessions'
    AND schemaname = 'public'
    AND rowsecurity = true
  ) THEN
    ALTER TABLE IF EXISTS sessions ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Policy: Users manage their own sessions
DROP POLICY IF EXISTS "Users manage own sessions" ON sessions;
CREATE POLICY "Users manage own sessions"
  ON sessions
  FOR ALL
  TO authenticated
  USING (auth.uid() = "userId")
  WITH CHECK (auth.uid() = "userId");

-- Policy: Admin can view all sessions (debugging)
DROP POLICY IF EXISTS "Admin can view all sessions" ON sessions;
CREATE POLICY "Admin can view all sessions"
  ON sessions
  FOR SELECT
  TO authenticated
  USING (is_admin_user());

GRANT SELECT, INSERT, UPDATE, DELETE ON sessions TO authenticated;

-- ============================================================================
-- 3. addresses (Shared delivery/pickup addresses)
-- ============================================================================
-- Special case: Addresses can be shared between users, so we use a more
-- permissive read policy but restrict modifications.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE tablename = 'addresses'
    AND schemaname = 'public'
    AND rowsecurity = true
  ) THEN
    ALTER TABLE IF EXISTS addresses ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Policy: Authenticated users can view all non-deleted addresses
-- (Addresses are shared resources used across orders)
DROP POLICY IF EXISTS "Authenticated can view addresses" ON addresses;
CREATE POLICY "Authenticated can view addresses"
  ON addresses
  FOR SELECT
  TO authenticated
  USING ("deletedAt" IS NULL);

-- Policy: Authenticated users can create addresses
DROP POLICY IF EXISTS "Authenticated can create addresses" ON addresses;
CREATE POLICY "Authenticated can create addresses"
  ON addresses
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Creator or admin can update address
DROP POLICY IF EXISTS "Creator or admin can update address" ON addresses;
CREATE POLICY "Creator or admin can update address"
  ON addresses
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = "createdBy"
    OR is_admin_user()
  )
  WITH CHECK (
    auth.uid() = "createdBy"
    OR is_admin_user()
  );

-- Policy: Only admin can delete addresses (soft-delete in practice)
DROP POLICY IF EXISTS "Admin can delete addresses" ON addresses;
CREATE POLICY "Admin can delete addresses"
  ON addresses
  FOR DELETE
  TO authenticated
  USING (is_admin_user());

GRANT SELECT, INSERT, UPDATE ON addresses TO authenticated;

-- ============================================================================
-- 4. client_configurations (Client-specific pricing)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE tablename = 'client_configurations'
    AND schemaname = 'public'
    AND rowsecurity = true
  ) THEN
    ALTER TABLE IF EXISTS client_configurations ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Policy: Client can view their own configuration
DROP POLICY IF EXISTS "Client views own config" ON client_configurations;
CREATE POLICY "Client views own config"
  ON client_configurations
  FOR SELECT
  TO authenticated
  USING (
    client_id = auth.uid()
    OR is_admin_user()
  );

-- Policy: Only admin can manage client configurations
DROP POLICY IF EXISTS "Admin manages client configs" ON client_configurations;
CREATE POLICY "Admin manages client configs"
  ON client_configurations
  FOR ALL
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

GRANT SELECT ON client_configurations TO authenticated;

-- ============================================================================
-- 5. calculation_history (Pricing calculation audit trail)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE tablename = 'calculation_history'
    AND schemaname = 'public'
    AND rowsecurity = true
  ) THEN
    ALTER TABLE IF EXISTS calculation_history ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Policy: Users can view their own calculation history
DROP POLICY IF EXISTS "User views own calculation history" ON calculation_history;
CREATE POLICY "User views own calculation history"
  ON calculation_history
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR is_admin_user()
  );

-- Policy: Authenticated users can create calculation history records
DROP POLICY IF EXISTS "Authenticated can create calculation history" ON calculation_history;
CREATE POLICY "Authenticated can create calculation history"
  ON calculation_history
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT ON calculation_history TO authenticated;

-- ============================================================================
-- 6. notification_analytics (Push/Email notification tracking)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE tablename = 'notification_analytics'
    AND schemaname = 'public'
    AND rowsecurity = true
  ) THEN
    ALTER TABLE IF EXISTS notification_analytics ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Policy: Users can view their own notification analytics
DROP POLICY IF EXISTS "User views own notification analytics" ON notification_analytics;
CREATE POLICY "User views own notification analytics"
  ON notification_analytics
  FOR SELECT
  TO authenticated
  USING (
    profile_id = auth.uid()
    OR is_admin_user()
  );

-- Policy: Service can insert notification analytics (backend logging)
-- Note: Service role bypasses RLS, this is for edge cases
DROP POLICY IF EXISTS "Service can insert notification analytics" ON notification_analytics;
CREATE POLICY "Service can insert notification analytics"
  ON notification_analytics
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

GRANT SELECT, INSERT ON notification_analytics TO authenticated;

COMMIT;

-- ============================================================================
-- Verification Query
-- ============================================================================
/*
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename IN (
  'accounts', 'sessions', 'addresses',
  'client_configurations', 'calculation_history', 'notification_analytics'
)
AND schemaname = 'public';

-- Check policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename IN (
  'accounts', 'sessions', 'addresses',
  'client_configurations', 'calculation_history', 'notification_analytics'
)
ORDER BY tablename, policyname;
*/
