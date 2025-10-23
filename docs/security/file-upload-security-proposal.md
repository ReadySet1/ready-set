# File Upload Security Enhancement Proposal

## Problem Statement
Current implementation allows anonymous file uploads without authentication, creating security vulnerabilities:
- Anyone can upload files consuming storage quota
- No accountability or tracking
- Potential for spam and abuse attacks
- Orphaned files not properly cleaned up

## Recommended Solution: Email Verification with Upload Sessions

### Why This Approach?
✅ **Security**: Valid email required, rate-limited, time-bounded
✅ **User Experience**: No account creation required, familiar flow
✅ **Accountability**: Can track and contact users
✅ **Implementation**: Moderate complexity, uses existing patterns

### Implementation Plan

#### Phase 1: Backend Infrastructure

```typescript
// 1. Database Schema
interface ApplicationSession {
  id: string;                    // UUID
  email: string;                 // Verified email
  verificationCode: string;      // 6-digit code
  codeExpiresAt: Date;          // 10 minutes
  verified: boolean;
  sessionToken: string;          // JWT for uploads
  sessionExpiresAt: Date;        // 2 hours after verification
  uploadedFiles: string[];       // Track uploads
  ipAddress: string;             // For rate limiting
  userAgent: string;
  createdAt: Date;
  lastActivityAt: Date;
}

// 2. Verification API
POST /api/application-sessions
Body: { email: string, firstName: string, lastName: string, role: string }
Returns: { sessionId: string, message: "Verification code sent" }

POST /api/application-sessions/:id/verify
Body: { code: string }
Returns: { uploadToken: string, expiresAt: Date }

// 3. Upload API (Enhanced)
POST /api/file-uploads
Headers: { 'X-Upload-Token': uploadToken }
Body: FormData with file
Returns: { fileKey: string, filePath: string }
```

#### Phase 2: Frontend Flow

```typescript
// ApplyForm.tsx - Step 0: Email Verification
const [verificationStep, setVerificationStep] = useState<'email' | 'code' | 'verified'>('email');
const [sessionId, setSessionId] = useState<string | null>(null);
const [uploadToken, setUploadToken] = useState<string | null>(null);

// Step 1: Request verification code
async function requestVerificationCode(email: string) {
  const response = await fetch('/api/application-sessions', {
    method: 'POST',
    body: JSON.stringify({ email, firstName, lastName, role })
  });
  const { sessionId } = await response.json();
  setSessionId(sessionId);
  setVerificationStep('code');
}

// Step 2: Verify code
async function verifyCode(code: string) {
  const response = await fetch(`/api/application-sessions/${sessionId}/verify`, {
    method: 'POST',
    body: JSON.stringify({ code })
  });
  const { uploadToken, expiresAt } = await response.json();
  setUploadToken(uploadToken);
  setVerificationStep('verified');
  // Now user can proceed with file uploads
}
```

#### Phase 3: Storage Policies

```sql
-- Migration: Enhanced security policies

-- 1. Create application_sessions table
CREATE TABLE IF NOT EXISTS public.application_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  verification_code TEXT NOT NULL,
  code_expires_at TIMESTAMPTZ NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  session_token TEXT,
  session_expires_at TIMESTAMPTZ,
  uploaded_files TEXT[] DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  upload_count INTEGER DEFAULT 0,
  max_uploads INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX idx_application_sessions_email ON public.application_sessions(email);
CREATE INDEX idx_application_sessions_token ON public.application_sessions(session_token);
CREATE INDEX idx_application_sessions_expires ON public.application_sessions(session_expires_at);

-- 2. Function to validate upload token
CREATE OR REPLACE FUNCTION validate_upload_session(token TEXT, file_path TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  session_record RECORD;
BEGIN
  -- Look up session
  SELECT * INTO session_record
  FROM application_sessions
  WHERE session_token = token
    AND verified = TRUE
    AND session_expires_at > NOW()
    AND upload_count < max_uploads;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Update upload count and last activity
  UPDATE application_sessions
  SET upload_count = upload_count + 1,
      last_activity_at = NOW(),
      uploaded_files = array_append(uploaded_files, file_path)
  WHERE id = session_record.id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update storage policy (more restrictive)
DROP POLICY IF EXISTS "Authenticated temp uploads" ON storage.objects;

CREATE POLICY "Session-verified temp uploads"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'job-applications' AND
  (storage.foldername(name))[1] = 'temp' AND
  validate_upload_session(
    current_setting('request.headers', true)::json->>'x-upload-token',
    name
  )
);

-- 4. Read policy (only for verified sessions)
CREATE POLICY "Session-verified temp reads"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'job-applications' AND
  (
    -- Allow reading your own temp files
    (storage.foldername(name))[1] = 'temp' AND
    current_setting('request.headers', true)::json->>'x-upload-token' IN (
      SELECT session_token FROM application_sessions
      WHERE name = ANY(uploaded_files)
    )
    OR
    -- Allow admins to read finalized files
    auth.jwt() ->> 'role' = 'admin'
  )
);
```

#### Phase 4: Rate Limiting & Security

```typescript
// Rate limiting configuration
const RATE_LIMITS = {
  verificationEmailsPerDay: 3,        // Per email address
  verificationAttemptsPerSession: 5,  // Per session
  uploadsPerSession: 10,              // Per verified session
  sessionDuration: 2 * 60 * 60,       // 2 hours in seconds
  cleanupOrphanedFilesAfter: 2 * 60 * 60, // 2 hours
};

// Implement rate limiting in API
import rateLimit from 'express-rate-limit';

const verificationLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 3, // Max 3 requests per day per IP
  keyGenerator: (req) => req.body.email,
  message: 'Too many verification requests. Please try again tomorrow.'
});

// Apply to verification endpoint
app.post('/api/application-sessions', verificationLimiter, async (req, res) => {
  // Handle verification
});
```

#### Phase 5: Cleanup Job

```typescript
// Scheduled job to clean up expired sessions and orphaned files
export async function cleanupExpiredSessions() {
  // 1. Find expired sessions
  const expiredSessions = await db.applicationSessions.findMany({
    where: {
      OR: [
        { sessionExpiresAt: { lt: new Date() } },
        {
          verified: false,
          codeExpiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      ]
    }
  });

  // 2. Delete associated files
  for (const session of expiredSessions) {
    for (const filePath of session.uploadedFiles) {
      await supabase.storage
        .from('job-applications')
        .remove([filePath]);
    }
  }

  // 3. Delete session records
  await db.applicationSessions.deleteMany({
    where: {
      id: { in: expiredSessions.map(s => s.id) }
    }
  });
}

// Run via cron job
// 0 */2 * * * - Every 2 hours
```

### UX Flow Diagram

```
User Action              System Response
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Click "Apply Now"
                    →   Show email verification step
                        "We'll send you a code to verify your email"

2. Enter email & basic info
   Click "Send Code"
                    →   Generate 6-digit code
                        Send email
                        Create session record
                        Show code input field

3. Enter 6-digit code
   Click "Verify"
                    →   Validate code
                        Generate upload token (JWT)
                        Mark session as verified
                        Show success + proceed to form

4. Fill out application
   Upload files
                    →   Each upload validates token
                        Track file in session
                        Enforce rate limits
                        Update last activity

5. Submit application
                    →   Create job application
                        Move files to permanent storage
                        Mark session as complete
                        Send confirmation email
```

### Rollback Plan

If issues arise, we can fall back to current implementation:

```sql
-- Temporarily disable new policies
ALTER POLICY "Session-verified temp uploads" ON storage.objects DISABLE;

-- Re-enable old permissive policy
CREATE POLICY "Temp fallback policy"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'job-applications');
```

### Testing Checklist

- [ ] Email verification flow works correctly
- [ ] Invalid codes are rejected
- [ ] Expired codes are rejected
- [ ] Upload token validation works
- [ ] Rate limiting prevents abuse
- [ ] Files upload successfully with valid token
- [ ] Files are rejected without token
- [ ] Session expiration works correctly
- [ ] Cleanup job removes orphaned files
- [ ] User can resume application (email link)

### Migration Timeline

**Week 1**: Backend infrastructure
- Create database tables
- Implement verification API
- Update upload API to validate tokens

**Week 2**: Frontend integration
- Add verification step to form
- Update upload components
- Test end-to-end flow

**Week 3**: Security hardening
- Implement rate limiting
- Add cleanup job
- Security testing

**Week 4**: Monitoring & deployment
- Add monitoring/logging
- Deploy to staging
- Load testing
- Production deployment

### Alternative: Quick Win (Interim Solution)

If full implementation takes too long, implement this as a stopgap:

```typescript
// Generate server-side upload token on form load
// Valid for 2 hours, tied to IP + user agent
// Rate limit: 10 uploads per session
// Cleanup orphaned files after 2 hours

// This is less secure but better than current state
```

## Conclusion

The email verification approach provides the best balance of:
- **Security**: Verified identity, rate limiting, accountability
- **UX**: No account creation, familiar flow, can resume
- **Maintenance**: Clean data, fewer orphaned files
- **Scalability**: Easy to monitor and tune

Estimated implementation: 3-4 weeks for full solution, 1 week for interim solution.
