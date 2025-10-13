-- =====================================================
-- Production Schema Update Script
-- Generated: 2025-10-03
-- Purpose: Align production schema with dev features
-- =====================================================

BEGIN;

-- 1. Add testimonials table
-- ===================================================
CREATE TABLE IF NOT EXISTS testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text,
  content text NOT NULL,
  image text,
  rating integer NOT NULL DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  category "TestimonialCategory" NOT NULL DEFAULT 'CLIENTS',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create enum if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TestimonialCategory') THEN
    CREATE TYPE "TestimonialCategory" AS ENUM ('CLIENTS', 'VENDORS', 'DRIVERS');
  END IF;
END$$;

-- 2. Add missing default values
-- ===================================================
ALTER TABLE profiles
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE profiles
  ALTER COLUMN createdAt SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE profiles
  ALTER COLUMN updatedAt SET DEFAULT CURRENT_TIMESTAMP;

-- 3. Fix timestamp column types
-- ===================================================
-- Change timestamp to timestamptz for consistency

-- sessions table
ALTER TABLE sessions
  ALTER COLUMN expires TYPE timestamptz;

-- addresses table
ALTER TABLE addresses
  ALTER COLUMN createdAt TYPE timestamptz;

ALTER TABLE addresses
  ALTER COLUMN updatedAt TYPE timestamptz;

-- file_uploads table
ALTER TABLE file_uploads
  ALTER COLUMN uploadedAt TYPE timestamptz;

ALTER TABLE file_uploads
  ALTER COLUMN updatedAt TYPE timestamptz;

-- user_addresses table
ALTER TABLE user_addresses
  ALTER COLUMN createdAt TYPE timestamptz;

ALTER TABLE user_addresses
  ALTER COLUMN updatedAt TYPE timestamptz;

-- verification_tokens table
ALTER TABLE verification_tokens
  ALTER COLUMN expires TYPE timestamptz;

-- form_submissions table
ALTER TABLE form_submissions
  ALTER COLUMN createdAt TYPE timestamptz;

ALTER TABLE form_submissions
  ALTER COLUMN updatedAt TYPE timestamptz;

-- lead_captures table
ALTER TABLE lead_captures
  ALTER COLUMN createdAt TYPE timestamptz;

ALTER TABLE lead_captures
  ALTER COLUMN updatedAt TYPE timestamptz;

-- job_applications table
ALTER TABLE job_applications
  ALTER COLUMN createdAt TYPE timestamptz;

ALTER TABLE job_applications
  ALTER COLUMN updatedAt TYPE timestamptz;

-- pricing_tiers table
ALTER TABLE pricing_tiers
  ALTER COLUMN updatedAt TYPE timestamptz;

COMMIT;

-- Verify changes
SELECT 'Schema update completed successfully' AS status;
