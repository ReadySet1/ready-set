-- ============================================================================
-- Migration: Fix update_shift_delivery_count() status matching
-- Date: 2026-08-06
--
-- The original function (20251127000000_add_mileage_columns_miles.sql L95-148)
-- counted only rows with status = 'delivered' (exact, lowercase). The orders
-- PATCH mirrors driver progress into `deliveries` using the DriverStatus
-- enum's UPPERCASE values and terminates at 'COMPLETED', so the trigger never
-- matched anything and driver_shifts.delivery_count never incremented.
--
-- Fix: make the comparison case-insensitive and count both 'delivered' and
-- 'completed'. Everything else in the function is unchanged. The existing
-- trigger (trigger_update_shift_delivery_count) references the function by
-- name, so CREATE OR REPLACE is sufficient — no trigger recreation needed.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION update_shift_delivery_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Update delivery count when a delivery's shift_id changes or delivery is completed
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.shift_id IS NOT NULL THEN
      UPDATE driver_shifts
      SET delivery_count = (
        SELECT COUNT(*)
        FROM deliveries
        WHERE shift_id = NEW.shift_id
          AND LOWER(status) IN ('delivered','completed')
          AND deleted_at IS NULL
      )
      WHERE id = NEW.shift_id;
    END IF;

    -- Handle case where delivery moved from one shift to another
    IF TG_OP = 'UPDATE' AND OLD.shift_id IS NOT NULL AND OLD.shift_id != NEW.shift_id THEN
      UPDATE driver_shifts
      SET delivery_count = (
        SELECT COUNT(*)
        FROM deliveries
        WHERE shift_id = OLD.shift_id
          AND LOWER(status) IN ('delivered','completed')
          AND deleted_at IS NULL
      )
      WHERE id = OLD.shift_id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' AND OLD.shift_id IS NOT NULL THEN
    UPDATE driver_shifts
    SET delivery_count = (
      SELECT COUNT(*)
      FROM deliveries
      WHERE shift_id = OLD.shift_id
        AND LOWER(status) IN ('delivered','completed')
        AND deleted_at IS NULL
    )
    WHERE id = OLD.shift_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

COMMIT;
