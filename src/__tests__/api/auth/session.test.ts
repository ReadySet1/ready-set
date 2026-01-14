// src/__tests__/api/auth/session.test.ts

import { GET } from '@/app/api/auth/session/route';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/utils/prismaDB';
import { createGetRequest } from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies
jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    $queryRawUnsafe: jest.fn(),
  },
}));

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

describe('/api/auth/session GET API', () => {
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
    employee_id: 'EMP001',
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

  describe('✅ Successful Session Retrieval', () => {
    beforeEach(() => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
    });

    it('should return a valid session with driver data', async () => {
      (prisma.$queryRawUnsafe as jest.Mock)
        .mockResolvedValueOnce([mockProfile])
        .mockResolvedValueOnce([mockDriver]);

      const request = createGetRequest('http://localhost:3000/api/auth/session');
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

      expect(data.expires).toBeDefined();
      expect(new Date(data.expires).getTime()).toBeGreaterThan(Date.now());
    });

    it('should return session with null driverId when no driver record exists', async () => {
      (prisma.$queryRawUnsafe as jest.Mock)
        .mockResolvedValueOnce([mockProfile])
        .mockResolvedValueOnce([]);

      const request = createGetRequest('http://localhost:3000/api/auth/session');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user.driverId).toBeNull();
    });

    it('should set expiration to 24 hours from now', async () => {
      (prisma.$queryRawUnsafe as jest.Mock)
        .mockResolvedValueOnce([mockProfile])
        .mockResolvedValueOnce([mockDriver]);

      const beforeRequest = Date.now();
      const request = createGetRequest('http://localhost:3000/api/auth/session');
      const response = await GET(request);
      const data = await response.json();
      const afterRequest = Date.now();

      const expiryTime = new Date(data.expires).getTime();
      const expectedMinExpiry = beforeRequest + (24 * 60 * 60 * 1000);
      const expectedMaxExpiry = afterRequest + (24 * 60 * 60 * 1000);

      expect(expiryTime).toBeGreaterThanOrEqual(expectedMinExpiry);
      expect(expiryTime).toBeLessThanOrEqual(expectedMaxExpiry);
    });
  });

  describe('🔒 Unauthenticated Requests', () => {
    it('should return null session when not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = createGetRequest('http://localhost:3000/api/auth/session');
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

      const request = createGetRequest('http://localhost:3000/api/auth/session');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ user: null, expires: null });
    });
  });

  describe('❌ Error Handling Tests', () => {
    beforeEach(() => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
    });

    it('should return 500 when database query fails', async () => {
      (prisma.$queryRawUnsafe as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const request = createGetRequest('http://localhost:3000/api/auth/session');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to get session');

      consoleSpy.mockRestore();
    });

    it('should handle database timeout errors', async () => {
      (prisma.$queryRawUnsafe as jest.Mock).mockRejectedValue(
        new Error('Query timeout')
      );

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const request = createGetRequest('http://localhost:3000/api/auth/session');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to get session');

      consoleSpy.mockRestore();
    });
  });

  describe('📊 Response Structure Tests', () => {
    beforeEach(() => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
    });

    it('should return session with all required user fields', async () => {
      (prisma.$queryRawUnsafe as jest.Mock)
        .mockResolvedValueOnce([mockProfile])
        .mockResolvedValueOnce([mockDriver]);

      const request = createGetRequest('http://localhost:3000/api/auth/session');
      const response = await GET(request);
      const data = await response.json();

      expect(data.user).toHaveProperty('id');
      expect(data.user).toHaveProperty('email');
      expect(data.user).toHaveProperty('type');
      expect(data.user).toHaveProperty('driverId');
      expect(data.user).toHaveProperty('name');
    });

    it('should return ISO 8601 formatted expiration date', async () => {
      (prisma.$queryRawUnsafe as jest.Mock)
        .mockResolvedValueOnce([mockProfile])
        .mockResolvedValueOnce([mockDriver]);

      const request = createGetRequest('http://localhost:3000/api/auth/session');
      const response = await GET(request);
      const data = await response.json();

      // Verify ISO 8601 format
      expect(data.expires).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(() => new Date(data.expires)).not.toThrow();
    });

    it('should not include sensitive driver information', async () => {
      const driverWithSensitive = {
        ...mockDriver,
        password: 'should-not-be-returned',
        ssn: 'should-not-be-returned',
      };

      (prisma.$queryRawUnsafe as jest.Mock)
        .mockResolvedValueOnce([mockProfile])
        .mockResolvedValueOnce([driverWithSensitive]);

      const request = createGetRequest('http://localhost:3000/api/auth/session');
      const response = await GET(request);
      const data = await response.json();

      expect(data.user).not.toHaveProperty('password');
      expect(data.user).not.toHaveProperty('ssn');
      expect(data.user).not.toHaveProperty('employee_id');
    });
  });

  describe('🗄️ Database Query Tests', () => {
    beforeEach(() => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
    });

    it('should query profile and driver tables with user ID', async () => {
      (prisma.$queryRawUnsafe as jest.Mock)
        .mockResolvedValueOnce([mockProfile])
        .mockResolvedValueOnce([mockDriver]);

      const request = createGetRequest('http://localhost:3000/api/auth/session');
      await GET(request);

      // First call: profile query
      expect(prisma.$queryRawUnsafe).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('SELECT id, email, name, type'),
        mockUser.id
      );

      // Second call: driver query (only for DRIVER type)
      expect(prisma.$queryRawUnsafe).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('SELECT d.id, d.employee_id'),
        mockUser.id
      );
    });

    it('should not query driver table for non-DRIVER users', async () => {
      const vendorProfile = { ...mockProfile, type: 'VENDOR' };
      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce([vendorProfile]);

      const request = createGetRequest('http://localhost:3000/api/auth/session');
      const response = await GET(request);
      const data = await response.json();

      expect(data.user.type).toBe('VENDOR');
      expect(data.user.driverId).toBeNull();
      // Should only call once for profile, not for driver
      expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(1);
    });
  });

  describe('🔒 Security Tests', () => {
    beforeEach(() => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
    });

    it('should not expose database errors to client', async () => {
      (prisma.$queryRawUnsafe as jest.Mock).mockRejectedValue(
        new Error('Internal database error: Connection string postgres://user:pass@host')
      );

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const request = createGetRequest('http://localhost:3000/api/auth/session');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to get session');
      expect(data.error).not.toContain('postgres');
      expect(data.error).not.toContain('Connection string');

      consoleSpy.mockRestore();
    });

    it('should return consistent session structure on errors', async () => {
      (prisma.$queryRawUnsafe as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const request = createGetRequest('http://localhost:3000/api/auth/session');
      const response = await GET(request);
      const data = await response.json();

      expect(data).toHaveProperty('error');
      expect(data).not.toHaveProperty('user');

      consoleSpy.mockRestore();
    });
  });

  describe('📱 User Type Handling', () => {
    beforeEach(() => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
    });

    it('should default to VENDOR type when profile has no type', async () => {
      const profileWithoutType = { ...mockProfile, type: undefined };
      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce([profileWithoutType]);

      const request = createGetRequest('http://localhost:3000/api/auth/session');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user.type).toBe('VENDOR');
    });

    it('should use email prefix as name when profile has no name', async () => {
      const profileWithoutName = { ...mockProfile, name: undefined };
      (prisma.$queryRawUnsafe as jest.Mock)
        .mockResolvedValueOnce([profileWithoutName])
        .mockResolvedValueOnce([mockDriver]);

      const request = createGetRequest('http://localhost:3000/api/auth/session');
      const response = await GET(request);
      const data = await response.json();

      expect(data.user.name).toBe('driver'); // From driver@readyset.com
    });
  });
});
