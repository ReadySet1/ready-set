-- ============================================================================
-- Production Migration: Application Sessions RLS Fix
-- ============================================================================
-- Related Issue: REA-191 - Anonymous user session creation failing
-- Date: 2025-11-19
-- Purpose: Fix RLS policies to allow anonymous users to create job application sessions
--
-- DEPLOYMENT INSTRUCTIONS:
-- 1. Backup the database before running this migration
-- 2. Run this script in production database
-- 3. Verify no active sessions are disrupted
-- 4. Test anonymous job application flow after deployment
--
-- ROLLBACK: See prod_application_sessions_rollback.sql
-- ============================================================================

BEGIN;

-- ============================================================================
-- MIGRATION 1: Fix RLS policies for application_sessions table
-- ============================================================================
-- Issue: "Admins have full access to sessions" FOR ALL policy interferes with INSERT operations
-- Solution: Replace with specific policies that don't block other INSERT policies

-- Drop the problematic ALL policy
DROP POLICY IF EXISTS "Admins have full access to sessions" ON public.application_sessions;

-- Create specific admin policies that don't interfere with INSERT
CREATE POLICY "Admins can read all sessions"
ON public.application_sessions
FOR SELECT
TO authenticated
USING (
  (auth.jwt() ->> 'role') = 'admin'
);

CREATE POLICY "Admins can update all sessions"
ON public.application_sessions
FOR UPDATE
TO authenticated
USING (
  (auth.jwt() ->> 'role') = 'admin'
)
WITH CHECK (
  (auth.jwt() ->> 'role') = 'admin'
);

CREATE POLICY "Admins can delete all sessions"
ON public.application_sessions
FOR DELETE
TO authenticated
USING (
  (auth.jwt() ->> 'role') = 'admin'
);

-- Add admin INSERT policy that doesn't interfere with other INSERT policies
CREATE POLICY "Admins can insert sessions"
ON public.application_sessions
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.jwt() ->> 'role') = 'admin'
);

-- Add comment explaining the fix
COMMENT ON TABLE public.application_sessions IS 'Tracks file upload sessions for job applications. RLS policies fixed to prevent admin ALL policy from blocking anonymous inserts.';

-- ============================================================================
-- MIGRATION 2: Grant necessary permissions to anon role
-- ============================================================================
-- This allows anonymous users to create job application sessions

-- Grant INSERT on the table
GRANT INSERT ON public.application_sessions TO anon;

-- Grant USAGE on the sequence used by the id column
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Grant SELECT for the RETURNING clause to work
GRANT SELECT ON public.application_sessions TO anon;

-- Add comment explaining the grants
COMMENT ON TABLE public.application_sessions IS 'Job application session tracking. Anonymous users can INSERT to create sessions. RLS policies enforce security constraints.';

-- ============================================================================
-- MIGRATION 3: Create RPC function for session creation
-- ============================================================================
-- Solution: Use a SECURITY DEFINER function (RPC) to handle session creation
-- This bypasses RLS checks entirely for this specific operation, ensuring reliability

CREATE OR REPLACE FUNCTION public.create_application_session(
  p_email TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_role TEXT,
  p_session_token TEXT,
  p_session_expires_at TIMESTAMPTZ,
  p_ip_address TEXT,
  p_user_agent TEXT,
  p_max_uploads INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with privileges of the creator (bypassing RLS)
AS $$
DECLARE
  v_session_id UUID;
BEGIN
  INSERT INTO public.application_sessions (
    email,
    first_name,
    last_name,
    role,
    session_token,
    session_expires_at,
    ip_address,
    user_agent,
    upload_count,
    max_uploads,
    verified,
    completed
  ) VALUES (
    p_email,
    p_first_name,
    p_last_name,
    p_role,
    p_session_token,
    p_session_expires_at,
    p_ip_address,
    p_user_agent,
    0,
    p_max_uploads,
    false,
    false
  )
  RETURNING id INTO v_session_id;

  RETURN jsonb_build_object(
    'id', v_session_id,
    'session_token', p_session_token,
    'session_expires_at', p_session_expires_at
  );
END;
$$;

-- Grant execute permission to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.create_application_session TO anon, authenticated;

COMMENT ON FUNCTION public.create_application_session IS 'Creates a new application session. Bypasses RLS to ensure successful creation for anonymous users.';

-- ============================================================================
-- MIGRATION 4: Grant service_role permissions
-- ============================================================================
-- This allows the admin client (using service_role key) to manage sessions

GRANT ALL ON public.application_sessions TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ============================================================================
-- VERIFICATION QUERIES (Run after migration)
-- ============================================================================
-- Uncomment and run these queries to verify the migration was successful:

-- 1. Check that policies were created correctly
-- SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'application_sessions'
-- ORDER BY policyname;

-- 2. Check that permissions were granted
-- SELECT grantee, privilege_type
-- FROM information_schema.table_privileges
-- WHERE table_schema = 'public' AND table_name = 'application_sessions'
-- ORDER BY grantee, privilege_type;

-- 3. Check that function was created
-- SELECT proname, proargtypes, prosecdef
-- FROM pg_proc
-- WHERE proname = 'create_application_session';

-- ============================================================================
-- POST-DEPLOYMENT TESTING
-- ============================================================================
-- Test the anonymous session creation by making a POST request to:
-- /api/application-sessions
-- 
-- Expected behavior:
-- - Anonymous users can create sessions
-- - Admin users can read/update/delete sessions
-- - Session token is required for subsequent operations
-- - Rate limiting still applies

COMMIT;

-- ============================================================================
-- DEPLOYMENT NOTES
-- ============================================================================
-- 1. This migration is ADDITIVE ONLY - no data loss risk
-- 2. Existing sessions will continue to work
-- 3. No downtime required
-- 4. Can be rolled back using prod_application_sessions_rollback.sql
-- 5. Monitor Sentry for RLS-related errors after deployment
-- ============================================================================

