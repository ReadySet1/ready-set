-- Migration: Add Storage RLS Policies for File Uploads
-- Created: 2025-10-22
-- Description: Enable public file uploads to the fileUploader bucket

-- ============================================================================
-- PART 1: Storage Bucket Policies
-- ============================================================================

-- Policy: Allow anyone to upload files to job-applications folder
CREATE POLICY "Allow public uploads to job-applications"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'fileUploader'
  AND (storage.foldername(name))[1] = 'job-applications'
);

-- Policy: Allow anyone to upload files to orders folder
CREATE POLICY "Allow public uploads to orders"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'fileUploader'
  AND (storage.foldername(name))[1] = 'orders'
);

-- Policy: Allow anyone to upload files to users folder
CREATE POLICY "Allow public uploads to users"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'fileUploader'
  AND (storage.foldername(name))[1] = 'users'
);

-- Policy: Allow authenticated users to read their own files
CREATE POLICY "Allow authenticated users to read files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'fileUploader');

-- Policy: Allow public to read files (for signed URLs)
CREATE POLICY "Allow public to read files"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'fileUploader');

-- Policy: Allow authenticated users to update their own files
CREATE POLICY "Allow authenticated users to update files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'fileUploader')
WITH CHECK (bucket_id = 'fileUploader');

-- Policy: Allow authenticated users to delete their own files
CREATE POLICY "Allow authenticated users to delete files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'fileUploader');

-- ============================================================================
-- PART 2: Service Role Policies (for API operations)
-- ============================================================================

-- Policy: Service role can do everything
CREATE POLICY "Service role full access"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'fileUploader')
WITH CHECK (bucket_id = 'fileUploader');

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- List all storage policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
ORDER BY policyname;
