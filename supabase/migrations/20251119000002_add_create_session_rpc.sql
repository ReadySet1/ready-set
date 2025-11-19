-- Create a secure function to create application sessions bypassing RLS
-- Related to: REA-191 - Session creation failures
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

