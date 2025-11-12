-- Migration: Create fileUploader bucket
-- Created: 2025-11-12
-- Purpose: Fix missing bucket that was referenced in RLS policies but never created
-- Issue: REA-53 - File uploads failing with "new row violates row-level security policy"

-- Create the fileUploader bucket if it doesn't exist
-- This bucket is used for general file uploads (user files, documents, etc.)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fileUploader',
  'fileUploader',
  false, -- Private bucket - requires signed URLs for access
  104857600, -- 100MB limit (100 * 1024 * 1024 bytes)
  ARRAY[
    -- Images
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    -- Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    -- Text files
    'text/plain',
    'text/csv'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Add comment explaining bucket purpose
COMMENT ON TABLE storage.buckets IS 'Storage buckets for file uploads. fileUploader bucket is the primary bucket for user files and documents.';

-- Verify RLS policies exist (they should from 20251022220000_add_storage_policies.sql)
-- This is informational - the policies should already exist, but we'll check
DO $$
BEGIN
  -- Check if the "Allow public uploads to users" policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'Allow public uploads to users'
  ) THEN
    RAISE WARNING 'RLS policy "Allow public uploads to users" does not exist. Please ensure migration 20251022220000_add_storage_policies.sql has been run.';
  END IF;
END $$;
