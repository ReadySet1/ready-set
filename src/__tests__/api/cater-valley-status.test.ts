// src/__tests__/api/cater-valley-status.test.ts
// Tests for /api/cater-valley/status route

import { createGetRequest, createPostRequest } from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies BEFORE imports
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    cateringRequest: {
      count: jest.fn(),
    },
  },
}));

import { GET, POST } from '@/app/api/cater-valley/status/route';
import { prisma } from '@/lib/db/prisma';

describe('/api/cater-valley/status API', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('GET /api/cater-valley/status', () => {
    it('should return integration status information', async () => {
      (prisma.cateringRequest.count as jest.Mock).mockResolvedValue(25);
      process.env.CATERVALLEY_API_KEY = 'test-api-key';
      process.env.CATERVALLEY_WEBHOOK_URL = 'https://api.catervalley.com/webhook';

      const request = createGetRequest('http://localhost:3000/api/cater-valley/status');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.service).toBe('Ready Set CaterValley Integration');
      expect(data.status).toBe('operational');
      expect(data.version).toBe('1.0.0');
      expect(data).toHaveProperty('timestamp');
    });

    it('should report database connectivity status', async () => {
      (prisma.cateringRequest.count as jest.Mock).mockResolvedValue(42);

      const request = createGetRequest('http://localhost:3000/api/cater-valley/status');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.database.status).toBe('connected');
      expect(data.database.caterValleyOrderCount).toBe(42);
    });

    it('should handle database connectivity errors', async () => {
      (prisma.cateringRequest.count as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = createGetRequest('http://localhost:3000/api/cater-valley/status');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.database.status).toBe('error');
      expect(data.database.caterValleyOrderCount).toBe(0);
    });

    it('should report environment configuration status', async () => {
      (prisma.cateringRequest.count as jest.Mock).mockResolvedValue(0);
      process.env.CATERVALLEY_API_KEY = 'configured-key';
      process.env.CATERVALLEY_WEBHOOK_URL = 'https://webhook.url';

      const request = createGetRequest('http://localhost:3000/api/cater-valley/status');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.environment.apiKeyConfigured).toBe(true);
      expect(data.environment.webhookUrlConfigured).toBe(true);
    });

    it('should report missing environment variables', async () => {
      (prisma.cateringRequest.count as jest.Mock).mockResolvedValue(0);
      delete process.env.CATERVALLEY_API_KEY;
      delete process.env.CATERVALLEY_WEBHOOK_URL;

      const request = createGetRequest('http://localhost:3000/api/cater-valley/status');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.environment.apiKeyConfigured).toBe(false);
      expect(data.environment.webhookUrlConfigured).toBe(false);
    });

    it('should include endpoint documentation', async () => {
      (prisma.cateringRequest.count as jest.Mock).mockResolvedValue(0);

      const request = createGetRequest('http://localhost:3000/api/cater-valley/status');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.endpoints).toHaveProperty('draft');
      expect(data.endpoints.draft).toMatchObject({
        method: 'POST',
        path: '/api/cater-valley/orders/draft',
        description: 'Create a new draft order with pricing calculation',
        authentication: 'Required: partner: catervalley, x-api-key',
      });

      expect(data.endpoints).toHaveProperty('update');
      expect(data.endpoints.update).toMatchObject({
        method: 'POST',
        path: '/api/cater-valley/orders/update',
      });

      expect(data.endpoints).toHaveProperty('confirm');
      expect(data.endpoints.confirm).toMatchObject({
        method: 'POST',
        path: '/api/cater-valley/orders/confirm',
      });
    });

    it('should include status mapping documentation', async () => {
      (prisma.cateringRequest.count as jest.Mock).mockResolvedValue(0);

      const request = createGetRequest('http://localhost:3000/api/cater-valley/status');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.statusMapping).toEqual({
        'ASSIGNED': 'CONFIRM',
        'ARRIVED_AT_VENDOR': 'READY',
        'EN_ROUTE_TO_CLIENT': 'ON_THE_WAY',
        'ARRIVED_TO_CLIENT': 'ON_THE_WAY',
        'COMPLETED': 'COMPLETED',
        'CANCELLED': 'CANCELLED',
      });
    });

    it('should include pricing structure documentation', async () => {
      (prisma.cateringRequest.count as jest.Mock).mockResolvedValue(0);

      const request = createGetRequest('http://localhost:3000/api/cater-valley/status');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pricing).toHaveProperty('structure');
      expect(data.pricing).toHaveProperty('distanceTiers');
      expect(data.pricing).toHaveProperty('headCountTiers');
      expect(data.pricing).toHaveProperty('tipOptions');
    });

    it('should include business hours information', async () => {
      (prisma.cateringRequest.count as jest.Mock).mockResolvedValue(0);

      const request = createGetRequest('http://localhost:3000/api/cater-valley/status');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.businessHours).toMatchObject({
        deliveryWindow: '7:00 AM - 10:00 PM',
        minimumAdvanceTime: '2 hours',
        timezone: 'Local time',
      });
    });

    it('should handle errors gracefully and return degraded status', async () => {
      (prisma.cateringRequest.count as jest.Mock).mockRejectedValue(
        new Error('Critical database error')
      );

      const request = createGetRequest('http://localhost:3000/api/cater-valley/status');

      const response = await GET(request);
      const data = await response.json();

      // The route catches DB errors and reports degraded status
      expect(response.status).toBe(200);
      expect(data.database.status).toBe('error');
      expect(data.database.caterValleyOrderCount).toBe(0);
    });
  });

  describe('POST /api/cater-valley/status', () => {
    it('should return same status information as GET', async () => {
      (prisma.cateringRequest.count as jest.Mock).mockResolvedValue(15);

      const request = createPostRequest(
        'http://localhost:3000/api/cater-valley/status',
        { test: 'data' }
      ) as any;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.service).toBe('Ready Set CaterValley Integration');
      expect(data.status).toBe('operational');
      expect(data.database.caterValleyOrderCount).toBe(15);
    });
  });
});
