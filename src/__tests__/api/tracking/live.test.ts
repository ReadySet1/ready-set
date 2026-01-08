// src/__tests__/api/tracking/live.test.ts

/**
 * Integration tests for the live tracking SSE endpoint.
 * Tests SSE initialization, authentication, and error handling.
 */

import { GET } from '@/app/api/tracking/live/route';
import { withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/utils/prismaDB';
import { captureException, captureMessage } from '@/lib/monitoring/sentry';
import { createGetRequest } from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies
jest.mock('@/lib/auth-middleware');
jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    $queryRawUnsafe: jest.fn(),
  },
}));
jest.mock('@/lib/monitoring/sentry', () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));

// Helper to create a request with a mock abort signal for SSE tests
const createSSERequest = (url: string) => {
  const request = createGetRequest(url);
  // Add mock signal for abort handling
  const abortController = new AbortController();
  Object.defineProperty(request, 'signal', {
    value: abortController.signal,
    writable: true,
    configurable: true,
  });
  return { request, abortController };
};

describe('/api/tracking/live SSE Endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllTimers();
  });

  describe('Authentication and Authorization', () => {
    it('should return 401 for unauthenticated requests', async () => {
      (withAuth as jest.Mock).mockResolvedValue({
        success: false,
        response: new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401 }
        ),
      });

      const request = createGetRequest(
        'http://localhost:3000/api/tracking/live'
      );

      const response = await GET(request);
      expect(response.status).toBe(401);
    });

    it('should return 403 for DRIVER users', async () => {
      (withAuth as jest.Mock).mockResolvedValue({
        success: false,
        response: new Response(
          JSON.stringify({ error: 'Forbidden' }),
          { status: 403 }
        ),
      });

      const request = createGetRequest(
        'http://localhost:3000/api/tracking/live'
      );

      const response = await GET(request);
      expect(response.status).toBe(403);
    });

    it('should return 403 for CLIENT users', async () => {
      (withAuth as jest.Mock).mockResolvedValue({
        success: false,
        response: new Response(
          JSON.stringify({ error: 'Forbidden' }),
          { status: 403 }
        ),
      });

      const request = createGetRequest(
        'http://localhost:3000/api/tracking/live'
      );

      const response = await GET(request);
      expect(response.status).toBe(403);
    });

    it('should allow ADMIN users', async () => {
      (withAuth as jest.Mock).mockResolvedValue({
        success: true,
        context: {
          user: { id: 'admin-123', type: 'ADMIN' },
        },
      });

      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([]);

      const { request } = createSSERequest(
        'http://localhost:3000/api/tracking/live'
      );

      const response = await GET(request);
      expect(response.status).toBe(200);
    });

    it('should allow SUPER_ADMIN users', async () => {
      (withAuth as jest.Mock).mockResolvedValue({
        success: true,
        context: {
          user: { id: 'superadmin-123', type: 'SUPER_ADMIN' },
        },
      });

      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([]);

      const { request } = createSSERequest(
        'http://localhost:3000/api/tracking/live'
      );

      const response = await GET(request);
      expect(response.status).toBe(200);
    });

    it('should allow HELPDESK users', async () => {
      (withAuth as jest.Mock).mockResolvedValue({
        success: true,
        context: {
          user: { id: 'helpdesk-123', type: 'HELPDESK' },
        },
      });

      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([]);

      const { request } = createSSERequest(
        'http://localhost:3000/api/tracking/live'
      );

      const response = await GET(request);
      expect(response.status).toBe(200);
    });
  });

  describe('SSE Response Headers', () => {
    it('should set correct SSE headers', async () => {
      (withAuth as jest.Mock).mockResolvedValue({
        success: true,
        context: {
          user: { id: 'admin-123', type: 'ADMIN' },
        },
      });

      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([]);

      const { request } = createSSERequest(
        'http://localhost:3000/api/tracking/live'
      );

      const response = await GET(request);

      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
      expect(response.headers.get('Cache-Control')).toBe('no-cache');
      expect(response.headers.get('Connection')).toBe('keep-alive');
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });
  });

  describe('Initial Connection', () => {
    it('should create a readable stream for successful connections', async () => {
      (withAuth as jest.Mock).mockResolvedValue({
        success: true,
        context: {
          user: { id: 'admin-123', type: 'ADMIN' },
        },
      });

      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([]);

      const { request } = createSSERequest(
        'http://localhost:3000/api/tracking/live'
      );

      const response = await GET(request);
      expect(response.body).toBeDefined();
      expect(response.body).toBeInstanceOf(ReadableStream);
    });
  });

  describe('Error Handling', () => {
    it('should handle setup errors gracefully', async () => {
      (withAuth as jest.Mock).mockRejectedValue(new Error('Auth service down'));

      const request = createGetRequest(
        'http://localhost:3000/api/tracking/live'
      );

      const response = await GET(request);
      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Failed to establish live connection');
    });

    it('should capture exception on error', async () => {
      (withAuth as jest.Mock).mockRejectedValue(new Error('Auth service down'));

      const request = createGetRequest(
        'http://localhost:3000/api/tracking/live'
      );

      await GET(request);

      expect(captureException).toHaveBeenCalled();
    });
  });

  describe('Logging', () => {
    it('should log SSE stream start', async () => {
      (withAuth as jest.Mock).mockResolvedValue({
        success: true,
        context: {
          user: { id: 'admin-123', type: 'ADMIN' },
        },
      });

      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([]);

      const { request } = createSSERequest(
        'http://localhost:3000/api/tracking/live'
      );

      await GET(request);

      expect(captureMessage).toHaveBeenCalledWith(
        'Admin tracking SSE stream started',
        'info',
        expect.objectContaining({
          feature: 'admin_tracking',
        })
      );
    });
  });
});
