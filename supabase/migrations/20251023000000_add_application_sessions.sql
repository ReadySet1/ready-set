-- Migration: Add application_sessions table for secure file uploads
-- Purpose: Track upload sessions and validate file uploads
-- Related to: File upload security enhancement (REA-54/REA-55 follow-up)

-- 1. Create application_sessions table
CREATE TABLE IF NOT EXISTS public.application_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User identification
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  role TEXT,

  -- Email verification (for future phase)
  verification_code TEXT,
  code_expires_at TIMESTAMPTZ,
  verified BOOLEAN DEFAULT FALSE,

  -- Session management
  session_token TEXT UNIQUE NOT NULL,
  session_expires_at TIMESTAMPTZ NOT NULL,

  -- File tracking
  uploaded_files TEXT[] DEFAULT '{}',
  upload_count INTEGER DEFAULT 0,
  max_uploads INTEGER DEFAULT 10,

  -- Security & tracking
  ip_address TEXT,
  user_agent TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  completed BOOLEAN DEFAULT FALSE,
  job_application_id UUID
);

-- 2. Create indexes for performance
CREATE INDEX idx_application_sessions_token ON public.application_sessions(session_token);
CREATE INDEX idx_application_sessions_expires ON public.application_sessions(session_expires_at);
CREATE INDEX idx_application_sessions_email ON public.application_sessions(email);
CREATE INDEX idx_application_sessions_ip ON public.application_sessions(ip_address);
CREATE INDEX idx_application_sessions_created ON public.application_sessions(created_at);

-- 3. Add comment for documentation
COMMENT ON TABLE public.application_sessions IS 'Tracks file upload sessions for job applications. Includes verification codes for email validation and session tokens for secure uploads.';

-- 4. Enable Row Level Security
ALTER TABLE public.application_sessions ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
-- Allow anonymous users to create sessions (needed for job applications)
CREATE POLICY "Anyone can create application sessions"
ON public.application_sessions
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Users can only read their own sessions (by token)
CREATE POLICY "Users can read own sessions"
ON public.application_sessions
FOR SELECT
TO anon, authenticated
USING (
  session_token = current_setting('request.jwt.claims', true)::json->>'session_token'
  OR
  auth.uid() IS NOT NULL AND auth.role() = 'authenticated'
);

-- Only allow updates to specific fields (activity tracking)
CREATE POLICY "Users can update own session activity"
ON public.application_sessions
FOR UPDATE
TO anon, authenticated
USING (
  session_token = current_setting('request.jwt.claims', true)::json->>'session_token'
  OR
  auth.uid() IS NOT NULL AND auth.role() = 'authenticated'
)
WITH CHECK (
  session_token = current_setting('request.jwt.claims', true)::json->>'session_token'
  OR
  auth.uid() IS NOT NULL AND auth.role() = 'authenticated'
);

-- Admin full access
CREATE POLICY "Admins have full access to sessions"
ON public.application_sessions
FOR ALL
TO authenticated
USING (
  auth.jwt() ->> 'role' = 'admin'
);

-- 6. Function to validate upload session
CREATE OR REPLACE FUNCTION public.validate_upload_session(
  p_session_token TEXT,
  p_file_path TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_session_record RECORD;
  v_session_id TEXT;
BEGIN
  -- Extract session ID from file path (format: temp/sessionId/filename)
  v_session_id := split_part(p_file_path, '/', 2);

  -- Look up session
  SELECT * INTO v_session_record
  FROM public.application_sessions
  WHERE session_token = p_session_token
    AND id::text = v_session_id
    AND session_expires_at > NOW()
    AND upload_count < max_uploads
    AND completed = FALSE;

  IF NOT FOUND THEN
    RAISE WARNING 'Invalid or expired session: token=%, path=%', p_session_token, p_file_path;
    RETURN FALSE;
  END IF;

  -- Update upload count and last activity
  UPDATE public.application_sessions
  SET
    upload_count = upload_count + 1,
    last_activity_at = NOW(),
    uploaded_files = array_append(uploaded_files, p_file_path)
  WHERE id = v_session_record.id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Function to cleanup expired sessions
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Delete sessions that are:
  -- 1. Expired (session_expires_at < now)
  -- 2. Old and unverified (created > 24h ago and not verified)
  -- 3. Completed and old (completed > 7 days ago)
  DELETE FROM public.application_sessions
  WHERE
    session_expires_at < NOW()
    OR (verified = FALSE AND created_at < NOW() - INTERVAL '24 hours')
    OR (completed = TRUE AND created_at < NOW() - INTERVAL '7 days');

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Create a scheduled job to cleanup (using pg_cron if available)
-- Note: This requires pg_cron extension which may need to be enabled
-- If pg_cron is not available, this can be run via external cron job

-- Check if pg_cron exists before creating the job
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Run cleanup every 2 hours
    PERFORM cron.schedule(
      'cleanup-expired-sessions',
      '0 */2 * * *', -- Every 2 hours
      'SELECT public.cleanup_expired_sessions();'
    );
  ELSE
    RAISE NOTICE 'pg_cron extension not available. Please run cleanup_expired_sessions() via external scheduler.';
  END IF;
END $$;

-- 9. Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.application_sessions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_sessions TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_upload_session(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_sessions() TO authenticated;

-- 10. Add trigger to update last_activity_at automatically
CREATE OR REPLACE FUNCTION public.update_session_activity()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_activity_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_session_activity_trigger
BEFORE UPDATE ON public.application_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_session_activity();
