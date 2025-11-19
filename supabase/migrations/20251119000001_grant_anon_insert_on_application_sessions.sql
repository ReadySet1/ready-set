-- Grant necessary permissions to anon role for application_sessions
-- This allows anonymous users to create job application sessions
-- Related to: REA-191 - Session creation failures

-- Grant INSERT on the table
GRANT INSERT ON public.application_sessions TO anon;

-- Grant USAGE on the sequence used by the id column
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Grant SELECT for the RETURNING clause to work
GRANT SELECT ON public.application_sessions TO anon;

-- Add comment explaining the grants
COMMENT ON TABLE public.application_sessions IS 'Job application session tracking. Anonymous users can INSERT to create sessions. RLS policies enforce security constraints.';

