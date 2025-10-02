// src/middleware.ts
import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";
import { logger } from "@/utils/logger";

// Protected routes that require session refresh
const PROTECTED_ROUTES = [
  '/admin',
  '/admin/catering-orders',
  '/admin/users',
  '/admin/job-applications',
  '/dashboard',
  '/client',
  '/driver',
  '/vendor',
  '/helpdesk',
  '/profile'
];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Skip middleware for specific paths
  if (request.nextUrl.pathname.startsWith('/auth/callback') ||
      request.nextUrl.pathname === "/complete-profile") {
    return NextResponse.next();
  }

  // Handle redirects for renamed or moved pages
  if (request.nextUrl.pathname === "/resources") {
    return NextResponse.redirect(new URL('/free-resources', request.url));
  }

  try {
    // Update the user's session using Supabase middleware helper
    const response = await updateSession(request);

    // Check if the path is a protected route
    const { pathname } = request.nextUrl;
    const isProtectedRoute = PROTECTED_ROUTES.some(route =>
      pathname === route || pathname.startsWith(`${route}/`)
    );

    // Only check auth for protected routes
    if (isProtectedRoute) {
      try {
        // Create Supabase client from the middleware response
        const { createClient } = await import('@/utils/supabase/server');
        const supabase = await createClient();

        // Get the current user
        const { data: { user }, error } = await supabase.auth.getUser();

        // Only log authentication failures for debugging
        if (!user || error) {
          console.log('❌ [Middleware] Auth failed for protected route:', pathname, error?.message);

          const redirectUrl = new URL(`/sign-in?returnTo=${pathname}`, request.url);
          const response = NextResponse.redirect(redirectUrl);

          // Add tracking headers
          response.headers.set('x-auth-redirect', 'true');
          response.headers.set('x-redirect-from', pathname);
          response.headers.set('x-redirect-reason', 'unauthenticated');

          return response;
        }

        // Enhanced session validation using session manager (disabled for server-side)
        // Note: Session fingerprinting requires browser environment, so we skip enhanced validation in middleware
        // This prevents the "Session fingerprinting requires browser environment" error

        // Check for admin-only routes
        if (pathname.startsWith('/admin')) {
          // Get user profile to check role - use maybeSingle() to handle missing profiles
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('type')
            .eq('id', user.id)
            .maybeSingle();

          // Log profile lookup errors (except for missing profile which is handled below)
          if (profileError) {
            console.error('Middleware: Error fetching user profile:', profileError);
          }

          if (!profile || !['admin', 'super_admin', 'helpdesk'].includes((profile.type ?? '').toLowerCase())) {
            // User is authenticated but not authorized
            const response = NextResponse.redirect(new URL('/', request.url));

            // Add tracking headers
            response.headers.set('x-auth-redirect', 'true');
            response.headers.set('x-redirect-from', pathname);
            response.headers.set('x-redirect-reason', 'unauthorized');

            return response;
          }
        }

        // Add session validation headers for debugging
        response.headers.set('x-session-validated', 'true');
        response.headers.set('x-session-timestamp', new Date().toISOString());

      } catch (error) {
        console.error('Error in enhanced auth check:', error);
        // On error, redirect to sign-in as a safety measure
        return NextResponse.redirect(new URL('/sign-in', request.url));
      }
    }

    return response;
  } catch (error) {
    console.error('Error in middleware:', error);
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
     * - public folder (images, fonts, etc.)
     * - api routes
     */
    '/((?!_next/static|_next/image|favicon.ico|images|fonts|pdf|robots.txt|api).*)',
  ],
};