# Authentication Architecture

## Overview

This project uses **Supabase Auth** as the sole authentication provider, providing a secure, scalable, and feature-rich authentication system.

## Architecture Components

### 1. Authentication Provider

- **Supabase Auth** - Primary authentication service
- **Google OAuth** - Social login integration
- **Magic Link** - Passwordless authentication option

### 2. User Management

- **User Types**: CLIENT, ADMIN, SUPER_ADMIN, DRIVER, VENDOR, HELPDESK
- **Session Management**: JWT-based secure sessions
- **Role-based Access Control**: Middleware-protected routes

### 3. Database Integration

- **Profiles Table**: Extended user data linked to Supabase auth.users
- **Prisma ORM**: Type-safe database operations
- **Real-time Updates**: Supabase real-time subscriptions

## Key Features

### Authentication Methods

- ✅ Email/Password authentication
- ✅ Google OAuth integration
- ✅ Magic link authentication
- ✅ Secure password hashing
- ✅ Session management with JWT tokens

### Security Features

- ✅ CSRF protection
- ✅ Secure cookie handling
- ✅ Role-based authorization
- ✅ Protected API routes
- ✅ Environment variable security

### User Experience

- ✅ Seamless login/logout flows
- ✅ Persistent sessions
- ✅ Social login options
- ✅ Passwordless authentication
- ✅ Responsive authentication UI

## Environment Variables

Required environment variables for authentication:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Google OAuth (Optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

## API Endpoints

### Authentication Routes

- `/api/auth/session` - Get current session
- `/api/auth/signup` - User registration
- `/api/auth/current-user` - Get current user data
- `/api/auth/user-role` - Get user role information
- `/api/auth/redirect` - OAuth redirect handling

### User Management

- `/api/users/current-user` - Current user profile
- `/api/users/[userId]` - User CRUD operations
- `/api/users/[userId]/change-role` - Role management
- `/api/users/updateUserStatus` - Status updates

## Middleware Protection

The application uses Next.js middleware to protect routes:

```typescript
// Middleware configuration
export const config = {
  matcher: [
    "/admin/:path*",
    "/client/:path*",
    "/driver/:path*",
    "/vendor/:path*",
    "/api/protected/:path*",
  ],
};
```

## Migration History

### From NextAuth to Supabase Auth

- ✅ Removed NextAuth dependencies
- ✅ Removed Better Auth dependencies
- ✅ Updated authentication flows
- ✅ Cleaned up environment variables
- ✅ Updated documentation
- ✅ Verified functionality

## Security Considerations

1. **Environment Variables**: All sensitive keys are properly secured
2. **CSRF Protection**: Implemented header-based CSRF validation
3. **Session Security**: JWT tokens with proper expiration
4. **Role Validation**: Server-side role verification
5. **API Protection**: Middleware-based route protection

## Testing

Authentication functionality is tested through:

- Unit tests for auth components
- Integration tests for auth flows
- E2E tests for complete authentication scenarios

## Troubleshooting

### Common Issues

1. **Session not persisting**: Check Supabase configuration
2. **OAuth not working**: Verify Google OAuth setup
3. **Role access denied**: Check user role assignment
4. **API protection errors**: Verify middleware configuration

### Debug Steps

1. Check browser console for auth errors
2. Verify environment variables are set
3. Test Supabase connection
4. Review middleware logs
5. Check user role assignments

## Future Enhancements

Potential improvements:

- Multi-factor authentication (MFA)
- Advanced role permissions
- Audit logging
- Session analytics
- Enhanced security features
