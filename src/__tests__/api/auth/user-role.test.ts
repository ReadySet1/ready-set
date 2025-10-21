// src/__tests__/api/auth/user-role.test.ts

import { GET } from '@/app/api/auth/user-role/route';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/lib/db/prisma';
import { createGetRequest } from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies
jest.mock('@/utils/supabase/server');
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    profile: {
      findUnique: jest.fn(),
    },
  },
}));

describe('/api/auth/user-role GET API', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
  });

  // Helper to create request with Authorization header
  const createAuthRequest = (token: string = 'valid-token') => {
    return createGetRequest('http://localhost:3000/api/auth/user-role', {
      'Authorization': `Bearer ${token}`,
    });
  };

  describe('✅ Successful Role Retrieval', () => {
    it('should return ADMIN role information', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'admin@example.com',
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: 'ADMIN',
        deletedAt: null,
      });

      const request = createAuthRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        isAdmin: true,
        isSuperAdmin: false,
        isHelpdesk: false,
        userType: 'ADMIN',
      });
    });

    it('should return SUPER_ADMIN role information', async () => {
      const mockUser = {
        id: 'user-456',
        email: 'superadmin@example.com',
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: 'SUPER_ADMIN',
        deletedAt: null,
      });

      const request = createAuthRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        isAdmin: false,
        isSuperAdmin: true,
        isHelpdesk: false,
        userType: 'SUPER_ADMIN',
      });
    });

    it('should return HELPDESK role information', async () => {
      const mockUser = {
        id: 'user-789',
        email: 'helpdesk@example.com',
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: 'HELPDESK',
        deletedAt: null,
      });

      const request = createAuthRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        isAdmin: false,
        isSuperAdmin: false,
        isHelpdesk: true,
        userType: 'HELPDESK',
      });
    });

    it('should return false for all admin roles for CLIENT user', async () => {
      const mockUser = {
        id: 'user-111',
        email: 'client@example.com',
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: 'CLIENT',
        deletedAt: null,
      });

      const request = createAuthRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        isAdmin: false,
        isSuperAdmin: false,
        isHelpdesk: false,
        userType: 'CLIENT',
      });
    });

    it('should return false for all admin roles for DRIVER user', async () => {
      const mockUser = {
        id: 'user-222',
        email: 'driver@example.com',
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: 'DRIVER',
        deletedAt: null,
      });

      const request = createAuthRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        isAdmin: false,
        isSuperAdmin: false,
        isHelpdesk: false,
        userType: 'DRIVER',
      });
    });

    it('should handle case-insensitive user types', async () => {
      const mockUser = {
        id: 'user-333',
        email: 'admin@example.com',
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: 'admin', // lowercase
        deletedAt: null,
      });

      const request = createAuthRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.isAdmin).toBe(true);
      expect(data.userType).toBe('admin');
    });
  });

  describe('🔐 Authentication Tests', () => {
    it('should return 401 when Authorization header is missing', async () => {
      const request = createGetRequest('http://localhost:3000/api/auth/user-role');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({
        isAdmin: false,
        isSuperAdmin: false,
        error: 'Unauthorized - Invalid authorization header',
      });
    });

    it('should return 401 when Authorization header does not start with Bearer', async () => {
      const request = createGetRequest('http://localhost:3000/api/auth/user-role', {
        'Authorization': 'Basic some-token',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({
        isAdmin: false,
        isSuperAdmin: false,
        error: 'Unauthorized - Invalid authorization header',
      });
    });

    it('should return 401 for invalid JWT token', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'JWT token is invalid' },
      });

      const request = createAuthRequest('invalid-token');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({
        isAdmin: false,
        isSuperAdmin: false,
        error: 'Unauthorized - Invalid JWT token',
      });
    });

    it('should return 401 for expired JWT token', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'JWT token has expired' },
      });

      const request = createAuthRequest('expired-token');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({
        isAdmin: false,
        isSuperAdmin: false,
        error: 'Unauthorized - Invalid JWT token',
      });
    });

    it('should return 401 when user is null', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = createAuthRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized - Invalid JWT token');
    });
  });

  describe('👤 Profile Validation Tests', () => {
    it('should return 404 when user profile does not exist', async () => {
      const mockUser = {
        id: 'user-999',
        email: 'noProfile@example.com',
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue(null);

      const request = createAuthRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toEqual({
        isAdmin: false,
        isSuperAdmin: false,
        error: 'User profile not found',
      });
    });

    it('should verify profile query uses correct user ID', async () => {
      const mockUser = {
        id: 'specific-user-id-789',
        email: 'test@example.com',
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: 'CLIENT',
        deletedAt: null,
      });

      const request = createAuthRequest();
      await GET(request);

      expect(prisma.profile.findUnique).toHaveBeenCalledWith({
        where: { id: 'specific-user-id-789' },
        select: { type: true, deletedAt: true },
      });
    });
  });

  describe('🚫 Soft Delete Tests', () => {
    it('should return 403 when account has been soft-deleted', async () => {
      const mockUser = {
        id: 'user-deleted',
        email: 'deleted@example.com',
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: 'CLIENT',
        deletedAt: new Date('2025-01-15T10:00:00Z'),
      });

      const request = createAuthRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data).toEqual({
        isAdmin: false,
        isSuperAdmin: false,
        error: 'Account has been deactivated',
      });
    });

    it('should allow access when deletedAt is null', async () => {
      const mockUser = {
        id: 'user-active',
        email: 'active@example.com',
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: 'CLIENT',
        deletedAt: null,
      });

      const request = createAuthRequest();
      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });

  describe('❌ Error Handling Tests', () => {
    it('should handle Supabase client creation failure', async () => {
      (createClient as jest.Mock).mockRejectedValue(
        new Error('Failed to create Supabase client')
      );

      const request = createAuthRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        isAdmin: false,
        isSuperAdmin: false,
        error: 'Internal server error',
      });
    });

    it('should handle database query failure', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = createAuthRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        isAdmin: false,
        isSuperAdmin: false,
        error: 'Internal server error',
      });
    });

    it('should handle unexpected errors gracefully', async () => {
      mockSupabaseClient.auth.getUser.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const request = createAuthRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });

  describe('📊 Response Structure Tests', () => {
    it('should include all required fields in success response', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: 'ADMIN',
        deletedAt: null,
      });

      const request = createAuthRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(data).toHaveProperty('isAdmin');
      expect(data).toHaveProperty('isSuperAdmin');
      expect(data).toHaveProperty('isHelpdesk');
      expect(data).toHaveProperty('userType');
      expect(data).not.toHaveProperty('error');
    });

    it('should include error field in error responses', async () => {
      const request = createGetRequest('http://localhost:3000/api/auth/user-role');
      const response = await GET(request);
      const data = await response.json();

      expect(data).toHaveProperty('isAdmin', false);
      expect(data).toHaveProperty('isSuperAdmin', false);
      expect(data).toHaveProperty('error');
      expect(typeof data.error).toBe('string');
    });
  });

  describe('🔒 Security Tests', () => {
    it('should not expose sensitive database errors', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockRejectedValue(
        new Error('Internal: Connection string postgres://user:password@host')
      );

      const request = createAuthRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
      expect(data.error).not.toContain('postgres');
      expect(data.error).not.toContain('password');
    });

    it('should not expose JWT token details in errors', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: {
          message: 'JWT verification failed: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
      });

      const request = createAuthRequest('invalid-token');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized - Invalid JWT token');
      expect(data.error).not.toContain('eyJhbGci');
    });

    it('should extract token safely from Authorization header', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: 'CLIENT',
        deletedAt: null,
      });

      const request = createAuthRequest('my-secure-token');
      await GET(request);

      // Verify token was passed to getUser
      expect(mockSupabaseClient.auth.getUser).toHaveBeenCalledWith('my-secure-token');
    });
  });

  describe('🎯 All User Types Tests', () => {
    const userTypes = ['CLIENT', 'VENDOR', 'DRIVER', 'ADMIN', 'SUPER_ADMIN', 'HELPDESK'];

    userTypes.forEach((type) => {
      it(`should handle ${type} user type correctly`, async () => {
        const mockUser = {
          id: `user-${type}`,
          email: `${type.toLowerCase()}@example.com`,
        };

        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: mockUser },
          error: null,
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          type,
          deletedAt: null,
        });

        const request = createAuthRequest();
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.userType).toBe(type);
        expect(data).toHaveProperty('isAdmin');
        expect(data).toHaveProperty('isSuperAdmin');
        expect(data).toHaveProperty('isHelpdesk');
      });
    });
  });
});
