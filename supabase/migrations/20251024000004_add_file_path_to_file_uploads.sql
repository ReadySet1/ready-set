-- Add filePath column to file_uploads table to store storage path for generating signed URLs
ALTER TABLE public.file_uploads ADD COLUMN IF NOT EXISTS file_path TEXT;

-- Create an index on file_path for faster lookups
CREATE INDEX IF NOT EXISTS idx_file_uploads_file_path ON public.file_uploads(file_path);

-- Add a comment to explain the column's purpose
COMMENT ON COLUMN public.file_uploads.file_path IS 'Storage path in Supabase bucket for generating signed URLs';
