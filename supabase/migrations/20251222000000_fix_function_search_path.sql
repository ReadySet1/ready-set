-- ============================================================================
-- Migration: Fix SECURITY DEFINER Function Search Paths
-- Date: 2025-12-22
-- Issue: Supabase Security Advisor warnings about mutable search_path
-- ============================================================================
--
-- Description:
--   Sets explicit search_path on all SECURITY DEFINER functions to prevent
--   potential privilege escalation via search_path manipulation.
--
-- Functions Fixed:
--   - is_admin_user() - RLS helper function
--   - log_upload_error() - Upload error logging
--   - resolve_upload_error() - Upload error resolution
--   - create_or_update_session() - Session management
--   - broadcast_location_update() - Realtime location trigger
--   - cleanup_old_upload_errors() - Upload error cleanup
--
-- Impact: None - only adds security metadata, no behavior change
-- ============================================================================

BEGIN;

-- ============================================================================
-- Fix search_path for all SECURITY DEFINER functions
-- ============================================================================

-- is_admin_user - Used by RLS policies for admin role checking
ALTER FUNCTION IF EXISTS is_admin_user() SET search_path = public, pg_temp;

-- log_upload_error - Logging upload failures
ALTER FUNCTION IF EXISTS log_upload_error(TEXT, TEXT, TEXT, TEXT, TEXT, UUID, BOOLEAN)
  SET search_path = public, pg_temp;

-- resolve_upload_error - Marking upload errors as resolved
ALTER FUNCTION IF EXISTS resolve_upload_error(UUID, UUID)
  SET search_path = public, pg_temp;

-- create_or_update_session - Atomic session management
ALTER FUNCTION IF EXISTS create_or_update_session(UUID, JSONB)
  SET search_path = public, pg_temp;

-- broadcast_location_update - Realtime driver location trigger
ALTER FUNCTION IF EXISTS broadcast_location_update()
  SET search_path = public, pg_temp;

-- cleanup_old_upload_errors - Scheduled cleanup function
ALTER FUNCTION IF EXISTS cleanup_old_upload_errors(INTEGER)
  SET search_path = public, pg_temp;

-- create_session - Session creation RPC
ALTER FUNCTION IF EXISTS create_session(UUID, TEXT, JSONB)
  SET search_path = public, pg_temp;

COMMIT;

-- ============================================================================
-- Verification Query
-- ============================================================================
-- Run this to verify the search_path was set correctly:
/*
SELECT
  proname as function_name,
  proconfig as config
FROM pg_proc
WHERE proname IN (
  'is_admin_user',
  'log_upload_error',
  'resolve_upload_error',
  'create_or_update_session',
  'broadcast_location_update',
  'cleanup_old_upload_errors',
  'create_session'
)
AND pronamespace = 'public'::regnamespace;
*/
