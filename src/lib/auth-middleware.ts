// Auth middleware for API routes
// Simplified implementation - you'll need to adapt this to your actual auth system

import { NextRequest, NextResponse } from 'next/server';

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
    // Get session from request headers or cookies
    // This is a simplified implementation - adapt to your auth system
    const authHeader = request.headers.get('authorization');
    const sessionCookie = request.cookies.get('session')?.value;

    if (!authHeader && !sessionCookie && requireAuth) {
      return {
        success: false,
        response: NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        ),
        context: {} as AuthContext
      };
    }

    // Mock user data - replace with actual session validation
    const mockUser = {
      id: 'user-123',
      email: 'driver@readyset.com',
      type: 'DRIVER' as const,
      driverId: 'driver-456'
    };

    // Check role permissions
    if (allowedRoles.length > 0 && !allowedRoles.includes(mockUser.type)) {
      return {
        success: false,
        response: NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        ),
        context: {} as AuthContext
      };
    }

    return {
      success: true,
      context: { 
        user: mockUser,
        isAdmin: ['ADMIN', 'SUPER_ADMIN'].includes(mockUser.type),
        isSuperAdmin: ['SUPER_ADMIN'].includes(mockUser.type),
        isHelpdesk: ['HELPDESK'].includes(mockUser.type)
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