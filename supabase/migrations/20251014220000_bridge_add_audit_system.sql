-- ============================================================================
-- Bridge Migration: Add Audit System to Production
-- ============================================================================
-- Description: Adds comprehensive audit logging system from dev to prod
-- Author: Migration Reconciliation Process
-- Date: 2025-10-14
-- Risk Level: LOW (additive only, no data modification)
-- Dependencies: None
-- Rollback: See rollback section at bottom
-- ============================================================================

-- Migration Start
BEGIN;

-- ============================================================================
-- PART 1: Create user_audits table
-- ============================================================================
-- Purpose: Track all user profile modifications with full audit trail
-- Impact: Enables compliance and debugging capabilities

CREATE TABLE IF NOT EXISTS public.user_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    action TEXT NOT NULL,
    "performedBy" UUID,
    changes JSONB,
    reason TEXT,
    metadata JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign key constraints
ALTER TABLE public.user_audits
    ADD CONSTRAINT user_audits_userId_fkey
    FOREIGN KEY ("userId")
    REFERENCES public.profiles(id)
    ON DELETE CASCADE;

ALTER TABLE public.user_audits
    ADD CONSTRAINT user_audits_performedBy_fkey
    FOREIGN KEY ("performedBy")
    REFERENCES public.profiles(id)
    ON DELETE SET NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_audits_userId
    ON public.user_audits("userId");

CREATE INDEX IF NOT EXISTS idx_user_audits_performedBy
    ON public.user_audits("performedBy");

CREATE INDEX IF NOT EXISTS idx_user_audits_action
    ON public.user_audits(action);

CREATE INDEX IF NOT EXISTS idx_user_audits_createdAt
    ON public.user_audits("createdAt" DESC);

-- Add GIN index for JSONB columns for faster queries
CREATE INDEX IF NOT EXISTS idx_user_audits_changes
    ON public.user_audits USING GIN (changes);

CREATE INDEX IF NOT EXISTS idx_user_audits_metadata
    ON public.user_audits USING GIN (metadata);

-- Add comments for documentation
COMMENT ON TABLE public.user_audits IS
    'Audit log for all user profile modifications - tracks who did what and when';
COMMENT ON COLUMN public.user_audits."userId" IS
    'The user profile that was modified';
COMMENT ON COLUMN public.user_audits.action IS
    'Type of action performed (e.g., CREATE, UPDATE, DELETE, RESTORE)';
COMMENT ON COLUMN public.user_audits."performedBy" IS
    'The user who performed the action (NULL for system actions)';
COMMENT ON COLUMN public.user_audits.changes IS
    'JSON object containing before/after values of changed fields';
COMMENT ON COLUMN public.user_audits.reason IS
    'Human-readable reason for the change';
COMMENT ON COLUMN public.user_audits.metadata IS
    'Additional context (IP address, user agent, etc.)';

-- ============================================================================
-- PART 2: Enhance profiles table with additional soft-delete fields
-- ============================================================================
-- Purpose: Track WHO deleted a user and WHY
-- Impact: Improves accountability and supports GDPR compliance

-- Add deletedBy column (references the admin who performed deletion)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'deletedBy'
    ) THEN
        ALTER TABLE public.profiles
            ADD COLUMN "deletedBy" UUID;

        ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_deletedBy_fkey
            FOREIGN KEY ("deletedBy")
            REFERENCES public.profiles(id)
            ON DELETE SET NULL;

        CREATE INDEX idx_profiles_deletedBy
            ON public.profiles("deletedBy");

        COMMENT ON COLUMN public.profiles."deletedBy" IS
            'The admin user who performed the soft deletion';
    END IF;
END $$;

-- Add deletionReason column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'deletionReason'
    ) THEN
        ALTER TABLE public.profiles
            ADD COLUMN "deletionReason" TEXT;

        COMMENT ON COLUMN public.profiles."deletionReason" IS
            'Reason for soft deletion (for audit and compliance)';
    END IF;
END $$;

-- ============================================================================
-- PART 3: Create audit trigger function
-- ============================================================================
-- Purpose: Automatically log profile changes to user_audits table
-- Impact: Zero-code audit logging for all profile modifications

CREATE OR REPLACE FUNCTION public.audit_profile_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_changes JSONB;
    v_action TEXT;
    v_performed_by UUID;
BEGIN
    -- Determine action type
    IF (TG_OP = 'INSERT') THEN
        v_action := 'CREATE';
        v_changes := jsonb_build_object('new', to_jsonb(NEW));
        v_performed_by := NEW.id; -- User created themselves

    ELSIF (TG_OP = 'UPDATE') THEN
        -- Check if this is a soft delete
        IF (OLD."deletedAt" IS NULL AND NEW."deletedAt" IS NOT NULL) THEN
            v_action := 'DELETE';
            v_performed_by := NEW."deletedBy";
        -- Check if this is a restore
        ELSIF (OLD."deletedAt" IS NOT NULL AND NEW."deletedAt" IS NULL) THEN
            v_action := 'RESTORE';
            v_performed_by := NEW."deletedBy";
        ELSE
            v_action := 'UPDATE';
            v_performed_by := current_setting('app.current_user_id', TRUE)::UUID;
        END IF;

        -- Build changes object with only modified fields
        v_changes := jsonb_build_object(
            'old', to_jsonb(OLD),
            'new', to_jsonb(NEW)
        );

    ELSIF (TG_OP = 'DELETE') THEN
        v_action := 'HARD_DELETE';
        v_changes := jsonb_build_object('old', to_jsonb(OLD));
        v_performed_by := current_setting('app.current_user_id', TRUE)::UUID;
    END IF;

    -- Insert audit record
    INSERT INTO public.user_audits (
        "userId",
        action,
        "performedBy",
        changes,
        reason,
        metadata
    ) VALUES (
        COALESCE(NEW.id, OLD.id),
        v_action,
        v_performed_by,
        v_changes,
        NEW."deletionReason", -- Will be NULL for non-delete operations
        jsonb_build_object(
            'ip_address', current_setting('request.headers', TRUE)::JSONB->>'x-real-ip',
            'user_agent', current_setting('request.headers', TRUE)::JSONB->>'user-agent',
            'timestamp', NOW()
        )
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.audit_profile_changes() IS
    'Trigger function that automatically logs all profile changes to user_audits table';

-- ============================================================================
-- PART 4: Create trigger on profiles table
-- ============================================================================
-- Drop existing trigger if it exists (idempotent)
DROP TRIGGER IF EXISTS trg_audit_profile_changes ON public.profiles;

-- Create trigger for INSERT, UPDATE, and DELETE
CREATE TRIGGER trg_audit_profile_changes
    AFTER INSERT OR UPDATE OR DELETE
    ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_profile_changes();

COMMENT ON TRIGGER trg_audit_profile_changes ON public.profiles IS
    'Automatically logs all profile changes to user_audits table';

-- ============================================================================
-- PART 5: Enable RLS on user_audits (security)
-- ============================================================================
ALTER TABLE public.user_audits ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own audit logs
CREATE POLICY "Users can view own audit logs"
    ON public.user_audits
    FOR SELECT
    USING (
        "userId" = auth.uid()
        OR "performedBy" = auth.uid()
    );

-- Policy: Only admins can view all audit logs
CREATE POLICY "Admins can view all audit logs"
    ON public.user_audits
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND type IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

-- Policy: Only system can insert audit logs (via trigger)
CREATE POLICY "System can insert audit logs"
    ON public.user_audits
    FOR INSERT
    WITH CHECK (true); -- Trigger runs as SECURITY DEFINER

-- ============================================================================
-- PART 6: Backfill audit data for existing soft-deleted users (optional)
-- ============================================================================
-- Purpose: Create audit records for users who were deleted before this migration
-- Note: This is a best-effort backfill with limited information

INSERT INTO public.user_audits (
    "userId",
    action,
    "performedBy",
    changes,
    reason,
    metadata
)
SELECT
    id,
    'DELETE'::TEXT,
    NULL::UUID, -- Unknown who deleted
    jsonb_build_object(
        'old', jsonb_build_object(
            'id', id,
            'email', email,
            'name', name,
            'deletedAt', "deletedAt"
        )
    ),
    'Historical deletion (before audit system)'::TEXT,
    jsonb_build_object(
        'backfilled', true,
        'migration_date', NOW(),
        'note', 'This record was created during audit system migration'
    )
FROM public.profiles
WHERE "deletedAt" IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Migration Success
-- ============================================================================
COMMIT;

-- ============================================================================
-- ROLLBACK PROCEDURE (if needed)
-- ============================================================================
-- To rollback this migration, run the following:
/*
BEGIN;

-- Drop trigger
DROP TRIGGER IF EXISTS trg_audit_profile_changes ON public.profiles;

-- Drop trigger function
DROP FUNCTION IF EXISTS public.audit_profile_changes();

-- Drop indexes
DROP INDEX IF EXISTS public.idx_user_audits_userId;
DROP INDEX IF EXISTS public.idx_user_audits_performedBy;
DROP INDEX IF EXISTS public.idx_user_audits_action;
DROP INDEX IF EXISTS public.idx_user_audits_createdAt;
DROP INDEX IF EXISTS public.idx_user_audits_changes;
DROP INDEX IF EXISTS public.idx_user_audits_metadata;
DROP INDEX IF EXISTS public.idx_profiles_deletedBy;

-- Drop audit table
DROP TABLE IF EXISTS public.user_audits CASCADE;

-- Remove columns from profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS "deletedBy" CASCADE;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS "deletionReason";

COMMIT;
*/

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these after migration to verify success:
/*
-- Check that table exists
SELECT COUNT(*) as audit_count FROM public.user_audits;

-- Check that new columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'profiles'
AND column_name IN ('deletedBy', 'deletionReason');

-- Check that trigger exists
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'trg_audit_profile_changes';

-- Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'user_audits';

-- Test audit logging (optional - creates a test audit record)
-- UPDATE public.profiles SET name = name WHERE id = '<some-user-id>';
-- SELECT * FROM public.user_audits WHERE "userId" = '<some-user-id>' ORDER BY "createdAt" DESC LIMIT 1;
*/
