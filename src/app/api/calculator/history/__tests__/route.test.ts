/**
 * Tests for /api/calculator/history route
 *
 * Tests cover:
 * - GET: Retrieve calculation history with filtering
 * - Authentication enforcement (Bearer token required)
 * - User role-based access control
 * - Query parameters (templateId, userId, limit)
 * - Error handling
 */

import { GET } from '../route';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/utils/prismaDB';
import { CalculatorService } from '@/lib/calculator/calculator-service';
import { NextRequest } from 'next/server';
import {
  expectSuccessResponse,
  expectUnauthorized,
  expectErrorResponse,
  expectServerError,
} from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies
jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    profile: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('@/lib/calculator/calculator-service', () => ({
  CalculatorService: {
    getCalculationHistory: jest.fn(),
  },
}));

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockCalculatorService = CalculatorService as jest.Mocked<typeof CalculatorService>;

// Helper to create request with Bearer token
function createAuthorizedRequest(
  url: string,
  token: string = 'valid-token'
): NextRequest {
  const request = new NextRequest(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  const urlObj = new URL(url);
  Object.defineProperty(request, 'url', { value: url, writable: true });
  if (!request.nextUrl) {
    Object.defineProperty(request, 'nextUrl', {
      value: urlObj,
      writable: true,
      configurable: true,
    });
  }
  return request;
}

function createUnauthorizedRequest(url: string): NextRequest {
  const request = new NextRequest(url);
  const urlObj = new URL(url);
  Object.defineProperty(request, 'url', { value: url, writable: true });
  if (!request.nextUrl) {
    Object.defineProperty(request, 'nextUrl', {
      value: urlObj,
      writable: true,
      configurable: true,
    });
  }
  return request;
}

describe('/api/calculator/history', () => {
  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
  };

  const mockUserProfile = {
    id: 'profile-id',
    email: 'test@example.com',
    type: 'CLIENT',
  };

  const mockAdminProfile = {
    id: 'admin-profile-id',
    email: 'admin@example.com',
    type: 'ADMIN',
  };

  const mockHistory = [
    {
      id: 'history-1',
      templateId: 'template-123',
      userId: 'profile-id',
      input: { headcount: 50, foodCost: 500, mileage: 5 },
      result: { totalDeliveryCost: 75.5, foodCost: 500, grandTotal: 575.5 },
      createdAt: '2024-01-15T10:00:00Z',
    },
    {
      id: 'history-2',
      templateId: 'template-123',
      userId: 'profile-id',
      input: { headcount: 100, foodCost: 1000, mileage: 10 },
      result: { totalDeliveryCost: 125.0, foodCost: 1000, grandTotal: 1125.0 },
      createdAt: '2024-01-14T10:00:00Z',
    },
  ];

  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
    };

    mockCreateClient.mockResolvedValue(mockSupabase);
    (mockPrisma.profile.findUnique as jest.Mock).mockResolvedValue(mockUserProfile);
    (mockCalculatorService.getCalculationHistory as jest.Mock).mockResolvedValue(mockHistory);
  });

  describe('GET /api/calculator/history', () => {
    describe('Authentication', () => {
      it('should return 401 when Authorization header is missing', async () => {
        const request = createUnauthorizedRequest(
          'http://localhost:3000/api/calculator/history'
        );

        const response = await GET(request);
        const data = await expectUnauthorized(response);
        expect(data.error).toContain('Invalid authorization header');
      });

      it('should return 401 when Authorization header does not start with Bearer', async () => {
        const request = new NextRequest('http://localhost:3000/api/calculator/history', {
          headers: {
            Authorization: 'Basic invalid-token',
          },
        });

        const response = await GET(request);
        await expectUnauthorized(response);
      });

      it('should return 401 when token is invalid', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: { message: 'Invalid token' },
        });

        const request = createAuthorizedRequest(
          'http://localhost:3000/api/calculator/history',
          'invalid-token'
        );

        const response = await GET(request);
        await expectUnauthorized(response, 'Unauthorized');
      });

      it('should return 404 when user profile is not found', async () => {
        (mockPrisma.profile.findUnique as jest.Mock).mockResolvedValue(null);

        const request = createAuthorizedRequest(
          'http://localhost:3000/api/calculator/history'
        );

        const response = await GET(request);
        const data = await expectErrorResponse(response, 404);
        expect(data.error).toContain('User profile not found');
      });
    });

    describe('Successful History Retrieval', () => {
      it('should retrieve history successfully', async () => {
        const request = createAuthorizedRequest(
          'http://localhost:3000/api/calculator/history'
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.success).toBe(true);
        expect(data.data).toHaveLength(2);
        expect(data).toHaveProperty('total', 2);
        expect(data).toHaveProperty('limit', 50);
        expect(data).toHaveProperty('timestamp');
      });

      it('should filter by templateId when provided', async () => {
        const request = createAuthorizedRequest(
          'http://localhost:3000/api/calculator/history?templateId=template-123'
        );

        await GET(request);

        expect(mockCalculatorService.getCalculationHistory).toHaveBeenCalledWith(
          mockSupabase,
          expect.objectContaining({
            templateId: 'template-123',
          })
        );
      });

      it('should use custom limit when provided', async () => {
        const request = createAuthorizedRequest(
          'http://localhost:3000/api/calculator/history?limit=25'
        );

        await GET(request);

        expect(mockCalculatorService.getCalculationHistory).toHaveBeenCalledWith(
          mockSupabase,
          expect.objectContaining({
            limit: 25,
          })
        );
      });

      it('should default to limit of 50', async () => {
        const request = createAuthorizedRequest(
          'http://localhost:3000/api/calculator/history'
        );

        await GET(request);

        expect(mockCalculatorService.getCalculationHistory).toHaveBeenCalledWith(
          mockSupabase,
          expect.objectContaining({
            limit: 50,
          })
        );
      });

      it('should cap limit at 100', async () => {
        const request = createAuthorizedRequest(
          'http://localhost:3000/api/calculator/history?limit=200'
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.limit).toBe(100);
      });

      it('should enforce minimum limit of 1', async () => {
        const request = createAuthorizedRequest(
          'http://localhost:3000/api/calculator/history?limit=0'
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.limit).toBe(1);
      });
    });

    describe('Role-Based Access Control', () => {
      it('should restrict non-admin users to their own history', async () => {
        (mockPrisma.profile.findUnique as jest.Mock).mockResolvedValue(mockUserProfile);

        const request = createAuthorizedRequest(
          'http://localhost:3000/api/calculator/history?userId=other-user-id'
        );

        await GET(request);

        // Non-admin should only see their own history regardless of userId param
        expect(mockCalculatorService.getCalculationHistory).toHaveBeenCalledWith(
          mockSupabase,
          expect.objectContaining({
            userId: 'profile-id', // Their own profile ID, not the requested userId
          })
        );
      });

      it('should allow admin users to query any userId', async () => {
        (mockPrisma.profile.findUnique as jest.Mock).mockResolvedValue(mockAdminProfile);

        const request = createAuthorizedRequest(
          'http://localhost:3000/api/calculator/history?userId=other-user-id'
        );

        await GET(request);

        expect(mockCalculatorService.getCalculationHistory).toHaveBeenCalledWith(
          mockSupabase,
          expect.objectContaining({
            userId: 'other-user-id',
          })
        );
      });

      it('should allow SUPER_ADMIN users to query any userId', async () => {
        const superAdminProfile = { ...mockAdminProfile, type: 'SUPER_ADMIN' };
        (mockPrisma.profile.findUnique as jest.Mock).mockResolvedValue(superAdminProfile);

        const request = createAuthorizedRequest(
          'http://localhost:3000/api/calculator/history?userId=other-user-id'
        );

        await GET(request);

        expect(mockCalculatorService.getCalculationHistory).toHaveBeenCalledWith(
          mockSupabase,
          expect.objectContaining({
            userId: 'other-user-id',
          })
        );
      });

      it('should use admin user ID when no userId is specified', async () => {
        (mockPrisma.profile.findUnique as jest.Mock).mockResolvedValue(mockAdminProfile);

        const request = createAuthorizedRequest(
          'http://localhost:3000/api/calculator/history'
        );

        await GET(request);

        expect(mockCalculatorService.getCalculationHistory).toHaveBeenCalledWith(
          mockSupabase,
          expect.objectContaining({
            userId: undefined,
          })
        );
      });
    });

    describe('Error Handling', () => {
      it('should return 500 when service throws error', async () => {
        (mockCalculatorService.getCalculationHistory as jest.Mock).mockRejectedValue(
          new Error('Database error')
        );

        const request = createAuthorizedRequest(
          'http://localhost:3000/api/calculator/history'
        );

        const response = await GET(request);
        await expectServerError(response);
      });

      it('should return empty array when no history exists', async () => {
        (mockCalculatorService.getCalculationHistory as jest.Mock).mockResolvedValue([]);

        const request = createAuthorizedRequest(
          'http://localhost:3000/api/calculator/history'
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.data).toEqual([]);
        expect(data.total).toBe(0);
      });
    });
  });
});
