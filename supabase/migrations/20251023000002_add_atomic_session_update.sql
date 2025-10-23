-- Migration: Add atomic session update function
-- Purpose: Prevent race conditions when incrementing upload count
-- Related to: File upload security fix (PR #88)

-- Create function for atomic session upload increment
CREATE OR REPLACE FUNCTION public.increment_session_upload(
  p_session_id UUID,
  p_file_path TEXT,
  p_session_token TEXT DEFAULT NULL
)
RETURNS TABLE (
  new_upload_count INTEGER,
  success BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_count INTEGER;
  v_max_uploads INTEGER;
  v_completed BOOLEAN;
  v_expires_at TIMESTAMPTZ;
  v_session_token TEXT;
BEGIN
  -- Lock the row for update to prevent race conditions
  -- SECURITY: Validate session token ownership to prevent session hijacking
  SELECT upload_count, max_uploads, completed, session_expires_at, session_token
  INTO v_current_count, v_max_uploads, v_completed, v_expires_at, v_session_token
  FROM public.application_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  -- Check if session exists
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0, FALSE, 'Session not found'::TEXT;
    RETURN;
  END IF;

  -- SECURITY: Validate token ownership if provided
  IF p_session_token IS NOT NULL AND v_session_token != p_session_token THEN
    RETURN QUERY SELECT v_current_count, FALSE, 'Invalid session token'::TEXT;
    RETURN;
  END IF;

  -- Check if session is completed
  IF v_completed THEN
    RETURN QUERY SELECT v_current_count, FALSE, 'Session already completed'::TEXT;
    RETURN;
  END IF;

  -- Check if session is expired
  IF v_expires_at < NOW() THEN
    RETURN QUERY SELECT v_current_count, FALSE, 'Session expired'::TEXT;
    RETURN;
  END IF;

  -- Check upload limit
  IF v_current_count >= v_max_uploads THEN
    RETURN QUERY SELECT v_current_count, FALSE, 'Upload limit exceeded'::TEXT;
    RETURN;
  END IF;

  -- Perform atomic increment and file tracking
  UPDATE public.application_sessions
  SET
    upload_count = upload_count + 1,
    uploaded_files = array_append(uploaded_files, p_file_path),
    last_activity_at = NOW()
  WHERE id = p_session_id;

  -- Return success with new count
  RETURN QUERY SELECT v_current_count + 1, TRUE, 'Upload count incremented'::TEXT;
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION public.increment_session_upload IS 'Atomically increments session upload count and tracks uploaded file. Prevents race conditions during concurrent uploads.';

-- Grant execute permission to authenticated and anonymous users (same as table access)
GRANT EXECUTE ON FUNCTION public.increment_session_upload TO anon, authenticated;
