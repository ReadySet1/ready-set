// src/__tests__/api/users/users.test.ts

import { GET, POST } from '@/app/api/users/route';
import { createClient } from '@/utils/supabase/server';
import { prisma, withDatabaseRetry } from '@/utils/prismaDB';
import {
  createGetRequest,
  createPostRequest,
  expectSuccessResponse,
  expectErrorResponse,
  expectUnauthorized,
  expectForbidden,
} from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies
jest.mock('@/utils/supabase/server');
jest.mock('@/utils/prismaDB');
jest.mock('@/lib/rate-limiting', () => ({
  withRateLimit: jest.fn(() => jest.fn(async () => null)),
  RateLimitConfigs: { admin: {} },
}));

describe('/api/users API', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    })),
  };

  const mockPrisma = {
    profile: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
    (prisma as any).profile = mockPrisma.profile;
    (withDatabaseRetry as jest.Mock).mockImplementation((fn) => fn());
  });

  describe('GET /api/users - List Users', () => {
    describe('✅ Successful Retrieval', () => {
      it('should return paginated users for admin', async () => {
        // Mock admin authentication
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123', email: 'admin@example.com' } },
          error: null,
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: { type: 'ADMIN' },
          error: null,
        });

        // Mock database response
        const mockUsers = [
          {
            id: 'user-1',
            name: 'John Doe',
            email: 'john@example.com',
            type: 'CLIENT',
            status: 'ACTIVE',
            contactNumber: '123-456-7890',
            companyName: 'ACME Corp',
            contactName: 'John',
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-02'),
          },
          {
            id: 'user-2',
            name: 'Jane Smith',
            email: 'jane@example.com',
            type: 'VENDOR',
            status: 'ACTIVE',
            contactNumber: '098-765-4321',
            companyName: 'Smith Catering',
            contactName: 'Jane',
            createdAt: new Date('2024-01-03'),
            updatedAt: new Date('2024-01-04'),
          },
        ];

        mockPrisma.profile.findMany.mockResolvedValue(mockUsers);
        mockPrisma.profile.count.mockResolvedValue(2);

        const request = createGetRequest('http://localhost:3000/api/users', {
          authorization: 'Bearer valid-token',
        });

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.users).toHaveLength(2);
        expect(data.totalCount).toBe(2);
        expect(data.totalPages).toBe(1);
        expect(data.currentPage).toBe(1);
        expect(data.hasNextPage).toBe(false);
        expect(data.hasPrevPage).toBe(false);
        expect(data.users[0]).toMatchObject({
          id: 'user-1',
          email: 'john@example.com',
          type: 'CLIENT',
        });
      });

      it('should support pagination parameters', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: { type: 'SUPER_ADMIN' },
          error: null,
        });

        mockPrisma.profile.findMany.mockResolvedValue([]);
        mockPrisma.profile.count.mockResolvedValue(50);

        const request = createGetRequest(
          'http://localhost:3000/api/users?page=2&limit=20',
          {
            authorization: 'Bearer valid-token',
          }
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.currentPage).toBe(2);
        expect(data.limit).toBe(20);
        expect(data.totalPages).toBe(3);
        expect(data.hasNextPage).toBe(true);
        expect(data.hasPrevPage).toBe(true);

        // Verify skip/take was called correctly
        expect(mockPrisma.profile.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            skip: 20, // (page 2 - 1) * 20
            take: 20,
          })
        );
      });

      it('should support search filtering', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: { type: 'HELPDESK' },
          error: null,
        });

        mockPrisma.profile.findMany.mockResolvedValue([]);
        mockPrisma.profile.count.mockResolvedValue(0);

        const request = createGetRequest(
          'http://localhost:3000/api/users?search=john',
          {
            authorization: 'Bearer valid-token',
          }
        );

        await GET(request);

        // Verify search was applied with OR conditions
        expect(mockPrisma.profile.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              OR: expect.arrayContaining([
                { name: { contains: 'john', mode: 'insensitive' } },
                { email: { contains: 'john', mode: 'insensitive' } },
                { contactName: { contains: 'john', mode: 'insensitive' } },
                { companyName: { contains: 'john', mode: 'insensitive' } },
              ]),
            }),
          })
        );
      });

      it('should support status filtering', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: { type: 'ADMIN' },
          error: null,
        });

        mockPrisma.profile.findMany.mockResolvedValue([]);
        mockPrisma.profile.count.mockResolvedValue(0);

        const request = createGetRequest(
          'http://localhost:3000/api/users?status=PENDING',
          {
            authorization: 'Bearer valid-token',
          }
        );

        await GET(request);

        expect(mockPrisma.profile.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              status: 'PENDING',
            }),
          })
        );
      });

      it('should support type filtering', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: { type: 'ADMIN' },
          error: null,
        });

        mockPrisma.profile.findMany.mockResolvedValue([]);
        mockPrisma.profile.count.mockResolvedValue(0);

        const request = createGetRequest(
          'http://localhost:3000/api/users?type=VENDOR',
          {
            authorization: 'Bearer valid-token',
          }
        );

        await GET(request);

        expect(mockPrisma.profile.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              type: 'VENDOR',
            }),
          })
        );
      });

      it('should support sorting by different fields', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: { type: 'ADMIN' },
          error: null,
        });

        mockPrisma.profile.findMany.mockResolvedValue([]);
        mockPrisma.profile.count.mockResolvedValue(0);

        const request = createGetRequest(
          'http://localhost:3000/api/users?sort=name&sortOrder=asc',
          {
            authorization: 'Bearer valid-token',
          }
        );

        await GET(request);

        expect(mockPrisma.profile.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: { name: 'asc' },
          })
        );
      });

      it('should exclude soft-deleted users by default', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: { type: 'ADMIN' },
          error: null,
        });

        mockPrisma.profile.findMany.mockResolvedValue([]);
        mockPrisma.profile.count.mockResolvedValue(0);

        const request = createGetRequest('http://localhost:3000/api/users', {
          authorization: 'Bearer valid-token',
        });

        await GET(request);

        expect(mockPrisma.profile.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              deletedAt: null,
            }),
          })
        );
      });
    });

    describe('🔐 Authentication Tests', () => {
      it('should return 401 for missing authorization header', async () => {
        const request = createGetRequest('http://localhost:3000/api/users');

        const response = await GET(request);
        await expectUnauthorized(
          response,
          /Invalid authorization header/i
        );
      });

      it('should return 401 for invalid Bearer token format', async () => {
        const request = createGetRequest('http://localhost:3000/api/users', {
          authorization: 'InvalidFormat token',
        });

        const response = await GET(request);
        await expectUnauthorized(
          response,
          /Invalid authorization header/i
        );
      });

      it('should return 401 for invalid token', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: { message: 'Invalid token' },
        });

        const request = createGetRequest('http://localhost:3000/api/users', {
          authorization: 'Bearer invalid-token',
        });

        const response = await GET(request);
        await expectUnauthorized(response);
      });

      it('should return 404 when user profile not found', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'no-profile-user' } },
          error: null,
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: null,
          error: { message: 'Profile not found' },
        });

        const request = createGetRequest('http://localhost:3000/api/users', {
          authorization: 'Bearer valid-token',
        });

        const response = await GET(request);
        await expectErrorResponse(response, 404, /profile not found/i);
      });
    });

    describe('🔒 Authorization Tests', () => {
      it('should return 403 for non-admin users (CLIENT)', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'client-123' } },
          error: null,
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: { type: 'CLIENT' },
          error: null,
        });

        const request = createGetRequest('http://localhost:3000/api/users', {
          authorization: 'Bearer valid-token',
        });

        const response = await GET(request);
        await expectForbidden(response);
      });

      it('should return 403 for VENDOR users', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'vendor-123' } },
          error: null,
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: { type: 'VENDOR' },
          error: null,
        });

        const request = createGetRequest('http://localhost:3000/api/users', {
          authorization: 'Bearer valid-token',
        });

        const response = await GET(request);
        await expectForbidden(response);
      });

      it('should return 403 for DRIVER users', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'driver-123' } },
          error: null,
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: { type: 'DRIVER' },
          error: null,
        });

        const request = createGetRequest('http://localhost:3000/api/users', {
          authorization: 'Bearer valid-token',
        });

        const response = await GET(request);
        await expectForbidden(response);
      });

      it('should allow ADMIN users', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: { type: 'ADMIN' },
          error: null,
        });

        mockPrisma.profile.findMany.mockResolvedValue([]);
        mockPrisma.profile.count.mockResolvedValue(0);

        const request = createGetRequest('http://localhost:3000/api/users', {
          authorization: 'Bearer valid-token',
        });

        const response = await GET(request);
        expect(response.status).toBe(200);
      });

      it('should allow SUPER_ADMIN users', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'superadmin-123' } },
          error: null,
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: { type: 'SUPER_ADMIN' },
          error: null,
        });

        mockPrisma.profile.findMany.mockResolvedValue([]);
        mockPrisma.profile.count.mockResolvedValue(0);

        const request = createGetRequest('http://localhost:3000/api/users', {
          authorization: 'Bearer valid-token',
        });

        const response = await GET(request);
        expect(response.status).toBe(200);
      });

      it('should allow HELPDESK users', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'helpdesk-123' } },
          error: null,
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: { type: 'HELPDESK' },
          error: null,
        });

        mockPrisma.profile.findMany.mockResolvedValue([]);
        mockPrisma.profile.count.mockResolvedValue(0);

        const request = createGetRequest('http://localhost:3000/api/users', {
          authorization: 'Bearer valid-token',
        });

        const response = await GET(request);
        expect(response.status).toBe(200);
      });
    });

    describe('❌ Error Handling', () => {
      it('should handle database errors gracefully', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: { type: 'ADMIN' },
          error: null,
        });

        mockPrisma.profile.findMany.mockRejectedValue(
          new Error('Database connection failed')
        );

        const request = createGetRequest('http://localhost:3000/api/users', {
          authorization: 'Bearer valid-token',
        });

        const response = await GET(request);
        await expectErrorResponse(response, 500);
      });
    });
  });

  describe('POST /api/users - Create User', () => {
    describe('✅ Successful Creation', () => {
      it('should create a new user with all fields', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: { type: 'ADMIN' },
          error: null,
        });

        mockPrisma.profile.findUnique.mockResolvedValue(null); // Email not taken
        mockPrisma.profile.create.mockResolvedValue({
          id: 'new-user-123',
          email: 'newuser@example.com',
          type: 'CLIENT',
          status: 'ACTIVE',
          name: 'New User',
          contactName: 'Contact Person',
          contactNumber: '555-1234',
          companyName: 'New Company',
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const request = createPostRequest(
          'http://localhost:3000/api/users',
          {
            email: 'newuser@example.com',
            type: 'CLIENT',
            status: 'ACTIVE',
            name: 'New User',
            contactName: 'Contact Person',
            contactNumber: '555-1234',
            companyName: 'New Company',
          },
          {
            authorization: 'Bearer valid-token',
          }
        );

        const response = await POST(request);
        const data = await expectSuccessResponse(response, 201);

        expect(data.id).toBe('new-user-123');
        expect(data.email).toBe('newuser@example.com');
        expect(data.type).toBe('CLIENT');
        expect(mockPrisma.profile.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              email: 'newuser@example.com',
              type: 'CLIENT',
              status: 'ACTIVE',
            }),
          })
        );
      });

      it('should create user with minimal required fields', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: { type: 'SUPER_ADMIN' },
          error: null,
        });

        mockPrisma.profile.findUnique.mockResolvedValue(null);
        mockPrisma.profile.create.mockResolvedValue({
          id: 'new-user-123',
          email: 'minimal@example.com',
          type: 'VENDOR',
          status: 'PENDING',
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const request = createPostRequest(
          'http://localhost:3000/api/users',
          {
            email: 'minimal@example.com',
            type: 'VENDOR',
            status: 'PENDING',
          },
          {
            authorization: 'Bearer valid-token',
          }
        );

        const response = await POST(request);
        await expectSuccessResponse(response, 201);
      });

      it('should normalize user type to uppercase', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: { type: 'ADMIN' },
          error: null,
        });

        mockPrisma.profile.findUnique.mockResolvedValue(null);
        mockPrisma.profile.create.mockResolvedValue({
          id: 'new-user-123',
          email: 'test@example.com',
          type: 'CLIENT',
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const request = createPostRequest(
          'http://localhost:3000/api/users',
          {
            email: 'test@example.com',
            type: 'client', // lowercase
            status: 'ACTIVE',
          },
          {
            authorization: 'Bearer valid-token',
          }
        );

        await POST(request);

        // Verify type was normalized
        expect(mockPrisma.profile.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              type: 'CLIENT',
            }),
          })
        );
      });
    });

    describe('🔐 Authentication Tests', () => {
      it('should return 401 for missing authorization header', async () => {
        const request = createPostRequest('http://localhost:3000/api/users', {
          email: 'test@example.com',
          type: 'CLIENT',
          status: 'ACTIVE',
        });

        const response = await POST(request);
        await expectUnauthorized(
          response,
          /Invalid authorization header/i
        );
      });

      it('should return 401 for invalid token', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: { message: 'Invalid token' },
        });

        const request = createPostRequest(
          'http://localhost:3000/api/users',
          {
            email: 'test@example.com',
            type: 'CLIENT',
            status: 'ACTIVE',
          },
          {
            authorization: 'Bearer invalid-token',
          }
        );

        const response = await POST(request);
        await expectUnauthorized(response);
      });
    });

    describe('🔒 Authorization Tests', () => {
      it('should return 403 for non-admin users', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'client-123' } },
          error: null,
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: { type: 'CLIENT' },
          error: null,
        });

        const request = createPostRequest(
          'http://localhost:3000/api/users',
          {
            email: 'test@example.com',
            type: 'CLIENT',
            status: 'ACTIVE',
          },
          {
            authorization: 'Bearer valid-token',
          }
        );

        const response = await POST(request);
        await expectForbidden(response, /Only admins can create users/i);
      });
    });

    describe('✏️ Validation Tests', () => {
      it('should return 400 for missing email', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: { type: 'ADMIN' },
          error: null,
        });

        const request = createPostRequest(
          'http://localhost:3000/api/users',
          {
            type: 'CLIENT',
            status: 'ACTIVE',
          },
          {
            authorization: 'Bearer valid-token',
          }
        );

        const response = await POST(request);
        await expectErrorResponse(
          response,
          400,
          /Missing required fields/i
        );
      });

      it('should return 400 for missing type', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: { type: 'ADMIN' },
          error: null,
        });

        const request = createPostRequest(
          'http://localhost:3000/api/users',
          {
            email: 'test@example.com',
            status: 'ACTIVE',
          },
          {
            authorization: 'Bearer valid-token',
          }
        );

        const response = await POST(request);
        await expectErrorResponse(
          response,
          400,
          /Missing required fields/i
        );
      });

      it('should return 400 for missing status', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: { type: 'ADMIN' },
          error: null,
        });

        const request = createPostRequest(
          'http://localhost:3000/api/users',
          {
            email: 'test@example.com',
            type: 'CLIENT',
          },
          {
            authorization: 'Bearer valid-token',
          }
        );

        const response = await POST(request);
        await expectErrorResponse(
          response,
          400,
          /Missing required fields/i
        );
      });

      it('should return 400 for invalid user type', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: { type: 'ADMIN' },
          error: null,
        });

        const request = createPostRequest(
          'http://localhost:3000/api/users',
          {
            email: 'test@example.com',
            type: 'INVALID_TYPE',
            status: 'ACTIVE',
          },
          {
            authorization: 'Bearer valid-token',
          }
        );

        const response = await POST(request);
        await expectErrorResponse(
          response,
          400,
          /Invalid user type provided/i
        );
      });

      it('should return 409 for duplicate email', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: { type: 'ADMIN' },
          error: null,
        });

        mockPrisma.profile.findUnique.mockResolvedValue({
          id: 'existing-user',
          email: 'duplicate@example.com',
        });

        const request = createPostRequest(
          'http://localhost:3000/api/users',
          {
            email: 'duplicate@example.com',
            type: 'CLIENT',
            status: 'ACTIVE',
          },
          {
            authorization: 'Bearer valid-token',
          }
        );

        const response = await POST(request);
        await expectErrorResponse(response, 409, /Email already in use/i);
      });
    });

    describe('❌ Error Handling', () => {
      it('should handle database errors gracefully', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        mockSupabaseClient.from().single.mockResolvedValue({
          data: { type: 'ADMIN' },
          error: null,
        });

        mockPrisma.profile.findUnique.mockResolvedValue(null);
        mockPrisma.profile.create.mockRejectedValue(
          new Error('Database connection failed')
        );

        const request = createPostRequest(
          'http://localhost:3000/api/users',
          {
            email: 'test@example.com',
            type: 'CLIENT',
            status: 'ACTIVE',
          },
          {
            authorization: 'Bearer valid-token',
          }
        );

        const response = await POST(request);
        await expectErrorResponse(response, 500);
      });
    });
  });
});
