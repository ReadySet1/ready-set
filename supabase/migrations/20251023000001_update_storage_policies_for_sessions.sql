-- Migration: Update storage policies to enforce session validation
-- Purpose: Implement secure file upload policies using application_sessions
-- Related to: File upload security enhancement (PR #87 Critical Security Issue #1)

-- Drop existing permissive policies for temp uploads
DROP POLICY IF EXISTS "Authenticated temp uploads" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload to temp" ON storage.objects;
DROP POLICY IF EXISTS "Public temp uploads" ON storage.objects;

-- Create new restrictive policy for session-validated uploads
CREATE POLICY "Session-validated temp uploads"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'job-applications' AND
  (storage.foldername(name))[1] = 'temp' AND
  validate_upload_session(
    current_setting('request.headers', true)::json->>'x-upload-token',
    name
  )
);

-- Update read policy to allow reading own temp files
DROP POLICY IF EXISTS "Public temp file access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated temp file access" ON storage.objects;

CREATE POLICY "Session-validated temp reads"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'job-applications' AND
  (
    -- Allow reading your own temp files
    ((storage.foldername(name))[1] = 'temp' AND
    EXISTS (
      SELECT 1 FROM application_sessions
      WHERE session_token = current_setting('request.headers', true)::json->>'x-upload-token'
        AND name = ANY(uploaded_files)
    ))
    OR
    -- Allow admins to read finalized files
    (auth.jwt() ->> 'role' = 'admin')
    OR
    -- Allow authenticated users to read finalized job application files (not temp)
    ((storage.foldername(name))[1] = 'job-applications'
     AND (storage.foldername(name))[2] != 'temp'
     AND auth.role() = 'authenticated')
  )
);

-- Policy for deleting temp files (only the session owner or admin)
CREATE POLICY "Session-validated temp deletes"
ON storage.objects FOR DELETE
TO anon, authenticated
USING (
  bucket_id = 'job-applications' AND
  (
    -- Allow deleting your own temp files
    ((storage.foldername(name))[1] = 'temp' AND
    EXISTS (
      SELECT 1 FROM application_sessions
      WHERE session_token = current_setting('request.headers', true)::json->>'x-upload-token'
        AND name = ANY(uploaded_files)
    ))
    OR
    -- Allow admins to delete any files
    (auth.jwt() ->> 'role' = 'admin')
  )
);

-- Add comment for documentation
COMMENT ON POLICY "Session-validated temp uploads" ON storage.objects IS
  'Validates file uploads against application_sessions. Requires valid session token in x-upload-token header.';

COMMENT ON POLICY "Session-validated temp reads" ON storage.objects IS
  'Allows reading files only if associated with valid session or user is admin.';

COMMENT ON POLICY "Session-validated temp deletes" ON storage.objects IS
  'Allows deleting files only if associated with valid session or user is admin.';
