-- Migration: Create delivery-proofs storage bucket for POD images
-- REA-126: Proof of Delivery Photo Upload UI

-- Create the delivery-proofs bucket for storing proof of delivery images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'delivery-proofs',
  'delivery-proofs',
  true,  -- Public bucket for easier access, secured by RLS
  2097152, -- 2MB max file size (images are compressed client-side)
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']::text[];

-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Authenticated users can upload POD photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read POD photos" ON storage.objects;
DROP POLICY IF EXISTS "Service role full access to delivery-proofs" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own POD photos" ON storage.objects;

-- Policy: Allow authenticated users (drivers) to upload POD photos
-- Files are stored in deliveries/{deliveryId}/ path structure
CREATE POLICY "Authenticated users can upload POD photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'delivery-proofs'
  AND (storage.foldername(name))[1] = 'deliveries'
);

-- Policy: Allow authenticated users to read POD photos
-- All authenticated users (drivers, admins) can view POD photos
CREATE POLICY "Authenticated users can read POD photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'delivery-proofs');

-- Policy: Allow authenticated users to delete their uploads
-- This allows retake functionality
CREATE POLICY "Users can delete their own POD photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'delivery-proofs'
  AND auth.uid()::text = owner::text
);

-- Policy: Service role has full access for admin operations
CREATE POLICY "Service role full access to delivery-proofs"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'delivery-proofs')
WITH CHECK (bucket_id = 'delivery-proofs');

-- Add comment for documentation
COMMENT ON TABLE storage.buckets IS 'Storage buckets including delivery-proofs for POD images (REA-126)';
