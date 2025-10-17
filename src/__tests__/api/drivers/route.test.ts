// src/__tests__/api/drivers/route.test.ts

// Mock dependencies before any imports
jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    profile: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/auth-middleware');

import { GET } from '@/app/api/drivers/route';
import { prisma } from '@/utils/prismaDB';
import { withAuth } from '@/lib/auth-middleware';
import { createGetRequest } from '@/__tests__/helpers/api-test-helpers';
import type { AuthResult } from '@/lib/auth-middleware';

describe('/api/drivers GET API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('✅ Successful Driver Retrieval', () => {
    it('should return all drivers for ADMIN role', async () => {
      const mockDrivers = [
        {
          id: 'driver-1',
          name: 'John Driver',
          email: 'john@example.com',
          contactNumber: '555-0101',
          status: 'ACTIVE',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: 'driver-2',
          name: 'Jane Driver',
          email: 'jane@example.com',
          contactNumber: '555-0102',
          status: 'ACTIVE',
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
        },
      ];

      (withAuth as jest.Mock).mockResolvedValue({
        success: true,
        context: {
          user: {
            id: 'admin-1',
            email: 'admin@example.com',
            type: 'ADMIN',
          },
          isAdmin: true,
          isSuperAdmin: false,
        },
      } as AuthResult);

      (prisma.profile.findMany as jest.Mock).mockResolvedValue(mockDrivers);

      const request = createGetRequest('http://localhost:3000/api/drivers');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockDrivers);
      expect(prisma.profile.findMany).toHaveBeenCalledWith({
        where: { type: 'DRIVER' },
        select: {
          id: true,
          name: true,
          email: true,
          contactNumber: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    it('should return all drivers for SUPER_ADMIN role', async () => {
      const mockDrivers = [
        {
          id: 'driver-1',
          name: 'John Driver',
          email: 'john@example.com',
          contactNumber: '555-0101',
          status: 'ACTIVE',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ];

      (withAuth as jest.Mock).mockResolvedValue({
        success: true,
        context: {
          user: {
            id: 'super-admin-1',
            email: 'superadmin@example.com',
            type: 'SUPER_ADMIN',
          },
          isAdmin: true,
          isSuperAdmin: true,
        },
      } as AuthResult);

      (prisma.profile.findMany as jest.Mock).mockResolvedValue(mockDrivers);

      const request = createGetRequest('http://localhost:3000/api/drivers');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockDrivers);
    });

    it('should return all drivers for HELPDESK role', async () => {
      const mockDrivers = [
        {
          id: 'driver-1',
          name: 'John Driver',
          email: 'john@example.com',
          contactNumber: '555-0101',
          status: 'ACTIVE',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ];

      (withAuth as jest.Mock).mockResolvedValue({
        success: true,
        context: {
          user: {
            id: 'helpdesk-1',
            email: 'helpdesk@example.com',
            type: 'HELPDESK',
          },
          isHelpdesk: true,
        },
      } as AuthResult);

      (prisma.profile.findMany as jest.Mock).mockResolvedValue(mockDrivers);

      const request = createGetRequest('http://localhost:3000/api/drivers');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockDrivers);
    });

    it('should return all drivers for CLIENT role', async () => {
      const mockDrivers = [
        {
          id: 'driver-1',
          name: 'John Driver',
          email: 'john@example.com',
          contactNumber: '555-0101',
          status: 'ACTIVE',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ];

      (withAuth as jest.Mock).mockResolvedValue({
        success: true,
        context: {
          user: {
            id: 'client-1',
            email: 'client@example.com',
            type: 'CLIENT',
          },
        },
      } as AuthResult);

      (prisma.profile.findMany as jest.Mock).mockResolvedValue(mockDrivers);

      const request = createGetRequest('http://localhost:3000/api/drivers');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockDrivers);
    });

    it('should return all drivers for DRIVER role', async () => {
      const mockDrivers = [
        {
          id: 'driver-1',
          name: 'John Driver',
          email: 'john@example.com',
          contactNumber: '555-0101',
          status: 'ACTIVE',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ];

      (withAuth as jest.Mock).mockResolvedValue({
        success: true,
        context: {
          user: {
            id: 'driver-1',
            email: 'driver@example.com',
            type: 'DRIVER',
            driverId: 'driver-1',
          },
        },
      } as AuthResult);

      (prisma.profile.findMany as jest.Mock).mockResolvedValue(mockDrivers);

      const request = createGetRequest('http://localhost:3000/api/drivers');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockDrivers);
    });

    it('should return empty array when no drivers exist', async () => {
      (withAuth as jest.Mock).mockResolvedValue({
        success: true,
        context: {
          user: {
            id: 'admin-1',
            email: 'admin@example.com',
            type: 'ADMIN',
          },
          isAdmin: true,
        },
      } as AuthResult);

      (prisma.profile.findMany as jest.Mock).mockResolvedValue([]);

      const request = createGetRequest('http://localhost:3000/api/drivers');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual([]);
    });
  });

  describe('❌ Authentication and Authorization Failures', () => {
    it('should return 401 when authentication fails', async () => {
      const mockErrorResponse = {
        json: async () => ({ error: 'Authentication required' }),
        status: 401,
      };

      (withAuth as jest.Mock).mockResolvedValue({
        success: false,
        response: mockErrorResponse,
        context: {},
      } as AuthResult);

      const request = createGetRequest('http://localhost:3000/api/drivers');
      const response = await GET(request);

      expect(response).toBe(mockErrorResponse);
      expect(prisma.profile.findMany).not.toHaveBeenCalled();
    });

    it('should return 403 for unauthorized role', async () => {
      const mockErrorResponse = {
        json: async () => ({ error: 'Insufficient permissions' }),
        status: 403,
      };

      (withAuth as jest.Mock).mockResolvedValue({
        success: false,
        response: mockErrorResponse,
        context: {},
      } as AuthResult);

      const request = createGetRequest('http://localhost:3000/api/drivers');
      const response = await GET(request);

      expect(response).toBe(mockErrorResponse);
      expect(prisma.profile.findMany).not.toHaveBeenCalled();
    });

    it('should return 403 when user role is not found', async () => {
      const mockErrorResponse = {
        json: async () => ({ error: 'User role not found' }),
        status: 403,
      };

      (withAuth as jest.Mock).mockResolvedValue({
        success: false,
        response: mockErrorResponse,
        context: {},
      } as AuthResult);

      const request = createGetRequest('http://localhost:3000/api/drivers');
      const response = await GET(request);

      expect(response).toBe(mockErrorResponse);
      expect(prisma.profile.findMany).not.toHaveBeenCalled();
    });
  });

  describe('🗄️ Database Error Handling', () => {
    it('should return 500 when database query fails', async () => {
      (withAuth as jest.Mock).mockResolvedValue({
        success: true,
        context: {
          user: {
            id: 'admin-1',
            email: 'admin@example.com',
            type: 'ADMIN',
          },
          isAdmin: true,
        },
      } as AuthResult);

      (prisma.profile.findMany as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = createGetRequest('http://localhost:3000/api/drivers');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch drivers');
    });

    it('should handle database timeout errors', async () => {
      (withAuth as jest.Mock).mockResolvedValue({
        success: true,
        context: {
          user: {
            id: 'admin-1',
            email: 'admin@example.com',
            type: 'ADMIN',
          },
          isAdmin: true,
        },
      } as AuthResult);

      (prisma.profile.findMany as jest.Mock).mockRejectedValue(
        new Error('Query timeout exceeded')
      );

      const request = createGetRequest('http://localhost:3000/api/drivers');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch drivers');
    });

    it('should handle null database response', async () => {
      (withAuth as jest.Mock).mockResolvedValue({
        success: true,
        context: {
          user: {
            id: 'admin-1',
            email: 'admin@example.com',
            type: 'ADMIN',
          },
          isAdmin: true,
        },
      } as AuthResult);

      (prisma.profile.findMany as jest.Mock).mockResolvedValue(null);

      const request = createGetRequest('http://localhost:3000/api/drivers');
      const response = await GET(request);
      const data = await response.json();

      // Null gets returned as-is by NextResponse.json
      expect(response.status).toBe(200);
      expect(data).toBeNull();
    });
  });

  describe('📊 Response Format Tests', () => {
    it('should return drivers with only allowed fields', async () => {
      const mockDrivers = [
        {
          id: 'driver-1',
          name: 'John Driver',
          email: 'john@example.com',
          contactNumber: '555-0101',
          status: 'ACTIVE',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ];

      (withAuth as jest.Mock).mockResolvedValue({
        success: true,
        context: {
          user: {
            id: 'admin-1',
            email: 'admin@example.com',
            type: 'ADMIN',
          },
          isAdmin: true,
        },
      } as AuthResult);

      (prisma.profile.findMany as jest.Mock).mockResolvedValue(mockDrivers);

      const request = createGetRequest('http://localhost:3000/api/drivers');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data[0]).toHaveProperty('id');
      expect(data[0]).toHaveProperty('name');
      expect(data[0]).toHaveProperty('email');
      expect(data[0]).toHaveProperty('contactNumber');
      expect(data[0]).toHaveProperty('status');
      expect(data[0]).toHaveProperty('createdAt');
      expect(data[0]).toHaveProperty('updatedAt');
    });

    it('should not include sensitive driver fields', async () => {
      const mockDrivers = [
        {
          id: 'driver-1',
          name: 'John Driver',
          email: 'john@example.com',
          contactNumber: '555-0101',
          status: 'ACTIVE',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ];

      (withAuth as jest.Mock).mockResolvedValue({
        success: true,
        context: {
          user: {
            id: 'admin-1',
            email: 'admin@example.com',
            type: 'ADMIN',
          },
          isAdmin: true,
        },
      } as AuthResult);

      (prisma.profile.findMany as jest.Mock).mockResolvedValue(mockDrivers);

      const request = createGetRequest('http://localhost:3000/api/drivers');
      const response = await GET(request);
      const data = await response.json();

      expect(data[0]).not.toHaveProperty('password');
      expect(data[0]).not.toHaveProperty('ssn');
      expect(data[0]).not.toHaveProperty('driverLicense');
      expect(prisma.profile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.not.objectContaining({
            password: true,
            ssn: true,
            driverLicense: true,
          }),
        })
      );
    });

    it('should return consistent array structure', async () => {
      (withAuth as jest.Mock).mockResolvedValue({
        success: true,
        context: {
          user: {
            id: 'admin-1',
            email: 'admin@example.com',
            type: 'ADMIN',
          },
          isAdmin: true,
        },
      } as AuthResult);

      (prisma.profile.findMany as jest.Mock).mockResolvedValue([]);

      const request = createGetRequest('http://localhost:3000/api/drivers');
      const response = await GET(request);
      const data = await response.json();

      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('🔒 Security Tests', () => {
    it('should not expose database errors to client', async () => {
      (withAuth as jest.Mock).mockResolvedValue({
        success: true,
        context: {
          user: {
            id: 'admin-1',
            email: 'admin@example.com',
            type: 'ADMIN',
          },
          isAdmin: true,
        },
      } as AuthResult);

      (prisma.profile.findMany as jest.Mock).mockRejectedValue(
        new Error('Internal database error: Connection string postgres://user:pass@host')
      );

      const request = createGetRequest('http://localhost:3000/api/drivers');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch drivers');
      expect(data.error).not.toContain('postgres');
      expect(data.error).not.toContain('Connection string');
    });

    it('should verify auth middleware is called with correct options', async () => {
      (withAuth as jest.Mock).mockResolvedValue({
        success: true,
        context: {
          user: {
            id: 'admin-1',
            email: 'admin@example.com',
            type: 'ADMIN',
          },
          isAdmin: true,
        },
      } as AuthResult);

      (prisma.profile.findMany as jest.Mock).mockResolvedValue([]);

      const request = createGetRequest('http://localhost:3000/api/drivers');
      await GET(request);

      expect(withAuth).toHaveBeenCalledWith(request, {
        allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'HELPDESK', 'CLIENT', 'DRIVER'],
        requireAuth: true,
      });
    });

    it('should only fetch DRIVER type profiles', async () => {
      (withAuth as jest.Mock).mockResolvedValue({
        success: true,
        context: {
          user: {
            id: 'admin-1',
            email: 'admin@example.com',
            type: 'ADMIN',
          },
          isAdmin: true,
        },
      } as AuthResult);

      (prisma.profile.findMany as jest.Mock).mockResolvedValue([]);

      const request = createGetRequest('http://localhost:3000/api/drivers');
      await GET(request);

      expect(prisma.profile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { type: 'DRIVER' },
        })
      );
    });
  });

  describe('📈 Data Integrity Tests', () => {
    it('should handle multiple drivers with different statuses', async () => {
      const mockDrivers = [
        {
          id: 'driver-1',
          name: 'John Driver',
          email: 'john@example.com',
          contactNumber: '555-0101',
          status: 'ACTIVE',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: 'driver-2',
          name: 'Jane Driver',
          email: 'jane@example.com',
          contactNumber: '555-0102',
          status: 'INACTIVE',
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
        },
        {
          id: 'driver-3',
          name: 'Bob Driver',
          email: 'bob@example.com',
          contactNumber: '555-0103',
          status: 'SUSPENDED',
          createdAt: new Date('2024-01-03'),
          updatedAt: new Date('2024-01-03'),
        },
      ];

      (withAuth as jest.Mock).mockResolvedValue({
        success: true,
        context: {
          user: {
            id: 'admin-1',
            email: 'admin@example.com',
            type: 'ADMIN',
          },
          isAdmin: true,
        },
      } as AuthResult);

      (prisma.profile.findMany as jest.Mock).mockResolvedValue(mockDrivers);

      const request = createGetRequest('http://localhost:3000/api/drivers');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(3);
      expect(data[0].status).toBe('ACTIVE');
      expect(data[1].status).toBe('INACTIVE');
      expect(data[2].status).toBe('SUSPENDED');
    });

    it('should preserve Date objects in response', async () => {
      const createdDate = new Date('2024-01-01T10:00:00Z');
      const updatedDate = new Date('2024-01-02T15:30:00Z');

      const mockDrivers = [
        {
          id: 'driver-1',
          name: 'John Driver',
          email: 'john@example.com',
          contactNumber: '555-0101',
          status: 'ACTIVE',
          createdAt: createdDate,
          updatedAt: updatedDate,
        },
      ];

      (withAuth as jest.Mock).mockResolvedValue({
        success: true,
        context: {
          user: {
            id: 'admin-1',
            email: 'admin@example.com',
            type: 'ADMIN',
          },
          isAdmin: true,
        },
      } as AuthResult);

      (prisma.profile.findMany as jest.Mock).mockResolvedValue(mockDrivers);

      const request = createGetRequest('http://localhost:3000/api/drivers');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data[0].createdAt).toBeDefined();
      expect(data[0].updatedAt).toBeDefined();
    });
  });
});
