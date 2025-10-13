-- Add soft delete fields and audit model
-- This migration adds deletedBy and deletionReason fields to profiles table
-- and creates the user_audits table for tracking user modifications

-- Add deletedBy and deletionReason fields to profiles table
ALTER TABLE "profiles" ADD COLUMN "deletedBy" UUID;
ALTER TABLE "profiles" ADD COLUMN "deletionReason" TEXT;

-- Add foreign key constraint for deletedBy field
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_deletedBy_fkey" 
FOREIGN KEY ("deletedBy") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add indexes for the new fields
CREATE INDEX CONCURRENTLY IF NOT EXISTS "profiles_deletedBy_idx" ON "profiles"("deletedBy");

-- Create user_audits table
CREATE TABLE "user_audits" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "performedBy" UUID,
    "changes" JSONB,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_audits_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraints for user_audits table
ALTER TABLE "user_audits" ADD CONSTRAINT "user_audits_userId_fkey" 
FOREIGN KEY ("userId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_audits" ADD CONSTRAINT "user_audits_performedBy_fkey" 
FOREIGN KEY ("performedBy") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add indexes for user_audits table
CREATE INDEX CONCURRENTLY IF NOT EXISTS "user_audits_userId_idx" ON "user_audits"("userId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "user_audits_action_idx" ON "user_audits"("action");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "user_audits_performedBy_idx" ON "user_audits"("performedBy");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "user_audits_createdAt_idx" ON "user_audits"("createdAt");
