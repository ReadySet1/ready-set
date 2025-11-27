# Sentry Error Monitoring Setup Guide

Complete guide for setting up and using Sentry error monitoring in the Ready Set application.

## Table of Contents
- [Overview](#overview)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Usage](#usage)
- [Testing](#testing)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

Sentry provides real-time error tracking and monitoring for the application across:
- **Client-side** (Browser JavaScript)
- **Server-side** (Next.js API routes and Server Components)
- **Edge Runtime** (Middleware and Edge Functions)

### Benefits
- 📊 Real-time error reporting and alerting
- 🔍 Detailed stack traces with source maps
- 👤 User context for every error
- 🍞 Breadcrumbs showing user actions before errors
- 📈 Performance monitoring (optional)
- 🔔 Slack/Email alerts for critical errors

### Free Tier Limits
- **5,000 errors/month** - Sufficient for small to medium apps
- **10,000 performance units/month** - For transaction monitoring
- **50 MB source maps storage**

## Quick Start

> **Security Note**: Never commit real Sentry credentials to version control. The `.env.example` file contains placeholder values only. Real credentials should be in `.env.local` (which is gitignored).

### 1. Create a Sentry Account

1. Go to [sentry.io](https://sentry.io/) and sign up
2. Create a new organization (or use existing)
3. Create a new project:
   - Platform: **Next.js**
   - Alert me on every issue: **Yes** (recommended for development)
   - Give your project a name (e.g., "ready-set")

### 2. Get Your DSN

After creating the project, you'll see your **DSN** (Data Source Name). It looks like:
```
https://abc123def456@o1234567.ingest.sentry.io/7891011
```

Copy this - you'll need it for environment variables.

### 3. Generate an Auth Token

1. Go to **Settings** → **Auth Tokens**
2. Click **Create New Token**
3. Configure the token:
   - **Name**: "Source Maps Upload"
   - **Scopes**: Select:
     - `project:releases`
     - `project:write`
     - `org:read`
4. Click **Create Token**
5. **Copy the token immediately** (it won't be shown again)

### 4. Configure Environment Variables

Add these to your `.env.local` file:

```bash
# Sentry DSN (from step 2)
NEXT_PUBLIC_SENTRY_DSN=https://abc123def456@o1234567.ingest.sentry.io/7891011

# Auth token (from step 3)
SENTRY_AUTH_TOKEN=sntrys_your_token_here

# Organization slug (from your Sentry URL)
SENTRY_ORG=your-org-slug

# Project name
SENTRY_PROJECT=ready-set
```

**For Production (Vercel/your hosting):**
- Add the same variables to your hosting platform's environment variables
- Make sure `NEXT_PUBLIC_SENTRY_DSN` is marked as "Expose to client" or "Public"

### 5. Test the Integration

#### Option A: Using the Test Page (Development Only)
1. Start your development server: `pnpm dev`
2. Navigate to: `http://localhost:3000/test-sentry`
3. Click any test button
4. Check your Sentry dashboard → Issues

#### Option B: Using the API Route
```bash
# Test error
curl http://localhost:3000/api/test-sentry?type=error

# Test message
curl http://localhost:3000/api/test-sentry?type=message

# Test with context
curl http://localhost:3000/api/test-sentry?type=context
```

### 6. Verify in Sentry Dashboard

1. Go to your Sentry project
2. Navigate to **Issues** → **All Issues**
3. You should see your test error within 10-30 seconds
4. Click on the issue to see:
   - Full stack trace
   - Breadcrumbs
   - User context (if set)
   - Environment info

## Configuration

### Sentry Config Files

The application uses three configuration files:

#### `sentry.client.config.ts`
Handles browser-side error tracking:
- JavaScript exceptions
- Unhandled promise rejections
- Network errors (optional)
- Session replays on errors

Key features:
- Filters out common noise (ResizeObserver, etc.)
- 10% replay sampling rate
- Privacy: masks all text and media

#### `sentry.server.config.ts`
Handles server-side error tracking:
- API route errors
- Server component errors
- Database errors
- Server-side exceptions

Key features:
- Prisma integration for DB query tracking
- HTTP instrumentation
- Filters handled business logic errors

#### `sentry.edge.config.ts`
Handles edge runtime errors:
- Middleware errors
- Edge function errors

### Filtering Errors

Errors can be filtered using `beforeSend`:

```typescript
// In sentry.client.config.ts or sentry.server.config.ts
beforeSend(event, hint) {
  // Ignore specific error messages
  if (event.exception?.values?.[0]?.value?.includes('NetworkError')) {
    return null; // Don't send to Sentry
  }

  // Add custom context
  event.user = { id: getCurrentUserId() };

  return event;
}
```

### Sample Rates

Adjust these in the config files:

```typescript
// Percentage of errors to capture (0.0 to 1.0)
tracesSampleRate: 0.1, // 10% of transactions

// Percentage of sessions to replay
replaysSessionSampleRate: 0.1, // 10% of all sessions
replaysOnErrorSampleRate: 1.0, // 100% of error sessions
```

## Usage

### Basic Error Tracking

Errors are automatically captured. No code changes needed for:
- Uncaught exceptions
- Unhandled promise rejections
- React component errors
- API route errors

### Manual Error Tracking

Use the provided utilities from `@/lib/monitoring/sentry`:

#### 1. Set User Context

```typescript
import { setSentryUser } from '@/lib/monitoring/sentry';

// After successful authentication
setSentryUser({
  id: user.id,
  email: user.email,
  role: user.role,
  name: user.name
});

// On logout
setSentryUser(null);
```

**Where to add:**
- In your auth callback handler
- After session validation
- In middleware (for persistent context)

#### 2. Capture Exceptions with Context

```typescript
import { captureException } from '@/lib/monitoring/sentry';

try {
  await updateDelivery(deliveryId, data);
} catch (error) {
  // Capture with additional context
  captureException(error, {
    deliveryId,
    action: 'update_delivery',
    data: JSON.stringify(data),
  });

  // Handle error gracefully for user
  return { error: 'Failed to update delivery' };
}
```

#### 3. Capture Messages (Non-Errors)

```typescript
import { captureMessage } from '@/lib/monitoring/sentry';

// Track important events
captureMessage('GPS accuracy below threshold', 'warning', {
  accuracy: gpsData.accuracy,
  threshold: 50,
  driverId: driver.id
});
```

#### 4. Add Breadcrumbs

```typescript
import { addSentryBreadcrumb } from '@/lib/monitoring/sentry';

// Add trail of events
addSentryBreadcrumb('User started delivery', {
  deliveryId: delivery.id,
  driverId: driver.id
});

addSentryBreadcrumb('GPS update received', {
  accuracy: gps.accuracy,
  latitude: gps.lat,
  longitude: gps.lng
}, 'info');
```

#### 5. Performance Monitoring

```typescript
import { startSpan } from '@/lib/monitoring/sentry';

const span = startSpan('calculate_mileage', 'db.query');
try {
  const mileage = await calculateShiftMileage(shiftId);
  return mileage;
} finally {
  span?.end();
}
```

### Integration Points

#### In Authentication Flow
```typescript
// src/app/api/auth/callback/route.ts
import { setSentryUser } from '@/lib/monitoring/sentry';

export async function GET(request: Request) {
  const session = await getSession();

  if (session?.user) {
    setSentryUser({
      id: session.user.id,
      email: session.user.email,
      role: session.user.role
    });
  }

  // ... rest of auth logic
}
```

#### In API Routes
```typescript
// src/app/api/deliveries/[id]/route.ts
import { captureException, addSentryBreadcrumb } from '@/lib/monitoring/sentry';

export async function PUT(request: Request) {
  try {
    addSentryBreadcrumb('Updating delivery');

    const data = await request.json();
    const result = await updateDelivery(id, data);

    return NextResponse.json(result);
  } catch (error) {
    captureException(error, {
      deliveryId: id,
      action: 'update'
    });

    return NextResponse.json(
      { error: 'Failed to update delivery' },
      { status: 500 }
    );
  }
}
```

#### In React Components
```typescript
// Client components
'use client';
import { useEffect } from 'react';
import { setSentryUser } from '@/lib/monitoring/sentry';

export default function DashboardLayout({ user }: Props) {
  useEffect(() => {
    if (user) {
      setSentryUser({
        id: user.id,
        email: user.email,
        role: user.role
      });
    }
  }, [user]);

  // ... component logic
}
```

## Testing

### Development Testing

#### Test Page (Recommended)
```
http://localhost:3000/test-sentry
```

Features:
- Test client-side errors
- Test messages and warnings
- Set user context
- Test breadcrumbs
- Test unhandled errors
- Test API errors

#### API Route Testing
```bash
# Test different error types
curl http://localhost:3000/api/test-sentry?type=error
curl http://localhost:3000/api/test-sentry?type=message
curl http://localhost:3000/api/test-sentry?type=warning
curl http://localhost:3000/api/test-sentry?type=context
```

### Production Testing

**⚠️ Note:** Test pages are automatically disabled in production for security.

To test in production:
1. Temporarily enable test endpoints (add NODE_ENV check bypass)
2. Use only in staging environment
3. Remove test code before production deployment

Alternative: Trigger real errors and verify they're captured.

## Security & Credential Management

### Understanding Sentry Credentials

#### NEXT_PUBLIC_SENTRY_DSN
- ✅ **Safe to expose** - This is the public DSN
- Purpose: Identifies your Sentry project for error reporting
- Can be visible in client-side code and browser DevTools
- No security risk if exposed

#### SENTRY_AUTH_TOKEN
- ⚠️ **KEEP SECRET** - This is a sensitive token
- Purpose: Uploads source maps during build process
- Provides write access to your Sentry project
- **Never commit to version control**
- **Never expose to client-side code**

### Credential Rotation Procedures

If your `SENTRY_AUTH_TOKEN` has been exposed (e.g., committed to git, shared publicly):

#### Step 1: Rotate the Token Immediately

1. **Log in to Sentry Dashboard**
   - Go to [sentry.io](https://sentry.io/)
   - Navigate to **Settings** → **Auth Tokens**

2. **Delete the Exposed Token**
   - Find the token in the list
   - Click **Revoke** or **Delete**
   - Confirm the action

3. **Create a New Token**
   - Click **Create New Token**
   - Name: "Source Maps Upload - [Date]"
   - Scopes needed:
     - `project:releases`
     - `project:write`
     - `org:read`
   - Click **Create Token**
   - **Copy the token immediately** (shown only once)

#### Step 2: Update Environment Variables

**Local Development:**
```bash
# Update .env.local with new token
SENTRY_AUTH_TOKEN=sntryu_your_new_token_here
```

**Production (Vercel):**
1. Go to Vercel Dashboard → Your Project
2. Navigate to **Settings** → **Environment Variables**
3. Find `SENTRY_AUTH_TOKEN`
4. Click **Edit** and paste the new token
5. Select environments: **Production**, **Preview** (optional)
6. Click **Save**

**Production (Other Platforms):**
- **Netlify**: Site settings → Build & deploy → Environment
- **AWS**: Update in Parameter Store or Secrets Manager
- **Railway**: Project → Variables → Edit
- **Render**: Dashboard → Environment → Edit

#### Step 3: Verify the Update

```bash
# Trigger a new build
git commit --allow-empty -m "Rotate Sentry token"
git push

# Check build logs for:
# ℹ️ Sentry: Uploading source maps for release...
# ✓ Sentry: Source maps uploaded successfully
```

#### Step 4: Clean Git History (If Committed)

If the token was committed to git:

**Option A: Using BFG Repo-Cleaner (Recommended)**
```bash
# Install BFG
brew install bfg  # macOS
# or download from: https://rtyley.github.io/bfg-repo-cleaner/

# Clone a fresh mirror
git clone --mirror https://github.com/yourusername/repo.git

# Remove the sensitive file
bfg --delete-files .env.local repo.git

# Clean up and push
cd repo.git
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push
```

**Option B: Manual Approach**
```bash
# Rewrite history (WARNING: Destructive)
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env.local" \
  --prune-empty --tag-name-filter cat -- --all

# Force push (coordinate with team first!)
git push origin --force --all
```

⚠️ **Important:** After cleaning git history, all team members must re-clone the repository.

### Security Best Practices

1. **Never Commit Credentials**
   - Always use `.env.local` (already in `.gitignore`)
   - Double-check `.env.example` only has placeholders
   - Use pre-commit hooks to scan for secrets

2. **Rotate Tokens Regularly**
   - Schedule quarterly rotation
   - Rotate immediately after team member departure
   - Keep rotation history documented

3. **Use GitHub Secret Scanning**
   - Enable in repository settings
   - Configure alerts for Sentry tokens
   - Review alerts promptly

4. **Limit Token Permissions**
   - Use minimum required scopes
   - Create separate tokens for CI/CD vs. local development
   - Document token purpose in token name

5. **Monitor Token Usage**
   - Check Sentry → Settings → Audit Log
   - Review source map uploads
   - Alert on unusual activity

## Advanced Integration Examples

### Authentication Integration

#### Next-Auth (App Router)
```typescript
// src/app/api/auth/[...nextauth]/route.ts
import { setSentryUser } from '@/lib/monitoring/sentry';
import NextAuth from 'next-auth';

export const { handlers, auth } = NextAuth({
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Set Sentry user on login
        setSentryUser({
          id: user.id,
          email: user.email || undefined,
          role: user.role,
          name: user.name || undefined,
        });
      }
      return token;
    },
    async session({ session, token }) {
      // Update Sentry user on session refresh
      if (session.user) {
        setSentryUser({
          id: session.user.id,
          email: session.user.email || undefined,
          role: session.user.role,
        });
      }
      return session;
    },
  },
});
```

#### Sign Out Handler
```typescript
// src/app/api/auth/signout/route.ts
import { setSentryUser } from '@/lib/monitoring/sentry';

export async function POST() {
  // Clear Sentry user context on logout
  setSentryUser(null);

  // ... rest of signout logic
  return NextResponse.json({ success: true });
}
```

### API Route Integration

#### Complete API Route Example
```typescript
// src/app/api/orders/[id]/route.ts
import {
  captureException,
  addSentryBreadcrumb,
  setSentryContext,
  startSpan,
} from '@/lib/monitoring/sentry';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const orderId = params.id;

  try {
    // Add breadcrumb for debugging
    addSentryBreadcrumb('Order update started', {
      orderId,
      timestamp: new Date().toISOString(),
    });

    // Set context for this request
    setSentryContext('order', {
      orderId,
      action: 'update',
    });

    // Track performance
    const result = await startSpan('update_order', 'db.query', async () => {
      const data = await request.json();
      return await updateOrder(orderId, data);
    });

    addSentryBreadcrumb('Order updated successfully', {
      orderId,
      changes: Object.keys(result),
    });

    return NextResponse.json(result);
  } catch (error) {
    // Capture error with rich context
    captureException(error, {
      orderId,
      action: 'update_order',
      endpoint: '/api/orders/[id]',
      method: 'PUT',
    });

    return NextResponse.json(
      { error: 'Failed to update order' },
      { status: 500 }
    );
  }
}
```

### React Error Boundary

#### Custom Error Boundary Component
```typescript
// src/components/ErrorBoundary.tsx
'use client';

import { Component, ReactNode } from 'react';
import { logErrorToSentry } from '@/lib/monitoring/sentry';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to Sentry with component stack
    logErrorToSentry(error, {
      componentStack: errorInfo.componentStack,
      errorBoundary: 'ErrorBoundary',
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="error-container">
            <h2>Something went wrong</h2>
            <p>We've been notified and are looking into it.</p>
            <button onClick={() => this.setState({ hasError: false })}>
              Try again
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
```

#### Usage in Layout
```typescript
// src/app/layout.tsx
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function RootLayout({ children }: Props) {
  return (
    <html lang="en">
      <body>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
```

### Server Actions Integration

```typescript
// src/app/actions/orders.ts
'use server';

import { captureException, addSentryBreadcrumb } from '@/lib/monitoring/sentry';

export async function createOrder(formData: FormData) {
  try {
    addSentryBreadcrumb('Server action: createOrder started');

    const order = await db.order.create({
      data: {
        // ... order data
      },
    });

    addSentryBreadcrumb('Order created', { orderId: order.id });
    return { success: true, orderId: order.id };
  } catch (error) {
    captureException(error, {
      action: 'createOrder',
      formDataKeys: Array.from(formData.keys()),
    });

    return { success: false, error: 'Failed to create order' };
  }
}
```

### Middleware Integration

```typescript
// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { addSentryBreadcrumb, captureException } from '@/lib/monitoring/sentry';

export function middleware(request: NextRequest) {
  try {
    // Track middleware execution
    addSentryBreadcrumb('Middleware executed', {
      path: request.nextUrl.pathname,
      method: request.method,
    });

    // ... your middleware logic

    return NextResponse.next();
  } catch (error) {
    captureException(error, {
      middleware: true,
      path: request.nextUrl.pathname,
    });
    throw error;
  }
}
```

### Background Job Integration

```typescript
// src/lib/jobs/processOrders.ts
import {
  startSpan,
  captureException,
  setSentryTags,
  addSentryBreadcrumb,
} from '@/lib/monitoring/sentry';

export async function processOrders() {
  // Tag this job
  setSentryTags({
    job: 'process_orders',
    environment: process.env.NODE_ENV || 'development',
  });

  try {
    addSentryBreadcrumb('Background job started: processOrders');

    const result = await startSpan('process_orders', 'job', async () => {
      const orders = await fetchPendingOrders();

      for (const order of orders) {
        await startSpan('process_single_order', 'job.task', async () => {
          await processOrder(order.id);
        });
      }

      return { processed: orders.length };
    });

    addSentryBreadcrumb('Background job completed', result);
    return result;
  } catch (error) {
    captureException(error, {
      job: 'process_orders',
      failedAt: new Date().toISOString(),
    });
    throw error;
  }
}
```

## Best Practices

### 1. User Context
✅ **DO**: Set user context immediately after authentication
```typescript
setSentryUser({ id, email, role });
```

❌ **DON'T**: Include sensitive data in user context
```typescript
// DON'T do this
setSentryUser({ password: '...' }); // Never!
```

### 2. Error Context
✅ **DO**: Add helpful context
```typescript
captureException(error, {
  deliveryId: delivery.id,
  status: delivery.status,
  timestamp: new Date().toISOString()
});
```

❌ **DON'T**: Log sensitive data
```typescript
// DON'T do this
captureException(error, {
  creditCard: card.number, // Never!
  password: user.password // Never!
});
```

### 3. Error Filtering
✅ **DO**: Filter noise
```typescript
beforeSend(event) {
  // Ignore browser extensions
  if (event.exception?.values?.[0]?.value?.includes('chrome-extension')) {
    return null;
  }
  return event;
}
```

### 4. Breadcrumbs
✅ **DO**: Add breadcrumbs before critical operations
```typescript
addSentryBreadcrumb('Starting delivery update');
await updateDelivery();
addSentryBreadcrumb('Delivery updated successfully');
```

### 5. Performance
✅ **DO**: Monitor critical operations
```typescript
const transaction = startTransaction('gps_calculation', 'compute');
// ... expensive operation
transaction?.finish();
```

❌ **DON'T**: Monitor everything (wastes quota)
```typescript
// DON'T monitor trivial operations
const transaction = startTransaction('set_variable', 'misc');
const x = 1;
transaction?.finish();
```

## Alert Configuration

### Setting Up Alerts

1. Go to **Settings** → **Alerts**
2. Click **Create Alert Rule**
3. Choose trigger:
   - **All Events**: Every error
   - **Issue First Seen**: New error types
   - **Metric Alert**: Threshold-based

### Recommended Alerts

#### Critical Errors
- **Trigger**: Any error with tag `level:fatal`
- **Action**: Slack + Email
- **Examples**: Server crashes, database failures

#### High Priority
- **Trigger**: Error rate > 10/min
- **Action**: Slack notification
- **Examples**: Payment failures, GPS tracking failures

#### Medium Priority
- **Trigger**: New issue type
- **Action**: Sentry dashboard only
- **Examples**: UI errors, validation failures

### Slack Integration

#### Step 1: Connect Slack Workspace

1. Go to **Settings** → **Integrations** → **Slack**
2. Click **Add Workspace**
3. Authorize Sentry to access your Slack workspace
4. Select the workspace (Ready Set LLC)

#### Step 2: Configure Alert Routing

Create channels (if they don't exist):
- `#engineering-critical` - Fatal errors, database failures
- `#engineering-alerts` - All high-priority issues

Map alerts to channels:
1. Go to **Alerts** → **Alert Rules**
2. For each rule, under **Actions**, click **Add action**
3. Select **Send a Slack notification**
4. Choose the appropriate channel

#### Step 3: Create Alert Rules

**Critical Errors (Email + Slack)**:
```
Name: Critical Error Alert
Trigger: When an issue is seen more than 50 times in 1 hour
         OR error has tag level:fatal
Actions:
  - Send email to team@readysetllc.com
  - Send Slack notification to #engineering-critical
```

**New Issues (Slack)**:
```
Name: New Issue Alert
Trigger: When a new issue is first seen
Actions:
  - Send Slack notification to #engineering-alerts
```

**Performance Degradation (Weekly)**:
```
Name: Performance Alert
Trigger: When p95 transaction duration > 5000ms
Frequency: Weekly digest
Actions:
  - Send email digest to engineering team
```

#### Step 4: Test the Integration

1. Go to the test page: `/test-sentry`
2. Click "Test Client Error"
3. Verify alert appears in Slack within 30 seconds

### Email Alerts

Email notifications are enabled by default. Configure recipients:

1. Go to **Settings** → **General Settings**
2. Under **Email** section:
   - Add team member emails
   - Configure digest frequency (real-time, hourly, daily)

## Troubleshooting

### Errors Not Appearing in Sentry

#### Check 1: DSN Configured
```bash
# Verify environment variable is set
echo $NEXT_PUBLIC_SENTRY_DSN

# Should output your DSN, not empty
```

#### Check 2: Sentry Initialized
Open browser console and type:
```javascript
console.log(window.Sentry);
// Should show Sentry object, not undefined
```

#### Check 3: Network Requests
1. Open DevTools → Network tab
2. Trigger a test error
3. Look for request to `sentry.io/api/.../envelope/`
4. Check response status (should be 200)

#### Check 4: Error Filtering
- Check `beforeSend` in config files
- Make sure your error isn't being filtered out

### Source Maps Not Working

#### Check 1: Auth Token Set
```bash
# Verify auth token is set (build time only)
echo $SENTRY_AUTH_TOKEN

# Should output your token
```

#### Check 2: Org and Project Set
```bash
echo $SENTRY_ORG
echo $SENTRY_PROJECT

# Both should match your Sentry settings
```

#### Check 3: Build Output
Look for Sentry messages during build:
```
> pnpm build

...
ℹ️ Sentry: Uploading source maps for release...
✓ Sentry: Source maps uploaded successfully
```

If you don't see this, source maps aren't being uploaded.

### High Error Volume

If you're hitting the 5K/month limit:

#### Option 1: Increase Sampling
```typescript
// Reduce to 5% of transactions
tracesSampleRate: 0.05
```

#### Option 2: Better Filtering
```typescript
beforeSend(event) {
  // Filter out more aggressively
  if (isKnownNoise(event)) return null;
  return event;
}
```

#### Option 3: Upgrade Plan
- Sentry Team: $29/month for 50K errors
- Sentry Business: $99/month for 500K errors

### Test Page Not Loading

#### Error: 404 Not Found
- Check file location: `src/app/(backend)/test-sentry/page.tsx`
- Verify URL: `http://localhost:3000/test-sentry`

#### Error: Page Disabled
- Only available in development
- Check `process.env.NODE_ENV === 'development'`

## Additional Resources

- [Sentry Next.js Docs](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry Performance Monitoring](https://docs.sentry.io/product/performance/)
- [Best Practices](https://docs.sentry.io/product/best-practices/)
- [Filtering Events](https://docs.sentry.io/platforms/javascript/configuration/filtering/)

## Support

For issues or questions:
1. Check Sentry status: [status.sentry.io](https://status.sentry.io/)
2. Sentry Discord: [discord.gg/sentry](https://discord.gg/sentry)
3. Internal team Slack: `#engineering`
