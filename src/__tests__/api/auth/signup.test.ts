// src/__tests__/api/auth/signup.test.ts

import { POST } from '@/app/api/auth/signup/route';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/utils/prismaDB';
import { createPostRequest } from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies
jest.mock('@/utils/supabase/server');
jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    profile: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

describe('/api/auth/signup POST API', () => {
  const mockSupabaseClient = {
    auth: {
      signUp: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
  });

  describe('🔐 Input Validation Tests', () => {
    it('should return 400 for missing email', async () => {
      const request = createPostRequest('http://localhost:3000/api/auth/signup', {
        password: 'SecurePass123!',
        name: 'John Doe',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
      expect(data.error.email).toBeDefined();
    });

    it('should return 400 for invalid email format', async () => {
      const request = createPostRequest('http://localhost:3000/api/auth/signup', {
        email: 'not-an-email',
        password: 'SecurePass123!',
        name: 'John Doe',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
      expect(data.error.email).toBeDefined();
    });

    it('should return 400 for password shorter than 8 characters', async () => {
      const request = createPostRequest('http://localhost:3000/api/auth/signup', {
        email: 'test@example.com',
        password: 'short',
        name: 'John Doe',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
      expect(data.error.password).toBeDefined();
    });

    it('should return 400 for name shorter than 2 characters', async () => {
      const request = createPostRequest('http://localhost:3000/api/auth/signup', {
        email: 'test@example.com',
        password: 'SecurePass123!',
        name: 'J',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
      expect(data.error.name).toBeDefined();
    });

    it('should return 400 for missing all required fields', async () => {
      const request = createPostRequest('http://localhost:3000/api/auth/signup', {});

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
      expect(data.error.email).toBeDefined();
      expect(data.error.password).toBeDefined();
      expect(data.error.name).toBeDefined();
    });
  });

  describe('👥 User Existence Tests', () => {
    it('should return 400 if user already exists in Prisma', async () => {
      const existingUser = {
        id: 'existing-user-id',
        email: 'existing@example.com',
        name: 'Existing User',
      };

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue(existingUser);

      const request = createPostRequest('http://localhost:3000/api/auth/signup', {
        email: 'existing@example.com',
        password: 'SecurePass123!',
        name: 'John Doe',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBe('User with this email already exists');
      expect(prisma.profile.findUnique).toHaveBeenCalledWith({
        where: { email: 'existing@example.com' },
      });
    });
  });

  describe('✅ Successful Signup Tests', () => {
    it('should successfully create a new user with valid data', async () => {
      const mockAuthData = {
        user: {
          id: 'new-user-id',
          email: 'newuser@example.com',
        },
      };

      const mockCreatedUser = {
        id: 'new-user-id',
        email: 'newuser@example.com',
        name: 'John Doe',
      };

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue(null);
      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: mockAuthData,
        error: null,
      });
      (prisma.profile.create as jest.Mock).mockResolvedValue(mockCreatedUser);

      const request = createPostRequest('http://localhost:3000/api/auth/signup', {
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        name: 'John Doe',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.user).toEqual({
        id: 'new-user-id',
        email: 'newuser@example.com',
        name: 'John Doe',
      });
      expect(data.message).toBe('User created successfully. Please verify your email.');

      // Verify Supabase auth.signUp was called correctly
      expect(mockSupabaseClient.auth.signUp).toHaveBeenCalledWith({
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        options: {
          data: {
            name: 'John Doe',
          },
        },
      });

      // Verify Prisma profile.create was called correctly
      expect(prisma.profile.create).toHaveBeenCalledWith({
        data: {
          id: 'new-user-id',
          email: 'newuser@example.com',
          name: 'John Doe',
        },
      });
    });
  });

  describe('❌ Supabase Error Handling Tests', () => {
    it('should return 500 when Supabase auth.signUp fails', async () => {
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue(null);
      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: { user: null },
        error: { message: 'Supabase authentication failed' },
      });

      const request = createPostRequest('http://localhost:3000/api/auth/signup', {
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        name: 'John Doe',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Supabase authentication failed');
    });

    it('should return 500 when Supabase returns no user data', async () => {
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue(null);
      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = createPostRequest('http://localhost:3000/api/auth/signup', {
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        name: 'John Doe',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Failed to create user in Supabase');
    });
  });

  describe('🗄️ Database Error Handling Tests', () => {
    it('should handle Prisma findUnique errors gracefully', async () => {
      (prisma.profile.findUnique as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = createPostRequest('http://localhost:3000/api/auth/signup', {
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        name: 'John Doe',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('An unexpected error occurred');
    });

    it('should handle Prisma profile.create errors gracefully', async () => {
      const mockAuthData = {
        user: {
          id: 'new-user-id',
          email: 'newuser@example.com',
        },
      };

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue(null);
      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: mockAuthData,
        error: null,
      });
      (prisma.profile.create as jest.Mock).mockRejectedValue(
        new Error('Failed to create profile')
      );

      const request = createPostRequest('http://localhost:3000/api/auth/signup', {
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        name: 'John Doe',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('An unexpected error occurred');
    });

    it('should handle unique constraint violation (P2002)', async () => {
      const mockAuthData = {
        user: {
          id: 'new-user-id',
          email: 'newuser@example.com',
        },
      };

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue(null);
      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: mockAuthData,
        error: null,
      });

      const prismaError = new Error('Unique constraint failed');
      (prismaError as any).code = 'P2002';
      (prisma.profile.create as jest.Mock).mockRejectedValue(prismaError);

      const request = createPostRequest('http://localhost:3000/api/auth/signup', {
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        name: 'John Doe',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('An unexpected error occurred');
    });
  });

  describe('🔍 Edge Cases', () => {
    it('should handle email with special characters', async () => {
      const mockAuthData = {
        user: {
          id: 'new-user-id',
          email: 'user+tag@example.com',
        },
      };

      const mockCreatedUser = {
        id: 'new-user-id',
        email: 'user+tag@example.com',
        name: 'John Doe',
      };

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue(null);
      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: mockAuthData,
        error: null,
      });
      (prisma.profile.create as jest.Mock).mockResolvedValue(mockCreatedUser);

      const request = createPostRequest('http://localhost:3000/api/auth/signup', {
        email: 'user+tag@example.com',
        password: 'SecurePass123!',
        name: 'John Doe',
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
    });

    it('should handle name with unicode characters', async () => {
      const mockAuthData = {
        user: {
          id: 'new-user-id',
          email: 'unicode@example.com',
        },
      };

      const mockCreatedUser = {
        id: 'new-user-id',
        email: 'unicode@example.com',
        name: 'José García',
      };

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue(null);
      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: mockAuthData,
        error: null,
      });
      (prisma.profile.create as jest.Mock).mockResolvedValue(mockCreatedUser);

      const request = createPostRequest('http://localhost:3000/api/auth/signup', {
        email: 'unicode@example.com',
        password: 'SecurePass123!',
        name: 'José García',
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
    });

    it('should handle very long but valid password', async () => {
      const longPassword = 'A'.repeat(100);
      const mockAuthData = {
        user: {
          id: 'new-user-id',
          email: 'longpass@example.com',
        },
      };

      const mockCreatedUser = {
        id: 'new-user-id',
        email: 'longpass@example.com',
        name: 'John Doe',
      };

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue(null);
      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: mockAuthData,
        error: null,
      });
      (prisma.profile.create as jest.Mock).mockResolvedValue(mockCreatedUser);

      const request = createPostRequest('http://localhost:3000/api/auth/signup', {
        email: 'longpass@example.com',
        password: longPassword,
        name: 'John Doe',
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
    });
  });

  describe('🔒 Security Tests', () => {
    it('should not expose sensitive error details to client', async () => {
      (prisma.profile.findUnique as jest.Mock).mockRejectedValue(
        new Error('Internal database connection string: postgres://secret:password@host')
      );

      const request = createPostRequest('http://localhost:3000/api/auth/signup', {
        email: 'test@example.com',
        password: 'SecurePass123!',
        name: 'John Doe',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('An unexpected error occurred');
      expect(data.message).not.toContain('connection string');
      expect(data.message).not.toContain('password');
    });

    it('should validate email format to prevent injection', async () => {
      const request = createPostRequest('http://localhost:3000/api/auth/signup', {
        email: "test'; DROP TABLE users; --@example.com",
        password: 'SecurePass123!',
        name: 'John Doe',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });
  });

  describe('📊 Response Format Tests', () => {
    it('should return user data with correct structure on success', async () => {
      const mockAuthData = {
        user: {
          id: 'new-user-id',
          email: 'newuser@example.com',
        },
      };

      const mockCreatedUser = {
        id: 'new-user-id',
        email: 'newuser@example.com',
        name: 'John Doe',
      };

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue(null);
      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: mockAuthData,
        error: null,
      });
      (prisma.profile.create as jest.Mock).mockResolvedValue(mockCreatedUser);

      const request = createPostRequest('http://localhost:3000/api/auth/signup', {
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        name: 'John Doe',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data).toHaveProperty('user');
      expect(data).toHaveProperty('message');
      expect(data.user).toHaveProperty('id');
      expect(data.user).toHaveProperty('email');
      expect(data.user).toHaveProperty('name');
      expect(data.user).not.toHaveProperty('password');
    });

    it('should not include password in response', async () => {
      const mockAuthData = {
        user: {
          id: 'new-user-id',
          email: 'newuser@example.com',
        },
      };

      const mockCreatedUser = {
        id: 'new-user-id',
        email: 'newuser@example.com',
        name: 'John Doe',
        password: 'should-not-be-returned',
      };

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue(null);
      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: mockAuthData,
        error: null,
      });
      (prisma.profile.create as jest.Mock).mockResolvedValue(mockCreatedUser);

      const request = createPostRequest('http://localhost:3000/api/auth/signup', {
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        name: 'John Doe',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.user).not.toHaveProperty('password');
    });
  });
});
