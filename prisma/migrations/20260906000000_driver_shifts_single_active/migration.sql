-- One open shift per driver (pilot fix D3, board card pilot-active-shift-guard).
--
-- `startDriverShift` used to INSERT unconditionally; the only "already on
-- shift" check lived in the client. Two devices, a double tap, or a retried
-- POST left a second open `driver_shifts` row: `drivers.current_shift_id`
-- pointed at one, the other never ended, mileage never closed and the
-- end-shift guard got confused.
--
-- "Open" means status IN ('active', 'paused') AND deleted_at IS NULL — the
-- same predicate `getActiveShift` uses to pick the driver's current shift, so
-- a paused shift plus a fresh active one is exactly the duplicate we prevent.
--
-- Prisma cannot express a partial index in schema.prisma, so the index lives
-- only here. Plain CREATE UNIQUE INDEX (not CONCURRENTLY): Prisma runs each
-- migration inside a transaction, where CONCURRENTLY is not allowed, and the
-- repo precedent (20260512 api_partners, 20260202 archive) does the same.
-- driver_shifts is a small table (pilot fleet), so the brief lock is fine.

-- 1. Data safety: the index would fail to build if duplicates already exist.
--    Close every open shift except the most recent one per driver. Closed
--    rows get shift_end = NOW() (their real end is unknown) and a marker in
--    notes so they can be found later.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY driver_id
      ORDER BY shift_start DESC, created_at DESC, id DESC
    ) AS rn
  FROM "public"."driver_shifts"
  WHERE status IN ('active', 'paused')
    AND deleted_at IS NULL
)
UPDATE "public"."driver_shifts" ds
SET
  status = 'completed',
  shift_end = COALESCE(ds.shift_end, NOW()),
  notes = COALESCE(ds.notes, '')
    || ' [Auto-closed by migration driver_shifts_single_active: duplicate open shift]',
  updated_at = NOW()
FROM ranked r
WHERE ds.id = r.id
  AND r.rn > 1;

-- 2. Re-point drivers whose current_shift_id referenced one of the rows we
--    just closed (or was otherwise stale) at their surviving open shift.
--    Separate statement on purpose: a data-modifying CTE's writes are not
--    visible to the rest of the same statement.
UPDATE "public"."drivers" d
SET
  current_shift_id = open_shift.id,
  updated_at = NOW()
FROM (
  SELECT DISTINCT ON (driver_id) driver_id, id
  FROM "public"."driver_shifts"
  WHERE status IN ('active', 'paused')
    AND deleted_at IS NULL
  ORDER BY driver_id, shift_start DESC, created_at DESC, id DESC
) AS open_shift
WHERE d.id = open_shift.driver_id
  AND d.current_shift_id IS DISTINCT FROM open_shift.id;

-- 3. DB guard: at most one open shift per driver. `startDriverShift` catches
--    the unique violation (Postgres 23505) and resumes the winner's shift.
CREATE UNIQUE INDEX IF NOT EXISTS "driver_shifts_one_open_per_driver_idx"
  ON "public"."driver_shifts" ("driver_id")
  WHERE "status" IN ('active', 'paused') AND "deleted_at" IS NULL;
