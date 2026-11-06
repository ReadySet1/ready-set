/**
 * GET /api/calculator/config — resolution of a DB-only client
 *
 * Clients created from the admin panel exist only in delivery_configurations;
 * they have no entry in the in-memory CLIENT_CONFIGURATIONS registry. The
 * resolver must still return them (DB-first) and must not require the
 * in-memory map for the driver-pay flag merge.
 */

import { GET } from '../route';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/lib/prisma';
import { getConfiguration } from '@/lib/calculator/client-configurations';
import { createRequestWithParams, expectSuccessResponse } from '@/__tests__/helpers/api-test-helpers';

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    deliveryConfiguration: {
      findFirst: jest.fn(),
    },
  },
}));

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockFindFirst = prisma.deliveryConfiguration.findFirst as jest.Mock;

const dbOnlyRow = {
  id: 'row-uuid',
  configId: 'db-only-client',
  clientName: 'DB Only Client',
  vendorName: 'DB Only Vendor',
  description: null,
  isActive: true,
  pricingTiers: [
    { headcountMin: 0, headcountMax: null, foodCostMin: 0, foodCostMax: null, regularRate: 70, within10Miles: 40 },
  ],
  mileageRate: { toString: () => '2.75' },
  distanceThreshold: { toString: () => '12' },
  dailyDriveDiscounts: { twoDrivers: 5, threeDrivers: 10, fourPlusDrivers: 15 },
  driverPaySettings: { maxPayPerDrop: 35, basePayPerDrop: 20, bonusPay: 8, readySetFee: 60 },
  bridgeTollSettings: { defaultTollAmount: 8.5 },
  zeroOrderSettings: null,
  customSettings: null,
  createdAt: new Date('2026-10-15'),
  updatedAt: new Date('2026-10-15'),
};

describe('GET /api/calculator/config with a DB-only client', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    const templateQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: 'template-123', name: 'Standard', description: null, is_active: true, created_at: '', updated_at: '' },
        error: null,
      }),
    };
    const rulesQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: [], error: null }),
    };
    const legacyConfigQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
    };

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }),
      },
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'calculator_templates') return templateQuery;
        if (table === 'pricing_rules') return rulesQuery;
        if (table === 'client_configurations') return legacyConfigQuery;
        return {};
      }),
    } as any);
  });

  it('has no in-memory counterpart for the fixture key (precondition)', () => {
    expect(getConfiguration('db-only-client')).toBeNull();
  });

  it('resolves the client from the database without an in-memory fallback entry', async () => {
    mockFindFirst.mockResolvedValue(dbOnlyRow);

    const response = await GET(
      createRequestWithParams('http://localhost:3000/api/calculator/config', {
        templateId: 'template-123',
        clientConfigId: 'db-only-client',
      }),
    );
    const data = await expectSuccessResponse(response, 200);

    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { configId: 'db-only-client', isActive: true },
    });
    expect(data.data.clientConfig).toMatchObject({
      id: 'db-only-client',
      clientId: 'db-only-client',
      clientName: 'DB Only Client',
      vendorName: 'DB Only Vendor',
      mileageRate: 2.75,
      distanceThreshold: 12,
      driverPaySettings: { maxPayPerDrop: 35, basePayPerDrop: 20, bonusPay: 8, readySetFee: 60 },
    });
    expect(data.data.clientConfig.pricingTiers).toHaveLength(1);
  });

  it('returns null clientConfig when the DB-only key is unknown everywhere', async () => {
    mockFindFirst.mockResolvedValue(null);

    const response = await GET(
      createRequestWithParams('http://localhost:3000/api/calculator/config', {
        templateId: 'template-123',
        clientConfigId: 'db-only-client',
      }),
    );
    const data = await expectSuccessResponse(response, 200);

    expect(data.data.clientConfig).toBeNull();
  });
});
