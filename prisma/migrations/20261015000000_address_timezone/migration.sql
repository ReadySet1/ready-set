-- Per-location timezone for addresses (card: order-timezone-per-location).
-- Design: docs/ready-set/specs/2026-10-15-order-timezone-per-location.md
--
-- Idempotent: the column is added only if missing and the backfill only touches
-- rows that still have no zone. Application code never requires this column to
-- be set (it derives from ZIP at read time), so a NULL is always safe.

ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "timezone" TEXT;

COMMENT ON COLUMN "addresses"."timezone" IS
  'IANA timezone of the address (e.g. America/Chicago). Derived from ZIP; NULL falls back to derivation at read time. Mirror of src/lib/utils/address-timezone.ts ZIP_PREFIX_TIMEZONES.';

-- Backfill from the 3-digit ZIP prefix. Keep these ranges in sync with
-- ZIP_PREFIX_TIMEZONES in src/lib/utils/address-timezone.ts.
-- addresses.state is NOT used: it is dirty free text on prod.
UPDATE "addresses"
SET "timezone" = CASE
  -- Texas: El Paso / Hudspeth corner is Mountain time
  WHEN substring(trim("zip") from 1 for 3)::int BETWEEN 798 AND 799 THEN 'America/Denver'
  WHEN substring(trim("zip") from 1 for 3)::int = 885                THEN 'America/Denver'
  -- Texas: everything else is Central
  WHEN substring(trim("zip") from 1 for 3)::int BETWEEN 750 AND 797 THEN 'America/Chicago'
  -- California
  WHEN substring(trim("zip") from 1 for 3)::int BETWEEN 900 AND 961 THEN 'America/Los_Angeles'
  -- Georgia
  WHEN substring(trim("zip") from 1 for 3)::int BETWEEN 300 AND 319 THEN 'America/New_York'
  WHEN substring(trim("zip") from 1 for 3)::int BETWEEN 398 AND 399 THEN 'America/New_York'
  ELSE NULL
END
WHERE "timezone" IS NULL
  AND trim("zip") ~ '^[0-9]{5}(-[0-9]{4})?$';
