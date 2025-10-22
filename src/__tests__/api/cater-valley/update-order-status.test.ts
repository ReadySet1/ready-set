// src/__tests__/api/cater-valley/update-order-status.test.ts

import { POST } from '@/app/api/cater-valley/update-order-status/route';
import * as caterValleyService from '@/services/caterValleyService';
import { expectSuccessResponse, expectErrorResponse } from '@/__tests__/helpers/api-test-helpers';

// Mock the CaterValley service
jest.mock('@/services/caterValleyService', () => ({
  updateCaterValleyOrderStatus: jest.fn(),
  ALLOWED_STATUSES: ['CONFIRM', 'READY', 'ON_THE_WAY', 'COMPLETED', 'CANCELLED', 'REFUNDED'],
}));

describe('POST /api/cater-valley/update-order-status - Update Order Status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('✅ Successful Status Update', () => {
    it('should update order status successfully', async () => {
      (caterValleyService.updateCaterValleyOrderStatus as jest.Mock).mockResolvedValue({
        success: true,
        orderFound: true,
        response: {
          result: true,
          message: 'Status updated successfully',
          data: {},
        },
      });

      const request = new Request('http://localhost:3000/api/cater-valley/update-order-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: 'CV-TEST-001',
          status: 'READY',
        }),
      });

      const response = await POST(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.message).toContain('successfully updated');
      expect(data.orderNumber).toBe('CV-TEST-001');
      expect(data.status).toBe('READY');
      expect(data.orderFound).toBe(true);
    });

    it('should call service with correct parameters', async () => {
      (caterValleyService.updateCaterValleyOrderStatus as jest.Mock).mockResolvedValue({
        success: true,
        orderFound: true,
        response: {},
      });

      const request = new Request('http://localhost:3000/api/cater-valley/update-order-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: 'CV-TEST-002',
          status: 'COMPLETED',
        }),
      });

      await POST(request);

      expect(caterValleyService.updateCaterValleyOrderStatus).toHaveBeenCalledWith(
        'CV-TEST-002',
        'COMPLETED'
      );
    });

    it('should handle all allowed statuses', async () => {
      const statuses = ['CONFIRM', 'READY', 'ON_THE_WAY', 'COMPLETED', 'CANCELLED', 'REFUNDED'];

      for (const status of statuses) {
        (caterValleyService.updateCaterValleyOrderStatus as jest.Mock).mockResolvedValue({
          success: true,
          orderFound: true,
          response: {},
        });

        const request = new Request('http://localhost:3000/api/cater-valley/update-order-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderNumber: 'CV-TEST-001',
            status,
          }),
        });

        const response = await POST(request);
        await expectSuccessResponse(response, 200);
      }
    });
  });

  describe('❌ Validation Errors', () => {
    it('should reject invalid content type', async () => {
      const request = new Request('http://localhost:3000/api/cater-valley/update-order-status', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'test',
      });

      const response = await POST(request);
      await expectErrorResponse(response, 415, /Invalid Content-Type/i);
    });

    it('should reject invalid JSON', async () => {
      const request = new Request('http://localhost:3000/api/cater-valley/update-order-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json{',
      });

      const response = await POST(request);
      await expectErrorResponse(response, 400, /Invalid JSON/i);
    });

    it('should reject missing orderNumber', async () => {
      const request = new Request('http://localhost:3000/api/cater-valley/update-order-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'READY',
        }),
      });

      const response = await POST(request);
      await expectErrorResponse(response, 400, /Missing required fields/i);
    });

    it('should reject missing status', async () => {
      const request = new Request('http://localhost:3000/api/cater-valley/update-order-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: 'CV-TEST-001',
        }),
      });

      const response = await POST(request);
      await expectErrorResponse(response, 400, /Missing required fields/i);
    });

    it('should reject invalid status', async () => {
      const request = new Request('http://localhost:3000/api/cater-valley/update-order-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: 'CV-TEST-001',
          status: 'INVALID_STATUS',
        }),
      });

      const response = await POST(request);
      await expectErrorResponse(response, 400, /Invalid status/i);
    });
  });

  describe('❌ Service Errors', () => {
    it('should handle order not found', async () => {
      (caterValleyService.updateCaterValleyOrderStatus as jest.Mock).mockResolvedValue({
        success: false,
        orderFound: false,
        statusCode: 404,
        error: 'Order not found',
      });

      const request = new Request('http://localhost:3000/api/cater-valley/update-order-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: 'CV-NONEXISTENT',
          status: 'READY',
        }),
      });

      const response = await POST(request);
      await expectErrorResponse(response, 404, /Order.*not found/i);
    });

    it('should handle validation errors from service', async () => {
      (caterValleyService.updateCaterValleyOrderStatus as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Invalid orderNumber format',
        statusCode: 400,
      });

      const request = new Request('http://localhost:3000/api/cater-valley/update-order-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: 'INVALID',
          status: 'READY',
        }),
      });

      const response = await POST(request);
      await expectErrorResponse(response, 400, /Invalid orderNumber/i);
    });

    it('should handle API errors with custom status code', async () => {
      (caterValleyService.updateCaterValleyOrderStatus as jest.Mock).mockResolvedValue({
        success: false,
        orderFound: false,
        statusCode: 422,
        error: 'Unprocessable entity',
      });

      const request = new Request('http://localhost:3000/api/cater-valley/update-order-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: 'CV-TEST-001',
          status: 'READY',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(422);
    });

    it('should handle unexpected service errors', async () => {
      (caterValleyService.updateCaterValleyOrderStatus as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      const request = new Request('http://localhost:3000/api/cater-valley/update-order-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: 'CV-TEST-001',
          status: 'READY',
        }),
      });

      const response = await POST(request);
      await expectErrorResponse(response, 500, /Internal Server Error/i);
    });
  });

  describe('📊 Edge Cases', () => {
    it('should handle empty orderNumber string', async () => {
      const request = new Request('http://localhost:3000/api/cater-valley/update-order-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: '',
          status: 'READY',
        }),
      });

      const response = await POST(request);
      await expectErrorResponse(response, 400, /Missing required fields/i);
    });

    it('should handle empty status string', async () => {
      const request = new Request('http://localhost:3000/api/cater-valley/update-order-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: 'CV-TEST-001',
          status: '',
        }),
      });

      const response = await POST(request);
      await expectErrorResponse(response, 400, /Missing required fields/i);
    });

    it('should be case-sensitive for status', async () => {
      const request = new Request('http://localhost:3000/api/cater-valley/update-order-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: 'CV-TEST-001',
          status: 'ready', // lowercase
        }),
      });

      const response = await POST(request);
      await expectErrorResponse(response, 400, /Invalid status/i);
    });

    it('should handle very long orderNumber', async () => {
      (caterValleyService.updateCaterValleyOrderStatus as jest.Mock).mockResolvedValue({
        success: true,
        orderFound: true,
        response: {},
      });

      const longOrderNumber = 'CV-' + 'A'.repeat(500);
      const request = new Request('http://localhost:3000/api/cater-valley/update-order-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: longOrderNumber,
          status: 'READY',
        }),
      });

      const response = await POST(request);
      await expectSuccessResponse(response, 200);
    });

    it('should include caterValleyResponse in success response', async () => {
      const mockResponse = {
        result: true,
        message: 'Status updated',
        data: {},
      };

      (caterValleyService.updateCaterValleyOrderStatus as jest.Mock).mockResolvedValue({
        success: true,
        orderFound: true,
        response: mockResponse,
      });

      const request = new Request('http://localhost:3000/api/cater-valley/update-order-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: 'CV-TEST-001',
          status: 'READY',
        }),
      });

      const response = await POST(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.caterValleyResponse).toEqual(mockResponse);
    });
  });
});
