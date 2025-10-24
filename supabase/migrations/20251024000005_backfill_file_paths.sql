-- Backfill file_path from existing file_url values
-- This migration extracts the storage path from Supabase storage URLs

-- Update file_path for records where it's NULL but file_url exists
-- Pattern matches: /storage/v1/object/public/{bucket}/{path} or /storage/v1/object/sign/{bucket}/{path}
UPDATE file_uploads
SET file_path =
  CASE
    -- Handle signed URLs: /storage/v1/object/sign/{bucket}/{path}?token=...
    WHEN file_url ~ '^.*/storage/v1/object/sign/[^/]+/(.+)(\?.*)?$' THEN
      regexp_replace(file_url, '^.*/storage/v1/object/sign/[^/]+/([^?]+).*$', '\1')

    -- Handle public URLs: /storage/v1/object/public/{bucket}/{path}
    WHEN file_url ~ '^.*/storage/v1/object/public/[^/]+/.+$' THEN
      regexp_replace(file_url, '^.*/storage/v1/object/public/[^/]+/(.+)$', '\1')

    -- Handle any other storage URL patterns
    WHEN file_url ~ '^.*/storage/v1/object/[^/]+/[^/]+/.+$' THEN
      regexp_replace(file_url, '^.*/storage/v1/object/[^/]+/[^/]+/(.+)$', '\1')

    ELSE NULL
  END
WHERE file_path IS NULL
  AND file_url IS NOT NULL
  AND file_url != '';

-- Log the results of the backfill
DO $$
DECLARE
  backfilled_count INTEGER;
  remaining_null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO backfilled_count
  FROM file_uploads
  WHERE file_path IS NOT NULL;

  SELECT COUNT(*) INTO remaining_null_count
  FROM file_uploads
  WHERE file_path IS NULL AND file_url IS NOT NULL;

  RAISE NOTICE 'Backfill complete: % records now have file_path', backfilled_count;

  IF remaining_null_count > 0 THEN
    RAISE WARNING '% records still have NULL file_path despite having file_url', remaining_null_count;
  END IF;
END $$;

-- Make file_path NOT NULL for new records going forward
-- Note: We're NOT adding NOT NULL constraint yet to allow for any edge cases
-- The application layer will ensure new uploads always include file_path
-- A future migration can add the NOT NULL constraint after verification

-- Add index on file_path for performance
CREATE INDEX IF NOT EXISTS idx_file_uploads_file_path ON file_uploads(file_path);

-- Add comment documenting the security requirement
COMMENT ON COLUMN file_uploads.file_path IS 'Storage path for generating secure signed URLs. Required for all new uploads as of 2024-10-24. Legacy records may be NULL.';
