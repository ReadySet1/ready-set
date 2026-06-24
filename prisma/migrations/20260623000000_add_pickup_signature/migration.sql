-- Add a pickup-stage signature URL to the standalone `deliveries` mirror row.
-- Captured manually from the restaurant staff at vendor pickup (not DocuSign);
-- mirrored from the canonical FileUpload (category = 'pickup_signature'), the
-- same pattern as delivery_photo_url. Additive + nullable → safe no-op backfill.
ALTER TABLE "public"."deliveries" ADD COLUMN IF NOT EXISTS "pickup_signature_url" TEXT;
