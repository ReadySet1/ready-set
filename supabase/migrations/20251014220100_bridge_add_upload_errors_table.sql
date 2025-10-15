-- ============================================================================
-- Bridge Migration: Add Upload Errors Tracking Table
-- ============================================================================
-- Description: Adds upload_errors table for tracking file upload failures
-- Author: Migration Reconciliation Process
-- Date: 2025-10-14
-- Risk Level: LOW (additive only, no data modification)
-- Dependencies: None
-- Rollback: See rollback section at bottom
-- ============================================================================

-- Migration Start
BEGIN;

-- ============================================================================
-- PART 1: Create upload_errors table
-- ============================================================================
-- Purpose: Track and diagnose file upload failures with detailed error info
-- Impact: Improves debugging and user support for upload issues

CREATE TABLE IF NOT EXISTS public.upload_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "correlationId" TEXT NOT NULL,
    "errorType" TEXT NOT NULL,
    message TEXT NOT NULL,
    "userMessage" TEXT NOT NULL,
    details TEXT,
    "userId" UUID,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    retryable BOOLEAN NOT NULL DEFAULT false,
    resolved BOOLEAN NOT NULL DEFAULT false
);

-- Add comments for documentation
COMMENT ON TABLE public.upload_errors IS
    'Tracks file upload errors for debugging and user support';
COMMENT ON COLUMN public.upload_errors."correlationId" IS
    'Unique identifier to trace the upload attempt across logs';
COMMENT ON COLUMN public.upload_errors."errorType" IS
    'Classification of error (e.g., SIZE_LIMIT, FORMAT_INVALID, NETWORK_ERROR)';
COMMENT ON COLUMN public.upload_errors.message IS
    'Technical error message for developers';
COMMENT ON COLUMN public.upload_errors."userMessage" IS
    'User-friendly error message to display in UI';
COMMENT ON COLUMN public.upload_errors.details IS
    'Additional error details (stack trace, request info, etc.)';
COMMENT ON COLUMN public.upload_errors."userId" IS
    'User who attempted the upload (NULL for anonymous uploads)';
COMMENT ON COLUMN public.upload_errors.timestamp IS
    'When the error occurred';
COMMENT ON COLUMN public.upload_errors.retryable IS
    'Whether the operation can be retried';
COMMENT ON COLUMN public.upload_errors.resolved IS
    'Whether the error has been resolved/addressed';

-- ============================================================================
-- PART 2: Add indexes for performance
-- ============================================================================

-- Index for looking up errors by correlation ID (most common query)
CREATE INDEX IF NOT EXISTS idx_upload_errors_correlationId
    ON public.upload_errors("correlationId");

-- Index for filtering by user (support queries)
CREATE INDEX IF NOT EXISTS idx_upload_errors_userId
    ON public.upload_errors("userId")
    WHERE "userId" IS NOT NULL;

-- Index for filtering by error type (analytics)
CREATE INDEX IF NOT EXISTS idx_upload_errors_errorType
    ON public.upload_errors("errorType");

-- Index for time-based queries (most recent errors)
CREATE INDEX IF NOT EXISTS idx_upload_errors_timestamp
    ON public.upload_errors(timestamp DESC);

-- Composite index for unresolved errors by type (admin dashboard)
CREATE INDEX IF NOT EXISTS idx_upload_errors_unresolved
    ON public.upload_errors("errorType", timestamp DESC)
    WHERE resolved = false;

-- Index for retryable errors (retry queue processing)
CREATE INDEX IF NOT EXISTS idx_upload_errors_retryable
    ON public.upload_errors("correlationId", timestamp DESC)
    WHERE retryable = true AND resolved = false;

-- ============================================================================
-- PART 3: Enable RLS on upload_errors (security)
-- ============================================================================
ALTER TABLE public.upload_errors ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own upload errors
CREATE POLICY "Users can view own upload errors"
    ON public.upload_errors
    FOR SELECT
    USING (
        "userId" = auth.uid()
    );

-- Policy: Admins and helpdesk can view all upload errors
CREATE POLICY "Admins can view all upload errors"
    ON public.upload_errors
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND type IN ('ADMIN', 'SUPER_ADMIN', 'HELPDESK')
        )
    );

-- Policy: Service role can insert upload errors
CREATE POLICY "Service can insert upload errors"
    ON public.upload_errors
    FOR INSERT
    WITH CHECK (true); -- Backend service inserts these

-- Policy: Admins can update upload errors (mark as resolved)
CREATE POLICY "Admins can update upload errors"
    ON public.upload_errors
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND type IN ('ADMIN', 'SUPER_ADMIN', 'HELPDESK')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND type IN ('ADMIN', 'SUPER_ADMIN', 'HELPDESK')
        )
    );

-- ============================================================================
-- PART 4: Create helper function for logging errors
-- ============================================================================
-- Purpose: Simplify error logging from application code
-- Impact: Consistent error tracking across the application

CREATE OR REPLACE FUNCTION public.log_upload_error(
    p_correlation_id TEXT,
    p_error_type TEXT,
    p_message TEXT,
    p_user_message TEXT,
    p_details TEXT DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_retryable BOOLEAN DEFAULT false
)
RETURNS UUID AS $$
DECLARE
    v_error_id UUID;
BEGIN
    INSERT INTO public.upload_errors (
        "correlationId",
        "errorType",
        message,
        "userMessage",
        details,
        "userId",
        retryable,
        resolved
    ) VALUES (
        p_correlation_id,
        p_error_type,
        p_message,
        p_user_message,
        p_details,
        p_user_id,
        p_retryable,
        false
    )
    RETURNING id INTO v_error_id;

    RETURN v_error_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.log_upload_error IS
    'Helper function to log upload errors with standardized format';

-- ============================================================================
-- PART 5: Create function for marking errors as resolved
-- ============================================================================

CREATE OR REPLACE FUNCTION public.resolve_upload_error(
    p_error_id UUID,
    p_resolved_by UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_updated BOOLEAN;
BEGIN
    UPDATE public.upload_errors
    SET
        resolved = true,
        details = COALESCE(
            details || E'\n\nResolved by: ' || p_resolved_by::TEXT,
            'Resolved by: ' || p_resolved_by::TEXT
        )
    WHERE id = p_error_id
    AND resolved = false;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.resolve_upload_error IS
    'Mark an upload error as resolved';

-- ============================================================================
-- PART 6: Create view for error analytics
-- ============================================================================
-- Purpose: Provide easy-to-query error statistics for dashboards
-- Impact: Better visibility into upload system health

CREATE OR REPLACE VIEW public.upload_error_stats AS
SELECT
    "errorType",
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE resolved = false) as unresolved_count,
    COUNT(*) FILTER (WHERE retryable = true AND resolved = false) as retryable_count,
    COUNT(DISTINCT "userId") as affected_users,
    MIN(timestamp) as first_occurrence,
    MAX(timestamp) as last_occurrence,
    AVG(EXTRACT(EPOCH FROM (NOW() - timestamp))) / 3600 as avg_hours_to_resolve
FROM public.upload_errors
WHERE timestamp > NOW() - INTERVAL '30 days'
GROUP BY "errorType"
ORDER BY total_count DESC;

COMMENT ON VIEW public.upload_error_stats IS
    'Summary statistics of upload errors for monitoring and analytics';

-- Grant access to the view
GRANT SELECT ON public.upload_error_stats TO authenticated;

-- ============================================================================
-- PART 7: Create cleanup function for old errors
-- ============================================================================
-- Purpose: Automatically archive or delete old resolved errors
-- Impact: Maintains table performance over time

CREATE OR REPLACE FUNCTION public.cleanup_old_upload_errors(
    p_days_to_keep INTEGER DEFAULT 90
)
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    -- Delete resolved errors older than specified days
    DELETE FROM public.upload_errors
    WHERE resolved = true
    AND timestamp < NOW() - (p_days_to_keep || ' days')::INTERVAL;

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    -- Log the cleanup operation
    RAISE NOTICE 'Deleted % old resolved upload errors', v_deleted_count;

    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.cleanup_old_upload_errors IS
    'Remove old resolved upload errors to maintain table performance (default: 90 days)';

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

-- Drop view
DROP VIEW IF EXISTS public.upload_error_stats CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS public.log_upload_error(TEXT, TEXT, TEXT, TEXT, TEXT, UUID, BOOLEAN);
DROP FUNCTION IF EXISTS public.resolve_upload_error(UUID, UUID);
DROP FUNCTION IF EXISTS public.cleanup_old_upload_errors(INTEGER);

-- Drop indexes
DROP INDEX IF EXISTS public.idx_upload_errors_correlationId;
DROP INDEX IF EXISTS public.idx_upload_errors_userId;
DROP INDEX IF EXISTS public.idx_upload_errors_errorType;
DROP INDEX IF EXISTS public.idx_upload_errors_timestamp;
DROP INDEX IF EXISTS public.idx_upload_errors_unresolved;
DROP INDEX IF EXISTS public.idx_upload_errors_retryable;

-- Drop table
DROP TABLE IF EXISTS public.upload_errors CASCADE;

COMMIT;
*/

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these after migration to verify success:
/*
-- Check that table exists
SELECT COUNT(*) as error_count FROM public.upload_errors;

-- Check that indexes exist
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE tablename = 'upload_errors'
ORDER BY indexname;

-- Check that RLS policies exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'upload_errors';

-- Check that functions exist
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE '%upload_error%';

-- Check that view exists
SELECT viewname FROM pg_views WHERE viewname = 'upload_error_stats';

-- Test error logging (optional)
-- SELECT public.log_upload_error(
--     'test-correlation-id-123',
--     'TEST_ERROR',
--     'Test technical message',
--     'Test user-friendly message',
--     'Test details',
--     auth.uid(),
--     true
-- );

-- View error stats
-- SELECT * FROM public.upload_error_stats;
*/

-- ============================================================================
-- USAGE EXAMPLES
-- ============================================================================
/*
-- Example 1: Log an upload error from application code
SELECT public.log_upload_error(
    p_correlation_id := 'req-' || gen_random_uuid()::TEXT,
    p_error_type := 'SIZE_LIMIT_EXCEEDED',
    p_message := 'File size 15MB exceeds limit of 10MB',
    p_user_message := 'The file you selected is too large. Please choose a file smaller than 10MB.',
    p_details := jsonb_build_object(
        'file_size', 15728640,
        'limit', 10485760,
        'file_name', 'large_document.pdf'
    )::TEXT,
    p_user_id := auth.uid(),
    p_retryable := false
);

-- Example 2: Mark an error as resolved
SELECT public.resolve_upload_error(
    '<error-id-uuid>',
    auth.uid()
);

-- Example 3: Get recent unresolved errors for a user
SELECT *
FROM public.upload_errors
WHERE "userId" = auth.uid()
AND resolved = false
ORDER BY timestamp DESC
LIMIT 10;

-- Example 4: Run cleanup (should be scheduled as a cron job)
SELECT public.cleanup_old_upload_errors(90);
*/
