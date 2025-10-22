// src/__tests__/api/cater-valley/status.test.ts

import { GET, POST } from '@/app/api/cater-valley/status/route';
import { prisma } from '@/lib/db/prisma';
import {
  createGetRequest,
  createPostRequest,
  expectSuccessResponse,
  expectErrorResponse,
} from '@/__tests__/helpers/api-test-helpers';

// Mock Prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    cateringRequest: {
      count: jest.fn(),
    },
  },
}));

describe('GET/POST /api/cater-valley/status - CaterValley Integration Status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set up environment variables
    process.env.CATERVALLEY_API_KEY = 'test-api-key';
    process.env.CATERVALLEY_WEBHOOK_URL = 'https://test.catervalley.com/webhook';
  });

  afterEach(() => {
    delete process.env.CATERVALLEY_API_KEY;
    delete process.env.CATERVALLEY_WEBHOOK_URL;
  });

  describe('✅ Successful Status Retrieval', () => {
    it('should return comprehensive status information', async () => {
      (prisma.cateringRequest.count as jest.Mock).mockResolvedValue(42);

      const request = createGetRequest('http://localhost:3000/api/cater-valley/status');
      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data).toHaveProperty('service', 'Ready Set CaterValley Integration');
      expect(data).toHaveProperty('status', 'operational');
      expect(data).toHaveProperty('version', '1.0.0');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('database');
      expect(data).toHaveProperty('environment');
      expect(data).toHaveProperty('endpoints');
      expect(data).toHaveProperty('statusMapping');
      expect(data).toHaveProperty('pricing');
      expect(data).toHaveProperty('businessHours');
      expect(data).toHaveProperty('contact');
    });

    it('should show database connectivity status', async () => {
      (prisma.cateringRequest.count as jest.Mock).mockResolvedValue(15);

      const request = createGetRequest('http://localhost:3000/api/cater-valley/status');
      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.database.status).toBe('connected');
      expect(data.database.caterValleyOrderCount).toBe(15);
    });

    it('should show environment configuration', async () => {
      (prisma.cateringRequest.count as jest.Mock).mockResolvedValue(0);

      const request = createGetRequest('http://localhost:3000/api/cater-valley/status');
      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.environment.apiKeyConfigured).toBe(true);
      expect(data.environment.webhookUrlConfigured).toBe(true);
    });

    it('should list available endpoints', async () => {
      (prisma.cateringRequest.count as jest.Mock).mockResolvedValue(0);

      const request = createGetRequest('http://localhost:3000/api/cater-valley/status');
      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.endpoints).toHaveProperty('draft');
      expect(data.endpoints).toHaveProperty('update');
      expect(data.endpoints).toHaveProperty('confirm');
      expect(data.endpoints).toHaveProperty('webhook');

      expect(data.endpoints.draft.method).toBe('POST');
      expect(data.endpoints.draft.path).toBe('/api/cater-valley/orders/draft');
      expect(data.endpoints.draft.authentication).toContain('catervalley');
    });

    it('should show status mapping for order states', async () => {
      (prisma.cateringRequest.count as jest.Mock).mockResolvedValue(0);

      const request = createGetRequest('http://localhost:3000/api/cater-valley/status');
      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.statusMapping).toEqual({
        'ASSIGNED': 'CONFIRM',
        'ARRIVED_AT_VENDOR': 'READY',
        'EN_ROUTE_TO_CLIENT': 'ON_THE_WAY',
        'ARRIVED_TO_CLIENT': 'ON_THE_WAY',
        'COMPLETED': 'COMPLETED',
        'CANCELLED': 'CANCELLED',
      });
    });

    it('should show pricing structure information', async () => {
      (prisma.cateringRequest.count as jest.Mock).mockResolvedValue(0);

      const request = createGetRequest('http://localhost:3000/api/cater-valley/status');
      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.pricing).toHaveProperty('structure');
      expect(data.pricing).toHaveProperty('distanceTiers');
      expect(data.pricing).toHaveProperty('headCountTiers');
      expect(data.pricing).toHaveProperty('tipOptions');
      expect(data.pricing).toHaveProperty('percentagePricing');
      expect(data.pricing).toHaveProperty('distanceCalculation');
    });

    it('should show business hours information', async () => {
      (prisma.cateringRequest.count as jest.Mock).mockResolvedValue(0);

      const request = createGetRequest('http://localhost:3000/api/cater-valley/status');
      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.businessHours.deliveryWindow).toBe('7:00 AM - 10:00 PM');
      expect(data.businessHours.minimumAdvanceTime).toBe('2 hours');
      expect(data.businessHours.timezone).toBe('Local time');
    });

    it('should work with POST request', async () => {
      (prisma.cateringRequest.count as jest.Mock).mockResolvedValue(5);

      const request = createPostRequest(
        'http://localhost:3000/api/cater-valley/status',
        { test: 'data' }
      );

      const response = await POST(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.service).toBe('Ready Set CaterValley Integration');
      expect(data.status).toBe('operational');
    });
  });

  describe('❌ Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      (prisma.cateringRequest.count as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = createGetRequest('http://localhost:3000/api/cater-valley/status');
      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.database.status).toBe('error');
      expect(data.database.caterValleyOrderCount).toBe(0);
    });

    it('should return 500 on unexpected errors', async () => {
      // Force an error by making prisma undefined
      const originalPrisma = (prisma as any).cateringRequest;
      (prisma as any).cateringRequest = undefined;

      const request = createGetRequest('http://localhost:3000/api/cater-valley/status');
      const response = await GET(request);

      // Restore prisma
      (prisma as any).cateringRequest = originalPrisma;

      await expectErrorResponse(response, 500, /Internal server error|Unable to retrieve status information/i);
    });
  });

  describe('📊 Edge Cases', () => {
    it('should handle zero CaterValley orders', async () => {
      (prisma.cateringRequest.count as jest.Mock).mockResolvedValue(0);

      const request = createGetRequest('http://localhost:3000/api/cater-valley/status');
      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.database.caterValleyOrderCount).toBe(0);
      expect(data.database.status).toBe('connected');
    });

    it('should handle missing environment variables', async () => {
      delete process.env.CATERVALLEY_API_KEY;
      delete process.env.CATERVALLEY_WEBHOOK_URL;

      (prisma.cateringRequest.count as jest.Mock).mockResolvedValue(10);

      const request = createGetRequest('http://localhost:3000/api/cater-valley/status');
      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.environment.apiKeyConfigured).toBe(false);
      expect(data.environment.webhookUrlConfigured).toBe(false);
    });

    it('should handle POST with invalid JSON gracefully', async () => {
      (prisma.cateringRequest.count as jest.Mock).mockResolvedValue(5);

      const request = new Request('http://localhost:3000/api/cater-valley/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json{',
      });

      const response = await POST(request);
      const data = await expectSuccessResponse(response, 200);

      // Should still return status even with invalid JSON
      expect(data.service).toBe('Ready Set CaterValley Integration');
    });

    it('should include webhook URL from environment', async () => {
      const customWebhookUrl = 'https://custom.catervalley.com/webhook';
      process.env.CATERVALLEY_WEBHOOK_URL = customWebhookUrl;

      (prisma.cateringRequest.count as jest.Mock).mockResolvedValue(0);

      const request = createGetRequest('http://localhost:3000/api/cater-valley/status');
      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.endpoints.webhook.url).toBe(customWebhookUrl);
    });

    it('should include contact information', async () => {
      (prisma.cateringRequest.count as jest.Mock).mockResolvedValue(0);

      const request = createGetRequest('http://localhost:3000/api/cater-valley/status');
      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.contact.technical).toBe('developer@readyset.com');
      expect(data.contact.support).toBe('support@readyset.com');
    });
  });
});
