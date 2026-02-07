# Authentication System Overview

Ready Set uses **Supabase Auth** with enhanced session management for secure authentication.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Side                              │
├─────────────────────────────────────────────────────────────────┤
│  UserContext (useUser hook)                                      │
│       │                                                          │
│       ├── EnhancedSessionManager                                 │
│       │       ├── Session Fingerprinting                         │
│       │       ├── Cross-Tab Sync (BroadcastChannel)              │
│       │       └── Session Validation                             │
│       │                                                          │
│       └── TokenRefreshService                                    │
│               ├── Automatic Refresh (10 min)                     │
│               ├── Retry with Backoff                             │
│               └── Queue Management                               │
│                                                                  │
│  Supabase Client (Browser)                                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Server Side                              │
├─────────────────────────────────────────────────────────────────┤
│  Middleware (Route Protection)                                   │
│       └── Role-based access control                              │
│                                                                  │
│  Supabase Client (Server)                                        │
│       └── SSR-safe client creation                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Components

### 1. UserContext & useUser Hook

**Location**: `src/contexts/UserContext.tsx`

The main interface for authentication in React components.

```typescript
import { useUser } from '@/contexts/UserContext';

function MyComponent() {
  const {
    user,           // Supabase User object
    userRole,       // UserType enum (CLIENT, ADMIN, DRIVER, etc.)
    session,        // Supabase Session
    isLoading,      // Initial auth check in progress
    error,          // Any auth error message
    logout,         // Sign out function
    refreshToken,   // Manually refresh the token
  } = useUser();

  if (isLoading) return <Loading />;
  if (!user) return <SignInPrompt />;

  return <Dashboard user={user} role={userRole} />;
}
```

### 2. Enhanced Session Manager

**Location**: `src/lib/auth/session-manager.ts`

Provides enhanced session features beyond standard Supabase auth:

- **Session Fingerprinting**: Validates session integrity
- **Cross-Tab Synchronization**: Keeps all tabs in sync
- **Suspicious Activity Detection**: Detects potential session hijacking

### 3. Token Refresh Service

**Location**: `src/lib/auth/token-refresh-service.ts`

Handles automatic token renewal:

- Refreshes tokens ~10 minutes before expiry
- Queues concurrent refresh requests
- Implements retry with exponential backoff

### 4. Supabase Clients

**Browser Client**: `src/utils/supabase/client.ts`
- Singleton pattern
- Used in client components

**Server Client**: `src/utils/supabase/server.ts`
- SSR-safe
- Creates fresh client per request

---

## Using the useUser Hook

### Basic Usage

```typescript
import { useUser } from '@/contexts/UserContext';

function ProfilePage() {
  const { user, userRole, isLoading } = useUser();

  if (isLoading) {
    return <Spinner />;
  }

  if (!user) {
    redirect('/sign-in');
    return null;
  }

  return (
    <div>
      <h1>Welcome, {user.email}</h1>
      <p>Role: {userRole}</p>
    </div>
  );
}
```

### Available Properties

| Property | Type | Description |
|----------|------|-------------|
| `user` | `User \| null` | Supabase user object |
| `userRole` | `UserType \| null` | User's role (CLIENT, ADMIN, etc.) |
| `session` | `Session \| null` | Supabase session |
| `isLoading` | `boolean` | True during initial auth check |
| `isAuthenticating` | `boolean` | True during active auth operations |
| `error` | `string \| null` | Auth error message |
| `authState` | `AuthState` | Full auth state object |
| `authProgress` | `object` | Current auth operation progress |

### Available Methods

| Method | Description |
|--------|-------------|
| `logout()` | Sign out the user |
| `refreshToken()` | Manually refresh the auth token |
| `refreshUserData()` | Refresh user profile from database |
| `clearAuthError()` | Clear any auth error |
| `updateActivity()` | Update last activity timestamp |
| `getActiveSessions()` | Get all active sessions (for session management) |
| `revokeSession(id)` | Revoke a specific session |

---

## User Roles

```typescript
enum UserType {
  CLIENT = 'client',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
  DRIVER = 'driver',
  VENDOR = 'vendor',
  HELPDESK = 'helpdesk',
}
```

### Checking Roles

```typescript
const { userRole } = useUser();

// Check for specific role
if (userRole === 'admin') {
  // Admin-only logic
}

// Check for multiple roles
const isStaff = ['admin', 'super_admin', 'helpdesk'].includes(userRole);
```

---

## Route Protection

### Middleware-Based Protection

**Location**: `src/middleware/routeProtection.ts`

Routes are protected by role via middleware:

| Route Pattern | Allowed Roles |
|---------------|---------------|
| `/admin/*` | admin, super_admin |
| `/driver/*` | driver |
| `/client/*` | client |
| `/helpdesk/*` | helpdesk, admin |
| `/vendor/*` | vendor |

### Client-Side Guards

For additional protection in components:

```typescript
import { useUser } from '@/contexts/UserContext';
import { redirect } from 'next/navigation';

function AdminPage() {
  const { userRole, isLoading } = useUser();

  if (isLoading) return <Loading />;

  if (userRole !== 'admin' && userRole !== 'super_admin') {
    redirect('/unauthorized');
    return null;
  }

  return <AdminDashboard />;
}
```

---

## Session Management Features

### Session Fingerprinting

Sessions are validated against a fingerprint that includes:
- User agent
- Screen resolution
- Timezone
- Language
- Platform

If the fingerprint changes significantly, the session may be invalidated as a security measure.

### Cross-Tab Synchronization

When a user logs out in one tab, all other tabs are notified via `BroadcastChannel`:

```typescript
// Automatically handled - all tabs sync on:
// - Login
// - Logout
// - Token refresh
// - Session expiration
```

### Token Refresh

Tokens are automatically refreshed:
- 10 minutes before expiry (background refresh)
- Immediately if expired when needed
- With retry logic on network failures

---

## Authentication Flow

### Login Flow

```
1. User submits credentials
2. Supabase Auth validates
3. Session created
4. EnhancedSessionManager initializes
   - Generates fingerprint
   - Stores session
   - Starts refresh timer
5. UserContext updates
   - user, session, userRole populated
   - isLoading → false
6. UI renders authenticated state
```

### Logout Flow

```
1. User clicks logout
2. logout() called
3. TokenRefreshService stops
4. EnhancedSessionManager clears session
5. Supabase signOut() called
6. BroadcastChannel notifies other tabs
7. All auth state cleared
8. Redirect to home/login
```

### Session Recovery

On page load/refresh:

```
1. Check for session cookies (fast path)
2. If found, set minimal user immediately
3. Verify with Supabase getSession()
4. Fetch full user profile
5. Initialize EnhancedSessionManager
6. Start TokenRefreshService
```

---

## Server-Side Authentication

### API Routes

```typescript
import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // User is authenticated
  return Response.json({ data: '...' });
}
```

### Server Components

```typescript
import { createClient } from '@/utils/supabase/server';

export default async function ServerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/sign-in');
  }

  return <div>Hello, {user.email}</div>;
}
```

---

## Error Handling

### Auth Error Types

```typescript
enum AuthErrorType {
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  SESSION_REVOKED = 'SESSION_REVOKED',
  INVALID_SESSION = 'INVALID_SESSION',
  REFRESH_FAILED = 'REFRESH_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
}
```

### Handling Auth Errors

```typescript
const { error, clearAuthError } = useUser();

if (error) {
  return (
    <Alert>
      {error}
      <Button onClick={clearAuthError}>Dismiss</Button>
    </Alert>
  );
}
```

---

## Best Practices

### Do's

- Always check `isLoading` before rendering auth-dependent UI
- Use `useUser()` hook for client-side auth state
- Use `createClient()` from `server.ts` for server-side auth
- Handle the unauthenticated state gracefully

### Don'ts

- Don't call `supabase.auth.getSession()` directly in components
- Don't store sensitive auth data in localStorage manually
- Don't skip the `isLoading` check
- Don't access `user` without null checks

---

## Debugging Auth Issues

### Common Issues

**"Auth session missing" in console**
- Normal for unauthenticated users
- Not an error, just informational

**User flashes as logged out then logged in**
- Check if `isLoading` is being handled properly
- May need to wait for session recovery

**Token refresh failing**
- Check network connectivity
- Verify Supabase project is active
- Check for expired refresh token

### Debug Logging

Auth events are logged via `authLogger`:

```typescript
import { authLogger } from '@/utils/logger';

// These are automatically logged by the auth system:
// - Session initialization
// - Token refresh attempts
// - Cross-tab sync events
// - Suspicious activity detection
```

---

## Related Files

| File | Purpose |
|------|---------|
| `src/contexts/UserContext.tsx` | Main auth context and useUser hook |
| `src/lib/auth/session-manager.ts` | Enhanced session management |
| `src/lib/auth/token-refresh-service.ts` | Automatic token renewal |
| `src/lib/auth/api-interceptor.ts` | API request authentication |
| `src/utils/supabase/client.ts` | Browser Supabase client |
| `src/utils/supabase/server.ts` | Server Supabase client |
| `src/middleware/routeProtection.ts` | Route access control |
| `src/types/auth.ts` | Auth type definitions |
