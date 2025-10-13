-- Add deletedAt column to profiles table
-- This migration adds the missing deletedAt column that is defined in the Prisma schema

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ(6);

-- Add index for performance on deletedAt queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS "profiles_deletedAt_idx" 
ON public.profiles("deletedAt");

-- Add comment to document the purpose
COMMENT ON COLUMN public.profiles."deletedAt" IS 'Timestamp when the user was soft deleted';
