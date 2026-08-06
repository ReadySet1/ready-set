-- Name of the vendor-side person who handed over / confirmed the pickup.
-- Replaces the mandatory-signature policy (2026-07-09 live-drive decision):
-- PICKED_UP now requires this name OR a pickup_signature upload.
-- Additive + nullable -> safe no-op backfill.
ALTER TABLE "public"."deliveries" ADD COLUMN IF NOT EXISTS "pickup_received_by" VARCHAR(255);
