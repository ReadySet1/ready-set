-- Create quarantined-files storage bucket for security scanning
-- This bucket stores files that fail security validation

-- Create the quarantine bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'quarantined-files',
  'quarantined-files',
  false, -- Private bucket, only accessible by admins
  52428800, -- 50MB limit
  NULL -- Allow all mime types for quarantine purposes
)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for the quarantine bucket
-- Only allow service role and authenticated users with admin privileges to access

-- Policy 1: Allow service role full access (for automated quarantine)
CREATE POLICY "Service role can upload quarantined files"
ON storage.objects
FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'quarantined-files');

CREATE POLICY "Service role can read quarantined files"
ON storage.objects
FOR SELECT
TO service_role
USING (bucket_id = 'quarantined-files');

CREATE POLICY "Service role can delete quarantined files"
ON storage.objects
FOR DELETE
TO service_role
USING (bucket_id = 'quarantined-files');

-- Policy 2: Authenticated users with admin role can view quarantined files
-- Note: You'll need to implement admin role checking based on your auth system
-- This is a placeholder policy that should be customized to your needs
CREATE POLICY "Admins can view quarantined files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'quarantined-files'
  AND EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    -- Add your admin role check here, e.g.:
    -- AND auth.users.raw_app_meta_data->>'role' = 'admin'
  )
);

-- Create a table to track quarantine events
CREATE TABLE IF NOT EXISTS public.quarantine_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  quarantine_path TEXT NOT NULL,
  reason TEXT NOT NULL,
  threat_level TEXT NOT NULL CHECK (threat_level IN ('low', 'medium', 'high', 'critical')),
  user_id UUID REFERENCES auth.users(id),
  scan_results JSONB,
  quarantined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  review_status TEXT CHECK (review_status IN ('pending', 'approved', 'rejected', 'deleted')),
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_quarantine_logs_user_id ON public.quarantine_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_quarantine_logs_threat_level ON public.quarantine_logs(threat_level);
CREATE INDEX IF NOT EXISTS idx_quarantine_logs_review_status ON public.quarantine_logs(review_status);
CREATE INDEX IF NOT EXISTS idx_quarantine_logs_quarantined_at ON public.quarantine_logs(quarantined_at);

-- Enable RLS on quarantine_logs table
ALTER TABLE public.quarantine_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for quarantine_logs
CREATE POLICY "Service role can insert quarantine logs"
ON public.quarantine_logs
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Admins can view all quarantine logs"
ON public.quarantine_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    -- Add your admin role check here
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
    -- Add your admin role check here
  )
);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_quarantine_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_quarantine_logs_updated_at
  BEFORE UPDATE ON public.quarantine_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_quarantine_logs_updated_at();

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.quarantine_logs TO authenticated;
GRANT ALL ON public.quarantine_logs TO service_role;
