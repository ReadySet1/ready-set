import { NextRequest } from 'next/server';
import { GET } from '@/app/api/tracking/mileage/route';
import { prisma } from '@/utils/prismaDB';
import * as mileageService from '@/services/tracking/mileage';

// Mock Prisma
jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    $queryRawUnsafe: jest.fn(),
  },
}));

// Mock mileage service
jest.mock('@/services/tracking/mileage', () => ({
  calculateShiftMileage: jest.fn(),
  calculateShiftMileageWithBreakdown: jest.fn(),
}));

// Mock auth middleware to bypass authentication
jest.mock('@/lib/auth-middleware', () => ({
  withAuth: jest.fn().mockResolvedValue({
    success: true,
    context: {
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        type: 'ADMIN',
      },
      isAdmin: true,
      isSuperAdmin: false,
      isHelpdesk: false,
    },
  }),
}));

describe('/api/tracking/mileage', () => {
  const mockPrisma = prisma as unknown as { $queryRawUnsafe: jest.Mock };
  const mockMileageService = mileageService as unknown as {
    calculateShiftMileageWithBreakdown: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET - Aggregated mileage data', () => {
    it('returns aggregated mileage data as JSON', async () => {
      const mockRows = [
        {
          shift_id: 'shift-1',
          driver_id: 'driver-1',
          shift_start: new Date('2025-01-01T10:00:00Z'),
          shift_end: new Date('2025-01-01T12:00:00Z'),
          total_distance_miles: 26.4,
          gps_distance_miles: 26.4,
          reported_distance_miles: null,
          mileage_source: 'gps',
          delivery_count: 3,
        },
      ];

      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce(mockRows);

      const request = new NextRequest(
        'http://localhost:3000/api/tracking/mileage?startDate=2025-01-01T00:00:00.000Z&endDate=2025-01-02T00:00:00.000Z',
      );
      const response = await GET(request);
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
      expect(payload.data).toHaveLength(1);
      expect(payload.data[0]).toMatchObject({
        driverId: 'driver-1',
        shiftId: 'shift-1',
        totalDistanceMiles: 26.4,
        gpsDistanceMiles: 26.4,
        reportedDistanceMiles: null,
        mileageSource: 'gps',
        deliveryCount: 3,
      });
      // Dates are serialized as Date objects by NextResponse.json
      expect(payload.data[0].shiftStart).toBeDefined();
      expect(payload.data[0].shiftEnd).toBeDefined();
    });

    it('returns empty data when no shifts found', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);

      const request = new NextRequest(
        'http://localhost:3000/api/tracking/mileage?startDate=2025-01-01T00:00:00.000Z&endDate=2025-01-02T00:00:00.000Z',
      );
      const response = await GET(request);
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
      expect(payload.data).toEqual([]);
    });

    it('filters by driverId when provided', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);

      const request = new NextRequest(
        'http://localhost:3000/api/tracking/mileage?startDate=2025-01-01T00:00:00.000Z&endDate=2025-01-02T00:00:00.000Z&driverId=1e0e4a42-04a0-4c7f-bd1f-3b5f4ec1a111',
      );
      await GET(request);

      // Verify the SQL includes driver filter
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('driver_id = $3'),
        expect.any(Date),
        expect.any(Date),
        '1e0e4a42-04a0-4c7f-bd1f-3b5f4ec1a111',
      );
    });

    it('uses default date range when not provided', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);

      const request = new NextRequest('http://localhost:3000/api/tracking/mileage');
      await GET(request);

      // Should be called with dates (default: last 7 days)
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Date),
        expect.any(Date),
      );
    });
  });

  describe('GET - Per-shift breakdown', () => {
    it('returns per-shift breakdown when shiftId is provided', async () => {
      mockMileageService.calculateShiftMileageWithBreakdown.mockResolvedValueOnce({
        totalMiles: 10.5,
        gpsDistanceMiles: 10.5,
        mileageSource: 'gps',
        warnings: [],
        deliveries: [
          { deliveryId: 'del-1', distanceMiles: 4.0 },
          { deliveryId: 'del-2', distanceMiles: 6.5 },
        ],
      });

      const request = new NextRequest(
        'http://localhost:3000/api/tracking/mileage?shiftId=1e0e4a42-04a0-4c7f-bd1f-3b5f4ec1a111',
      );
      const response = await GET(request);
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
      expect(payload.data.totalMiles).toBe(10.5);
      expect(payload.data.deliveries).toHaveLength(2);
      expect(payload.data.shiftId).toBe('1e0e4a42-04a0-4c7f-bd1f-3b5f4ec1a111');
    });

    it('calls mileage service with correct shiftId', async () => {
      mockMileageService.calculateShiftMileageWithBreakdown.mockResolvedValueOnce({
        totalMiles: 0,
        gpsDistanceMiles: 0,
        mileageSource: 'gps',
        warnings: [],
        deliveries: [],
      });

      const shiftId = '1e0e4a42-04a0-4c7f-bd1f-3b5f4ec1a111';
      const request = new NextRequest(
        `http://localhost:3000/api/tracking/mileage?shiftId=${shiftId}`,
      );
      await GET(request);

      expect(mockMileageService.calculateShiftMileageWithBreakdown).toHaveBeenCalledWith(shiftId);
    });
  });

  describe('GET - CSV format', () => {
    it('returns CSV when format=csv for aggregated data', async () => {
      const mockRows = [
        {
          shift_id: 'shift-1',
          driver_id: 'driver-1',
          shift_start: new Date('2025-01-01T10:00:00Z'),
          shift_end: new Date('2025-01-01T12:00:00Z'),
          total_distance_miles: 26.4,
          gps_distance_miles: 26.4,
          reported_distance_miles: null,
          mileage_source: 'gps',
          delivery_count: 3,
        },
      ];

      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce(mockRows);

      const request = new NextRequest(
        'http://localhost:3000/api/tracking/mileage?startDate=2025-01-01T00:00:00.000Z&endDate=2025-01-02T00:00:00.000Z&format=csv',
      );
      const response = await GET(request);
      const text = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('text/csv');
      expect(response.headers.get('Content-Disposition')).toContain('mileage-report.csv');
      expect(text).toContain('driver_id');
      expect(text).toContain('shift_id');
      expect(text).toContain('driver-1');
      expect(text).toContain('shift-1');
    });

    it('returns CSV when format=csv for shift breakdown', async () => {
      mockMileageService.calculateShiftMileageWithBreakdown.mockResolvedValueOnce({
        totalMiles: 10.5,
        gpsDistanceMiles: 10.5,
        mileageSource: 'gps',
        warnings: [],
        deliveries: [
          { deliveryId: 'del-1', distanceMiles: 4.0 },
          { deliveryId: 'del-2', distanceMiles: 6.5 },
        ],
      });

      const request = new NextRequest(
        'http://localhost:3000/api/tracking/mileage?shiftId=1e0e4a42-04a0-4c7f-bd1f-3b5f4ec1a111&format=csv',
      );
      const response = await GET(request);
      const text = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('text/csv');
      expect(text).toContain('shift_id');
      expect(text).toContain('delivery_id');
      expect(text).toContain('del-1');
      expect(text).toContain('del-2');
    });

    it('returns empty CSV with headers when no data', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);

      const request = new NextRequest(
        'http://localhost:3000/api/tracking/mileage?startDate=2025-01-01T00:00:00.000Z&endDate=2025-01-02T00:00:00.000Z&format=csv',
      );
      const response = await GET(request);
      const text = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('text/csv');
      // Should have header row even with no data
      expect(text).toContain('driver_id');
    });
  });

  describe('GET - Error handling', () => {
    it('returns 500 when database query fails', async () => {
      mockPrisma.$queryRawUnsafe.mockRejectedValueOnce(new Error('Database connection failed'));

      const request = new NextRequest(
        'http://localhost:3000/api/tracking/mileage?startDate=2025-01-01T00:00:00.000Z&endDate=2025-01-02T00:00:00.000Z',
      );
      const response = await GET(request);
      const payload = await response.json();

      expect(response.status).toBe(500);
      expect(payload.success).toBe(false);
      expect(payload.error).toBe('Failed to fetch mileage report');
    });

    it('returns 500 when mileage service fails', async () => {
      mockMileageService.calculateShiftMileageWithBreakdown.mockRejectedValueOnce(
        new Error('Calculation failed'),
      );

      const request = new NextRequest(
        'http://localhost:3000/api/tracking/mileage?shiftId=1e0e4a42-04a0-4c7f-bd1f-3b5f4ec1a111',
      );
      const response = await GET(request);
      const payload = await response.json();

      expect(response.status).toBe(500);
      expect(payload.success).toBe(false);
    });

    it('returns error details in response', async () => {
      const errorMessage = 'Specific database error';
      mockPrisma.$queryRawUnsafe.mockRejectedValueOnce(new Error(errorMessage));

      const request = new NextRequest('http://localhost:3000/api/tracking/mileage');
      const response = await GET(request);
      const payload = await response.json();

      expect(response.status).toBe(500);
      expect(payload.details).toBe(errorMessage);
    });
  });

  describe('GET - Authentication', () => {
    it('returns 401 when auth fails', async () => {
      const { withAuth } = require('@/lib/auth-middleware');
      withAuth.mockResolvedValueOnce({
        success: false,
        response: new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
        context: {},
      });

      const request = new NextRequest('http://localhost:3000/api/tracking/mileage');
      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it('returns 403 when user lacks permissions', async () => {
      const { withAuth } = require('@/lib/auth-middleware');
      withAuth.mockResolvedValueOnce({
        success: false,
        response: new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }),
        context: {},
      });

      const request = new NextRequest('http://localhost:3000/api/tracking/mileage');
      const response = await GET(request);

      expect(response.status).toBe(403);
    });
  });
});
