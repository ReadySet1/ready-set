-- ============================================================================
-- Production Rollback: Application Sessions RLS Fix
-- ============================================================================
-- Related Issue: REA-191
-- Purpose: Rollback the application sessions RLS fix if issues occur
--
-- WARNING: This rollback script will restore the original RLS policies
-- that were causing anonymous session creation failures. Only use this
-- if the fix introduces breaking issues.
--
-- USAGE:
-- 1. Backup the database before running this rollback
-- 2. Run this script in production database
-- 3. Verify existing sessions continue to work
-- 4. Report issues to the development team
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Drop the RPC function
-- ============================================================================
DROP FUNCTION IF EXISTS public.create_application_session(
  TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, INTEGER
);

-- ============================================================================
-- STEP 2: Revoke permissions granted to anon role
-- ============================================================================
REVOKE INSERT ON public.application_sessions FROM anon;
REVOKE SELECT ON public.application_sessions FROM anon;
-- Note: We don't revoke USAGE on sequences as other tables may depend on it

-- ============================================================================
-- STEP 3: Drop the specific admin policies
-- ============================================================================
DROP POLICY IF EXISTS "Admins can read all sessions" ON public.application_sessions;
DROP POLICY IF EXISTS "Admins can update all sessions" ON public.application_sessions;
DROP POLICY IF EXISTS "Admins can delete all sessions" ON public.application_sessions;
DROP POLICY IF EXISTS "Admins can insert sessions" ON public.application_sessions;

-- ============================================================================
-- STEP 4: Restore the original broad admin policy
-- ============================================================================
-- WARNING: This is the policy that was causing the issue. Only restore if
-- the fix is causing worse problems.

CREATE POLICY "Admins have full access to sessions"
ON public.application_sessions
FOR ALL
TO authenticated
USING (
  (auth.jwt() ->> 'role') = 'admin'
)
WITH CHECK (
  (auth.jwt() ->> 'role') = 'admin'
);

-- ============================================================================
-- STEP 5: Update table comment
-- ============================================================================
COMMENT ON TABLE public.application_sessions IS 'Tracks file upload sessions for job applications. NOTE: Rolled back to original RLS configuration.';

-- ============================================================================
-- VERIFICATION QUERIES (Run after rollback)
-- ============================================================================
-- Uncomment and run these queries to verify the rollback was successful:

-- 1. Verify policies were restored
-- SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'application_sessions'
-- ORDER BY policyname;

-- 2. Verify function was dropped
-- SELECT proname, proargtypes, prosecdef
-- FROM pg_proc
-- WHERE proname = 'create_application_session';
-- (Should return 0 rows)

-- 3. Verify permissions
-- SELECT grantee, privilege_type
-- FROM information_schema.table_privileges
-- WHERE table_schema = 'public' AND table_name = 'application_sessions'
-- ORDER BY grantee, privilege_type;

COMMIT;

-- ============================================================================
-- POST-ROLLBACK ACTIONS REQUIRED
-- ============================================================================
-- After running this rollback:
--
-- 1. Anonymous job application flow will be BROKEN again
--    - Users will not be able to create sessions
--    - Original REA-191 issue will resurface
--
-- 2. Revert the application code changes:
--    - Revert src/app/api/application-sessions/route.ts
--    - The code currently uses the RPC function which was just dropped
--    - Application will throw errors if code is not reverted
--
-- 3. Investigate why the fix was causing issues:
--    - Check Sentry for error logs
--    - Review database logs
--    - Check for conflicts with other RLS policies
--
-- 4. Plan a better fix:
--    - Consider alternative RLS policy configurations
--    - Test thoroughly in staging before production
--    - Document any edge cases discovered
--
-- 5. Notify stakeholders:
--    - Inform team that anonymous job applications are temporarily disabled
--    - Provide ETA for permanent fix
-- ============================================================================

-- ============================================================================
-- ALTERNATIVE: Partial Rollback Options
-- ============================================================================
-- If only specific parts of the migration are causing issues, you can
-- selectively rollback. Comment out the steps above and uncomment one of
-- these alternatives:

-- OPTION A: Keep RPC function but restore original policies
-- Useful if: RPC function works but policies are causing issues
/*
BEGIN;
DROP POLICY IF EXISTS "Admins can read all sessions" ON public.application_sessions;
DROP POLICY IF EXISTS "Admins can update all sessions" ON public.application_sessions;
DROP POLICY IF EXISTS "Admins can delete all sessions" ON public.application_sessions;
DROP POLICY IF EXISTS "Admins can insert sessions" ON public.application_sessions;

CREATE POLICY "Admins have full access to sessions"
ON public.application_sessions
FOR ALL
TO authenticated
USING ((auth.jwt() ->> 'role') = 'admin')
WITH CHECK ((auth.jwt() ->> 'role') = 'admin');
COMMIT;
*/

-- OPTION B: Keep policies but remove RPC function
-- Useful if: Policies work but RPC function has security concerns
/*
BEGIN;
DROP FUNCTION IF EXISTS public.create_application_session(
  TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, INTEGER
);
-- Application code must be updated to use direct INSERT instead of RPC
COMMIT;
*/

-- OPTION C: Keep everything but revoke anon permissions
-- Useful if: Anonymous access is being abused or causing security issues
/*
BEGIN;
REVOKE INSERT ON public.application_sessions FROM anon;
REVOKE SELECT ON public.application_sessions FROM anon;
-- Note: This will break anonymous job applications
-- Application must be updated to require authentication
COMMIT;
*/

-- ============================================================================
-- EMERGENCY CONTACT
-- ============================================================================
-- If issues persist after rollback or if you need immediate assistance:
-- 1. Check docs/authentication/AUTHENTICATION_ARCHITECTURE.md
-- 2. Review original issue REA-191 for context
-- 3. Contact development team with:
--    - Error logs from Sentry
--    - Database logs showing RLS denials
--    - Steps to reproduce the issue
-- ============================================================================

