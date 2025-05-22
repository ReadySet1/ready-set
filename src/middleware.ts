// src/middleware.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { highlightMiddleware } from '@highlight-run/next/server';

// Protected admin routes that require authentication
const PROTECTED_ROUTES = [
  '/admin',
  '/admin/catering-orders',
  '/admin/users',
  '/admin/job-applications',
  '/dashboard'
];

export async function middleware(request: NextRequest) {
  try {
    // Skip middleware for callback route to avoid cookie issues during auth flow
    if (request.nextUrl.pathname.includes('/auth/callback')) {
      return NextResponse.next();
    }

    let response = NextResponse.next({
      request: {
        headers: request.headers,
      },
    });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            response.cookies.set(name, value, options);
          },
          remove(name: string, options: CookieOptions) {
            const { path, domain } = options;
            response.cookies.delete({ name, path, domain });
          },
        },
      }
    );

    // Refresh session if expired - required for server components
    const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
    
    const { pathname } = request.nextUrl;
    
    // Define protected routes that require authentication
    const isProtectedRoute = 
      PROTECTED_ROUTES.some(route => pathname.startsWith(route)) ||
      pathname.startsWith('/client') || 
      pathname.startsWith('/vendor') || 
      pathname.startsWith('/driver') || 
      pathname.startsWith('/helpdesk');
    
    if (isProtectedRoute) {
      try {
        // Check if user is authenticated (session already fetched above)
        if (userError || !currentUser) {
          // User is not authenticated, redirect to sign-in
          const redirectUrl = new URL(`/sign-in?returnTo=${pathname}`, request.url);
          return NextResponse.redirect(redirectUrl);
        }
        
        // For admin routes, check if user has appropriate role
        if (pathname.startsWith('/admin')) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('type')
            .eq('id', currentUser.id)
            .single();
          
          if (!profile || !['admin', 'super_admin', 'helpdesk'].includes((profile.type ?? '').toLowerCase())) {
            // User is authenticated but not authorized for admin
            return NextResponse.redirect(new URL('/', request.url));
          }
        }
      } catch (error) {
        console.error('Error in auth check:', error);
        // On error, redirect to sign-in as a safety measure
        return NextResponse.redirect(new URL('/sign-in', request.url));
      }
    }

    // Apply Highlight.run middleware separately
    try {
      // Highlight middleware wants to be called with request only
      await highlightMiddleware(request);
    } catch (e) {
      console.error('Highlight middleware error:', e);
    }

    return response;
  } catch (error) {
    console.error("Middleware global error:", error);
    return NextResponse.next();
  }
}

// Only run middleware on auth-related paths and protected areas
export const config = {
  matcher: [
    '/auth/:path*',
    '/client/:path*',
    '/admin/:path*',
    '/vendor/:path*',
    '/driver/:path*',
    '/helpdesk/:path*',
  ],
}