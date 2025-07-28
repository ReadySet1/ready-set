import { GET } from '@/app/api/users/profile/route';
import { NextRequest } from 'next/server';

// Mock Prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    profile: {
      findUnique: jest.fn(),
    },
  },
}));

// Mock Supabase
jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn(),
    },
  })),
}));

describe('GET /api/users/profile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 400 when email parameter is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/users/profile');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Email parameter is required');
  });

  it('should return 401 when user is not authenticated', async () => {
    const { createClient } = await import('@/utils/supabase/server');
    const mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    };
    (createClient as any).mockReturnValue(mockSupabase);

    const request = new NextRequest('http://localhost:3000/api/users/profile?email=test@example.com');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized: Authentication required');
  });

  it('should return 403 when user tries to access another user profile', async () => {
    const { createClient } = await import('@/utils/supabase/server');
    const { prisma } = await import('@/lib/db/prisma');

    const mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { 
            user: { 
              id: 'current-user-id',
              email: 'current@example.com'
            } 
          },
          error: null,
        }),
      },
    };
    (createClient as any).mockReturnValue(mockSupabase);

    // Mock profile lookup for different user
    (prisma.profile.findUnique as any).mockResolvedValue({
      id: 'other-user-id',
      email: 'other@example.com',
      type: 'CLIENT',
    });

    const request = new NextRequest('http://localhost:3000/api/users/profile?email=other@example.com');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Forbidden: Cannot access other user profiles');
  });

  it('should return 404 when profile is not found', async () => {
    const { createClient } = await import('@/utils/supabase/server');
    const { prisma } = await import('@/lib/db/prisma');

    const mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { 
            user: { 
              id: 'current-user-id',
              email: 'test@example.com'
            } 
          },
          error: null,
        }),
      },
    };
    (createClient as any).mockReturnValue(mockSupabase);

    // Mock profile not found
    (prisma.profile.findUnique as any).mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/users/profile?email=test@example.com');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Profile not found');
  });

  it('should return profile data for authenticated user', async () => {
    const { createClient } = await import('@/utils/supabase/server');
    const { prisma } = await import('@/lib/db/prisma');

    const mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { 
            user: { 
              id: 'current-user-id',
              email: 'test@example.com'
            } 
          },
          error: null,
        }),
      },
    };
    (createClient as any).mockReturnValue(mockSupabase);

    // Mock profile found
    const mockProfile = {
      id: 'current-user-id',
      email: 'test@example.com',
      name: 'Test User',
      type: 'CLIENT',
      contactNumber: '123-456-7890',
      companyName: 'Test Company',
      street1: '123 Test St',
      city: 'Test City',
      state: 'CA',
      zip: '12345',
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-01'),
    };
    (prisma.profile.findUnique as any).mockResolvedValue(mockProfile);

    const request = new NextRequest('http://localhost:3000/api/users/profile?email=test@example.com');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      id: 'current-user-id',
      email: 'test@example.com',
      name: 'Test User',
      type: 'CLIENT',
      contact_number: '123-456-7890',
      company_name: 'Test Company',
      street1: '123 Test St',
      city: 'Test City',
      state: 'CA',
      zip: '12345',
      created_at: '2023-01-01T00:00:00.000Z',
      updated_at: '2023-01-01T00:00:00.000Z',
    });
  });

  it('should handle database errors gracefully', async () => {
    const { createClient } = await import('@/utils/supabase/server');
    const { prisma } = await import('@/lib/db/prisma');

    const mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { 
            user: { 
              id: 'current-user-id',
              email: 'test@example.com'
            } 
          },
          error: null,
        }),
      },
    };
    (createClient as any).mockReturnValue(mockSupabase);

    // Mock database error
    (prisma.profile.findUnique as any).mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost:3000/api/users/profile?email=test@example.com');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Internal server error');
  });
}); 