-- REA-342 / REA-343: deleting an order is now a soft delete. Record who
-- deleted it and why, next to the existing "deletedAt" column on both order
-- tables (camelCase columns, same convention as profiles).
-- Additive + nullable, no default, no backfill -> metadata-only ALTERs that
-- are safe to re-run.
ALTER TABLE "public"."catering_requests" ADD COLUMN IF NOT EXISTS "deletedBy" UUID;
ALTER TABLE "public"."catering_requests" ADD COLUMN IF NOT EXISTS "deletionReason" TEXT;
ALTER TABLE "public"."on_demand_requests" ADD COLUMN IF NOT EXISTS "deletedBy" UUID;
ALTER TABLE "public"."on_demand_requests" ADD COLUMN IF NOT EXISTS "deletionReason" TEXT;
