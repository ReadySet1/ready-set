// src/__tests__/api/application-sessions.test.ts

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { POST, GET, PATCH } from '@/app/api/application-sessions/route';
import { prisma } from '@/utils/prismaDB';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    applicationSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    $executeRaw: jest.fn(),
  },
}));

describe('Application Sessions API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/application-sessions - Create Session', () => {
    it('should create a new session with valid data', async () => {
      const mockSession = {
        id: 'session-123',
        sessionToken: 'token-abc-123',
        sessionExpiresAt: new Date(Date.now() + 7200000),
        uploadCount: 0,
        maxUploads: 10,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'Server',
        ipAddress: '127.0.0.1',
        completed: false,
        createdAt: new Date(),
      };

      (prisma.applicationSession.count as jest.Mock).mockResolvedValue(2); // Under rate limit
      (prisma.applicationSession.create as jest.Mock).mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/application-sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '127.0.0.1',
        },
        body: JSON.stringify({
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          role: 'Server',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.sessionId).toBe('session-123');
      expect(data.uploadToken).toBe('token-abc-123');
      expect(data.expiresAt).toBeDefined();
    });

    it('should enforce rate limiting (5 sessions per hour per IP)', async () => {
      (prisma.applicationSession.count as jest.Mock).mockResolvedValue(5); // At rate limit

      const request = new NextRequest('http://localhost:3000/api/application-sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '127.0.0.1',
        },
        body: JSON.stringify({
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          role: 'Server',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toContain('Rate limit exceeded');
    });

    it('should validate required fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/application-sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Missing required fields
          email: 'test@example.com',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should validate email format', async () => {
      const request = new NextRequest('http://localhost:3000/api/application-sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'invalid-email',
          firstName: 'John',
          lastName: 'Doe',
          role: 'Server',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/application-sessions - Get Session Details', () => {
    it('should return session details with valid session ID and token', async () => {
      const mockSession = {
        id: 'session-123',
        sessionToken: 'token-abc-123',
        sessionExpiresAt: new Date(Date.now() + 7200000),
        uploadCount: 3,
        maxUploads: 10,
        email: 'test@example.com',
        completed: false,
      };

      (prisma.applicationSession.findUnique as jest.Mock).mockResolvedValue(mockSession);

      const request = new NextRequest(
        'http://localhost:3000/api/application-sessions?id=session-123',
        {
          headers: {
            'x-upload-token': 'token-abc-123',
          },
        }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sessionId).toBe('session-123');
      expect(data.uploadCount).toBe(3);
      expect(data.maxUploads).toBe(10);
    });

    it('should return 401 for invalid token', async () => {
      const mockSession = {
        id: 'session-123',
        sessionToken: 'token-abc-123',
        sessionExpiresAt: new Date(Date.now() + 7200000),
      };

      (prisma.applicationSession.findUnique as jest.Mock).mockResolvedValue(mockSession);

      const request = new NextRequest(
        'http://localhost:3000/api/application-sessions?id=session-123',
        {
          headers: {
            'x-upload-token': 'wrong-token',
          },
        }
      );

      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent session', async () => {
      (prisma.applicationSession.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost:3000/api/application-sessions?id=non-existent',
        {
          headers: {
            'x-upload-token': 'some-token',
          },
        }
      );

      const response = await GET(request);

      expect(response.status).toBe(404);
    });

    it('should return 400 for expired session', async () => {
      const mockSession = {
        id: 'session-123',
        sessionToken: 'token-abc-123',
        sessionExpiresAt: new Date(Date.now() - 1000), // Expired
      };

      (prisma.applicationSession.findUnique as jest.Mock).mockResolvedValue(mockSession);

      const request = new NextRequest(
        'http://localhost:3000/api/application-sessions?id=session-123',
        {
          headers: {
            'x-upload-token': 'token-abc-123',
          },
        }
      );

      const response = await GET(request);

      expect(response.status).toBe(400);
    });
  });

  describe('PATCH /api/application-sessions - Update Session', () => {
    it('should mark session as completed with valid job application ID', async () => {
      const mockSession = {
        id: 'session-123',
        sessionToken: 'token-abc-123',
        sessionExpiresAt: new Date(Date.now() + 7200000),
        completed: false,
      };

      (prisma.applicationSession.findUnique as jest.Mock).mockResolvedValue(mockSession);
      (prisma.applicationSession.update as jest.Mock).mockResolvedValue({
        ...mockSession,
        completed: true,
        jobApplicationId: 'job-123',
      });

      const request = new NextRequest(
        'http://localhost:3000/api/application-sessions?id=session-123',
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-upload-token': 'token-abc-123',
          },
          body: JSON.stringify({
            completed: true,
            jobApplicationId: 'job-123',
          }),
        }
      );

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.session.completed).toBe(true);
    });

    it('should prevent marking already completed session', async () => {
      const mockSession = {
        id: 'session-123',
        sessionToken: 'token-abc-123',
        sessionExpiresAt: new Date(Date.now() + 7200000),
        completed: true, // Already completed
      };

      (prisma.applicationSession.findUnique as jest.Mock).mockResolvedValue(mockSession);

      const request = new NextRequest(
        'http://localhost:3000/api/application-sessions?id=session-123',
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-upload-token': 'token-abc-123',
          },
          body: JSON.stringify({
            completed: true,
            jobApplicationId: 'job-123',
          }),
        }
      );

      const response = await PATCH(request);

      expect(response.status).toBe(400);
    });

    it('should require valid token for session update', async () => {
      const mockSession = {
        id: 'session-123',
        sessionToken: 'token-abc-123',
        sessionExpiresAt: new Date(Date.now() + 7200000),
        completed: false,
      };

      (prisma.applicationSession.findUnique as jest.Mock).mockResolvedValue(mockSession);

      const request = new NextRequest(
        'http://localhost:3000/api/application-sessions?id=session-123',
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-upload-token': 'wrong-token',
          },
          body: JSON.stringify({
            completed: true,
            jobApplicationId: 'job-123',
          }),
        }
      );

      const response = await PATCH(request);

      expect(response.status).toBe(401);
    });
  });

  describe('Session Security & Cleanup', () => {
    it('should generate unique session tokens', async () => {
      const mockSessions: any[] = [];

      (prisma.applicationSession.count as jest.Mock).mockResolvedValue(0);
      (prisma.applicationSession.create as jest.Mock).mockImplementation((data) => {
        const session = {
          id: `session-${mockSessions.length}`,
          sessionToken: data.data.sessionToken,
          ...data.data,
        };
        mockSessions.push(session);
        return Promise.resolve(session);
      });

      // Create multiple sessions
      for (let i = 0; i < 3; i++) {
        const request = new NextRequest('http://localhost:3000/api/application-sessions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: `test${i}@example.com`,
            firstName: 'John',
            lastName: 'Doe',
            role: 'Server',
          }),
        });

        await POST(request);
      }

      // Verify all tokens are unique
      const tokens = mockSessions.map(s => s.sessionToken);
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(tokens.length);
    });

    it('should set session expiration to 2 hours from creation', async () => {
      const now = Date.now();

      (prisma.applicationSession.count as jest.Mock).mockResolvedValue(0);
      (prisma.applicationSession.create as jest.Mock).mockImplementation((data) => {
        const expiresAt = new Date(data.data.sessionExpiresAt);
        const expectedExpiry = new Date(now + 2 * 60 * 60 * 1000); // 2 hours

        // Allow 1 second difference for test execution time
        expect(Math.abs(expiresAt.getTime() - expectedExpiry.getTime())).toBeLessThan(1000);

        return Promise.resolve({
          id: 'session-123',
          ...data.data,
        });
      });

      const request = new NextRequest('http://localhost:3000/api/application-sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          role: 'Server',
        }),
      });

      await POST(request);
    });
  });
});
