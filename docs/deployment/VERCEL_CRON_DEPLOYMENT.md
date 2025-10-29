# Vercel Cron Jobs - Deployment Guide

**Project:** Ready Set
**Feature:** Automated Quarantine Cleanup
**Generated:** 2025-10-29
**Status:** Production Ready

---

## Overview

This guide covers deploying and configuring Vercel Cron Jobs for automated maintenance tasks in the Ready Set application.

## Current Cron Jobs

### 1. Quarantine Cleanup Job

**Purpose:** Automatically clean up quarantined files and expired rate limit entries
**Schedule:** Daily at 2 AM UTC
**Endpoint:** `/api/admin/quarantine-cleanup`
**Configuration:** `vercel.json`

This cron job performs two critical maintenance tasks:
1. Removes quarantined files older than 30 days from the `quarantined-files` storage bucket
2. Clears expired rate limit entries from memory to prevent memory leaks

---

## Prerequisites

Before deploying cron jobs to Vercel:

1. **Vercel Account** with project access
2. **Project deployed** to Vercel (production or preview)
3. **Admin access** to Vercel project settings
4. **Node.js crypto module** or OpenSSL for secret generation

---

## Deployment Steps

### Step 1: Generate CRON_SECRET

The `CRON_SECRET` environment variable is **required** to secure cron endpoints from unauthorized access.

#### Option A: Using Node.js
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

#### Option B: Using OpenSSL
```bash
openssl rand -base64 32
```

#### Option C: Using Online Generator
Visit: https://generate-secret.vercel.app/32

**Output Example:**
```
8J5xQvF2mK9pL3nR7tW1aB4cD6eH8iJ0kM2nP5qS7uV9wX1yZ3bC5dF7gH9jL
```

⚠️ **Security Note:** Never commit this secret to version control or share it publicly.

---

### Step 2: Configure Environment Variable in Vercel

1. **Navigate to Vercel Dashboard:**
   - Go to https://vercel.com/dashboard
   - Select your Ready Set project

2. **Open Environment Variables:**
   - Click **Settings** in the top navigation
   - Select **Environment Variables** from the sidebar

3. **Add CRON_SECRET:**
   - Click **Add New** button
   - Configure:
     ```
     Name: CRON_SECRET
     Value: [Your generated secret from Step 1]
     Environments:
       ☑ Production
       ☑ Preview (optional, recommended for testing)
       ☐ Development (not needed, cron jobs don't run locally)
     ```

4. **Save Changes:**
   - Click **Save**
   - Vercel will automatically redeploy affected environments

---

### Step 3: Verify Cron Configuration

#### Check vercel.json

Ensure your `vercel.json` includes the cron configuration:

```json
{
  "crons": [
    {
      "path": "/api/admin/quarantine-cleanup",
      "schedule": "0 2 * * *"
    }
  ]
}
```

**Schedule Format:** Standard cron expression
- `0 2 * * *` = Daily at 2:00 AM UTC
- [Cron expression reference](https://crontab.guru/)

---

### Step 4: Deploy to Vercel

#### Option A: Automatic Deployment (Git Push)
```bash
# Commit your changes
git add vercel.json
git commit -m "Configure Vercel Cron for quarantine cleanup"

# Push to trigger deployment
git push origin main  # or your production branch
```

#### Option B: Manual Deployment (Vercel CLI)
```bash
# Install Vercel CLI (if not already installed)
npm install -g vercel

# Deploy
vercel --prod

# Verify deployment
vercel ls
```

---

### Step 5: Verify Cron Job Configuration

After deployment, verify the cron job is configured:

1. **Via Vercel Dashboard:**
   - Go to your project in Vercel Dashboard
   - Click **Cron Jobs** in the sidebar
   - You should see: `/api/admin/quarantine-cleanup` listed
   - Status should show: **Active**
   - Next execution time should be displayed

2. **Via Vercel CLI:**
   ```bash
   vercel cron ls
   ```

Expected output:
```
Cron Jobs for project: ready-set
┌──────────────────────────────────┬───────────────┬────────────────┐
│ Path                             │ Schedule      │ Next Run       │
├──────────────────────────────────┼───────────────┼────────────────┤
│ /api/admin/quarantine-cleanup    │ 0 2 * * *     │ Tomorrow 2 AM  │
└──────────────────────────────────┴───────────────┴────────────────┘
```

---

## Testing

### Manual Trigger via API

Admins can manually trigger the cleanup endpoint to test functionality:

#### Using curl:
```bash
# Get your access token (admin user required)
# You can get this from browser dev tools after logging in

curl -X POST https://your-app.vercel.app/api/admin/quarantine-cleanup \
  -H "Cookie: your-session-cookie"
```

#### Expected Response (Success):
```json
{
  "success": true,
  "timestamp": "2025-10-29T10:30:00.000Z",
  "duration": "1250ms",
  "filesCleanedCount": 5,
  "rateLimitsCleanedCount": 12,
  "message": "Cleaned up 5 quarantined files and 12 expired rate limit entries"
}
```

#### Expected Response (Unauthorized):
```json
{
  "error": "Unauthorized - admin access or valid cron secret required"
}
```

---

## Monitoring & Maintenance

### View Cron Job Logs

#### Via Vercel Dashboard:
1. Go to your project in Vercel Dashboard
2. Click **Logs** in the sidebar
3. Filter by:
   - Path: `/api/admin/quarantine-cleanup`
   - Status: Success (200) or Error (500)

#### Via Vercel CLI:
```bash
# View recent logs
vercel logs --follow

# Filter for cron job
vercel logs | grep quarantine-cleanup
```

### Monitor Execution History

Check cron job execution history:

1. **Dashboard:** Project → Cron Jobs → Click on job name
2. View metrics:
   - Execution count (last 7 days)
   - Success rate
   - Average duration
   - Error rate
   - Last execution timestamp

### Expected Log Output

**Successful Execution:**
```
✅ Quarantine cleanup completed: {
  success: true,
  timestamp: '2025-10-29T02:00:00.000Z',
  duration: '1250ms',
  filesCleanedCount: 5,
  rateLimitsCleanedCount: 12
}
```

**Failed Execution:**
```
❌ Quarantine cleanup failed: Error: [error message]
```

### Set Up Alerts

Configure alerts for cron job failures:

1. **Via Vercel Integrations:**
   - Add Slack integration
   - Configure notifications for deployment/cron failures

2. **Via Third-Party Monitoring:**
   - Set up external monitoring (e.g., UptimeRobot)
   - Monitor endpoint: `/api/admin/quarantine-cleanup`
   - Expected status: 401 (without cron secret) or 200 (with valid admin session)

---

## Troubleshooting

### Issue: Cron Job Not Running

**Symptoms:**
- No execution logs in Vercel Dashboard
- Files not being cleaned up

**Solutions:**

1. **Verify cron job is configured:**
   ```bash
   vercel cron ls
   ```

2. **Check vercel.json syntax:**
   - Ensure JSON is valid
   - Verify path matches your API route exactly
   - Confirm schedule expression is correct

3. **Redeploy the project:**
   ```bash
   vercel --prod
   ```

### Issue: "Unauthorized" Error in Logs

**Symptoms:**
- Cron job runs but returns 401 Unauthorized
- Logs show: "Unauthorized - admin access or valid cron secret required"

**Solutions:**

1. **Verify CRON_SECRET is set:**
   ```bash
   vercel env ls
   ```
   Should list CRON_SECRET for Production

2. **Regenerate secret if compromised:**
   ```bash
   # Generate new secret
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

   # Update in Vercel Dashboard
   # Settings → Environment Variables → CRON_SECRET → Edit
   ```

3. **Check endpoint code:**
   - Verify `route.ts` correctly reads `process.env.CRON_SECRET`
   - Ensure authorization header comparison is correct

### Issue: Execution Timeout

**Symptoms:**
- Cron job execution exceeds time limit
- Logs show timeout error

**Solutions:**

1. **Check function timeout limits:**
   - Hobby plan: 10 seconds
   - Pro plan: 60 seconds (serverless), 900 seconds (edge)

2. **Optimize cleanup logic:**
   - Batch file deletions
   - Add pagination for large cleanup operations
   - Consider splitting into multiple cron jobs

3. **Upgrade Vercel plan** if needed for longer timeouts

### Issue: High Memory Usage

**Symptoms:**
- Memory errors in logs
- Inconsistent execution

**Solutions:**

1. **Optimize file processing:**
   - Process files in batches
   - Don't load all files into memory at once
   - Use streaming where possible

2. **Monitor memory usage:**
   ```javascript
   console.log('Memory:', process.memoryUsage());
   ```

3. **Check rate limit Map size:**
   - Ensure `cleanupExpiredRateLimits()` runs regularly
   - Consider persisting rate limits to database instead

---

## Security Considerations

### CRON_SECRET Security

1. **Rotation Policy:**
   - Rotate secret every 90 days
   - Rotate immediately if compromised
   - Document rotation in security logs

2. **Access Control:**
   - Only deployment admins should have access
   - Use Vercel team permissions appropriately
   - Audit environment variable access logs

3. **Fallback Authentication:**
   - Endpoint also accepts admin user authentication
   - Useful for manual triggering by admins
   - Doesn't require CRON_SECRET for admin users

### Endpoint Security

The quarantine cleanup endpoint implements defense-in-depth:

```typescript
// 1. Vercel Cron authentication (via CRON_SECRET)
if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
  // Authorized via cron
}

// 2. Admin user authentication (fallback)
const { data: { user } } = await supabase.auth.getUser();
if (user && user.app_metadata?.role === 'admin') {
  // Authorized via admin session
}

// 3. Deny if neither condition met
return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
```

---

## Performance Considerations

### Execution Time

**Target:** < 5 seconds for typical cleanup operation
**Maximum:** 60 seconds (Pro plan limit)

**Optimize for:**
- Batch operations (delete multiple files at once)
- Early returns (skip processing if nothing to clean)
- Efficient queries (indexed database lookups)

### Resource Usage

**Expected Usage:**
- Memory: < 100 MB
- CPU: < 1 second compute time
- Network: Depends on file count (Supabase API calls)

**Monitor:**
```javascript
const startTime = Date.now();
const startMemory = process.memoryUsage().heapUsed;

// ... cleanup operations ...

const duration = Date.now() - startTime;
const memoryUsed = (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024;
console.log(`Duration: ${duration}ms, Memory: ${memoryUsed.toFixed(2)}MB`);
```

### Scaling Considerations

As your application grows:

1. **File Count:**
   - Implement pagination for large buckets
   - Consider archiving instead of deleting
   - Use lifecycle policies in Supabase Storage

2. **Rate Limit Map:**
   - Current implementation uses in-memory Map
   - Consider Redis for distributed systems
   - Or persist to database with TTL

3. **Execution Frequency:**
   - Daily at 2 AM UTC is suitable for most apps
   - Increase frequency if quarantine fills quickly
   - Decrease if cleanup rarely finds anything

---

## Rollback Procedure

If cron job deployment causes issues:

### Emergency Disable

1. **Via Vercel Dashboard:**
   - Project → Settings → Cron Jobs
   - Toggle cron job to "Disabled"

2. **Via Code:**
   - Remove cron configuration from `vercel.json`
   - Deploy:
     ```bash
     git commit -am "Disable quarantine cleanup cron"
     git push origin main
     ```

### Revert Deployment

If you need to revert to a previous version:

```bash
# List recent deployments
vercel ls

# Promote a previous deployment
vercel promote [deployment-url]
```

---

## Maintenance Checklist

### Weekly
- [ ] Review cron execution logs
- [ ] Check success rate (should be > 95%)
- [ ] Verify no unexpected errors

### Monthly
- [ ] Review quarantine bucket size
- [ ] Analyze cleanup statistics
- [ ] Adjust retention period if needed (currently 30 days)
- [ ] Verify CRON_SECRET hasn't been exposed

### Quarterly
- [ ] Rotate CRON_SECRET
- [ ] Review and optimize cleanup logic
- [ ] Update documentation if process changes
- [ ] Test manual trigger functionality

---

## Related Documentation

- **API Implementation:** `src/app/api/admin/quarantine-cleanup/route.ts`
- **Security Manager:** `src/lib/upload-security.ts`
- **Vercel Configuration:** `vercel.json`
- **Environment Variables:** `.env.example`
- **README Section:** Main README.md → "Automated Maintenance (Vercel Cron)"

---

## Support & Questions

### Internal Resources
- **Slack:** #engineering or #devops
- **Wiki:** [Link to internal documentation]
- **Runbook:** [Link to incident response runbook]

### Vercel Resources
- **Documentation:** https://vercel.com/docs/cron-jobs
- **Support:** https://vercel.com/support
- **Status Page:** https://www.vercel-status.com/

---

## Changelog

### 2025-10-29 - Initial Version
- Created comprehensive Vercel Cron deployment guide
- Documented CRON_SECRET configuration
- Added troubleshooting section
- Included monitoring and maintenance procedures

---

**Last Updated:** 2025-10-29
**Next Review:** 2025-11-29 (or after first production cron execution)
**Owner:** DevOps Team
**Maintained By:** Engineering Team
