/**
 * POST /api/calculator/configurations?mode=create
 *
 * Creating a brand-new client configuration (no in-memory counterpart):
 * - admin-only
 * - validates the config and the key format
 * - rejects duplicate keys (DB row OR in-memory registry) with 409
 * - inserts the row and audits the create
 */

import { POST } from '../route';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';
import { buildNewClientConfiguration } from '@/lib/calculator/new-client-configuration';

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    deliveryConfiguration: {
      findUnique: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockFindUnique = prisma.deliveryConfiguration.findUnique as jest.Mock;
const mockCreate = prisma.deliveryConfiguration.create as jest.Mock;
const mockUpsert = prisma.deliveryConfiguration.upsert as jest.Mock;

const CREATE_URL = 'http://localhost:3000/api/calculator/configurations?mode=create';

function postRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function dbRowFor(config: ReturnType<typeof buildNewClientConfiguration>) {
  return {
    id: 'row-uuid',
    configId: config.id,
    clientName: config.clientName,
    vendorName: config.vendorName,
    description: null,
    isActive: true,
    pricingTiers: config.pricingTiers,
    mileageRate: config.mileageRate,
    distanceThreshold: config.distanceThreshold,
    dailyDriveDiscounts: config.dailyDriveDiscounts,
    driverPaySettings: config.driverPaySettings,
    bridgeTollSettings: config.bridgeTollSettings,
    zeroOrderSettings: null,
    customSettings: null,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
    createdBy: 'admin-id',
    notes: null,
  };
}

describe('POST /api/calculator/configurations?mode=create', () => {
  const now = new Date('2026-10-15T00:00:00Z');
  const newClient = buildNewClientConfiguration(
    { id: 'brand-new-client', clientName: 'Brand New Client' },
    now,
  );

  let profileType: string | null;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    profileType = 'admin';

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'admin-id', email: 'admin@example.com' } },
          error: null,
        }),
      },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockImplementation(async () => ({
          data: profileType ? { type: profileType } : null,
        })),
      }),
    } as any);

    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockImplementation(async ({ data }: any) =>
      dbRowFor({ ...newClient, ...data, id: data.configId }),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects non-admin callers with 403', async () => {
    profileType = 'client';

    const response = await POST(postRequest(CREATE_URL, newClient));

    expect(response.status).toBe(403);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('creates the row, returns 201 and audits the create', async () => {
    const response = await POST(postRequest(CREATE_URL, newClient));
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('brand-new-client');
    expect(data.data.clientName).toBe('Brand New Client');

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        configId: 'brand-new-client',
        clientName: 'Brand New Client',
        createdBy: 'admin-id',
      }),
    });
    expect(mockUpsert).not.toHaveBeenCalled();

    const auditLine = (console.log as jest.Mock).mock.calls
      .map((call) => call.join(' '))
      .find((line) => line.includes('[AUDIT]'));
    expect(auditLine).toContain('"action":"create"');
    expect(auditLine).toContain('"configId":"brand-new-client"');
  });

  it('returns 409 when the key already exists in the database', async () => {
    mockFindUnique.mockResolvedValue(dbRowFor(newClient));

    const response = await POST(postRequest(CREATE_URL, newClient));
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toMatch(/already exists/i);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 409 when the key shadows an in-memory configuration', async () => {
    const shadowing = { ...newClient, id: 'kasa' };

    const response = await POST(postRequest(CREATE_URL, shadowing));

    expect(response.status).toBe(409);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 409 when the insert races a concurrent create (P2002)', async () => {
    mockCreate.mockRejectedValue(Object.assign(new Error('Unique constraint'), { code: 'P2002' }));

    const response = await POST(postRequest(CREATE_URL, newClient));

    expect(response.status).toBe(409);
  });

  it('returns 400 for a malformed key', async () => {
    const response = await POST(postRequest(CREATE_URL, { ...newClient, id: 'Bad Key!' }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toMatch(/invalid configuration key/i);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 400 when the configuration itself is invalid', async () => {
    const response = await POST(postRequest(CREATE_URL, { ...newClient, clientName: '' }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.details).toEqual(expect.arrayContaining(['Client name is required']));
  });

  it('keeps upsert semantics when mode=create is absent', async () => {
    mockUpsert.mockResolvedValue(dbRowFor(newClient));

    const response = await POST(
      postRequest('http://localhost:3000/api/calculator/configurations', newClient),
    );

    expect(response.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
