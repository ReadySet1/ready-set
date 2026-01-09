-- ============================================================================
-- Migration: Cleanup old broadcast trigger that references non-existent columns
-- Date: 2026-01-09
-- Issue: Fix "column p.first_name does not exist" error
-- ============================================================================

-- Purpose: Remove any old broadcast trigger functions that reference
-- profiles.first_name column which doesn't exist in our schema.
-- The new trigger (notify_driver_location_update from migration 20251107000008)
-- doesn't require any profile data.

-- ============================================================================
-- Drop old trigger if it exists
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_broadcast_driver_location ON driver_locations;
DROP TRIGGER IF EXISTS trigger_driver_location_updated ON driver_locations;

-- ============================================================================
-- Drop old function if it exists
-- ============================================================================

DROP FUNCTION IF EXISTS broadcast_driver_location();
DROP FUNCTION IF EXISTS broadcast_driver_location_update();

-- ============================================================================
-- Remove orphaned comment if trigger was already dropped
-- ============================================================================

-- The comment in migration 20251107000001 line 175 references a trigger
-- that may not exist, which is fine - comments on non-existent objects
-- don't cause errors.

-- ============================================================================
-- Verify the correct trigger exists
-- ============================================================================

-- The correct trigger is: trigger_driver_location_update
-- Created by migration: 20251107000008_add_location_broadcast_trigger.sql
-- Function: notify_driver_location_update()
-- This trigger does NOT reference any profile columns, only driver_locations columns.
