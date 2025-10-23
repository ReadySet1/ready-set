# File Upload Security - Deployment Guide

## Overview

This guide covers deploying the session-based file upload security system that addresses PR #87 Critical Security Issue #1: "Overly Permissive Storage Policies".

## What's Been Implemented

### ✅ Backend Infrastructure (Completed)

1. **Database Schema** (`supabase/migrations/20251023000000_add_application_sessions.sql`)
   - `application_sessions` table with session management
   - Rate limiting (5 sessions/hour per IP, 10 uploads/session)
   - Automatic expiration (2-hour sessions)
   - PostgreSQL functions for validation and cleanup

2. **API Endpoints** (`src/app/api/application-sessions/route.ts`)
   - `POST /api/application-sessions` - Create upload session
   - `GET /api/application-sessions?id={id}` - Get session details
   - `PATCH /api/application-sessions?id={id}` - Update session (mark completed)

3. **File Upload API Updates** (`src/app/api/file-uploads/route.ts`)
   - Session token validation
   - Upload count tracking
   - Session-based file path construction

4. **Storage Policies** (`supabase/migrations/20251023000001_update_storage_policies_for_sessions.sql`)
   - Session-validated upload policy
   - Restricted read access
   - Secure delete policy

## Deployment Steps

### Phase 1: Database Migration (REQUIRED)

These migrations MUST be applied to your Supabase instance before the code will work.

#### Option A: Using Supabase CLI (Recommended)

```bash
# 1. Link to your Supabase project
supabase link --project-ref your-project-ref

# 2. Apply migrations
supabase db push

# 3. Verify migrations were applied
supabase migration list
```

#### Option B: Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run both migration files in order:
   - First: `supabase/migrations/20251023000000_add_application_sessions.sql`
   - Then: `supabase/migrations/20251023000001_update_storage_policies_for_sessions.sql`
4. Verify the `application_sessions` table exists in the Table Editor

#### Option C: Using Direct SQL Connection

```bash
# Get your database connection string from Supabase dashboard
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-HOST]:5432/postgres" \
  -f supabase/migrations/20251023000000_add_application_sessions.sql \
  -f supabase/migrations/20251023000001_update_storage_policies_for_sessions.sql
```

### Phase 2: Generate TypeScript Types (REQUIRED)

After migrations are applied, regenerate Supabase types:

```bash
# Using Supabase CLI
supabase gen types typescript --project-id your-project-ref > src/types/supabase.ts

# Or using npx
npx supabase gen types typescript --project-id your-project-ref > src/types/supabase.ts
```

Then **remove all `@ts-ignore` comments and `as any` assertions** from:
- `src/app/api/application-sessions/route.ts`
- `src/app/api/file-uploads/route.ts`

### Phase 3: Deploy Backend Code

```bash
# 1. Run type check
pnpm typecheck

# 2. Run tests
pnpm test

# 3. Build for production
pnpm build

# 4. Deploy to your hosting platform
# (Vercel, Netlify, etc.)
```

### Phase 4: Verify Deployment

After deployment, verify the system is working:

#### Test 1: Session Creation

```bash
curl -X POST https://your-app.com/api/application-sessions \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "firstName": "Test",
    "lastName": "User",
    "role": "Server"
  }'
```

Expected response:
```json
{
  "success": true,
  "sessionId": "uuid-here",
  "uploadToken": "token-here",
  "expiresAt": "timestamp",
  "message": "Session created successfully. You can now upload files."
}
```

#### Test 2: File Upload with Session

```bash
curl -X POST https://your-app.com/api/file-uploads \
  -H "x-upload-token: YOUR_UPLOAD_TOKEN" \
  -F "file=@test-resume.pdf" \
  -F "entityType=job_application" \
  -F "category=job-applications/temp"
```

Expected response:
```json
{
  "success": true,
  "file": {
    "id": "file-id",
    "name": "test-resume.pdf",
    "url": "storage-url",
    "path": "job-applications/temp/session-id/timestamp-file.pdf"
  }
}
```

#### Test 3: Rate Limiting

Make 6 session creation requests from the same IP within an hour. The 6th should fail with:
```json
{
  "error": "Rate limit exceeded. Maximum 5 sessions per hour."
}
```

#### Test 4: Session Expiration

Wait 2 hours after creating a session, then try to upload. Should fail with:
```json
{
  "error": "Session expired",
  "errorType": "SESSION_EXPIRED"
}
```

## Phase 5: Frontend Integration (TODO)

⚠️ **NOT YET IMPLEMENTED** - This is planned for the next iteration.

The frontend needs to be updated to:

1. **Create session on form load**
   ```typescript
   // In ApplyForm.tsx
   useEffect(() => {
     async function createUploadSession() {
       const response = await fetch('/api/application-sessions', {
         method: 'POST',
         body: JSON.stringify({
           email: formData.email,
           firstName: formData.firstName,
           lastName: formData.lastName,
           role: formData.position
         })
       });
       const { sessionId, uploadToken } = await response.json();
       setUploadToken(uploadToken);
     }
     createUploadSession();
   }, []);
   ```

2. **Pass token in file upload headers**
   ```typescript
   // In file upload utility
   const formData = new FormData();
   formData.append('file', file);

   const response = await fetch('/api/file-uploads', {
     method: 'POST',
     headers: {
       'x-upload-token': uploadToken
     },
     body: formData
   });
   ```

3. **Mark session as completed on form submission**
   ```typescript
   // After successful application submission
   await fetch(`/api/application-sessions?id=${sessionId}`, {
     method: 'PATCH',
     headers: {
       'x-upload-token': uploadToken,
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({
       completed: true,
       jobApplicationId: applicationId
     })
   });
   ```

## Monitoring & Maintenance

### Session Cleanup

The `cleanup_expired_sessions()` function runs automatically every 2 hours (if pg_cron is enabled). To run manually:

```sql
SELECT public.cleanup_expired_sessions();
```

### Monitor Session Activity

```sql
-- Active sessions
SELECT COUNT(*) FROM application_sessions
WHERE session_expires_at > NOW() AND NOT completed;

-- Sessions by IP (rate limit check)
SELECT ip_address, COUNT(*) as sessions
FROM application_sessions
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY ip_address
ORDER BY sessions DESC;

-- Upload activity
SELECT
  DATE(created_at) as date,
  COUNT(*) as sessions,
  SUM(upload_count) as total_uploads,
  AVG(upload_count) as avg_uploads_per_session
FROM application_sessions
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### Troubleshooting

#### Issue: "application_sessions table not found"
**Solution:** Migrations haven't been applied. Run Phase 1 deployment steps.

#### Issue: TypeScript errors about application_sessions
**Solution:** Regenerate Supabase types (Phase 2) and remove type assertions.

#### Issue: "Authentication required" error on upload
**Solution:**
1. Verify session was created successfully
2. Check that `x-upload-token` header is being sent
3. Verify session hasn't expired (check `session_expires_at`)

#### Issue: Rate limit errors
**Solution:**
1. Check if same IP is creating too many sessions
2. Increase `MAX_SESSIONS_PER_IP_PER_HOUR` in `src/app/api/application-sessions/route.ts`
3. Or implement session reuse instead of creating new sessions

## Rollback Plan

If issues arise, you can temporarily disable the new policies:

```sql
-- Disable session-validated policies
ALTER POLICY "Session-validated temp uploads" ON storage.objects DISABLE;
ALTER POLICY "Session-validated temp reads" ON storage.objects DISABLE;
ALTER POLICY "Session-validated temp deletes" ON storage.objects DISABLE;

-- Re-enable old permissive policy (temporary)
CREATE POLICY "Temp fallback policy"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'job-applications' AND (storage.foldername(name))[1] = 'temp');
```

Then redeploy previous code version and plan migration fix.

## Security Considerations

### Current State
✅ Backend session validation implemented
✅ Rate limiting active
✅ Upload limits enforced
✅ Session expiration working
✅ Storage policies restrictive

### Still TODO
⚠️ Email verification (planned for Phase 2)
⚠️ Frontend integration (planned for Phase 2)
⚠️ Resumable sessions (planned for Phase 2)

### Production Checklist

Before going to production:
- [ ] Migrations applied to production database
- [ ] TypeScript types regenerated
- [ ] All type assertions removed
- [ ] Rate limits tested and tuned
- [ ] Session expiration tested
- [ ] Storage policies verified
- [ ] Monitoring queries set up
- [ ] Cleanup cron job verified
- [ ] Error handling tested
- [ ] Frontend integration completed (if Phase 2 done)

## Support

For questions or issues:
1. Check the security proposal: `docs/security/file-upload-security-proposal.md`
2. Review migration files for implementation details
3. Check Supabase logs for runtime errors
4. Monitor application sessions table for issues
