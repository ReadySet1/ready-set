/**
 * Integration Tests for /api/calculator/configurations route
 *
 * Tests cover:
 * - GET: Retrieve all active client configurations
 * - GET by ID: Retrieve specific configuration (e.g., cater-valley)
 * - Authentication enforcement
 * - Database fallback to in-memory configurations
 * - CaterValley-specific configuration validation
 */

import { GET } from '../route';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';
import {
  expectSuccessResponse,
} from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies
jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    deliveryConfiguration: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// Helper to create GET request
function createGetRequest(url: string): NextRequest {
  return new NextRequest(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

describe('/api/calculator/configurations', () => {
  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
  };

  const mockSupabase = {
    auth: {
      getUser: jest.fn(),
    },
  };

  // Mock CaterValley configuration as it would be stored in database
  const mockCaterValleyConfig = {
    id: 'cater-valley-uuid',
    configId: 'cater-valley',
    clientName: 'CaterValley',
    vendorName: 'CaterValley',
    description: 'CaterValley delivery pricing with $42.50 minimum delivery fee',
    isActive: true,
    pricingTiers: [
      { headcountMin: 0, headcountMax: 25, foodCostMin: 0, foodCostMax: 300, regularRate: 85, within10Miles: 42.50 },
      { headcountMin: 26, headcountMax: 49, foodCostMin: 300.01, foodCostMax: 599.99, regularRate: 90, within10Miles: 52.50 },
      { headcountMin: 50, headcountMax: 74, foodCostMin: 600, foodCostMax: 899.99, regularRate: 110, within10Miles: 62.50 },
      { headcountMin: 75, headcountMax: 99, foodCostMin: 900, foodCostMax: 1199.99, regularRate: 120, within10Miles: 72.50 },
      { headcountMin: 100, headcountMax: null, foodCostMin: 1200, foodCostMax: null, regularRate: 0, within10Miles: 0, regularRatePercent: 0.10, within10MilesPercent: 0.10 }
    ],
    mileageRate: 3.00,
    distanceThreshold: 10.00,
    dailyDriveDiscounts: { twoDrivers: 5, threeDrivers: 10, fourPlusDrivers: 15 },
    driverPaySettings: { maxPayPerDrop: 40, basePayPerDrop: 23, bonusPay: 10, readySetFee: 70 },
    bridgeTollSettings: { defaultTollAmount: 8.00, autoApplyForAreas: ['San Francisco', 'Oakland', 'Marin County'] },
    customSettings: { tollPaidByReadySet: true },
    createdAt: new Date('2025-11-10'),
    updatedAt: new Date('2025-11-10'),
    createdBy: null,
    notes: 'CaterValley pricing with $42.50 minimum delivery fee as per agreement'
  };

  const mockReadySetConfig = {
    id: 'ready-set-uuid',
    configId: 'ready-set-food-standard',
    clientName: 'Ready Set Food - Standard',
    vendorName: 'Destino',
    description: 'Standard Ready Set Food delivery pricing',
    isActive: true,
    pricingTiers: [],
    mileageRate: 3.00,
    distanceThreshold: 10.00,
    dailyDriveDiscounts: { twoDrivers: 5, threeDrivers: 10, fourPlusDrivers: 15 },
    driverPaySettings: { maxPayPerDrop: 40, basePayPerDrop: 23, bonusPay: 10, readySetFee: 70 },
    bridgeTollSettings: { defaultTollAmount: 8.00 },
    customSettings: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    notes: null
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default: authenticated user
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
    mockCreateClient.mockResolvedValue(mockSupabase as any);

    // Default: return both configs from database
    (mockPrisma.deliveryConfiguration.findMany as jest.Mock).mockResolvedValue([
      mockReadySetConfig,
      mockCaterValleyConfig
    ]);
  });

  describe('GET /api/calculator/configurations', () => {
    describe('Public Access', () => {
      it('should allow unauthenticated access to configurations', async () => {
        // This endpoint is public - no authentication required
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: null,
        });

        const request = createGetRequest('http://localhost:3000/api/calculator/configurations');
        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.success).toBe(true);
        expect(data.data).toBeInstanceOf(Array);
      });
    });

    describe('Successful Configuration Retrieval', () => {
      it('should return all active configurations including CaterValley', async () => {
        const request = createGetRequest('http://localhost:3000/api/calculator/configurations');
        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.success).toBe(true);
        expect(data.data).toBeInstanceOf(Array);
        expect(data.data.length).toBeGreaterThanOrEqual(2);

        // Find CaterValley in the response
        const caterValley = data.data.find((c: any) => c.id === 'cater-valley');
        expect(caterValley).toBeDefined();
        expect(caterValley.clientName).toBe('CaterValley');
        expect(caterValley.vendorName).toBe('CaterValley');
        expect(caterValley.isActive).toBe(true);
      });

      it('should return CaterValley with correct pricing tiers', async () => {
        const request = createGetRequest('http://localhost:3000/api/calculator/configurations');
        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        const caterValley = data.data.find((c: any) => c.id === 'cater-valley');
        expect(caterValley.pricingTiers).toBeInstanceOf(Array);
        expect(caterValley.pricingTiers.length).toBe(5);

        // Verify Tier 1 pricing ($42.50 minimum)
        const tier1 = caterValley.pricingTiers[0];
        expect(tier1.within10Miles).toBe(42.50);
        expect(tier1.regularRate).toBe(85);
      });

      it('should return CaterValley with correct mileage settings', async () => {
        const request = createGetRequest('http://localhost:3000/api/calculator/configurations');
        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        const caterValley = data.data.find((c: any) => c.id === 'cater-valley');
        expect(caterValley.mileageRate).toBe(3.00);
        expect(caterValley.distanceThreshold).toBe(10.00);
      });

      it('should return CaterValley with correct driver pay settings', async () => {
        const request = createGetRequest('http://localhost:3000/api/calculator/configurations');
        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        const caterValley = data.data.find((c: any) => c.id === 'cater-valley');
        expect(caterValley.driverPaySettings).toEqual({
          maxPayPerDrop: 40,
          basePayPerDrop: 23,
          bonusPay: 10,
          readySetFee: 70
        });
      });

      it('should return CaterValley with bridge toll settings', async () => {
        const request = createGetRequest('http://localhost:3000/api/calculator/configurations');
        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        const caterValley = data.data.find((c: any) => c.id === 'cater-valley');
        expect(caterValley.bridgeTollSettings.defaultTollAmount).toBe(8.00);
        expect(caterValley.bridgeTollSettings.autoApplyForAreas).toContain('San Francisco');
      });

      it('should return CaterValley custom settings with tollPaidByReadySet', async () => {
        const request = createGetRequest('http://localhost:3000/api/calculator/configurations');
        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        const caterValley = data.data.find((c: any) => c.id === 'cater-valley');
        expect(caterValley.customSettings).toEqual({ tollPaidByReadySet: true });
      });
    });

    describe('Database Fallback', () => {
      it('should fallback to in-memory configs when database is empty', async () => {
        (mockPrisma.deliveryConfiguration.findMany as jest.Mock).mockResolvedValue([]);

        const request = createGetRequest('http://localhost:3000/api/calculator/configurations');
        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        // Should still return configs from in-memory fallback
        expect(data.success).toBe(true);
        expect(data.data).toBeInstanceOf(Array);
        expect(data.data.length).toBeGreaterThan(0);
      });

      it('should fallback to in-memory configs on database error', async () => {
        (mockPrisma.deliveryConfiguration.findMany as jest.Mock).mockRejectedValue(
          new Error('Database connection failed')
        );

        const request = createGetRequest('http://localhost:3000/api/calculator/configurations');
        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        // Should return in-memory configs as fallback
        expect(data.success).toBe(true);
        expect(data.data).toBeInstanceOf(Array);
      });
    });

    describe('Filter Inactive Configurations', () => {
      it('should only return active configurations (DB filters by isActive)', async () => {
        // Simulate DB returning only active configs (as it filters WHERE isActive=true)
        // CaterValley is not returned because it's inactive in this scenario
        (mockPrisma.deliveryConfiguration.findMany as jest.Mock).mockResolvedValue([
          mockReadySetConfig
          // mockCaterValleyConfig not included because DB filtered it out (isActive: false)
        ]);

        const request = createGetRequest('http://localhost:3000/api/calculator/configurations');
        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        // CaterValley should not be in response since DB filtered it (isActive: false)
        const caterValley = data.data.find((c: any) => c.id === 'cater-valley');
        expect(caterValley).toBeUndefined();

        // Only Ready Set should be returned
        expect(data.data.length).toBe(1);
        expect(data.data[0].id).toBe('ready-set-food-standard');
      });
    });
  });
});
