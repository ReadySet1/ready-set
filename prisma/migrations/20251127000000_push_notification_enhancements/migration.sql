-- Push Notification Enhancements (REA-124)
-- This migration adds:
-- 1. Token refresh tracking fields to profile_push_tokens
-- 2. Notification analytics table
-- 3. Notification deduplication table

-- Add token refresh tracking to profile_push_tokens
ALTER TABLE "public"."profile_push_tokens"
ADD COLUMN IF NOT EXISTS "last_refreshed_at" TIMESTAMPTZ(6) DEFAULT now(),
ADD COLUMN IF NOT EXISTS "refresh_count" INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS "profile_push_tokens_last_refreshed_at_idx"
ON "public"."profile_push_tokens"("last_refreshed_at");

-- Create notification_analytics table
CREATE TABLE IF NOT EXISTS "public"."notification_analytics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "profile_id" UUID NOT NULL,
    "notification_type" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "recipient_type" TEXT NOT NULL,
    "order_id" UUID,
    "dispatch_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "error_message" TEXT,
    "fcm_message_id" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT now(),
    "delivered_at" TIMESTAMPTZ(6),
    "clicked_at" TIMESTAMPTZ(6),

    CONSTRAINT "notification_analytics_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraint
ALTER TABLE "public"."notification_analytics"
ADD CONSTRAINT "notification_analytics_profile_id_fkey"
FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

-- Add indexes for notification_analytics
CREATE INDEX IF NOT EXISTS "notification_analytics_profile_id_idx"
ON "public"."notification_analytics"("profile_id");

CREATE INDEX IF NOT EXISTS "notification_analytics_created_at_idx"
ON "public"."notification_analytics"("created_at");

CREATE INDEX IF NOT EXISTS "notification_analytics_status_idx"
ON "public"."notification_analytics"("status");

CREATE INDEX IF NOT EXISTS "notification_analytics_notification_type_status_idx"
ON "public"."notification_analytics"("notification_type", "status");

CREATE INDEX IF NOT EXISTS "notification_analytics_recipient_type_created_at_idx"
ON "public"."notification_analytics"("recipient_type", "created_at");

-- Create notification_dedup table
CREATE TABLE IF NOT EXISTS "public"."notification_dedup" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cache_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT now(),

    CONSTRAINT "notification_dedup_pkey" PRIMARY KEY ("id")
);

-- Add unique constraint for cache_key
ALTER TABLE "public"."notification_dedup"
ADD CONSTRAINT "notification_dedup_cache_key_key" UNIQUE ("cache_key");

-- Add indexes for notification_dedup
CREATE INDEX IF NOT EXISTS "notification_dedup_cache_key_idx"
ON "public"."notification_dedup"("cache_key");

CREATE INDEX IF NOT EXISTS "notification_dedup_created_at_idx"
ON "public"."notification_dedup"("created_at");
