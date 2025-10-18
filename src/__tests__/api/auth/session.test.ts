// src/__tests__/api/auth/session.test.ts

import { GET } from '@/app/api/auth/session/route';
import { prisma } from '@/utils/prismaDB';
import { createGetRequest } from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies
jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    $queryRawUnsafe: jest.fn(),
  },
}));

describe('/api/auth/session GET API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('✅ Successful Session Retrieval', () => {
    it('should return a valid session with driver data', async () => {
      const mockDriver = [
        {
          id: 'driver-uuid-123',
          employee_id: 'EMP001',
        },
      ];

      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue(mockDriver);

      const request = createGetRequest('http://localhost:3000/api/auth/session');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('user');
      expect(data).toHaveProperty('expires');

      expect(data.user).toEqual({
        id: 'user-123',
        email: 'driver@readyset.com',
        type: 'DRIVER',
        driverId: 'driver-uuid-123',
        name: 'John Driver',
      });

      expect(data.expires).toBeDefined();
      expect(new Date(data.expires).getTime()).toBeGreaterThan(Date.now());
    });

    it('should return session with null driverId when no drivers exist', async () => {
      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([]);

      const request = createGetRequest('http://localhost:3000/api/auth/session');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user.driverId).toBeNull();
    });

    it('should set expiration to 24 hours from now', async () => {
      const mockDriver = [
        {
          id: 'driver-uuid-123',
          employee_id: 'EMP001',
        },
      ];

      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue(mockDriver);

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

  describe('❌ Error Handling Tests', () => {
    it('should return 500 when database query fails', async () => {
      (prisma.$queryRawUnsafe as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = createGetRequest('http://localhost:3000/api/auth/session');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to get session');
    });

    it('should handle database timeout errors', async () => {
      (prisma.$queryRawUnsafe as jest.Mock).mockRejectedValue(
        new Error('Query timeout')
      );

      const request = createGetRequest('http://localhost:3000/api/auth/session');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to get session');
    });

    it('should handle null database response with error', async () => {
      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue(null);

      const request = createGetRequest('http://localhost:3000/api/auth/session');
      const response = await GET(request);
      const data = await response.json();

      // When database returns null, accessing properties throws error
      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to get session');
    });

    it('should handle undefined database response with error', async () => {
      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue(undefined);

      const request = createGetRequest('http://localhost:3000/api/auth/session');
      const response = await GET(request);
      const data = await response.json();

      // When database returns undefined, accessing properties throws error
      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to get session');
    });
  });

  describe('📊 Response Structure Tests', () => {
    it('should return session with all required user fields', async () => {
      const mockDriver = [
        {
          id: 'driver-uuid-123',
          employee_id: 'EMP001',
        },
      ];

      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue(mockDriver);

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
      const mockDriver = [
        {
          id: 'driver-uuid-123',
          employee_id: 'EMP001',
        },
      ];

      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue(mockDriver);

      const request = createGetRequest('http://localhost:3000/api/auth/session');
      const response = await GET(request);
      const data = await response.json();

      // Verify ISO 8601 format
      expect(data.expires).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(() => new Date(data.expires)).not.toThrow();
    });

    it('should not include sensitive driver information', async () => {
      const mockDriver = [
        {
          id: 'driver-uuid-123',
          employee_id: 'EMP001',
          password: 'should-not-be-returned',
          ssn: 'should-not-be-returned',
        },
      ];

      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue(mockDriver);

      const request = createGetRequest('http://localhost:3000/api/auth/session');
      const response = await GET(request);
      const data = await response.json();

      expect(data.user).not.toHaveProperty('password');
      expect(data.user).not.toHaveProperty('ssn');
      expect(data.user).not.toHaveProperty('employee_id');
    });
  });

  describe('🗄️ Database Query Tests', () => {
    it('should query for most recent driver', async () => {
      const mockDriver = [
        {
          id: 'driver-uuid-123',
          employee_id: 'EMP001',
        },
      ];

      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue(mockDriver);

      const request = createGetRequest('http://localhost:3000/api/auth/session');
      await GET(request);

      expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
        'SELECT id, employee_id FROM drivers ORDER BY created_at DESC LIMIT 1'
      );
      expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple drivers and select the most recent', async () => {
      const mockDrivers = [
        {
          id: 'most-recent-driver-uuid',
          employee_id: 'EMP999',
        },
      ];

      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue(mockDrivers);

      const request = createGetRequest('http://localhost:3000/api/auth/session');
      const response = await GET(request);
      const data = await response.json();

      expect(data.user.driverId).toBe('most-recent-driver-uuid');
    });
  });

  describe('🔒 Security Tests', () => {
    it('should not expose database errors to client', async () => {
      (prisma.$queryRawUnsafe as jest.Mock).mockRejectedValue(
        new Error('Internal database error: Connection string postgres://user:pass@host')
      );

      const request = createGetRequest('http://localhost:3000/api/auth/session');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to get session');
      expect(data.error).not.toContain('postgres');
      expect(data.error).not.toContain('Connection string');
    });

    it('should return consistent session structure on errors', async () => {
      (prisma.$queryRawUnsafe as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const request = createGetRequest('http://localhost:3000/api/auth/session');
      const response = await GET(request);
      const data = await response.json();

      expect(data).toHaveProperty('error');
      expect(data).not.toHaveProperty('user');
    });
  });

  describe('⚠️ Temporary Implementation Tests', () => {
    it('should use hardcoded user data (temporary dev implementation)', async () => {
      const mockDriver = [
        {
          id: 'any-driver-id',
          employee_id: 'EMP001',
        },
      ];

      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue(mockDriver);

      const request = createGetRequest('http://localhost:3000/api/auth/session');
      const response = await GET(request);
      const data = await response.json();

      // This test documents that the endpoint currently uses hardcoded values
      // and should be updated when proper session management is implemented
      expect(data.user.id).toBe('user-123');
      expect(data.user.email).toBe('driver@readyset.com');
      expect(data.user.type).toBe('DRIVER');
      expect(data.user.name).toBe('John Driver');
    });
  });
});
