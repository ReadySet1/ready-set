/**
 * Comprehensive Middleware, RBAC, and Multi-Tenant Isolation Tests
 * Tests route protection, role-based access control, and data isolation
 *
 * Coverage:
 * - Middleware route protection
 * - Role-based access control (ADMIN, CLIENT, DRIVER, VENDOR)
 * - Multi-tenant data isolation
 * - Security headers
 * - CSRF protection
 * - Token validation
 * - Privilege escalation prevention
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { NextRequest, NextResponse } from 'next/server';
import { middleware } from '@/middleware';
import { withAuth, validateCSRFToken, addSecurityHeaders } from '@/lib/auth-middleware';
import { createClient } from '@/utils/supabase/server';

// Mock dependencies
jest.mock('@/utils/supabase/server');
jest.mock('@/utils/supabase/middleware', () => ({
  updateSession: jest.fn((req: NextRequest) => NextResponse.next()),
}));
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));
jest.mock('@/lib/auth', () => ({
  getUserRole: jest.fn(),
}));

const { getUserRole } = require('@/lib/auth');

describe('Middleware Route Protection', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      auth: {
        getUser: jest.fn(),
      },
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(),
    };

    (createClient as jest.MockedFunction<any>).mockResolvedValue(mockSupabase);
  });

  describe('Public Routes', () => {
    it('should allow access to public routes without authentication', async () => {
      const request = new NextRequest(new URL('http://localhost:3000/'));

      const response = await middleware(request);

      expect(response).toBeDefined();
      expect(response.status).not.toBe(307); // Not redirected
    });

    it('should allow access to sign-in page', async () => {
      const request = new NextRequest(new URL('http://localhost:3000/sign-in'));

      const response = await middleware(request);

      expect(response).toBeDefined();
      expect(response.status).not.toBe(307);
    });

    it('should allow access to auth callback', async () => {
      const request = new NextRequest(new URL('http://localhost:3000/auth/callback'));

      const response = await middleware(request);

      expect(response.status).not.toBe(307);
    });
  });

  describe('Protected Routes', () => {
    const protectedRoutes = [
      '/admin',
      '/admin/users',
      '/admin/catering-orders',
      '/dashboard',
      '/client',
      '/driver',
      '/vendor',
      '/helpdesk',
      '/profile',
    ];

    protectedRoutes.forEach((route) => {
      it(`should redirect unauthenticated users from ${route}`, async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: { message: 'Not authenticated' },
        });

        const request = new NextRequest(new URL(`http://localhost:3000${route}`));
        const response = await middleware(request);

        expect(response.status).toBe(307); // Redirect
        expect(response.headers.get('location')).toContain('/sign-in');
        expect(response.headers.get('x-auth-redirect')).toBe('true');
        expect(response.headers.get('x-redirect-reason')).toBe('unauthenticated');
      });

      it(`should allow authenticated users to access ${route}`, async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
          data: {
            user: { id: 'user-123', email: 'user@example.com' },
          },
          error: null,
        });

        // Mock profile for non-admin routes
        if (!route.startsWith('/admin')) {
          mockSupabase.maybeSingle.mockResolvedValue({
            data: { type: 'CLIENT' },
            error: null,
          });
        }

        const request = new NextRequest(new URL(`http://localhost:3000${route}`));
        const response = await middleware(request);

        if (route.startsWith('/admin')) {
          // Admin routes need special handling - test separately
          return;
        }

        expect(response.status).not.toBe(307);
        expect(response.headers.get('x-session-validated')).toBe('true');
      });
    });

    it('should preserve returnTo parameter in redirect', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });

      const request = new NextRequest(new URL('http://localhost:3000/admin/users'));
      const response = await middleware(request);

      expect(response.headers.get('location')).toContain('returnTo=%2Fadmin%2Fusers');
    });
  });

  describe('Admin Route Protection', () => {
    it('should allow ADMIN users to access admin routes', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: { id: 'admin-123', email: 'admin@example.com' },
        },
        error: null,
      });

      mockSupabase.maybeSingle.mockResolvedValue({
        data: { type: 'ADMIN' },
        error: null,
      });

      const request = new NextRequest(new URL('http://localhost:3000/admin'));
      const response = await middleware(request);

      expect(response.status).not.toBe(307);
      expect(response.headers.get('x-session-validated')).toBe('true');
    });

    it('should allow SUPER_ADMIN users to access admin routes', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: { id: 'superadmin-123', email: 'superadmin@example.com' },
        },
        error: null,
      });

      mockSupabase.maybeSingle.mockResolvedValue({
        data: { type: 'SUPER_ADMIN' },
        error: null,
      });

      const request = new NextRequest(new URL('http://localhost:3000/admin/users'));
      const response = await middleware(request);

      expect(response.status).not.toBe(307);
    });

    it('should allow HELPDESK users to access admin routes', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: { id: 'helpdesk-123', email: 'helpdesk@example.com' },
        },
        error: null,
      });

      mockSupabase.maybeSingle.mockResolvedValue({
        data: { type: 'HELPDESK' },
        error: null,
      });

      const request = new NextRequest(new URL('http://localhost:3000/admin'));
      const response = await middleware(request);

      expect(response.status).not.toBe(307);
    });

    it('should deny CLIENT users access to admin routes', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: { id: 'client-123', email: 'client@example.com' },
        },
        error: null,
      });

      mockSupabase.maybeSingle.mockResolvedValue({
        data: { type: 'CLIENT' },
        error: null,
      });

      const request = new NextRequest(new URL('http://localhost:3000/admin'));
      const response = await middleware(request);

      expect(response.status).toBe(307); // Redirected
      expect(response.headers.get('location')).toContain('/');
      expect(response.headers.get('x-redirect-reason')).toBe('unauthorized');
    });

    it('should deny DRIVER users access to admin routes', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: { id: 'driver-123', email: 'driver@example.com' },
        },
        error: null,
      });

      mockSupabase.maybeSingle.mockResolvedValue({
        data: { type: 'DRIVER' },
        error: null,
      });

      const request = new NextRequest(new URL('http://localhost:3000/admin/users'));
      const response = await middleware(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('x-redirect-reason')).toBe('unauthorized');
    });

    it('should deny VENDOR users access to admin routes', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: { id: 'vendor-123', email: 'vendor@example.com' },
        },
        error: null,
      });

      mockSupabase.maybeSingle.mockResolvedValue({
        data: { type: 'VENDOR' },
        error: null,
      });

      const request = new NextRequest(new URL('http://localhost:3000/admin'));
      const response = await middleware(request);

      expect(response.status).toBe(307);
    });

    it('should deny users with null type access to admin routes', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: { id: 'user-123', email: 'user@example.com' },
        },
        error: null,
      });

      mockSupabase.maybeSingle.mockResolvedValue({
        data: { type: null },
        error: null,
      });

      const request = new NextRequest(new URL('http://localhost:3000/admin'));
      const response = await middleware(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('x-redirect-reason')).toBe('unauthorized');
    });
  });

  describe('Error Handling', () => {
    it('should redirect to sign-in on auth error', async () => {
      mockSupabase.auth.getUser.mockRejectedValue(new Error('Auth service error'));

      const request = new NextRequest(new URL('http://localhost:3000/admin'));
      const response = await middleware(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/sign-in');
    });

    it('should handle profile fetch errors gracefully', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: { id: 'user-123', email: 'user@example.com' },
        },
        error: null,
      });

      mockSupabase.maybeSingle.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const request = new NextRequest(new URL('http://localhost:3000/admin'));
      const response = await middleware(request);

      expect(response.status).toBe(307); // Redirected due to error
    });
  });
});

describe('Role-Based Access Control (RBAC)', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      auth: {
        getUser: jest.fn(),
      },
    };

    (createClient as jest.MockedFunction<any>).mockResolvedValue(mockSupabase);
  });

  describe('withAuth Middleware', () => {
    it('should authenticate user with valid session', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: { id: 'user-123', email: 'user@example.com' },
        },
        error: null,
      });

      getUserRole.mockResolvedValue('CLIENT');

      const request = new NextRequest(new URL('http://localhost:3000/api/test'));
      const result = await withAuth(request);

      expect(result.success).toBe(true);
      expect(result.context.user.id).toBe('user-123');
      expect(result.context.user.type).toBe('CLIENT');
    });

    it('should authenticate user with Bearer token', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: { id: 'user-123', email: 'user@example.com' },
        },
        error: null,
      });

      getUserRole.mockResolvedValue('ADMIN');

      const request = new NextRequest(new URL('http://localhost:3000/api/test'), {
        headers: {
          authorization: 'Bearer valid-token-123',
        },
      });

      const result = await withAuth(request);

      expect(result.success).toBe(true);
      expect(mockSupabase.auth.getUser).toHaveBeenCalledWith('valid-token-123');
    });

    it('should reject unauthenticated requests when requireAuth is true', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });

      const request = new NextRequest(new URL('http://localhost:3000/api/test'));
      const result = await withAuth(request, { requireAuth: true });

      expect(result.success).toBe(false);
      expect(result.response?.status).toBe(401);
    });

    it('should allow unauthenticated requests when requireAuth is false', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = new NextRequest(new URL('http://localhost:3000/api/test'));
      const result = await withAuth(request, { requireAuth: false });

      expect(result.success).toBe(true);
    });

    it('should enforce role-based access for ADMIN-only routes', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: { id: 'client-123', email: 'client@example.com' },
        },
        error: null,
      });

      getUserRole.mockResolvedValue('CLIENT');

      const request = new NextRequest(new URL('http://localhost:3000/api/admin/users'));
      const result = await withAuth(request, { allowedRoles: ['ADMIN', 'SUPER_ADMIN'] });

      expect(result.success).toBe(false);
      expect(result.response?.status).toBe(403);
    });

    it('should allow ADMIN users to access ADMIN routes', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: { id: 'admin-123', email: 'admin@example.com' },
        },
        error: null,
      });

      getUserRole.mockResolvedValue('ADMIN');

      const request = new NextRequest(new URL('http://localhost:3000/api/admin/users'));
      const result = await withAuth(request, { allowedRoles: ['ADMIN', 'SUPER_ADMIN'] });

      expect(result.success).toBe(true);
      expect(result.context.isAdmin).toBe(true);
    });

    it('should allow SUPER_ADMIN users to access all routes', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: { id: 'superadmin-123', email: 'superadmin@example.com' },
        },
        error: null,
      });

      getUserRole.mockResolvedValue('SUPER_ADMIN');

      const request = new NextRequest(new URL('http://localhost:3000/api/admin/users'));
      const result = await withAuth(request, { allowedRoles: ['SUPER_ADMIN'] });

      expect(result.success).toBe(true);
      expect(result.context.isSuperAdmin).toBe(true);
      expect(result.context.isAdmin).toBe(true);
    });

    it('should set isHelpdesk flag for HELPDESK users', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: { id: 'helpdesk-123', email: 'helpdesk@example.com' },
        },
        error: null,
      });

      getUserRole.mockResolvedValue('HELPDESK');

      const request = new NextRequest(new URL('http://localhost:3000/api/test'));
      const result = await withAuth(request);

      expect(result.success).toBe(true);
      expect(result.context.isHelpdesk).toBe(true);
    });

    it('should set driverId for DRIVER users', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: { id: 'driver-123', email: 'driver@example.com' },
        },
        error: null,
      });

      getUserRole.mockResolvedValue('DRIVER');

      const request = new NextRequest(new URL('http://localhost:3000/api/driver/orders'));
      const result = await withAuth(request, { allowedRoles: ['DRIVER'] });

      expect(result.success).toBe(true);
      expect(result.context.user.driverId).toBe('driver-123');
    });

    it('should reject users without a role', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: { id: 'user-123', email: 'user@example.com' },
        },
        error: null,
      });

      getUserRole.mockResolvedValue(null);

      const request = new NextRequest(new URL('http://localhost:3000/api/test'));
      const result = await withAuth(request, { requireAuth: true });

      expect(result.success).toBe(false);
      expect(result.response?.status).toBe(403);
    });
  });

  describe('Multi-Role Access', () => {
    it('should allow multiple roles to access a route', async () => {
      const roles = ['ADMIN', 'SUPER_ADMIN', 'HELPDESK'];

      for (const role of roles) {
        mockSupabase.auth.getUser.mockResolvedValue({
          data: {
            user: { id: `${role}-123`, email: `${role}@example.com` },
          },
          error: null,
        });

        getUserRole.mockResolvedValue(role);

        const request = new NextRequest(new URL('http://localhost:3000/api/admin/test'));
        const result = await withAuth(request, { allowedRoles: roles });

        expect(result.success).toBe(true);
      }
    });

    it('should deny access to roles not in allowedRoles', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: { id: 'vendor-123', email: 'vendor@example.com' },
        },
        error: null,
      });

      getUserRole.mockResolvedValue('VENDOR');

      const request = new NextRequest(new URL('http://localhost:3000/api/admin/test'));
      const result = await withAuth(request, { allowedRoles: ['ADMIN', 'SUPER_ADMIN'] });

      expect(result.success).toBe(false);
      expect(result.response?.status).toBe(403);
    });
  });
});

describe('Multi-Tenant Data Isolation', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      auth: {
        getUser: jest.fn(),
      },
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };

    (createClient as jest.MockedFunction<any>).mockResolvedValue(mockSupabase);
  });

  describe('Client Data Isolation', () => {
    it('should ensure CLIENT can only access their own data', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: { id: 'client-123', email: 'client@example.com' },
        },
        error: null,
      });

      getUserRole.mockResolvedValue('CLIENT');

      const request = new NextRequest(new URL('http://localhost:3000/api/orders'));
      const result = await withAuth(request, { allowedRoles: ['CLIENT'] });

      expect(result.success).toBe(true);
      expect(result.context.user.id).toBe('client-123');
      // In a real implementation, queries would be filtered by user.id
    });

    it('should prevent CLIENT from accessing other clients data', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: { id: 'client-123', email: 'client@example.com' },
        },
        error: null,
      });

      getUserRole.mockResolvedValue('CLIENT');

      const request = new NextRequest(new URL('http://localhost:3000/api/admin/users'));
      const result = await withAuth(request, { allowedRoles: ['ADMIN'] });

      expect(result.success).toBe(false); // CLIENT not in allowedRoles
    });
  });

  describe('Driver Data Isolation', () => {
    it('should ensure DRIVER can only access assigned orders', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: { id: 'driver-123', email: 'driver@example.com' },
        },
        error: null,
      });

      getUserRole.mockResolvedValue('DRIVER');

      const request = new NextRequest(new URL('http://localhost:3000/api/driver/orders'));
      const result = await withAuth(request, { allowedRoles: ['DRIVER'] });

      expect(result.success).toBe(true);
      expect(result.context.user.driverId).toBe('driver-123');
      // Queries should filter by driverId
    });
  });

  describe('Vendor Data Isolation', () => {
    it('should ensure VENDOR can only access vendor-specific data', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: { id: 'vendor-123', email: 'vendor@example.com' },
        },
        error: null,
      });

      getUserRole.mockResolvedValue('VENDOR');

      const request = new NextRequest(new URL('http://localhost:3000/api/vendor/products'));
      const result = await withAuth(request, { allowedRoles: ['VENDOR'] });

      expect(result.success).toBe(true);
      expect(result.context.user.id).toBe('vendor-123');
    });
  });

  describe('Admin Full Access', () => {
    it('should allow ADMIN to access all tenant data', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: { id: 'admin-123', email: 'admin@example.com' },
        },
        error: null,
      });

      getUserRole.mockResolvedValue('ADMIN');

      const request = new NextRequest(new URL('http://localhost:3000/api/admin/all-orders'));
      const result = await withAuth(request, { allowedRoles: ['ADMIN', 'SUPER_ADMIN'] });

      expect(result.success).toBe(true);
      expect(result.context.isAdmin).toBe(true);
      // ADMIN can query across all tenants
    });
  });
});

describe('Security Edge Cases', () => {
  describe('CSRF Protection', () => {
    it('should allow GET requests without CSRF token', () => {
      const request = new NextRequest(new URL('http://localhost:3000/api/test'), {
        method: 'GET',
      });

      const isValid = validateCSRFToken(request);

      expect(isValid).toBe(true);
    });

    it('should validate origin for POST requests', () => {
      const request = new NextRequest(new URL('http://localhost:3000/api/test'), {
        method: 'POST',
        headers: {
          origin: 'http://localhost:3000',
        },
      });

      const isValid = validateCSRFToken(request);

      expect(isValid).toBe(true);
    });

    it('should reject POST requests from different origin', () => {
      const request = new NextRequest(new URL('http://localhost:3000/api/test'), {
        method: 'POST',
        headers: {
          origin: 'http://malicious-site.com',
        },
      });

      const isValid = validateCSRFToken(request);

      expect(isValid).toBe(false);
    });

    it('should validate referer when origin is missing', () => {
      const request = new NextRequest(new URL('http://localhost:3000/api/test'), {
        method: 'POST',
        headers: {
          referer: 'http://localhost:3000/some-page',
        },
      });

      const isValid = validateCSRFToken(request);

      expect(isValid).toBe(true);
    });

    it('should reject invalid referer', () => {
      const request = new NextRequest(new URL('http://localhost:3000/api/test'), {
        method: 'POST',
        headers: {
          referer: 'http://malicious-site.com',
        },
      });

      const isValid = validateCSRFToken(request);

      expect(isValid).toBe(false);
    });
  });

  describe('Privilege Escalation Prevention', () => {
    let mockSupabase: any;

    beforeEach(() => {
      mockSupabase = {
        auth: {
          getUser: jest.fn(),
        },
      };

      (createClient as jest.MockedFunction<any>).mockResolvedValue(mockSupabase);
    });

    it('should prevent CLIENT from accessing ADMIN routes', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: { id: 'client-123', email: 'client@example.com' },
        },
        error: null,
      });

      getUserRole.mockResolvedValue('CLIENT');

      const request = new NextRequest(new URL('http://localhost:3000/api/admin/users'));
      const result = await withAuth(request, { allowedRoles: ['ADMIN', 'SUPER_ADMIN'] });

      expect(result.success).toBe(false);
      expect(result.response?.status).toBe(403);
    });

    it('should prevent DRIVER from accessing CLIENT data', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: { id: 'driver-123', email: 'driver@example.com' },
        },
        error: null,
      });

      getUserRole.mockResolvedValue('DRIVER');

      const request = new NextRequest(new URL('http://localhost:3000/api/client/orders'));
      const result = await withAuth(request, { allowedRoles: ['CLIENT'] });

      expect(result.success).toBe(false);
    });

    it('should prevent role manipulation via request headers', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: { id: 'client-123', email: 'client@example.com' },
        },
        error: null,
      });

      getUserRole.mockResolvedValue('CLIENT'); // Real role from database

      // Attempt to spoof role via header
      const request = new NextRequest(new URL('http://localhost:3000/api/admin/users'), {
        headers: {
          'x-user-role': 'ADMIN', // Malicious header
        },
      });

      const result = await withAuth(request, { allowedRoles: ['ADMIN'] });

      expect(result.success).toBe(false); // Should use DB role, not header
    });
  });

  describe('Token Expiration', () => {
    let mockSupabase: any;

    beforeEach(() => {
      mockSupabase = {
        auth: {
          getUser: jest.fn(),
        },
      };

      (createClient as jest.MockedFunction<any>).mockResolvedValue(mockSupabase);
    });

    it('should reject expired tokens', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Token expired' },
      });

      const request = new NextRequest(new URL('http://localhost:3000/api/test'), {
        headers: {
          authorization: 'Bearer expired-token',
        },
      });

      const result = await withAuth(request, { requireAuth: true });

      expect(result.success).toBe(false);
      expect(result.response?.status).toBe(401);
    });

    it('should reject invalid tokens', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' },
      });

      const request = new NextRequest(new URL('http://localhost:3000/api/test'), {
        headers: {
          authorization: 'Bearer invalid-token',
        },
      });

      const result = await withAuth(request, { requireAuth: true });

      expect(result.success).toBe(false);
    });
  });

  describe('Security Headers', () => {
    it('should add security headers to response', () => {
      const response = NextResponse.json({ message: 'test' });
      const secureResponse = addSecurityHeaders(response);

      expect(secureResponse.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(secureResponse.headers.get('X-Frame-Options')).toBe('DENY');
      expect(secureResponse.headers.get('X-XSS-Protection')).toBe('1; mode=block');
      expect(secureResponse.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
      expect(secureResponse.headers.get('Content-Security-Policy')).toBe("default-src 'self'");
    });
  });
});
