-- ============================================================================
-- Migration: Add profile_push_tokens table and push notification preferences
-- Date: 2025-11-21
-- Issue: REA-124 - Implement Push Notifications (PWA/Firebase)
-- ============================================================================

-- Purpose:
--   - Store Firebase Cloud Messaging (FCM) tokens per device for each profile
--   - Provide a simple flag on profiles to indicate if push notifications are enabled
--   - Secure access via Row Level Security (RLS)
--
-- Notes:
--   - A separate table is used to support multiple devices per user
--   - Tokens are treated as sensitive identifiers and should not be logged in full

-- ============================================================================
-- 1. Add has_push_notifications column to profiles (if missing)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'has_push_notifications'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN has_push_notifications BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.has_push_notifications IS
  'Indicates whether the user has enabled browser push notifications.';

-- ============================================================================
-- 2. Create profile_push_tokens table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profile_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationship to profiles table (Supabase auth-linked profile)
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- FCM registration token for this specific device / browser
  token TEXT NOT NULL,

  -- Optional metadata to help identify devices and platforms
  user_agent TEXT,
  platform TEXT,

  -- Lifecycle tracking
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

COMMENT ON TABLE public.profile_push_tokens IS
  'Stores Firebase Cloud Messaging (FCM) tokens for each user profile and device.';

COMMENT ON COLUMN public.profile_push_tokens.token IS
  'FCM registration token for a specific browser/device. Treated as sensitive and not logged in full.';

-- ============================================================================
-- 3. Indexes for performance
-- ============================================================================

-- Look up all active tokens for a profile quickly
CREATE INDEX IF NOT EXISTS idx_profile_push_tokens_profile_id
  ON public.profile_push_tokens(profile_id);

CREATE INDEX IF NOT EXISTS idx_profile_push_tokens_active
  ON public.profile_push_tokens(profile_id, revoked_at)
  WHERE revoked_at IS NULL;

-- Optional: ensure token uniqueness to avoid duplicates across devices
CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_push_tokens_token_unique
  ON public.profile_push_tokens(token);

-- ============================================================================
-- 4. Enable Row Level Security and policies
-- ============================================================================

ALTER TABLE public.profile_push_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can manage their own tokens
CREATE POLICY "Users can manage their own push tokens"
  ON public.profile_push_tokens
  FOR ALL
  USING (
    auth.role() = 'authenticated'
    AND auth.uid() = profile_id
  )
  WITH CHECK (
    auth.role() = 'authenticated'
    AND auth.uid() = profile_id
  );

-- Policy: service role (backend) can manage all tokens (implicit bypass in Supabase)
-- NOTE: Supabase service_role bypasses RLS automatically; no explicit policy required.


