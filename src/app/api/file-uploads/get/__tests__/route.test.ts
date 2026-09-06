/**
 * GET /api/file-uploads/get lists file records + URLs for an entity. It must
 * require a session and only return files the caller owns (or any files for
 * ADMIN / SUPER_ADMIN / HELPDESK).
 */
jest.mock('@/lib/auth-middleware', () => ({ withAuth: jest.fn() }));
jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    fileUpload: { findMany: jest.fn() },
    cateringRequest: { findFirst: jest.fn() },
    onDemand: { findFirst: jest.fn() },
  },
}));

import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/utils/prismaDB';
import { GET } from '../route';
import { createGetRequest } from '@/__tests__/helpers/api-test-helpers';

const mockedWithAuth = withAuth as jest.Mock;
const mockedPrisma = prisma as any;

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';
const ORDER_ID = '33333333-3333-4333-8333-333333333333';

const authOk = (type: string, id = USER_ID) => ({
  success: true,
  context: { user: { id, email: 'u@rs.com', type } },
});

const url = (params: Record<string, string>) =>
  `http://localhost:3000/api/file-uploads/get?${new URLSearchParams(params)}`;

describe('GET /api/file-uploads/get', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.fileUpload.findMany.mockResolvedValue([]);
  });

  it('returns 401 when unauthenticated', async () => {
    mockedWithAuth.mockResolvedValue({
      success: false,
      response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
      context: {},
    });
    const res = await GET(createGetRequest(url({ entityId: USER_ID, entityType: 'user' })));
    expect(res.status).toBe(401);
    expect(mockedPrisma.fileUpload.findMany).not.toHaveBeenCalled();
  });

  it("returns 403 when a client lists another user's files", async () => {
    mockedWithAuth.mockResolvedValue(authOk('CLIENT'));
    const res = await GET(createGetRequest(url({ entityId: OTHER_ID, entityType: 'user' })));
    expect(res.status).toBe(403);
    expect(mockedPrisma.fileUpload.findMany).not.toHaveBeenCalled();
  });

  it('lets a user list their own files', async () => {
    mockedWithAuth.mockResolvedValue(authOk('CLIENT'));
    const res = await GET(createGetRequest(url({ entityId: USER_ID, entityType: 'user' })));
    expect(res.status).toBe(200);
    expect(mockedPrisma.fileUpload.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: USER_ID }) }),
    );
  });

  it("returns 403 for a catering order the caller doesn't own", async () => {
    mockedWithAuth.mockResolvedValue(authOk('CLIENT'));
    mockedPrisma.cateringRequest.findFirst.mockResolvedValue(null);
    const res = await GET(createGetRequest(url({ entityId: ORDER_ID, entityType: 'catering' })));
    expect(res.status).toBe(403);
    expect(mockedPrisma.cateringRequest.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: ORDER_ID, userId: USER_ID, deletedAt: null }),
      }),
    );
  });

  it('lists files for a catering order the caller owns', async () => {
    mockedWithAuth.mockResolvedValue(authOk('VENDOR'));
    mockedPrisma.cateringRequest.findFirst.mockResolvedValue({ id: ORDER_ID });
    const res = await GET(createGetRequest(url({ entityId: ORDER_ID, category: 'catering-order' })));
    expect(res.status).toBe(200);
  });

  it("returns 403 for an on-demand order the caller doesn't own", async () => {
    mockedWithAuth.mockResolvedValue(authOk('CLIENT'));
    mockedPrisma.onDemand.findFirst.mockResolvedValue(null);
    const res = await GET(createGetRequest(url({ entityId: ORDER_ID, entityType: 'on_demand' })));
    expect(res.status).toBe(403);
  });

  it('returns 403 when a non-staff caller lists job application files', async () => {
    mockedWithAuth.mockResolvedValue(authOk('DRIVER'));
    const res = await GET(createGetRequest(url({ entityId: ORDER_ID, entityType: 'job_application' })));
    expect(res.status).toBe(403);
  });

  it.each(['ADMIN', 'SUPER_ADMIN', 'HELPDESK'])('lets %s list any entity', async (type) => {
    mockedWithAuth.mockResolvedValue(authOk(type, 'staff-1'));
    for (const entityType of ['user', 'catering', 'on_demand', 'job_application']) {
      const res = await GET(createGetRequest(url({ entityId: OTHER_ID, entityType })));
      expect(res.status).toBe(200);
    }
    expect(mockedPrisma.cateringRequest.findFirst).not.toHaveBeenCalled();
    expect(mockedPrisma.onDemand.findFirst).not.toHaveBeenCalled();
  });

  it('still short-circuits entityId=new without hitting the database', async () => {
    mockedWithAuth.mockResolvedValue(authOk('CLIENT'));
    const res = await GET(createGetRequest(url({ entityId: 'new', entityType: 'user' })));
    expect(res.status).toBe(200);
    expect(mockedPrisma.fileUpload.findMany).not.toHaveBeenCalled();
  });
});
