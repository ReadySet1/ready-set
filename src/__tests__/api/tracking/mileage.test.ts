import { NextRequest } from 'next/server';
import { GET } from '@/app/api/tracking/mileage/route';
import { prisma } from '@/utils/prismaDB';
import * as mileageService from '@/services/tracking/mileage';

jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    $queryRawUnsafe: jest.fn(),
  },
}));

jest.mock('@/services/tracking/mileage', () => ({
  calculateShiftMileage: jest.fn(),
  calculateShiftMileageWithBreakdown: jest.fn(),
}));

/**
 * TODO: REA-211 - Tracking mileage API tests need auth middleware mocking
 */
describe.skip('/api/tracking/mileage', () => {
  const mockPrisma = prisma as unknown as { $queryRawUnsafe: jest.Mock };
  const mockMileageService = mileageService as unknown as {
    calculateShiftMileageWithBreakdown: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns aggregated mileage data as JSON', async () => {
    const mockRows = [
      {
        shift_id: 'shift-1',
        driver_id: 'driver-1',
        shift_start: new Date('2025-01-01T10:00:00Z'),
        shift_end: new Date('2025-01-01T12:00:00Z'),
        total_distance_km: 42.5,
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
    expect(payload.data).toEqual([
      {
        driverId: 'driver-1',
        shiftId: 'shift-1',
        shiftStart: mockRows[0]!.shift_start,
        shiftEnd: mockRows[0]!.shift_end,
        totalDistanceKm: 42.5,
        deliveryCount: 3,
      },
    ]);
  });

  it('returns per-shift breakdown when shiftId is provided', async () => {
    mockMileageService.calculateShiftMileageWithBreakdown.mockResolvedValueOnce({
      totalKm: 10.5,
      deliveries: [
        { deliveryId: 'del-1', distanceKm: 4.0 },
        { deliveryId: 'del-2', distanceKm: 6.5 },
      ],
    });

    const request = new NextRequest(
      'http://localhost:3000/api/tracking/mileage?shiftId=1e0e4a42-04a0-4c7f-bd1f-3b5f4ec1a111',
    );
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.totalKm).toBe(10.5);
    expect(payload.data.deliveries).toHaveLength(2);
  });

  it('returns CSV when format=csv', async () => {
    const mockRows = [
      {
        shift_id: 'shift-1',
        driver_id: 'driver-1',
        shift_start: new Date('2025-01-01T10:00:00Z'),
        shift_end: new Date('2025-01-01T12:00:00Z'),
        total_distance_km: 42.5,
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
    expect(text).toContain('driver_id,shift_id,shift_start,shift_end,total_distance_km,delivery_count');
    expect(text).toContain('driver-1');
    expect(text).toContain('shift-1');
  });
});


