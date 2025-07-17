// src/lib/auth-middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/utils/prismaDB';
import { UserType, UserStatus } from '@/types/prisma';

export interface AuthContext {
  user: {
    id: string;
    email: string;
    type: UserType;
  };
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isHelpdesk: boolean;
}

export interface AuthOptions {
  requireAuth?: boolean;
  allowedRoles?: UserType[];
  allowSelf?: boolean; // Allow access if user is accessing their own resource
  resourceUserIdExtractor?: (request: NextRequest) => string | null;
  enableCSRF?: boolean; // Enable CSRF protection for state-changing operations
}

/**
 * Add comprehensive security headers to API responses
 */
export function addSecurityHeaders(response: NextResponse): NextResponse {
  // Content Security Policy
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://checkout.stripe.com https://cdn.jsdelivr.net; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: https: blob:; " +
    "connect-src 'self' https://api.stripe.com https://uploads.stripe.com wss:; " +
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com;"
  );

  // HTTP Strict Transport Security (HSTS)
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );

  // X-Frame-Options to prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY');

  // X-Content-Type-Options to prevent MIME sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // Referrer Policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // X-XSS-Protection (legacy browsers)
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // Permissions Policy (formerly Feature Policy)
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  );

  // CORS headers for API endpoints
  response.headers.set('Access-Control-Allow-Origin', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');

  return response;
}

/**
 * CSRF Token validation for state-changing operations
 */
export function validateCSRFToken(request: NextRequest): boolean {
  // Only validate CSRF for state-changing methods
  const method = request.method.toUpperCase();
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    return true; // No CSRF validation needed for read operations
  }

  const csrfHeader = request.headers.get('X-CSRF-Token');
  const sessionCookie = request.cookies.get('next-auth.csrf-token')?.value;
  
  // For now, implement a simple header-based CSRF protection
  // In production, you should implement proper CSRF tokens
  const expectedOrigin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  // Validate origin or referer matches expected domain
  if (origin && origin !== expectedOrigin) {
    return false;
  }
  
  if (!origin && referer && !referer.startsWith(expectedOrigin)) {
    return false;
  }

  return true;
}

/**
 * Standardized authentication middleware for API routes
 * This ensures consistent security patterns across all endpoints
 */
export async function withAuth(
  request: NextRequest,
  options: AuthOptions = {}
): Promise<{ success: true; context: AuthContext } | { success: false; response: NextResponse }> {
  const {
    requireAuth = true,
    allowedRoles = [],
    allowSelf = false,
    resourceUserIdExtractor,
    enableCSRF = true
  } = options;

  try {
    // CSRF Protection for state-changing operations
    if (enableCSRF && !validateCSRFToken(request)) {
      const response = NextResponse.json(
        { error: 'CSRF validation failed. Invalid origin or missing CSRF token.' },
        { status: 403 }
      );
      return { success: false, response: addSecurityHeaders(response) };
    }

    // Create Supabase client
    const supabase = await createClient();
    
    // Get authentication header or session
    let token: string | null = null;
    const authHeader = request.headers.get('authorization');
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const parts = authHeader.split(' ');
      token = parts.length > 1 ? parts[1] : null;
    }

    // Get user from Supabase
    const { data: { user }, error: authError } = token 
      ? await supabase.auth.getUser(token)
      : await supabase.auth.getUser();

    // Check if authentication is required
    if (requireAuth && (authError || !user)) {
      return {
        success: false,
        response: NextResponse.json(
          { error: 'Unauthorized - Authentication required' },
          { status: 401 }
        )
      };
    }

    // If no authentication required and no user, return early
    if (!requireAuth && (!user || authError)) {
      return {
        success: true,
        context: {
          user: { id: '', email: '', type: UserType.CLIENT },
          isAdmin: false,
          isSuperAdmin: false,
          isHelpdesk: false
        }
      };
    }

    // User is authenticated, get their profile
    const userProfile = await prisma.profile.findUnique({
      where: { id: user!.id },
      select: { 
        type: true,
        email: true,
        status: true
      }
    });

    if (!userProfile) {
      return {
        success: false,
        response: NextResponse.json(
          { error: 'User profile not found' },
          { status: 404 }
        )
      };
    }

    // Check if user account is active  
    if (userProfile.status === UserStatus.DELETED) {
      return {
        success: false,
        response: NextResponse.json(
          { error: 'Account deleted' },
          { status: 403 }
        )
      };
    }

    // Create auth context
    const isAdmin = userProfile.type === UserType.ADMIN;
    const isSuperAdmin = userProfile.type === UserType.SUPER_ADMIN;
    const isHelpdesk = userProfile.type === UserType.HELPDESK;

    const context: AuthContext = {
      user: {
        id: user!.id,
        email: user!.email || userProfile.email || '',
        type: userProfile.type
      },
      isAdmin,
      isSuperAdmin,
      isHelpdesk
    };

    // Check role-based permissions
    if (allowedRoles.length > 0) {
      const hasRequiredRole = allowedRoles.includes(userProfile.type);
      const isPrivilegedUser = isAdmin || isSuperAdmin || isHelpdesk;
      
      if (!hasRequiredRole && !isPrivilegedUser) {
        return {
          success: false,
          response: NextResponse.json(
            { error: 'Forbidden - Insufficient permissions' },
            { status: 403 }
          )
        };
      }
    }

    // Check self-access permissions
    if (allowSelf && resourceUserIdExtractor) {
      const resourceUserId = resourceUserIdExtractor(request);
      if (resourceUserId && resourceUserId === user!.id) {
        // User is accessing their own resource, allow access
        return { success: true, context };
      }
    }

    // If allowedRoles is specified and user doesn't have the role, check if they're accessing their own resource
    if (allowedRoles.length > 0 && allowSelf && resourceUserIdExtractor) {
      const resourceUserId = resourceUserIdExtractor(request);
      const hasRequiredRole = allowedRoles.includes(userProfile.type);
      const isPrivilegedUser = isAdmin || isSuperAdmin || isHelpdesk;
      const isSelfAccess = resourceUserId === user!.id;

      if (!hasRequiredRole && !isPrivilegedUser && !isSelfAccess) {
        return {
          success: false,
          response: NextResponse.json(
            { error: 'Forbidden - Insufficient permissions' },
            { status: 403 }
          )
        };
      }
    }

    return { success: true, context };

  } catch (error) {
    console.error('Authentication middleware error:', error);
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Internal authentication error' },
        { status: 500 }
      )
    };
  }
}

/**
 * Helper function to extract user ID from URL path
 */
export function extractUserIdFromPath(request: NextRequest): string | null {
  const url = new URL(request.url);
  const pathSegments = url.pathname.split('/');
  
  // Look for patterns like /api/users/[userId] or /api/user/[userId]
  const userIndex = pathSegments.findIndex(segment => 
    segment === 'users' || segment === 'user'
  );
  
  if (userIndex !== -1 && pathSegments[userIndex + 1]) {
    return pathSegments[userIndex + 1];
  }
  
  return null;
}

/**
 * Helper function to extract entity ID from query parameters
 */
export function extractEntityIdFromQuery(request: NextRequest, paramName: string = 'entityId'): string | null {
  const { searchParams } = new URL(request.url);
  return searchParams.get(paramName) || null;
}

/**
 * Wrapper function for API routes that need authentication
 */
export function requireAuth(options: AuthOptions = {}) {
  return async function(
    request: NextRequest,
    handler: (request: NextRequest, context: AuthContext) => Promise<NextResponse>
  ): Promise<NextResponse> {
    const authResult = await withAuth(request, options);
    
    if (!authResult.success) {
      return authResult.response;
    }
    
    return handler(request, authResult.context);
  };
} 