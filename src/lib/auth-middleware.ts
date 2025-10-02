// Auth middleware for API routes
// Simplified implementation - you'll need to adapt this to your actual auth system

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserRole } from '@/lib/auth';

export interface AuthContext {
  user: {
    id: string;
    email: string;
    type: 'DRIVER' | 'ADMIN' | 'SUPER_ADMIN' | 'HELPDESK' | 'CLIENT';
    driverId?: string;
  };
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  isHelpdesk?: boolean;
}

export interface AuthMiddlewareOptions {
  allowedRoles?: string[];
  requireAuth?: boolean;
}

export interface AuthResult {
  success: boolean;
  response?: NextResponse;
  context: AuthContext;
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
  options: AuthMiddlewareOptions = {}
): Promise<AuthResult> {
  const { allowedRoles = [], requireAuth = true } = options;

  try {
    // Create Supabase client for server-side authentication
    const supabase = await createClient();
    
    // Check for Authorization header first (for API calls with Bearer token)
    const authHeader = request.headers.get('authorization');
    let user = null;
    let authError = null;
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const result = await supabase.auth.getUser(token);
      user = result.data.user;
      authError = result.error;
    } else {
      // Fallback to session-based authentication (cookies)
      const result = await supabase.auth.getUser();
      user = result.data.user;
      authError = result.error;
    }

    if (authError || !user) {
      if (requireAuth) {
        console.error('❌ [Auth Middleware] Authentication failed:', {
          authError: authError?.message,
          hasUser: !!user,
          authHeader: authHeader ? 'present' : 'missing'
        });
        return {
          success: false,
          response: NextResponse.json(
            { error: 'Authentication required' },
            { status: 401 }
          ),
          context: {} as AuthContext
        };
      }

      // If auth is not required and user is not found, return success with empty context
      console.log('ℹ️ [Auth Middleware] No authentication required, proceeding without user context');
      return {
        success: true,
        context: {} as AuthContext
      };
    }

    console.log('✅ [Auth Middleware] User authenticated:', {
      id: user.id,
      email: user.email,
      authMethod: authHeader ? 'Bearer token' : 'Session cookie'
    });

    // Get the user's role from the profiles table
    console.log('🔍 [Auth Middleware] Getting user role for user ID:', user.id);
    const userRole = await getUserRole(user.id);

    if (!userRole && requireAuth) {
      console.error('❌ [Auth Middleware] User role not found for user ID:', user.id);
      return {
        success: false,
        response: NextResponse.json(
          { error: 'User role not found' },
          { status: 403 }
        ),
        context: {} as AuthContext
      };
    }

    const userType = userRole as 'DRIVER' | 'ADMIN' | 'SUPER_ADMIN' | 'HELPDESK' | 'CLIENT';

    console.log('🔍 [Auth Middleware] User role:', userType, 'Allowed roles:', allowedRoles);

    // Check role permissions
    if (allowedRoles.length > 0 && userType && !allowedRoles.includes(userType)) {
      console.error('❌ [Auth Middleware] Insufficient permissions for user type:', userType, 'Allowed roles:', allowedRoles);
      return {
        success: false,
        response: NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        ),
        context: {} as AuthContext
      };
    }

    console.log('✅ [Auth Middleware] Access granted for user type:', userType);

    // Create auth context with real user data
    const authUser = {
      id: user.id,
      email: user.email || '',
      type: userType,
      driverId: userType === 'DRIVER' ? user.id : undefined
    };

    return {
      success: true,
      context: { 
        user: authUser,
        isAdmin: ['ADMIN', 'SUPER_ADMIN'].includes(userType),
        isSuperAdmin: ['SUPER_ADMIN'].includes(userType),
        isHelpdesk: ['HELPDESK'].includes(userType)
      }
    };
  } catch (error) {
    console.error('Auth middleware error:', error);
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Authentication error' },
        { status: 500 }
      ),
      context: {} as AuthContext
    };
  }
}

// Security headers utility
export function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Content-Security-Policy', "default-src 'self'");
  return response;
}