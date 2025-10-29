-- Fix quarantine security: Add ON DELETE behavior and improve RLS policies
-- This migration fixes issues identified in code review for PR #109

-- 1. Fix foreign key constraints to include ON DELETE SET NULL
-- First, we need to drop the existing constraints and recreate them with ON DELETE SET NULL

-- Drop existing foreign key constraints
ALTER TABLE IF EXISTS public.quarantine_logs
  DROP CONSTRAINT IF EXISTS quarantine_logs_user_id_fkey;

ALTER TABLE IF EXISTS public.quarantine_logs
  DROP CONSTRAINT IF EXISTS quarantine_logs_reviewed_by_fkey;

-- Recreate with ON DELETE SET NULL
ALTER TABLE public.quarantine_logs
  ADD CONSTRAINT quarantine_logs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.quarantine_logs
  ADD CONSTRAINT quarantine_logs_reviewed_by_fkey
  FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Update RLS policies to include proper admin role checks

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view quarantined files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all quarantine logs" ON public.quarantine_logs;
DROP POLICY IF EXISTS "Admins can update quarantine logs" ON public.quarantine_logs;

-- Recreate with proper admin checks
CREATE POLICY "Admins can view quarantined files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'quarantined-files'
  AND EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_app_meta_data->>'role' = 'admin'
  )
);

CREATE POLICY "Admins can view all quarantine logs"
ON public.quarantine_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_app_meta_data->>'role' = 'admin'
  )
);

CREATE POLICY "Admins can update quarantine logs"
ON public.quarantine_logs
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_app_meta_data->>'role' = 'admin'
  )
);
