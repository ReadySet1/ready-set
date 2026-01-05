-- ============================================================================
-- Migration: Enable RLS on Cache/Backend-Only Tables
-- Date: 2025-12-22
-- Issue: Supabase Security Advisor - RLS disabled on tables
-- ============================================================================
--
-- Description:
--   Enables Row Level Security on cache tables that should only be accessed
--   by the backend service role. No policies are created, which means only
--   service_role (which bypasses RLS) can access these tables.
--
-- Tables:
--   - notification_dedup: Distributed notification deduplication cache
--
-- Access Pattern:
--   - No user access (service_role only)
--   - Service role bypasses RLS automatically in Supabase
--
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. notification_dedup (Backend cache for notification deduplication)
-- ============================================================================
-- This table is used to prevent duplicate notifications across multiple
-- server instances. Only the backend service should access it.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE tablename = 'notification_dedup'
    AND schemaname = 'public'
    AND rowsecurity = true
  ) THEN
    ALTER TABLE IF EXISTS notification_dedup ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- No policies = no user access
-- Service role bypasses RLS, so backend can still CRUD this table

-- Revoke direct access from authenticated users (defense in depth)
REVOKE ALL ON notification_dedup FROM anon, authenticated;

-- Add comment explaining the access pattern
COMMENT ON TABLE notification_dedup IS
  'Distributed notification deduplication cache. '
  'RLS enabled with no policies - only service_role can access.';

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
WHERE tablename = 'notification_dedup'
AND schemaname = 'public';

-- Verify no policies exist (expected)
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'notification_dedup';

-- Verify service_role can still access (test from Supabase dashboard SQL editor)
-- SET ROLE service_role;
-- SELECT COUNT(*) FROM notification_dedup;
*/
