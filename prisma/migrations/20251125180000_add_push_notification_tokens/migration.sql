-- Add has_push_notifications column to profiles table
ALTER TABLE "public"."profiles" ADD COLUMN "has_push_notifications" BOOLEAN NOT NULL DEFAULT false;

-- Create profile_push_tokens table
CREATE TABLE "public"."profile_push_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "profile_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "user_agent" TEXT,
    "platform" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "profile_push_tokens_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint on token
CREATE UNIQUE INDEX "profile_push_tokens_token_key" ON "public"."profile_push_tokens"("token");

-- Create indexes
CREATE INDEX "profile_push_tokens_profile_id_idx" ON "public"."profile_push_tokens"("profile_id");
CREATE INDEX "profile_push_tokens_profile_id_revoked_at_idx" ON "public"."profile_push_tokens"("profile_id", "revoked_at");

-- Add foreign key constraint
ALTER TABLE "public"."profile_push_tokens" ADD CONSTRAINT "profile_push_tokens_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
