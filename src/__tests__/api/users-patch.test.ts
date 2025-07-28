import { PATCH } from '@/app/api/users/[userId]/route';
import { NextRequest } from 'next/server';

// Mock Prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    profile: {
      findUnique: jest.fn(),
      update: jest.fn(),
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

describe('PATCH /api/users/[userId]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 400 when userId is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/users/', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Test User' }),
    });
    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('User ID is required');
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

    const request = new NextRequest('http://localhost:3000/api/users/test-user-id', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Test User' }),
    });
    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized: Authentication required');
  });

  it('should return 403 when user tries to update another user profile', async () => {
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

    const request = new NextRequest('http://localhost:3000/api/users/other-user-id', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Test User' }),
    });
    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Forbidden: Cannot update other user profiles');
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

    const request = new NextRequest('http://localhost:3000/api/users/current-user-id', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Test User' }),
    });
    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Profile not found');
  });

  it('should successfully update user profile', async () => {
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

    // Mock existing profile
    const existingProfile = {
      id: 'current-user-id',
      email: 'test@example.com',
      name: 'Old Name',
      type: 'CLIENT',
      contactNumber: '123-456-7890',
      companyName: 'Old Company',
      street1: '123 Old St',
      city: 'Old City',
      state: 'CA',
      zip: '12345',
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-01'),
    };
    (prisma.profile.findUnique as any).mockResolvedValue(existingProfile);

    // Mock updated profile
    const updatedProfile = {
      ...existingProfile,
      name: 'New Name',
      contactNumber: '987-654-3210',
      companyName: 'New Company',
      street1: '456 New St',
      city: 'New City',
      updatedAt: new Date('2023-01-02'),
    };
    (prisma.profile.update as any).mockResolvedValue(updatedProfile);

    const requestBody = {
      name: 'New Name',
      contact_number: '987-654-3210',
      company_name: 'New Company',
      street1: '456 New St',
      city: 'New City',
    };

    const request = new NextRequest('http://localhost:3000/api/users/current-user-id', {
      method: 'PATCH',
      body: JSON.stringify(requestBody),
    });
    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe('User profile updated successfully');
    expect(data).toHaveProperty('id', 'current-user-id');
    expect(data).toHaveProperty('name', 'New Name');
    expect(data).toHaveProperty('contact_number', '987-654-3210');
    expect(data).toHaveProperty('company_name', 'New Company');
    expect(data).toHaveProperty('street1', '456 New St');
    expect(data).toHaveProperty('city', 'New City');

    // Verify that Prisma update was called with correct data
    expect(prisma.profile.update).toHaveBeenCalledWith({
      where: { id: 'current-user-id' },
      data: {
        name: 'New Name',
        contactNumber: '987-654-3210',
        companyName: 'New Company',
        street1: '456 New St',
        city: 'New City',
      },
    });
  });

  it('should handle partial updates correctly', async () => {
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

    // Mock existing profile
    const existingProfile = {
      id: 'current-user-id',
      email: 'test@example.com',
      name: 'Old Name',
      type: 'CLIENT',
      contactNumber: '123-456-7890',
      companyName: 'Old Company',
      street1: '123 Old St',
      city: 'Old City',
      state: 'CA',
      zip: '12345',
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-01'),
    };
    (prisma.profile.findUnique as any).mockResolvedValue(existingProfile);

    // Mock updated profile
    const updatedProfile = {
      ...existingProfile,
      name: 'New Name',
      updatedAt: new Date('2023-01-02'),
    };
    (prisma.profile.update as any).mockResolvedValue(updatedProfile);

    const requestBody = {
      name: 'New Name',
    };

    const request = new NextRequest('http://localhost:3000/api/users/current-user-id', {
      method: 'PATCH',
      body: JSON.stringify(requestBody),
    });
    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.name).toBe('New Name');

    // Verify that only the provided field was updated
    expect(prisma.profile.update).toHaveBeenCalledWith({
      where: { id: 'current-user-id' },
      data: {
        name: 'New Name',
      },
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

    // Mock existing profile
    (prisma.profile.findUnique as any).mockResolvedValue({
      id: 'current-user-id',
      email: 'test@example.com',
      name: 'Test User',
      type: 'CLIENT',
    });

    // Mock database error during update
    (prisma.profile.update as any).mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost:3000/api/users/current-user-id', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'New Name' }),
    });
    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Internal server error');
  });

  it('should handle invalid JSON in request body', async () => {
    const { createClient } = await import('@/utils/supabase/server');
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

    const request = new NextRequest('http://localhost:3000/api/users/current-user-id', {
      method: 'PATCH',
      body: 'invalid json',
    });
    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid JSON in request body');
  });
}); 