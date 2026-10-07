-- Stop the audit trigger from blocking permanent profile deletion.
--
-- public.user_audits."userId" is NOT NULL with an immediate FK to
-- public.profiles(id). The AFTER DELETE branch of audit_profile_changes()
-- inserted a HARD_DELETE row with "userId" = OLD.id, i.e. a row referencing
-- the profile that the same statement had just removed. That insert violates
-- the FK regardless of ON DELETE CASCADE (cascade removes rows that already
-- exist; it does not allow new ones), so every hard delete of a profile
-- failed and rolled back, on every environment.
--
-- Decision: a hard delete writes NO user_audits row at all. It is a GDPR
-- erasure, and a row that still references the erased user would defeat the
-- purpose. The application records the deletion as a structured log line
-- (ids and record counts only). INSERT / UPDATE auditing (CREATE, UPDATE,
-- DELETE = soft delete, RESTORE) is unchanged.
--
-- The trigger definition itself (trg_audit_profile_changes, AFTER INSERT OR
-- UPDATE OR DELETE) is left as is; replacing the function body is enough.

CREATE OR REPLACE FUNCTION public.audit_profile_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_changes JSONB;
    v_action TEXT;
    v_performed_by UUID;
BEGIN
    -- Hard deletes are not audited in user_audits: the row would reference a
    -- profile that no longer exists (FK violation) and would keep data about
    -- a user who has just been erased. The service logs the erasure instead.
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;

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
        NEW.id,
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp';

COMMENT ON FUNCTION public.audit_profile_changes() IS
    'Trigger function that logs profile INSERT/UPDATE changes to user_audits. Hard deletes are intentionally not audited (GDPR erasure).';

-- Normalize the user_audits foreign keys to the single canonical pair the
-- Prisma schema declares. Environments drifted: the "userId" FK exists under
-- two spellings and with/without ON DELETE CASCADE, and "performedBy" had a
-- duplicate FK under a second spelling. Dropping every known variant and
-- re-adding the canonical ones is idempotent and safe to re-run.
DO $$
BEGIN
    ALTER TABLE public.user_audits DROP CONSTRAINT IF EXISTS "user_audits_userId_fkey";
    ALTER TABLE public.user_audits DROP CONSTRAINT IF EXISTS "user_audits_userid_fkey";
    ALTER TABLE public.user_audits
        ADD CONSTRAINT "user_audits_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES public.profiles(id)
        ON DELETE CASCADE ON UPDATE CASCADE;

    ALTER TABLE public.user_audits DROP CONSTRAINT IF EXISTS "user_audits_performedBy_fkey";
    ALTER TABLE public.user_audits DROP CONSTRAINT IF EXISTS "user_audits_performedby_fkey";
    ALTER TABLE public.user_audits
        ADD CONSTRAINT "user_audits_performedBy_fkey"
        FOREIGN KEY ("performedBy") REFERENCES public.profiles(id)
        ON DELETE SET NULL ON UPDATE CASCADE;
END $$;
