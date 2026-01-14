/**
 * Tests for /api/auth/session route
 *
 * Critical functionality tested:
 * - Session data retrieval with real Supabase auth
 * - Profile data integration
 * - Driver data integration for DRIVER users
 * - Error handling
 * - Response structure validation
 */

import { NextRequest } from 'next/server';
import { GET } from '../route';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/utils/prismaDB';

// Mock Supabase
jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

// Mock Prisma
jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    $queryRawUnsafe: jest.fn(),
  },
}));

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

describe('GET /api/auth/session', () => {
  const mockUser = {
    id: 'user-uuid-123',
    email: 'driver@readyset.com',
  };

  const mockProfile = {
    id: 'user-uuid-123',
    email: 'driver@readyset.com',
    name: 'John Driver',
    type: 'DRIVER',
  };

  const mockDriver = {
    id: 'driver-uuid-123',
    employee_id: 'EMP-001',
  };

  const mockSupabase = {
    auth: {
      getUser: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateClient.mockResolvedValue(mockSupabase as any);
  });

  describe('Unauthenticated requests', () => {
    it('should return null session when not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/auth/session');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ user: null, expires: null });
    });

    it('should return null session on auth error', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Auth error'),
      });

      const request = new NextRequest('http://localhost:3000/api/auth/session');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ user: null, expires: null });
    });
  });

  describe('Authenticated DRIVER user', () => {
    beforeEach(() => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
    });

    it('should return session with driver data', async () => {
      (prisma.$queryRawUnsafe as jest.Mock)
        .mockResolvedValueOnce([mockProfile]) // Profile query
        .mockResolvedValueOnce([mockDriver]); // Driver query

      const request = new NextRequest('http://localhost:3000/api/auth/session');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('user');
      expect(data).toHaveProperty('expires');
      expect(data.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        type: 'DRIVER',
        driverId: 'driver-uuid-123',
        name: 'John Driver',
      });
    });

    it('should return session with null driverId when no driver record exists', async () => {
      (prisma.$queryRawUnsafe as jest.Mock)
        .mockResolvedValueOnce([mockProfile]) // Profile query
        .mockResolvedValueOnce([]); // No driver record

      const request = new NextRequest('http://localhost:3000/api/auth/session');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user.driverId).toBeNull();
    });

    it('should include valid expiration timestamp', async () => {
      (prisma.$queryRawUnsafe as jest.Mock)
        .mockResolvedValueOnce([mockProfile])
        .mockResolvedValueOnce([mockDriver]);

      const beforeRequest = Date.now();
      const request = new NextRequest('http://localhost:3000/api/auth/session');
      const response = await GET(request);
      const data = await response.json();
      const afterRequest = Date.now();

      expect(response.status).toBe(200);

      const expiresTimestamp = new Date(data.expires).getTime();
      const expectedExpiry = 24 * 60 * 60 * 1000; // 24 hours

      // Verify expiry is approximately 24 hours from now (within 1 second tolerance)
      expect(expiresTimestamp).toBeGreaterThan(beforeRequest + expectedExpiry - 1000);
      expect(expiresTimestamp).toBeLessThan(afterRequest + expectedExpiry + 1000);
    });

    it('should query profile with user ID parameter', async () => {
      (prisma.$queryRawUnsafe as jest.Mock)
        .mockResolvedValueOnce([mockProfile])
        .mockResolvedValueOnce([mockDriver]);

      const request = new NextRequest('http://localhost:3000/api/auth/session');
      await GET(request);

      // First call should be profile query with user ID
      expect(prisma.$queryRawUnsafe).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('SELECT id, email, name, type'),
        mockUser.id
      );
    });

    it('should query driver with user ID for DRIVER type', async () => {
      (prisma.$queryRawUnsafe as jest.Mock)
        .mockResolvedValueOnce([mockProfile])
        .mockResolvedValueOnce([mockDriver]);

      const request = new NextRequest('http://localhost:3000/api/auth/session');
      await GET(request);

      // Second call should be driver query with user ID
      expect(prisma.$queryRawUnsafe).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('SELECT d.id, d.employee_id'),
        mockUser.id
      );
    });
  });

  describe('Authenticated non-DRIVER user', () => {
    it('should not query driver table for non-DRIVER users', async () => {
      const vendorProfile = { ...mockProfile, type: 'VENDOR' };
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce([vendorProfile]);

      const request = new NextRequest('http://localhost:3000/api/auth/session');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user.type).toBe('VENDOR');
      expect(data.user.driverId).toBeNull();
      // Should only call once for profile, not for driver
      expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(1);
    });

    it('should default to VENDOR type when profile has no type', async () => {
      const profileWithoutType = { ...mockProfile, type: undefined };
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce([profileWithoutType]);

      const request = new NextRequest('http://localhost:3000/api/auth/session');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user.type).toBe('VENDOR');
    });
  });

  describe('Error handling', () => {
    beforeEach(() => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
    });

    it('should return 500 on database error', async () => {
      const dbError = new Error('Database connection failed');
      (prisma.$queryRawUnsafe as jest.Mock).mockRejectedValue(dbError);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const request = new NextRequest('http://localhost:3000/api/auth/session');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: 'Failed to get session' });
      expect(consoleSpy).toHaveBeenCalledWith('Session error:', dbError);

      consoleSpy.mockRestore();
    });

    it('should handle profile query errors gracefully', async () => {
      (prisma.$queryRawUnsafe as jest.Mock).mockRejectedValue(new Error('Profile query failed'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const request = new NextRequest('http://localhost:3000/api/auth/session');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to get session');

      consoleSpy.mockRestore();
    });

    it('should handle driver query errors gracefully', async () => {
      (prisma.$queryRawUnsafe as jest.Mock)
        .mockResolvedValueOnce([mockProfile])
        .mockRejectedValueOnce(new Error('Driver query failed'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const request = new NextRequest('http://localhost:3000/api/auth/session');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to get session');

      consoleSpy.mockRestore();
    });
  });

  describe('Response structure validation', () => {
    beforeEach(() => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
    });

    it('should have correct response shape for authenticated user', async () => {
      (prisma.$queryRawUnsafe as jest.Mock)
        .mockResolvedValueOnce([mockProfile])
        .mockResolvedValueOnce([mockDriver]);

      const request = new NextRequest('http://localhost:3000/api/auth/session');
      const response = await GET(request);
      const data = await response.json();

      expect(Object.keys(data).sort()).toEqual(['expires', 'user']);
      expect(Object.keys(data.user).sort()).toEqual(['driverId', 'email', 'id', 'name', 'type']);
    });

    it('should return expires as ISO 8601 string', async () => {
      (prisma.$queryRawUnsafe as jest.Mock)
        .mockResolvedValueOnce([mockProfile])
        .mockResolvedValueOnce([mockDriver]);

      const request = new NextRequest('http://localhost:3000/api/auth/session');
      const response = await GET(request);
      const data = await response.json();

      // Verify it's a valid ISO 8601 date string
      const expiresDate = new Date(data.expires);
      expect(expiresDate.toISOString()).toBe(data.expires);
      expect(isNaN(expiresDate.getTime())).toBe(false);
    });
  });

  describe('Fallback behavior', () => {
    beforeEach(() => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
    });

    it('should use email prefix as name when profile has no name', async () => {
      const profileWithoutName = { ...mockProfile, name: undefined };
      (prisma.$queryRawUnsafe as jest.Mock)
        .mockResolvedValueOnce([profileWithoutName])
        .mockResolvedValueOnce([mockDriver]);

      const request = new NextRequest('http://localhost:3000/api/auth/session');
      const response = await GET(request);
      const data = await response.json();

      expect(data.user.name).toBe('driver'); // From driver@readyset.com
    });

    it('should handle empty profile result', async () => {
      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce([]);

      const request = new NextRequest('http://localhost:3000/api/auth/session');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user.type).toBe('VENDOR'); // Default type
    });
  });

  describe('Consistency', () => {
    beforeEach(() => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
    });

    it('should return consistent session data on multiple calls', async () => {
      (prisma.$queryRawUnsafe as jest.Mock)
        .mockResolvedValue([mockProfile])
        .mockResolvedValueOnce([mockProfile])
        .mockResolvedValueOnce([mockDriver])
        .mockResolvedValueOnce([mockProfile])
        .mockResolvedValueOnce([mockDriver]);

      const request1 = new NextRequest('http://localhost:3000/api/auth/session');
      const response1 = await GET(request1);
      const data1 = await response1.json();

      const request2 = new NextRequest('http://localhost:3000/api/auth/session');
      const response2 = await GET(request2);
      const data2 = await response2.json();

      // User fields should be identical (same authenticated user)
      expect(data1.user.id).toBe(data2.user.id);
      expect(data1.user.email).toBe(data2.user.email);
      expect(data1.user.type).toBe(data2.user.type);
    });
  });
});
