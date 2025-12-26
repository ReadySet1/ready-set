// src/__tests__/api/drivers.test.ts
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/drivers/route';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/utils/prismaDB';

// Mock dependencies
jest.mock('@/utils/supabase/server');
jest.mock('@/utils/prismaDB');
jest.mock('@/lib/auth-middleware');

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

/**
 * TODO: REA-211 - Drivers API tests have Supabase/Prisma mocking issues
 */
describe.skip('/api/drivers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/drivers', () => {
    it('allows DRIVER role to access the endpoint', async () => {
      // Mock authenticated user with DRIVER role
      const mockSupabaseClient = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'driver-123', email: 'driver@test.com' } },
            error: null,
          }),
        },
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { type: 'DRIVER' },
                error: null,
              }),
            }),
          }),
        }),
      };

      mockCreateClient.mockResolvedValue(mockSupabaseClient as any);

      // Mock driver data
      const mockDrivers = [
        {
          id: 'driver-1',
          name: 'John Driver',
          email: 'john@test.com',
          contactNumber: '1234567890',
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrisma.profile.findMany.mockResolvedValue(mockDrivers);

      const request = new NextRequest('http://localhost:3000/api/drivers');

      const response = await GET(request);

      expect(response.status).toBe(200);
      const responseData = await response.json();
      expect(Array.isArray(responseData)).toBe(true);
      expect(responseData).toHaveLength(1);
      expect(responseData[0]).toMatchObject({
        id: 'driver-1',
        name: 'John Driver',
        email: 'john@test.com',
      });
    });

    it('allows ADMIN role to access the endpoint', async () => {
      // Mock authenticated user with ADMIN role
      const mockSupabaseClient = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'admin-123', email: 'admin@test.com' } },
            error: null,
          }),
        },
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { type: 'ADMIN' },
                error: null,
              }),
            }),
          }),
        }),
      };

      mockCreateClient.mockResolvedValue(mockSupabaseClient as any);

      // Mock driver data
      const mockDrivers = [
        {
          id: 'driver-1',
          name: 'John Driver',
          email: 'john@test.com',
          contactNumber: '1234567890',
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrisma.profile.findMany.mockResolvedValue(mockDrivers);

      const request = new NextRequest('http://localhost:3000/api/drivers');

      const response = await GET(request);

      expect(response.status).toBe(200);
      const responseData = await response.json();
      expect(Array.isArray(responseData)).toBe(true);
    });

    it('allows HELPDESK role to access the endpoint', async () => {
      // Mock authenticated user with HELPDESK role
      const mockSupabaseClient = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'helpdesk-123', email: 'helpdesk@test.com' } },
            error: null,
          }),
        },
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { type: 'HELPDESK' },
                error: null,
              }),
            }),
          }),
        }),
      };

      mockCreateClient.mockResolvedValue(mockSupabaseClient as any);

      // Mock driver data
      const mockDrivers = [
        {
          id: 'driver-1',
          name: 'John Driver',
          email: 'john@test.com',
          contactNumber: '1234567890',
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrisma.profile.findMany.mockResolvedValue(mockDrivers);

      const request = new NextRequest('http://localhost:3000/api/drivers');

      const response = await GET(request);

      expect(response.status).toBe(200);
      const responseData = await response.json();
      expect(Array.isArray(responseData)).toBe(true);
    });

    it('denies access for unauthorized roles like VENDOR', async () => {
      // Mock authenticated user with VENDOR role (not in allowed list)
      const mockSupabaseClient = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'vendor-123', email: 'vendor@test.com' } },
            error: null,
          }),
        },
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { type: 'VENDOR' },
                error: null,
              }),
            }),
          }),
        }),
      };

      mockCreateClient.mockResolvedValue(mockSupabaseClient as any);

      const request = new NextRequest('http://localhost:3000/api/drivers');

      const response = await GET(request);

      expect(response.status).toBe(403);
      const responseData = await response.json();
      expect(responseData).toMatchObject({
        error: 'Insufficient permissions',
      });
    });
  });
});
