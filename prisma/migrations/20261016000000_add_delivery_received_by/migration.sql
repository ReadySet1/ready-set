-- Name of the person who received the order at the client (completion stage).
-- Business rule (Gary, 2026-06-01 / 06-22): COMPLETED requires the setup photo
-- AND either the recipient's signature (delivery_signature_url / a
-- 'delivery_signature' upload) or, if they refuse to sign, their name here.
-- Lives on `deliveries` next to delivery_signature_url and pickup_received_by.
-- Additive + nullable -> safe no-op backfill.
ALTER TABLE "public"."deliveries" ADD COLUMN IF NOT EXISTS "delivery_received_by" VARCHAR(255);
