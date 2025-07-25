// src/middleware.ts
import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";
import { AuthErrorType, AuthError } from "@/types/auth";

// Enhanced error creation utility
const createAuthError = (
  type: AuthErrorType,
  message: string,
  retryable: boolean = true,
  details?: any
): AuthError => {
  return {
    type,
    message,
    retryable,
    timestamp: new Date(),
    details,
  };
};

// Protected admin routes that require authentication
const PROTECTED_ROUTES = [
  '/admin',
  '/admin/catering-orders',
  '/admin/users',
  '/admin/job-applications',
  '/dashboard',
  '/profile', // Add profile to protected routes
  '/client', // Add client dashboard to protected routes
];

// Routes that require specific admin roles
const ADMIN_ROUTES = [
  '/admin',
  '/admin/catering-orders',
  '/admin/users',
  '/admin/job-applications',
];

// NEW: Enhanced role fetching with retry logic
const fetchUserRoleWithRetry = async (supabase: any, userId: string, maxRetries: number = 3) => {
  const baseDelay = 500; // 500ms base delay
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Middleware] Fetching user role for user ${userId} (attempt ${attempt}/${maxRetries})`);
      
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('type')
        .eq('id', userId)
        .single();
        
      if (error) {
        console.error(`[Middleware] Error fetching profile (attempt ${attempt}):`, error);
        
        if (error.code === 'PGRST116') {
          // No rows returned - profile doesn't exist yet
          console.log(`[Middleware] No profile found for user ${userId}, waiting before retry...`);
          
          if (attempt === maxRetries) {
            return null; // Profile doesn't exist after all retries
          }
          
          // Wait before retry with exponential backoff
          const delay = baseDelay * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        throw error;
      }
      
      console.log('[Middleware] Profile fetched successfully:', profile);
      return profile?.type || null;
    } catch (error) {
      console.error(`[Middleware] Failed to fetch profile (attempt ${attempt}):`, error);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retry with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  return null;
};

// Enhanced authentication validation
const validateUserAuthentication = async (supabase: any, requestId: string) => {
  const startTime = Date.now();
  
  try {
    console.log(`[Middleware] [${requestId}] Starting authentication validation`);
    
    // Get the current user with enhanced error handling
    const { data: { user }, error } = await supabase.auth.getUser();
    
    const duration = Date.now() - startTime;
    console.log(`[Middleware] [${requestId}] Auth check completed in ${duration}ms:`, {
      hasUser: !!user,
      userId: user?.id,
      error: error?.message,
      duration,
    });

    if (error) {
      console.error(`[Middleware] [${requestId}] Authentication error:`, error);
      throw createAuthError(
        AuthErrorType.INVALID_TOKEN,
        "Authentication failed",
        true,
        error
      );
    }

    if (!user) {
      console.log(`[Middleware] [${requestId}] No authenticated user found`);
      throw createAuthError(
        AuthErrorType.USER_NOT_FOUND,
        "No authenticated user found",
        false
      );
    }

    return { user, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Middleware] [${requestId}] Authentication validation failed after ${duration}ms:`, error);
    throw error;
  }
};

// NEW: Enhanced role validation for admin routes with retry logic
const validateUserRole = async (supabase: any, user: any, pathname: string, requestId: string) => {
  const startTime = Date.now();
  
  try {
    console.log(`[Middleware] [${requestId}] Validating user role for path: ${pathname}`);
    
    // Check if the current path requires admin privileges
    const isAdminRoute = ADMIN_ROUTES.some(route => 
      pathname === route || pathname.startsWith(`${route}/`)
    );
    
    if (!isAdminRoute) {
      console.log(`[Middleware] [${requestId}] Route does not require admin privileges`);
      return { isValid: true, role: 'user' };
    }
    
    // NEW: Use enhanced role fetching with retry logic
    const userRole = await fetchUserRoleWithRetry(supabase, user.id);
    
    const duration = Date.now() - startTime;
    console.log(`[Middleware] [${requestId}] Role validation completed in ${duration}ms:`, {
      userRole,
      duration,
    });
    
    if (!userRole) {
      console.log(`[Middleware] [${requestId}] No role found for user`);
      throw createAuthError(
        AuthErrorType.USER_NOT_FOUND,
        "User role not found",
        false
      );
    }
    
    // Check if user has admin privileges
    const hasAdminPrivileges = ['admin', 'super_admin', 'helpdesk'].includes(
      userRole.toLowerCase()
    );
    
    if (!hasAdminPrivileges) {
      console.log(`[Middleware] [${requestId}] User ${user.id} (type: ${userRole}) attempted to access admin route`);
      throw createAuthError(
        AuthErrorType.USER_NOT_FOUND,
        "Insufficient privileges",
        false
      );
    }
    
    console.log(`[Middleware] [${requestId}] User role validated successfully: ${userRole}`);
    return { isValid: true, role: userRole };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Middleware] [${requestId}] Role validation failed after ${duration}ms:`, error);
    throw error;
  }
};

// NEW: Enhanced response creation with role caching headers
const createRedirectResponse = (
  url: string, 
  reason: string, 
  requestId: string,
  originalPath?: string,
  userRole?: string
) => {
  const response = NextResponse.redirect(url);
  
  // Add enhanced tracking headers
  response.headers.set('x-auth-redirect', 'true');
  response.headers.set('x-redirect-reason', reason);
  response.headers.set('x-request-id', requestId);
  if (originalPath) {
    response.headers.set('x-redirect-from', originalPath);
  }
  
  // NEW: Add role caching headers
  if (userRole) {
    response.headers.set('x-user-role', userRole);
    response.headers.set('x-role-cache-timestamp', Date.now().toString());
  }
  
  return response;
};

// NEW: Enhanced response creation with role validation headers
const createValidatedResponse = (
  response: NextResponse,
  userRole: string,
  requestId: string
) => {
  // Add role validation headers
  response.headers.set('x-user-role', userRole);
  response.headers.set('x-role-validated', 'true');
  response.headers.set('x-role-validation-timestamp', Date.now().toString());
  response.headers.set('x-request-id', requestId);
  
  return response;
};

export async function middleware(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  const startTime = Date.now();
  const { pathname } = request.nextUrl;
  
  console.log(`[Middleware] [${requestId}] Processing request for path: ${pathname}`);
  
  // Skip middleware for specific paths
  if (request.nextUrl.pathname.startsWith('/auth/callback') ||
      request.nextUrl.pathname === "/complete-profile" ||
      request.nextUrl.pathname.startsWith('/_next') ||
      request.nextUrl.pathname.startsWith('/api') ||
      request.nextUrl.pathname === '/favicon.ico') {
    console.log(`[Middleware] [${requestId}] Skipping middleware for path: ${pathname}`);
    return NextResponse.next();
  }

  // Handle redirects for renamed or moved pages
  if (request.nextUrl.pathname === "/resources") {
    console.log(`[Middleware] [${requestId}] Redirecting /resources to /free-resources`);
    return NextResponse.redirect(new URL('/free-resources', request.url));
  }

  try {
    // Update the user's session using Supabase middleware helper
    const response = await updateSession(request);
    
    // Check if the path is a protected route
    const isProtectedRoute = PROTECTED_ROUTES.some(route => 
      pathname === route || pathname.startsWith(`${route}/`)
    );

    console.log(`[Middleware] [${requestId}] Route protection check:`, {
      pathname,
      isProtectedRoute,
      duration: Date.now() - startTime,
    });

    // Only check auth for protected routes
    if (isProtectedRoute) {
      try {
        // Create Supabase client from the middleware response
        const { createClient } = await import('@/utils/supabase/server');
        const supabase = await createClient();

        // Validate user authentication
        const { user } = await validateUserAuthentication(supabase, requestId);
        
        // NEW: Check for cached role in cookies first
        const cachedRole = request.cookies.get('user-role')?.value;
        let userRole = cachedRole;
        
        if (cachedRole) {
          console.log(`[Middleware] [${requestId}] Using cached role: ${cachedRole}`);
        } else {
          // Validate user role for admin routes
          const { isValid, role } = await validateUserRole(supabase, user, pathname, requestId);
          
          if (!isValid) {
            console.log(`[Middleware] [${requestId}] User validation failed, redirecting to home`);
            return createRedirectResponse(
              new URL('/', request.url).toString(),
              'unauthorized',
              requestId,
              pathname
            );
          }
          
          userRole = role;
          
          // NEW: Cache the role in a cookie for faster access
          if (userRole) {
            response.cookies.set('user-role', userRole, {
              httpOnly: false,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              maxAge: 60 * 60 * 24 * 7, // 7 days
            });
          }
        }
        
        const totalDuration = Date.now() - startTime;
        console.log(`[Middleware] [${requestId}] Authentication successful in ${totalDuration}ms:`, {
          userId: user.id,
          role: userRole,
          pathname,
        });
        
        // NEW: Return response with role validation headers
        return createValidatedResponse(response, userRole || 'client', requestId);
        
      } catch (error) {
        const totalDuration = Date.now() - startTime;
        console.error(`[Middleware] [${requestId}] Error in auth check after ${totalDuration}ms:`, error);
        
        // Handle different types of authentication errors
        if (error instanceof Error && 'type' in error) {
          const authError = error as unknown as AuthError;
          
          if (authError.type === AuthErrorType.USER_NOT_FOUND) {
            // User is not authenticated, redirect to sign-in
            const redirectUrl = new URL(`/sign-in?returnTo=${pathname}`, request.url);
            return createRedirectResponse(
              redirectUrl.toString(),
              'unauthenticated',
              requestId,
              pathname
            );
          }
          
          if (authError.type === AuthErrorType.INVALID_TOKEN) {
            // Token is invalid, redirect to sign-in
            const redirectUrl = new URL(`/sign-in?returnTo=${pathname}`, request.url);
            return createRedirectResponse(
              redirectUrl.toString(),
              'invalid_token',
              requestId,
              pathname
            );
          }
          
          if (authError.type === AuthErrorType.ROLE_FETCH_FAILED) {
            // Could not fetch user role, redirect to sign-in as safety measure
            const redirectUrl = new URL(`/sign-in?returnTo=${pathname}`, request.url);
            return createRedirectResponse(
              redirectUrl.toString(),
              'role_fetch_failed',
              requestId,
              pathname
            );
          }
        }
        
        // Generic error handling - redirect to sign-in as a safety measure
        console.log(`[Middleware] [${requestId}] Generic error, redirecting to sign-in`);
        return createRedirectResponse(
          new URL('/sign-in', request.url).toString(),
          'error',
          requestId,
          pathname
        );
      }
    }
    
    const totalDuration = Date.now() - startTime;
    console.log(`[Middleware] [${requestId}] Middleware completed successfully in ${totalDuration}ms`);
    
    return response;
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    console.error(`[Middleware] [${requestId}] Error in middleware after ${totalDuration}ms:`, error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes
     */
    '/((?!_next/static|_next/image|favicon.ico|public|api).*)',
  ],
};