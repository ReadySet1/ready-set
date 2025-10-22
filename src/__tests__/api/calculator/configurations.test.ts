// src/__tests__/api/calculator/configurations.test.ts

import { createGetRequest, createPostRequest, createDeleteRequest } from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies BEFORE imports
jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    deliveryConfiguration: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock('@/lib/calculator/client-configurations', () => ({
  validateConfiguration: jest.fn(),
  getActiveConfigurations: jest.fn(),
  getConfiguration: jest.fn(),
}));

import { GET, POST, DELETE } from '@/app/api/calculator/configurations/route';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/lib/prisma';
import {
  validateConfiguration,
  getActiveConfigurations,
  getConfiguration
} from '@/lib/calculator/client-configurations';

describe('/api/calculator/configurations API', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
  });

  describe('GET /api/calculator/configurations', () => {
    describe('✅ Successful Configuration Retrieval', () => {
      it('should return all active configurations from database', async () => {
        (prisma.deliveryConfiguration.findMany as jest.Mock).mockResolvedValue([
          {
            configId: 'config-1',
            clientName: 'Client A',
            vendorName: 'Vendor A',
            isActive: true,
            mileageRate: '2.50',
            distanceThreshold: '5',
            pricingTiers: [],
            dailyDriveDiscounts: {},
            driverPaySettings: {},
            bridgeTollSettings: {},
            customSettings: {},
            createdAt: new Date('2025-01-01'),
            updatedAt: new Date('2025-01-01'),
          },
          {
            configId: 'config-2',
            clientName: 'Client B',
            vendorName: 'Vendor B',
            isActive: true,
            mileageRate: '3.00',
            distanceThreshold: '10',
            pricingTiers: [],
            dailyDriveDiscounts: {},
            driverPaySettings: {},
            bridgeTollSettings: {},
            customSettings: {},
            createdAt: new Date('2025-01-02'),
            updatedAt: new Date('2025-01-02'),
          },
        ]);

        const request = createGetRequest('http://localhost:3000/api/calculator/configurations');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toHaveLength(2);
        expect(data.data[0]).toMatchObject({
          id: 'config-1',
          clientName: 'Client A',
        });
      });

      it('should return specific configuration by ID from database', async () => {
        (prisma.deliveryConfiguration.findUnique as jest.Mock).mockResolvedValue({
          configId: 'config-123',
          clientName: 'Test Client',
          vendorName: 'Test Vendor',
          description: 'Test description',
          isActive: true,
          mileageRate: '2.75',
          distanceThreshold: '7.5',
          pricingTiers: [{ min: 0, max: 10, rate: 50 }],
          dailyDriveDiscounts: { threshold: 5, discount: 0.1 },
          driverPaySettings: { baseRate: 20 },
          bridgeTollSettings: { enabled: true },
          customSettings: { special: 'value' },
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-01'),
          createdBy: 'user-123',
          notes: 'Test notes',
        });

        const request = createGetRequest('http://localhost:3000/api/calculator/configurations?id=config-123');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toMatchObject({
          id: 'config-123',
          clientName: 'Test Client',
          mileageRate: 2.75,
          distanceThreshold: 7.5,
        });
      });

      it('should fall back to in-memory configurations when database is empty', async () => {
        (prisma.deliveryConfiguration.findMany as jest.Mock).mockResolvedValue([]);
        (getActiveConfigurations as jest.Mock).mockReturnValue([
          {
            id: 'memory-config-1',
            clientName: 'Memory Client',
            vendorName: 'Memory Vendor',
            isActive: true,
            mileageRate: 2.0,
            distanceThreshold: 5.0,
            pricingTiers: [],
            dailyDriveDiscounts: {},
            driverPaySettings: {},
            bridgeTollSettings: {},
            customSettings: {},
          },
        ]);

        const request = createGetRequest('http://localhost:3000/api/calculator/configurations');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toHaveLength(1);
        expect(data.data[0].clientName).toBe('Memory Client');
      });

      it('should fall back to in-memory config when database query fails', async () => {
        (prisma.deliveryConfiguration.findUnique as jest.Mock).mockRejectedValue(
          new Error('Database error')
        );
        (getConfiguration as jest.Mock).mockReturnValue({
          id: 'fallback-config',
          clientName: 'Fallback Client',
          vendorName: 'Fallback Vendor',
          isActive: true,
          mileageRate: 2.5,
          distanceThreshold: 5.0,
          pricingTiers: [],
          dailyDriveDiscounts: {},
          driverPaySettings: {},
          bridgeTollSettings: {},
          customSettings: {},
        });

        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

        const request = createGetRequest('http://localhost:3000/api/calculator/configurations?id=fallback-config');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.clientName).toBe('Fallback Client');
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          'Database query failed, falling back to in-memory configs:',
          expect.any(Error)
        );

        consoleWarnSpy.mockRestore();
      });

      it('should return 404 when config not found in database or memory', async () => {
        (prisma.deliveryConfiguration.findUnique as jest.Mock).mockResolvedValue(null);
        (getConfiguration as jest.Mock).mockReturnValue(null);

        const request = createGetRequest('http://localhost:3000/api/calculator/configurations?id=nonexistent');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.error).toBe('Configuration not found');
      });

      it('should query only active configurations', async () => {
        (prisma.deliveryConfiguration.findMany as jest.Mock).mockResolvedValue([]);
        (getActiveConfigurations as jest.Mock).mockReturnValue([]);

        const request = createGetRequest('http://localhost:3000/api/calculator/configurations');
        await GET(request);

        expect(prisma.deliveryConfiguration.findMany).toHaveBeenCalledWith({
          where: { isActive: true },
          orderBy: { updatedAt: 'desc' },
        });
      });
    });

    describe('❌ Error Handling Tests', () => {
      it('should return in-memory configs on database error', async () => {
        (prisma.deliveryConfiguration.findMany as jest.Mock).mockRejectedValue(
          new Error('Database connection failed')
        );
        (getActiveConfigurations as jest.Mock).mockReturnValue([
          {
            id: 'fallback-1',
            clientName: 'Fallback Client',
            vendorName: 'Fallback Vendor',
            isActive: true,
            mileageRate: 2.0,
            distanceThreshold: 5.0,
            pricingTiers: [],
            dailyDriveDiscounts: {},
            driverPaySettings: {},
            bridgeTollSettings: {},
            customSettings: {},
          },
        ]);

        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

        const request = createGetRequest('http://localhost:3000/api/calculator/configurations');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toHaveLength(1);

        consoleWarnSpy.mockRestore();
      });

      it('should return 500 when both database and fallback fail', async () => {
        (prisma.deliveryConfiguration.findMany as jest.Mock).mockRejectedValue(
          new Error('Database error')
        );
        (getActiveConfigurations as jest.Mock).mockImplementation(() => {
          throw new Error('Fallback error');
        });

        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

        const request = createGetRequest('http://localhost:3000/api/calculator/configurations');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Failed to fetch configurations');

        consoleErrorSpy.mockRestore();
      });
    });
  });

  describe('POST /api/calculator/configurations', () => {
    describe('✅ Successful Configuration Creation/Update', () => {
      it('should create new configuration', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123', email: 'test@example.com' } },
          error: null,
        });

        (validateConfiguration as jest.Mock).mockReturnValue({ valid: true, errors: [] });

        (prisma.deliveryConfiguration.upsert as jest.Mock).mockResolvedValue({
          configId: 'new-config-123',
          clientName: 'New Client',
          vendorName: 'New Vendor',
          isActive: true,
          mileageRate: '3.00',
          distanceThreshold: '8',
          pricingTiers: [],
          dailyDriveDiscounts: {},
          driverPaySettings: {},
          bridgeTollSettings: {},
          customSettings: {},
          createdAt: new Date('2025-01-15'),
          updatedAt: new Date('2025-01-15'),
          createdBy: 'user-123',
        });

        const request = createPostRequest('http://localhost:3000/api/calculator/configurations', {
          id: 'new-config-123',
          clientName: 'New Client',
          vendorName: 'New Vendor',
          isActive: true,
          mileageRate: 3.0,
          distanceThreshold: 8.0,
          pricingTiers: [],
          dailyDriveDiscounts: {},
          driverPaySettings: {},
          bridgeTollSettings: {},
          customSettings: {},
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.message).toBe('Configuration saved successfully');
        expect(data.data).toMatchObject({
          id: 'new-config-123',
          clientName: 'New Client',
        });
      });

      it('should update existing configuration', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-456', email: 'test@example.com' } },
          error: null,
        });

        (validateConfiguration as jest.Mock).mockReturnValue({ valid: true, errors: [] });

        (prisma.deliveryConfiguration.upsert as jest.Mock).mockResolvedValue({
          configId: 'existing-config',
          clientName: 'Updated Client',
          vendorName: 'Updated Vendor',
          isActive: true,
          mileageRate: '3.50',
          distanceThreshold: '10',
          pricingTiers: [],
          dailyDriveDiscounts: {},
          driverPaySettings: {},
          bridgeTollSettings: {},
          customSettings: {},
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-15'),
          createdBy: 'user-456',
        });

        const request = createPostRequest('http://localhost:3000/api/calculator/configurations', {
          id: 'existing-config',
          clientName: 'Updated Client',
          vendorName: 'Updated Vendor',
          isActive: true,
          mileageRate: 3.5,
          distanceThreshold: 10.0,
          pricingTiers: [],
          dailyDriveDiscounts: {},
          driverPaySettings: {},
          bridgeTollSettings: {},
          customSettings: {},
        });

        await POST(request);

        expect(prisma.deliveryConfiguration.upsert).toHaveBeenCalledWith({
          where: { configId: 'existing-config' },
          update: expect.objectContaining({
            clientName: 'Updated Client',
          }),
          create: expect.objectContaining({
            clientName: 'Updated Client',
          }),
        });
      });

      it('should associate configuration with authenticated user', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-789', email: 'test@example.com' } },
          error: null,
        });

        (validateConfiguration as jest.Mock).mockReturnValue({ valid: true, errors: [] });

        (prisma.deliveryConfiguration.upsert as jest.Mock).mockResolvedValue({
          configId: 'config-with-user',
          clientName: 'Test',
          vendorName: 'Test',
          isActive: true,
          mileageRate: '2.00',
          distanceThreshold: '5',
          pricingTiers: [],
          dailyDriveDiscounts: {},
          driverPaySettings: {},
          bridgeTollSettings: {},
          customSettings: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'user-789',
        });

        const request = createPostRequest('http://localhost:3000/api/calculator/configurations', {
          id: 'config-with-user',
          clientName: 'Test',
          vendorName: 'Test',
          isActive: true,
          mileageRate: 2.0,
          distanceThreshold: 5.0,
          pricingTiers: [],
          dailyDriveDiscounts: {},
          driverPaySettings: {},
          bridgeTollSettings: {},
          customSettings: {},
        });

        await POST(request);

        expect(prisma.deliveryConfiguration.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            create: expect.objectContaining({
              createdBy: 'user-789',
            }),
          })
        );
      });
    });

    describe('✏️ Validation Tests', () => {
      it('should return 400 when validation fails', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123', email: 'test@example.com' } },
          error: null,
        });

        (validateConfiguration as jest.Mock).mockReturnValue({
          valid: false,
          errors: ['clientName is required', 'mileageRate must be positive'],
        });

        const request = createPostRequest('http://localhost:3000/api/calculator/configurations', {
          id: 'invalid-config',
          clientName: '',
          vendorName: 'Test',
          isActive: true,
          mileageRate: -1,
          distanceThreshold: 5.0,
          pricingTiers: [],
          dailyDriveDiscounts: {},
          driverPaySettings: {},
          bridgeTollSettings: {},
          customSettings: {},
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Invalid configuration');
        expect(data.details).toContain('clientName is required');
        expect(data.details).toContain('mileageRate must be positive');
      });

      it('should not save to database when validation fails', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123', email: 'test@example.com' } },
          error: null,
        });

        (validateConfiguration as jest.Mock).mockReturnValue({
          valid: false,
          errors: ['Invalid data'],
        });

        const request = createPostRequest('http://localhost:3000/api/calculator/configurations', {
          id: 'invalid-config',
          clientName: 'Test',
          vendorName: 'Test',
          isActive: true,
          mileageRate: 2.0,
          distanceThreshold: 5.0,
          pricingTiers: [],
          dailyDriveDiscounts: {},
          driverPaySettings: {},
          bridgeTollSettings: {},
          customSettings: {},
        });

        await POST(request);

        expect(prisma.deliveryConfiguration.upsert).not.toHaveBeenCalled();
      });
    });

    describe('❌ Error Handling Tests', () => {
      it('should return 500 when database save fails', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123', email: 'test@example.com' } },
          error: null,
        });

        (validateConfiguration as jest.Mock).mockReturnValue({ valid: true, errors: [] });

        (prisma.deliveryConfiguration.upsert as jest.Mock).mockRejectedValue(
          new Error('Database error')
        );

        const request = createPostRequest('http://localhost:3000/api/calculator/configurations', {
          id: 'error-config',
          clientName: 'Test',
          vendorName: 'Test',
          isActive: true,
          mileageRate: 2.0,
          distanceThreshold: 5.0,
          pricingTiers: [],
          dailyDriveDiscounts: {},
          driverPaySettings: {},
          bridgeTollSettings: {},
          customSettings: {},
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Failed to save configuration');
      });

      it('should log errors to console', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123', email: 'test@example.com' } },
          error: null,
        });

        (validateConfiguration as jest.Mock).mockReturnValue({ valid: true, errors: [] });

        (prisma.deliveryConfiguration.upsert as jest.Mock).mockRejectedValue(
          new Error('Test error')
        );

        const request = createPostRequest('http://localhost:3000/api/calculator/configurations', {
          id: 'error-config',
          clientName: 'Test',
          vendorName: 'Test',
          isActive: true,
          mileageRate: 2.0,
          distanceThreshold: 5.0,
          pricingTiers: [],
          dailyDriveDiscounts: {},
          driverPaySettings: {},
          bridgeTollSettings: {},
          customSettings: {},
        });

        await POST(request);

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Error saving configuration:',
          expect.any(Error)
        );

        consoleErrorSpy.mockRestore();
      });
    });
  });

  describe('DELETE /api/calculator/configurations', () => {
    describe('✅ Successful Configuration Deletion', () => {
      it('should delete configuration', async () => {
        (prisma.deliveryConfiguration.delete as jest.Mock).mockResolvedValue({
          configId: 'delete-config-123',
        });

        const request = createDeleteRequest('http://localhost:3000/api/calculator/configurations?id=delete-config-123');
        const response = await DELETE(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.message).toBe('Configuration deleted successfully');
      });

      it('should call delete with correct configId', async () => {
        (prisma.deliveryConfiguration.delete as jest.Mock).mockResolvedValue({});

        const request = createDeleteRequest('http://localhost:3000/api/calculator/configurations?id=specific-config-456');
        await DELETE(request);

        expect(prisma.deliveryConfiguration.delete).toHaveBeenCalledWith({
          where: { configId: 'specific-config-456' },
        });
      });
    });

    describe('✏️ Validation Tests', () => {
      it('should return 400 when ID is missing', async () => {
        const request = createDeleteRequest('http://localhost:3000/api/calculator/configurations');
        const response = await DELETE(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Configuration ID is required');
      });

      it('should not call delete when ID is missing', async () => {
        const request = createDeleteRequest('http://localhost:3000/api/calculator/configurations');
        await DELETE(request);

        expect(prisma.deliveryConfiguration.delete).not.toHaveBeenCalled();
      });
    });

    describe('❌ Error Handling Tests', () => {
      it('should return 500 when deletion fails', async () => {
        (prisma.deliveryConfiguration.delete as jest.Mock).mockRejectedValue(
          new Error('Database error')
        );

        const request = createDeleteRequest('http://localhost:3000/api/calculator/configurations?id=error-config');
        const response = await DELETE(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Failed to delete configuration');
      });

      it('should log deletion errors to console', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

        (prisma.deliveryConfiguration.delete as jest.Mock).mockRejectedValue(
          new Error('Test error')
        );

        const request = createDeleteRequest('http://localhost:3000/api/calculator/configurations?id=error-config');
        await DELETE(request);

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Error deleting configuration:',
          expect.any(Error)
        );

        consoleErrorSpy.mockRestore();
      });
    });
  });

  describe('🎯 Integration Tests', () => {
    it('should handle complete configuration lifecycle', async () => {
      // 1. GET all configurations (initially empty, fallback to memory)
      (prisma.deliveryConfiguration.findMany as jest.Mock).mockResolvedValue([]);
      (getActiveConfigurations as jest.Mock).mockReturnValue([]);

      const getRequest = createGetRequest('http://localhost:3000/api/calculator/configurations');
      const getResponse = await GET(getRequest);
      const getData = await getResponse.json();

      expect(getData.success).toBe(true);
      expect(getData.data).toEqual([]);

      // 2. POST create new configuration
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-integration', email: 'integration@example.com' } },
        error: null,
      });

      (validateConfiguration as jest.Mock).mockReturnValue({ valid: true, errors: [] });

      (prisma.deliveryConfiguration.upsert as jest.Mock).mockResolvedValue({
        configId: 'integration-config',
        clientName: 'Integration Client',
        vendorName: 'Integration Vendor',
        isActive: true,
        mileageRate: '2.75',
        distanceThreshold: '7.5',
        pricingTiers: [],
        dailyDriveDiscounts: {},
        driverPaySettings: {},
        bridgeTollSettings: {},
        customSettings: {},
        createdAt: new Date('2025-01-15'),
        updatedAt: new Date('2025-01-15'),
        createdBy: 'user-integration',
      });

      const postRequest = createPostRequest('http://localhost:3000/api/calculator/configurations', {
        id: 'integration-config',
        clientName: 'Integration Client',
        vendorName: 'Integration Vendor',
        isActive: true,
        mileageRate: 2.75,
        distanceThreshold: 7.5,
        pricingTiers: [],
        dailyDriveDiscounts: {},
        driverPaySettings: {},
        bridgeTollSettings: {},
        customSettings: {},
      });

      const postResponse = await POST(postRequest);
      const postData = await postResponse.json();

      expect(postData.success).toBe(true);
      expect(postData.message).toBe('Configuration saved successfully');

      // 3. GET specific configuration
      (prisma.deliveryConfiguration.findUnique as jest.Mock).mockResolvedValue({
        configId: 'integration-config',
        clientName: 'Integration Client',
        vendorName: 'Integration Vendor',
        isActive: true,
        mileageRate: '2.75',
        distanceThreshold: '7.5',
        pricingTiers: [],
        dailyDriveDiscounts: {},
        driverPaySettings: {},
        bridgeTollSettings: {},
        customSettings: {},
        createdAt: new Date('2025-01-15'),
        updatedAt: new Date('2025-01-15'),
        createdBy: 'user-integration',
      });

      const getSingleRequest = createGetRequest('http://localhost:3000/api/calculator/configurations?id=integration-config');
      const getSingleResponse = await GET(getSingleRequest);
      const getSingleData = await getSingleResponse.json();

      expect(getSingleData.success).toBe(true);
      expect(getSingleData.data.id).toBe('integration-config');

      // 4. DELETE configuration
      (prisma.deliveryConfiguration.delete as jest.Mock).mockResolvedValue({
        configId: 'integration-config',
      });

      const deleteRequest = createDeleteRequest('http://localhost:3000/api/calculator/configurations?id=integration-config');
      const deleteResponse = await DELETE(deleteRequest);
      const deleteData = await deleteResponse.json();

      expect(deleteResponse.status).toBe(200);
      expect(deleteData.success).toBe(true);
      expect(deleteData.message).toBe('Configuration deleted successfully');
    });
  });
});
