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
import { startTransaction } from '@/lib/monitoring/sentry';

const transaction = startTransaction('calculate_mileage', 'db.query');
try {
  const mileage = await calculateShiftMileage(shiftId);
  return mileage;
} finally {
  transaction?.finish();
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

1. Go to **Settings** → **Integrations**
2. Find and configure **Slack**
3. Select channels for different alert levels:
   - `#engineering-critical` - Fatal errors
   - `#engineering-alerts` - High priority
   - `#engineering-monitoring` - All issues

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
