-- Fix RLS policies for application_sessions table
-- Issue: "Admins have full access to sessions" FOR ALL policy interferes with INSERT operations
-- Solution: Replace with specific policies that don't block other INSERT policies
-- Related to: REA-191 - Session creation failures

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

