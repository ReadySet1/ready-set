-- Grant permissions to service_role for application_sessions table
-- This allows the admin client (using service_role key) to manage sessions
-- Related to: Fix for "permission denied for schema public" error

GRANT ALL ON public.application_sessions TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;

