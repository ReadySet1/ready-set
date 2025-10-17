// src/__tests__/api/auth/current-user.test.ts

import { GET } from '@/app/api/auth/current-user/route';
import { createClient } from '@/utils/supabase/server';
import { createGetRequest, createMockSupabaseAuth } from '@/__tests__/helpers/api-test-helpers';
import { AuthErrorType } from '@/types/auth';

// Mock dependencies
jest.mock('@/utils/supabase/server');

describe('/api/auth/current-user GET API', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
  });

  describe('✅ Successful User Retrieval', () => {
    it('should return authenticated user with profile data', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        aud: 'authenticated',
        created_at: '2025-01-01T00:00:00Z',
      };

      const mockProfile = {
        type: 'CLIENT',
        email: 'test@example.com',
        name: 'Test User',
        status: 'active',
        deletedAt: null,
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({
        data: mockProfile,
        error: null,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        eq: mockEq,
      });
      mockEq.mockReturnValue({
        single: mockSingle,
      });

      const request = createGetRequest('http://localhost:3000/api/auth/current-user');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('id', 'user-123');
      expect(data).toHaveProperty('email', 'test@example.com');
      expect(data).toHaveProperty('profile');
      expect(data.profile).toEqual(mockProfile);
      expect(data).toHaveProperty('sessionInfo');
      expect(data.sessionInfo.validated).toBe(true);
      expect(data.sessionInfo.timestamp).toBeDefined();
    });

    it('should include session validation timestamp', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      const mockProfile = {
        type: 'CLIENT',
        email: 'test@example.com',
        name: 'Test User',
        status: 'active',
        deletedAt: null,
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({
        data: mockProfile,
        error: null,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        eq: mockEq,
      });
      mockEq.mockReturnValue({
        single: mockSingle,
      });

      const beforeRequest = Date.now();
      const request = createGetRequest('http://localhost:3000/api/auth/current-user');
      const response = await GET(request);
      const data = await response.json();
      const afterRequest = Date.now();

      const timestamp = new Date(data.sessionInfo.timestamp).getTime();
      expect(timestamp).toBeGreaterThanOrEqual(beforeRequest);
      expect(timestamp).toBeLessThanOrEqual(afterRequest);
    });
  });

  describe('🔐 Authentication Error Tests', () => {
    it('should return 401 for JWT token errors', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'JWT token is invalid' },
      });

      const request = createGetRequest('http://localhost:3000/api/auth/current-user');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid or expired token');
      expect(data.code).toBe(AuthErrorType.TOKEN_INVALID);
    });

    it('should return 401 for expired token errors', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'token has expired' },
      });

      const request = createGetRequest('http://localhost:3000/api/auth/current-user');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid or expired token');
      expect(data.code).toBe(AuthErrorType.TOKEN_INVALID);
    });

    it('should return 401 for generic auth errors', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Authentication failed' },
      });

      const request = createGetRequest('http://localhost:3000/api/auth/current-user');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Authentication failed');
      expect(data.code).toBe(AuthErrorType.TOKEN_INVALID);
    });

    it('should return 401 when user is null', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = createGetRequest('http://localhost:3000/api/auth/current-user');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Not authenticated');
      expect(data.code).toBe(AuthErrorType.TOKEN_INVALID);
    });
  });

  describe('👤 Profile Validation Tests', () => {
    it('should return 404 when user profile does not exist', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        eq: mockEq,
      });
      mockEq.mockReturnValue({
        single: mockSingle,
      });

      const request = createGetRequest('http://localhost:3000/api/auth/current-user');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('User profile not found');
    });

    it('should return 500 when profile query fails', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error', code: 'PGRST116' },
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        eq: mockEq,
      });
      mockEq.mockReturnValue({
        single: mockSingle,
      });

      const request = createGetRequest('http://localhost:3000/api/auth/current-user');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Unable to verify account status');
    });

    it('should verify profile query uses correct user ID', async () => {
      const mockUser = {
        id: 'specific-user-id-456',
        email: 'test@example.com',
      };

      const mockProfile = {
        type: 'CLIENT',
        email: 'test@example.com',
        name: 'Test User',
        status: 'active',
        deletedAt: null,
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({
        data: mockProfile,
        error: null,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        eq: mockEq,
      });
      mockEq.mockReturnValue({
        single: mockSingle,
      });

      const request = createGetRequest('http://localhost:3000/api/auth/current-user');
      await GET(request);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('profiles');
      expect(mockSelect).toHaveBeenCalledWith('type, email, name, status, deletedAt');
      expect(mockEq).toHaveBeenCalledWith('id', 'specific-user-id-456');
    });
  });

  describe('🚫 Soft Delete Tests', () => {
    it('should return 403 when account has been soft-deleted', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'deleted@example.com',
      };

      const mockProfile = {
        type: 'CLIENT',
        email: 'deleted@example.com',
        name: 'Deleted User',
        status: 'inactive',
        deletedAt: '2025-01-15T10:00:00Z',
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({
        data: mockProfile,
        error: null,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        eq: mockEq,
      });
      mockEq.mockReturnValue({
        single: mockSingle,
      });

      const request = createGetRequest('http://localhost:3000/api/auth/current-user');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Account has been deactivated');
    });

    it('should allow access when deletedAt is null', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'active@example.com',
      };

      const mockProfile = {
        type: 'CLIENT',
        email: 'active@example.com',
        name: 'Active User',
        status: 'active',
        deletedAt: null,
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({
        data: mockProfile,
        error: null,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        eq: mockEq,
      });
      mockEq.mockReturnValue({
        single: mockSingle,
      });

      const request = createGetRequest('http://localhost:3000/api/auth/current-user');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });

  describe('❌ Server Error Tests', () => {
    it('should handle unexpected errors gracefully', async () => {
      mockSupabaseClient.auth.getUser.mockRejectedValue(
        new Error('Unexpected server error')
      );

      const request = createGetRequest('http://localhost:3000/api/auth/current-user');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Authentication error');
      expect(data.code).toBe(AuthErrorType.SERVER_ERROR);
    });

    it('should handle Supabase client creation failure', async () => {
      (createClient as jest.Mock).mockRejectedValue(
        new Error('Failed to create Supabase client')
      );

      const request = createGetRequest('http://localhost:3000/api/auth/current-user');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Authentication error');
      expect(data.code).toBe(AuthErrorType.SERVER_ERROR);
    });
  });

  describe('📊 Response Structure Tests', () => {
    it('should include all user data from auth', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        aud: 'authenticated',
        role: 'authenticated',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-15T00:00:00Z',
      };

      const mockProfile = {
        type: 'CLIENT',
        email: 'test@example.com',
        name: 'Test User',
        status: 'active',
        deletedAt: null,
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({
        data: mockProfile,
        error: null,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        eq: mockEq,
      });
      mockEq.mockReturnValue({
        single: mockSingle,
      });

      const request = createGetRequest('http://localhost:3000/api/auth/current-user');
      const response = await GET(request);
      const data = await response.json();

      expect(data.id).toBe('user-123');
      expect(data.email).toBe('test@example.com');
      expect(data.aud).toBe('authenticated');
      expect(data.role).toBe('authenticated');
      expect(data.created_at).toBe('2025-01-01T00:00:00Z');
      expect(data.updated_at).toBe('2025-01-15T00:00:00Z');
    });

    it('should include sessionInfo with validated flag', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      const mockProfile = {
        type: 'CLIENT',
        email: 'test@example.com',
        name: 'Test User',
        status: 'active',
        deletedAt: null,
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({
        data: mockProfile,
        error: null,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        eq: mockEq,
      });
      mockEq.mockReturnValue({
        single: mockSingle,
      });

      const request = createGetRequest('http://localhost:3000/api/auth/current-user');
      const response = await GET(request);
      const data = await response.json();

      expect(data.sessionInfo).toBeDefined();
      expect(data.sessionInfo.validated).toBe(true);
      expect(data.sessionInfo.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
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

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({
        data: null,
        error: {
          message: 'Internal: Connection string postgres://user:password@host',
          code: 'PGRST500',
        },
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        eq: mockEq,
      });
      mockEq.mockReturnValue({
        single: mockSingle,
      });

      const request = createGetRequest('http://localhost:3000/api/auth/current-user');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Unable to verify account status');
      expect(data.error).not.toContain('postgres');
      expect(data.error).not.toContain('password');
    });

    it('should not expose auth token details in errors', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: {
          message: 'JWT verification failed: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
      });

      const request = createGetRequest('http://localhost:3000/api/auth/current-user');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid or expired token');
      expect(data.error).not.toContain('eyJhbGci');
    });
  });

  describe('🎯 Different User Types Tests', () => {
    it('should handle CLIENT user type', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'client@example.com',
      };

      const mockProfile = {
        type: 'CLIENT',
        email: 'client@example.com',
        name: 'Client User',
        status: 'active',
        deletedAt: null,
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({
        data: mockProfile,
        error: null,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        eq: mockEq,
      });
      mockEq.mockReturnValue({
        single: mockSingle,
      });

      const request = createGetRequest('http://localhost:3000/api/auth/current-user');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.profile.type).toBe('CLIENT');
    });

    it('should handle DRIVER user type', async () => {
      const mockUser = {
        id: 'user-456',
        email: 'driver@example.com',
      };

      const mockProfile = {
        type: 'DRIVER',
        email: 'driver@example.com',
        name: 'Driver User',
        status: 'active',
        deletedAt: null,
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({
        data: mockProfile,
        error: null,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        eq: mockEq,
      });
      mockEq.mockReturnValue({
        single: mockSingle,
      });

      const request = createGetRequest('http://localhost:3000/api/auth/current-user');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.profile.type).toBe('DRIVER');
    });

    it('should handle ADMIN user type', async () => {
      const mockUser = {
        id: 'user-789',
        email: 'admin@example.com',
      };

      const mockProfile = {
        type: 'ADMIN',
        email: 'admin@example.com',
        name: 'Admin User',
        status: 'active',
        deletedAt: null,
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({
        data: mockProfile,
        error: null,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        eq: mockEq,
      });
      mockEq.mockReturnValue({
        single: mockSingle,
      });

      const request = createGetRequest('http://localhost:3000/api/auth/current-user');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.profile.type).toBe('ADMIN');
    });
  });
});
