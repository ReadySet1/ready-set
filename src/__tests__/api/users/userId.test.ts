import { NextRequest } from 'next/server';
import { GET, PATCH } from '@/app/api/users/[userId]/route';

// Mocks
const mockSupabaseClient = {
  auth: {
    getUser: jest.fn(),
  },
};

jest.mock('@/utils/supabase/server', () => ({
  createClient: () => mockSupabaseClient,
}));

jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    profile: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import { prisma } from '@/utils/prismaDB';

/**
 * TODO: REA-211 - Users userId API tests have Supabase mocking issues
 */
describe.skip('/api/users/[userId] API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('returns snake_case fields and allows self access', async () => {
      // Authenticated user
      (mockSupabaseClient.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: { id: 'u1', email: 'user@example.com' } },
        error: null,
      });

      // First findUnique call: requester profile (type)
      // Second findUnique call: target profile (full record)
      (prisma.profile.findUnique as jest.Mock)
        .mockResolvedValueOnce({ type: 'client' })
        .mockResolvedValueOnce({
          id: 'u1',
          name: 'John Doe',
          email: 'user@example.com',
          contactNumber: '123-456',
          companyName: 'ACME Inc',
          website: 'https://acme.test',
          street1: '123 Main',
          street2: null,
          city: 'Austin',
          state: 'TX',
          zip: '78701',
          type: 'client',
          status: 'active',
          locationNumber: null,
          parkingLoading: null,
          counties: 'Travis, Williamson',
          timeNeeded: '30min, 1h',
          cateringBrokerage: 'yes',
          provide: 'food, drinks',
          frequency: 'weekly',
          headCount: 10,
          contactName: 'John',
        });

      const req = new Request('http://localhost:3000/api/users/u1', {
        method: 'GET',
      }) as NextRequest;

      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      // Ensure mapping to snake_case
      expect(data).toMatchObject({
        id: 'u1',
        name: 'John Doe',
        email: 'user@example.com',
        contact_number: '123-456',
        company_name: 'ACME Inc',
        city: 'Austin',
        state: 'TX',
        zip: '78701',
        contact_name: 'John',
      });
    });

    it('returns 401 if unauthenticated', async () => {
      (mockSupabaseClient.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const req = new Request('http://localhost:3000/api/users/u1', {
        method: 'GET',
      }) as NextRequest;

      const res = await GET(req);
      expect(res.status).toBe(401);
    });
  });

  describe('PATCH', () => {
    it('updates profile for self and returns snake_case response', async () => {
      (mockSupabaseClient.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: { id: 'u1', email: 'user@example.com' } },
        error: null,
      });

      // Requester type fetch
      (prisma.profile.findUnique as jest.Mock).mockResolvedValueOnce({ type: 'client' });

      // prisma update returns camelCase fields as stored
      (prisma.profile.update as jest.Mock).mockResolvedValue({
        id: 'u1',
        name: 'John Doe',
        email: 'user@example.com',
        contactNumber: '111-222',
        companyName: 'NewCo',
        website: null,
        street1: null,
        street2: null,
        city: null,
        state: null,
        zip: null,
        type: 'client',
        status: 'active',
        locationNumber: null,
        parkingLoading: null,
        counties: null,
        timeNeeded: null,
        cateringBrokerage: null,
        provide: null,
        frequency: null,
        headCount: null,
        sideNotes: null,
        contactName: 'John',
      });

      const body = {
        name: 'John Doe',
        contact_number: '111-222',
        company_name: 'NewCo',
      };

      const req = new Request('http://localhost:3000/api/users/u1', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }) as NextRequest;

      const res = await PATCH(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      // Ensure prisma was called with camelCase fields
      expect(prisma.profile.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: expect.objectContaining({
          name: 'John Doe',
          contactNumber: '111-222',
          companyName: 'NewCo',
        }),
      });

      // Ensure response contains snake_case fields at top-level
      expect(data).toMatchObject({
        contact_number: '111-222',
        company_name: 'NewCo',
        name: 'John Doe',
      });
      // And also in the nested user payload
      expect(data.user).toMatchObject({
        contact_number: '111-222',
        company_name: 'NewCo',
      });
    });

    it('returns 403 when updating another user without admin/helpdesk role', async () => {
      (mockSupabaseClient.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: { id: 'u2', email: 'user2@example.com' } },
        error: null,
      });
      // Requester is client (not admin/helpdesk)
      (prisma.profile.findUnique as jest.Mock).mockResolvedValueOnce({ type: 'client' });

      const req = new Request('http://localhost:3000/api/users/u1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Hacker' }),
      }) as NextRequest;

      const res = await PATCH(req);
      expect(res.status).toBe(403);
    });

    it('returns 401 when unauthenticated', async () => {
      (mockSupabaseClient.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const req = new Request('http://localhost:3000/api/users/u1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'John' }),
      }) as NextRequest;

      const res = await PATCH(req);
      expect(res.status).toBe(401);
    });
  });
});


