-- ============================================================================
-- Migration: Add unique constraint to drivers.profile_id
-- Date: 2025-11-07
-- Issue: REA-122 - Support for real-time driver tracking
-- ============================================================================

-- Purpose: Add unique constraint to ensure one profile can only have one driver record

-- ============================================================================
-- Add unique constraint
-- ============================================================================

ALTER TABLE drivers
  ADD CONSTRAINT drivers_profile_id_key UNIQUE (profile_id);
