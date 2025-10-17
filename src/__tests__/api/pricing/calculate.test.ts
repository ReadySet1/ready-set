// src/__tests__/api/pricing/calculate.test.ts

// Mock the prisma client before any imports
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    pricingTier: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

// Mock the PricingService
jest.mock('@/services/pricing/pricing.service');

import { POST, GET, PUT, DELETE } from '@/app/api/pricing/calculate/route';
import { PricingService } from '@/services/pricing/pricing.service';
import { createPostRequest, createGetRequest } from '@/__tests__/helpers/api-test-helpers';

describe('/api/pricing/calculate API', () => {
  let mockPricingService: jest.Mocked<PricingService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPricingService = {
      calculatePrice: jest.fn(),
    } as any;
    (PricingService as jest.Mock).mockImplementation(() => mockPricingService);
  });

  describe('POST /api/pricing/calculate', () => {
    describe('✅ Input Validation Tests', () => {
      it('should return 400 when headCount is missing', async () => {
        const request = createPostRequest('http://localhost:3000/api/pricing/calculate', {
          foodCost: 100,
          hasTip: true,
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toContain('headCount');
      });

      it('should return 400 when foodCost is missing', async () => {
        const request = createPostRequest('http://localhost:3000/api/pricing/calculate', {
          headCount: 10,
          hasTip: true,
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toContain('foodCost');
      });

      it('should return 400 when hasTip is missing', async () => {
        const request = createPostRequest('http://localhost:3000/api/pricing/calculate', {
          headCount: 10,
          foodCost: 100,
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toContain('hasTip');
      });

      it('should return 400 when headCount is not a number', async () => {
        const request = createPostRequest('http://localhost:3000/api/pricing/calculate', {
          headCount: '10',
          foodCost: 100,
          hasTip: true,
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
      });

      it('should return 400 when foodCost is not a number', async () => {
        const request = createPostRequest('http://localhost:3000/api/pricing/calculate', {
          headCount: 10,
          foodCost: '100',
          hasTip: true,
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
      });

      it('should return 400 when hasTip is not a boolean', async () => {
        const request = createPostRequest('http://localhost:3000/api/pricing/calculate', {
          headCount: 10,
          foodCost: 100,
          hasTip: 'yes',
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
      });

      it('should return 400 when headCount is zero', async () => {
        const request = createPostRequest('http://localhost:3000/api/pricing/calculate', {
          headCount: 0,
          foodCost: 100,
          hasTip: true,
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toContain('positive numbers');
      });

      it('should return 400 when foodCost is zero', async () => {
        const request = createPostRequest('http://localhost:3000/api/pricing/calculate', {
          headCount: 10,
          foodCost: 0,
          hasTip: true,
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toContain('positive numbers');
      });

      it('should return 400 when headCount is negative', async () => {
        const request = createPostRequest('http://localhost:3000/api/pricing/calculate', {
          headCount: -5,
          foodCost: 100,
          hasTip: true,
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toContain('positive numbers');
      });

      it('should return 400 when foodCost is negative', async () => {
        const request = createPostRequest('http://localhost:3000/api/pricing/calculate', {
          headCount: 10,
          foodCost: -50,
          hasTip: true,
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toContain('positive numbers');
      });
    });

    describe('✅ Successful Calculation Tests', () => {
      it('should successfully calculate pricing with tip', async () => {
        const mockCalculation = {
          basePrice: 100.00,
          discount: 0,
          finalPrice: 100.00,
          appliedTier: null,
          hasTip: true,
          calculationDetails: {
            isPercentageBased: false,
            tierName: 'No applicable tier found',
          },
        };

        mockPricingService.calculatePrice.mockResolvedValue(mockCalculation);

        const request = createPostRequest('http://localhost:3000/api/pricing/calculate', {
          headCount: 10,
          foodCost: 100,
          hasTip: true,
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toEqual(mockCalculation);
        expect(data.message).toBe('Pricing calculated successfully');
      });

      it('should successfully calculate pricing without tip', async () => {
        const mockCalculation = {
          basePrice: 100.00,
          discount: 0,
          finalPrice: 100.00,
          appliedTier: null,
          hasTip: false,
          calculationDetails: {
            isPercentageBased: false,
            tierName: 'No applicable tier found',
          },
        };

        mockPricingService.calculatePrice.mockResolvedValue(mockCalculation);

        const request = createPostRequest('http://localhost:3000/api/pricing/calculate', {
          headCount: 10,
          foodCost: 100,
          hasTip: false,
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.hasTip).toBe(false);
        expect(data.data.discount).toBe(0);
      });

      it('should call PricingService with correct parameters', async () => {
        const mockCalculation = {
          basePrice: 500.00,
          discount: 0,
          finalPrice: 500.00,
          appliedTier: null,
          hasTip: true,
          calculationDetails: {
            isPercentageBased: false,
            tierName: 'No applicable tier found',
          },
        };

        mockPricingService.calculatePrice.mockResolvedValue(mockCalculation);

        const request = createPostRequest('http://localhost:3000/api/pricing/calculate', {
          headCount: 25,
          foodCost: 500,
          hasTip: true,
        });

        await POST(request);

        expect(mockPricingService.calculatePrice).toHaveBeenCalledWith(25, 500, true);
      });

      it('should handle small headCount', async () => {
        const mockCalculation = {
          basePrice: 20.00,
          discount: 0,
          finalPrice: 20.00,
          appliedTier: null,
          hasTip: true,
          calculationDetails: {
            isPercentageBased: false,
            tierName: 'No applicable tier found',
          },
        };

        mockPricingService.calculatePrice.mockResolvedValue(mockCalculation);

        const request = createPostRequest('http://localhost:3000/api/pricing/calculate', {
          headCount: 1,
          foodCost: 20,
          hasTip: true,
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.basePrice).toBe(20.00);
      });

      it('should handle large headCount', async () => {
        const mockCalculation = {
          basePrice: 10000.00,
          discount: 0,
          finalPrice: 10000.00,
          appliedTier: null,
          hasTip: true,
          calculationDetails: {
            isPercentageBased: false,
            tierName: 'No applicable tier found',
          },
        };

        mockPricingService.calculatePrice.mockResolvedValue(mockCalculation);

        const request = createPostRequest('http://localhost:3000/api/pricing/calculate', {
          headCount: 500,
          foodCost: 10000,
          hasTip: true,
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.basePrice).toBe(10000.00);
      });

      it('should handle decimal foodCost values', async () => {
        const mockCalculation = {
          basePrice: 99.99,
          discount: 0,
          finalPrice: 99.99,
          appliedTier: null,
          hasTip: true,
          calculationDetails: {
            isPercentageBased: false,
            tierName: 'No applicable tier found',
          },
        };

        mockPricingService.calculatePrice.mockResolvedValue(mockCalculation);

        const request = createPostRequest('http://localhost:3000/api/pricing/calculate', {
          headCount: 10,
          foodCost: 99.99,
          hasTip: true,
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
      });
    });

    describe('❌ Error Handling Tests', () => {
      it('should handle PricingService errors gracefully', async () => {
        mockPricingService.calculatePrice.mockRejectedValue(
          new Error('Pricing calculation failed')
        );

        const request = createPostRequest('http://localhost:3000/api/pricing/calculate', {
          headCount: 10,
          foodCost: 100,
          hasTip: true,
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.success).toBe(false);
        expect(data.error).toContain('Failed to calculate pricing');
        expect(data.error).toContain('Pricing calculation failed');
      });

      it('should handle unknown errors', async () => {
        mockPricingService.calculatePrice.mockRejectedValue('Unknown error');

        const request = createPostRequest('http://localhost:3000/api/pricing/calculate', {
          headCount: 10,
          foodCost: 100,
          hasTip: true,
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.success).toBe(false);
        expect(data.error).toContain('Failed to calculate pricing');
      });

      it('should handle service initialization errors', async () => {
        (PricingService as jest.Mock).mockImplementation(() => {
          throw new Error('Service initialization failed');
        });

        const request = createPostRequest('http://localhost:3000/api/pricing/calculate', {
          headCount: 10,
          foodCost: 100,
          hasTip: true,
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.success).toBe(false);
      });
    });

    describe('📊 Response Format Tests', () => {
      it('should return response with success, data, and message fields', async () => {
        const mockCalculation = {
          headCount: 10,
          foodCost: 100.00,
          hasTip: true,
          subtotal: 100.00,
          tipAmount: 20.00,
          deliveryFee: 15.00,
          total: 135.00,
        };

        mockPricingService.calculatePrice.mockResolvedValue(mockCalculation);

        const request = createPostRequest('http://localhost:3000/api/pricing/calculate', {
          headCount: 10,
          foodCost: 100,
          hasTip: true,
        });

        const response = await POST(request);
        const data = await response.json();

        expect(data).toHaveProperty('success');
        expect(data).toHaveProperty('data');
        expect(data).toHaveProperty('message');
        expect(data.success).toBe(true);
      });

      it('should return error response with success and error fields', async () => {
        const request = createPostRequest('http://localhost:3000/api/pricing/calculate', {
          headCount: -5,
          foodCost: 100,
          hasTip: true,
        });

        const response = await POST(request);
        const data = await response.json();

        expect(data).toHaveProperty('success');
        expect(data).toHaveProperty('error');
        expect(data.success).toBe(false);
        expect(data).not.toHaveProperty('data');
      });
    });
  });

  describe('GET /api/pricing/calculate', () => {
    it('should return 405 for GET requests', async () => {
      const request = createGetRequest('http://localhost:3000/api/pricing/calculate');
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(405);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Method not allowed');
      expect(data.error).toContain('POST');
    });
  });

  describe('PUT /api/pricing/calculate', () => {
    it('should return 405 for PUT requests', async () => {
      const response = await PUT();
      const data = await response.json();

      expect(response.status).toBe(405);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Method not allowed');
      expect(data.error).toContain('POST');
    });
  });

  describe('DELETE /api/pricing/calculate', () => {
    it('should return 405 for DELETE requests', async () => {
      const response = await DELETE();
      const data = await response.json();

      expect(response.status).toBe(405);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Method not allowed');
      expect(data.error).toContain('POST');
    });
  });

  describe('🔒 Security Tests', () => {
    it('should not expose service internals in errors', async () => {
      mockPricingService.calculatePrice.mockRejectedValue(
        new Error('Internal: Database connection string')
      );

      const request = createPostRequest('http://localhost:3000/api/pricing/calculate', {
        headCount: 10,
        foodCost: 100,
        hasTip: true,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      // Error message is included in the response, but wrapped
      expect(data.error).toContain('Failed to calculate pricing');
    });

    it('should validate numeric types strictly', async () => {
      const request = createPostRequest('http://localhost:3000/api/pricing/calculate', {
        headCount: '10',
        foodCost: '100',
        hasTip: true,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });

  describe('🎯 Edge Cases', () => {
    it('should handle very small foodCost', async () => {
      const mockCalculation = {
        basePrice: 0.01,
        discount: 0,
        finalPrice: 0.01,
        appliedTier: null,
        hasTip: false,
        calculationDetails: {
          isPercentageBased: false,
          tierName: 'No applicable tier found',
        },
      };

      mockPricingService.calculatePrice.mockResolvedValue(mockCalculation);

      const request = createPostRequest('http://localhost:3000/api/pricing/calculate', {
        headCount: 1,
        foodCost: 0.01,
        hasTip: false,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should handle floating point headCount', async () => {
      const mockCalculation = {
        basePrice: 100.00,
        discount: 0,
        finalPrice: 100.00,
        appliedTier: null,
        hasTip: true,
        calculationDetails: {
          isPercentageBased: false,
          tierName: 'No applicable tier found',
        },
      };

      mockPricingService.calculatePrice.mockResolvedValue(mockCalculation);

      const request = createPostRequest('http://localhost:3000/api/pricing/calculate', {
        headCount: 10.5,
        foodCost: 100,
        hasTip: true,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});
