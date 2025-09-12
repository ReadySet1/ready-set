// src/middleware.ts
import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

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
  console.log('🔄 [Main Middleware] Processing request for:', pathname);
  
  // Skip middleware for specific paths
  if (request.nextUrl.pathname.startsWith('/auth/callback') ||
      request.nextUrl.pathname === "/complete-profile") {
    console.log('⏭️  [Main Middleware] Skipping auth callback or complete profile');
    return NextResponse.next();
  }

  // Handle redirects for renamed or moved pages
  if (request.nextUrl.pathname === "/resources") {
    console.log('🔀 [Main Middleware] Redirecting /resources to /free-resources');
    return NextResponse.redirect(new URL('/free-resources', request.url));
  }

  try {
    // Update the user's session using Supabase middleware helper
    console.log('🔄 [Main Middleware] Updating session...');
    const response = await updateSession(request);
    
    // Check if the path is a protected route
    const { pathname } = request.nextUrl;
    const isProtectedRoute = PROTECTED_ROUTES.some(route => 
      pathname === route || pathname.startsWith(`${route}/`)
    );

    console.log('🔒 [Main Middleware] Is protected route?', isProtectedRoute, 'for path:', pathname);

    // Only check auth for protected routes
    if (isProtectedRoute) {
      console.log('🔐 [Main Middleware] Checking authentication for protected route...');
      try {
        // Create Supabase client from the middleware response
        const { createClient } = await import('@/utils/supabase/server');
        const supabase = await createClient();

        // Get the current user
        const { data: { user }, error } = await supabase.auth.getUser();

        console.log('👤 [Main Middleware] User check result:', {
          hasUser: !!user,
          userEmail: user?.email,
          error: error?.message
        });

        if (!user || error) {
          // User is not authenticated, redirect to sign-in
          const redirectUrl = new URL(`/sign-in?returnTo=${pathname}`, request.url);
          const response = NextResponse.redirect(redirectUrl);
          
          // Add tracking headers
          response.headers.set('x-auth-redirect', 'true');
          response.headers.set('x-redirect-from', pathname);
          response.headers.set('x-redirect-reason', 'unauthenticated');
          
          return response;
        }

        // Check for admin-only routes
        if (pathname.startsWith('/admin')) {
          // Get user profile to check role
          // Note: deletedAt column temporarily removed from query until database is updated
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('type')
            .eq('id', user.id)
            .single();
          
          if (profileError || !profile) {
            console.error('Error fetching user profile in middleware:', profileError);
            // On error, redirect to sign-in as a safety measure
            return NextResponse.redirect(new URL('/sign-in', request.url));
          }
          
          // TODO: Check if user account has been soft-deleted
          // Note: Soft-delete check temporarily disabled until deletedAt column is added to database
          // if (profile.deletedAt) {
          //   console.log(`Access attempt by soft-deleted user: ${user.id}`);
          //   // Sign out the user and redirect to sign-in with error message
          //   await supabase.auth.signOut();
          //   const redirectUrl = new URL('/sign-in', request.url);
          //   redirectUrl.searchParams.set('error', 'Account has been deactivated');
          //   const response = NextResponse.redirect(redirectUrl);
          //   
          //   // Add tracking headers
          //   response.headers.set('x-auth-redirect', 'true');
          //   response.headers.set('x-redirect-from', pathname);
          //   response.headers.set('x-redirect-reason', 'account-deactivated');
          //   
          //   return response;
          // }
          
          if (!['admin', 'super_admin', 'helpdesk'].includes((profile.type ?? '').toLowerCase())) {
            // User is authenticated but not authorized
            const response = NextResponse.redirect(new URL('/', request.url));
            
            // Add tracking headers
            response.headers.set('x-auth-redirect', 'true');
            response.headers.set('x-redirect-from', pathname);
            response.headers.set('x-redirect-reason', 'unauthorized');
            
            return response;
          }
        }
      } catch (error) {
        console.error('Error in auth check:', error);
        // On error, redirect to sign-in as a safety measure
        return NextResponse.redirect(new URL('/sign-in', request.url));
      }
    } else {
      console.log('🔓 [Main Middleware] Non-protected route, allowing through');
    }
    
    console.log('✅ [Main Middleware] Request processed successfully');
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