/**
 * Unit Tests for Driver Stats Service
 *
 * Tests for:
 * - getDateRangeForPeriod calculations
 * - getDriverDeliveryStats aggregation
 * - getDriverDistanceStats aggregation
 * - getDriverShiftStats aggregation
 * - getDriverStats combined results
 * - getAllDriversStatsSummary admin endpoint
 */

import {
  getDateRangeForPeriod,
  getDriverStats,
  getDriverDeliveryStats,
  getDriverDistanceStats,
  getDriverShiftStats,
  getAllDriversStatsSummary,
  type StatsPeriod,
} from '../driver-stats';

// Mock Prisma
const mockQueryRawUnsafe = jest.fn();

jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    $queryRawUnsafe: (...args: unknown[]) => mockQueryRawUnsafe(...args),
  },
}));

// Mock Sentry
jest.mock('@sentry/nextjs', () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));

describe('Driver Stats Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDateRangeForPeriod', () => {
    it('should return correct range for today', () => {
      const { startDate, endDate } = getDateRangeForPeriod('today');

      expect(startDate.getHours()).toBe(0);
      expect(startDate.getMinutes()).toBe(0);
      expect(startDate.getSeconds()).toBe(0);
      expect(startDate.getMilliseconds()).toBe(0);
      expect(endDate.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
    });

    it('should return correct range for week', () => {
      const { startDate, endDate } = getDateRangeForPeriod('week');

      const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBeGreaterThanOrEqual(7);
    });

    it('should return correct range for month', () => {
      const { startDate, endDate } = getDateRangeForPeriod('month');

      const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBeGreaterThanOrEqual(30);
    });

    it('should return correct range for all time', () => {
      const { startDate, endDate } = getDateRangeForPeriod('all');

      // Start date should be in early 2020 (accounting for timezone)
      expect(startDate.getFullYear()).toBeLessThanOrEqual(2020);
      expect(startDate.getFullYear()).toBeGreaterThanOrEqual(2019);
      expect(endDate.getTime()).toBeGreaterThan(startDate.getTime());
    });
  });

  describe('getDriverDeliveryStats', () => {
    const mockDriverId = '123e4567-e89b-12d3-a456-426614174000';

    it('should return delivery stats for a driver', async () => {
      // Mock new delivery system results
      mockQueryRawUnsafe.mockResolvedValueOnce([
        {
          total: BigInt(10),
          completed: BigInt(8),
          cancelled: BigInt(1),
          in_progress: BigInt(1),
        },
      ]);

      // Mock driver profile lookup
      mockQueryRawUnsafe.mockResolvedValueOnce([
        { profile_id: 'profile-123' },
      ]);

      // Mock legacy dispatch results
      mockQueryRawUnsafe.mockResolvedValueOnce([
        {
          total: BigInt(5),
          completed: BigInt(4),
        },
      ]);

      const stats = await getDriverDeliveryStats(
        mockDriverId,
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(stats).toEqual({
        total: 15, // 10 + 5
        completed: 12, // 8 + 4
        cancelled: 1,
        inProgress: 1,
        averagePerDay: expect.any(Number),
      });
    });

    it('should throw error for invalid driver ID', async () => {
      await expect(
        getDriverDeliveryStats('invalid-uuid', new Date(), new Date())
      ).rejects.toThrow('Invalid driverId');
    });

    it('should handle empty results', async () => {
      mockQueryRawUnsafe.mockResolvedValueOnce([
        {
          total: BigInt(0),
          completed: BigInt(0),
          cancelled: BigInt(0),
          in_progress: BigInt(0),
        },
      ]);

      mockQueryRawUnsafe.mockResolvedValueOnce([
        { profile_id: null },
      ]);

      const stats = await getDriverDeliveryStats(
        mockDriverId,
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(stats.total).toBe(0);
      expect(stats.completed).toBe(0);
    });
  });

  describe('getDriverDistanceStats', () => {
    const mockDriverId = '123e4567-e89b-12d3-a456-426614174000';

    it('should return distance stats from shifts', async () => {
      mockQueryRawUnsafe.mockResolvedValueOnce([
        {
          total_miles: 150.5,
          gps_miles: 148.2,
          delivery_count: BigInt(20),
        },
      ]);

      const stats = await getDriverDistanceStats(
        mockDriverId,
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(stats).toEqual({
        totalMiles: 150.5,
        gpsVerifiedMiles: 148.2,
        averageMilesPerDelivery: expect.any(Number),
        averageMilesPerDay: expect.any(Number),
      });
    });

    it('should handle null values', async () => {
      mockQueryRawUnsafe.mockResolvedValueOnce([
        {
          total_miles: null,
          gps_miles: null,
          delivery_count: BigInt(0),
        },
      ]);

      const stats = await getDriverDistanceStats(
        mockDriverId,
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(stats.totalMiles).toBe(0);
      expect(stats.gpsVerifiedMiles).toBe(0);
      expect(stats.averageMilesPerDelivery).toBe(0);
    });
  });

  describe('getDriverShiftStats', () => {
    const mockDriverId = '123e4567-e89b-12d3-a456-426614174000';

    it('should return shift stats', async () => {
      mockQueryRawUnsafe.mockResolvedValueOnce([
        {
          total_shifts: BigInt(10),
          total_hours: 45.5,
        },
      ]);

      const stats = await getDriverShiftStats(
        mockDriverId,
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(stats).toEqual({
        totalShifts: 10,
        totalHoursWorked: 45.5,
        averageShiftDuration: expect.any(Number),
      });
    });

    it('should calculate average shift duration correctly', async () => {
      mockQueryRawUnsafe.mockResolvedValueOnce([
        {
          total_shifts: BigInt(4),
          total_hours: 32,
        },
      ]);

      const stats = await getDriverShiftStats(
        mockDriverId,
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(stats.averageShiftDuration).toBe(8); // 32 / 4 = 8 hours avg
    });
  });

  describe('getDriverStats', () => {
    const mockDriverId = '123e4567-e89b-12d3-a456-426614174000';

    it('should return combined driver stats', async () => {
      // Mock driver name lookup
      mockQueryRawUnsafe.mockResolvedValueOnce([
        { first_name: 'John', last_name: 'Doe' },
      ]);

      // Mock delivery stats
      mockQueryRawUnsafe.mockResolvedValueOnce([
        { total: BigInt(5), completed: BigInt(4), cancelled: BigInt(0), in_progress: BigInt(1) },
      ]);
      mockQueryRawUnsafe.mockResolvedValueOnce([{ profile_id: null }]);

      // Mock distance stats
      mockQueryRawUnsafe.mockResolvedValueOnce([
        { total_miles: 50, gps_miles: 48, delivery_count: BigInt(5) },
      ]);

      // Mock shift stats
      mockQueryRawUnsafe.mockResolvedValueOnce([
        { total_shifts: BigInt(2), total_hours: 16 },
      ]);

      // Mock current shift (none active)
      mockQueryRawUnsafe.mockResolvedValueOnce([]);

      const stats = await getDriverStats({
        driverId: mockDriverId,
        period: 'today',
      });

      expect(stats.driverId).toBe(mockDriverId);
      expect(stats.driverName).toBe('John Doe');
      expect(stats.period).toBe('today');
      expect(stats.deliveryStats).toBeDefined();
      expect(stats.distanceStats).toBeDefined();
      expect(stats.shiftStats).toBeDefined();
      expect(stats.periodStart).toBeDefined();
      expect(stats.periodEnd).toBeDefined();
    });

    it('should include current shift when active', async () => {
      // The queries are run in parallel via Promise.all, so order depends on execution
      // Mock all the different queries that can happen

      // Mock driver name query
      mockQueryRawUnsafe.mockImplementation((sql: string) => {
        if (sql.includes('SELECT p.first_name, p.last_name')) {
          return Promise.resolve([{ first_name: 'Jane', last_name: 'Smith' }]);
        }
        if (sql.includes('FROM deliveries')) {
          return Promise.resolve([
            { total: BigInt(3), completed: BigInt(2), cancelled: BigInt(0), in_progress: BigInt(1) },
          ]);
        }
        if (sql.includes('SELECT profile_id FROM drivers')) {
          return Promise.resolve([{ profile_id: null }]);
        }
        if (sql.includes('FROM driver_shifts') && sql.includes('SUM(total_distance_miles)')) {
          return Promise.resolve([
            { total_miles: 25, gps_miles: 24, delivery_count: BigInt(3) },
          ]);
        }
        if (sql.includes('FROM driver_shifts') && sql.includes('COUNT(*)')) {
          return Promise.resolve([
            { total_shifts: BigInt(1), total_hours: 4 },
          ]);
        }
        if (sql.includes('status = \'active\'')) {
          return Promise.resolve([
            {
              id: 'shift-123',
              shift_start: new Date('2024-01-15T08:00:00Z'),
              delivery_count: 3,
              total_distance_miles: 25,
              break_start: null,
              break_end: null,
            },
          ]);
        }
        return Promise.resolve([]);
      });

      const stats = await getDriverStats({
        driverId: mockDriverId,
        period: 'today',
      });

      expect(stats.currentShift).toBeDefined();
      expect(stats.currentShift?.id).toBe('shift-123');
      expect(stats.currentShift?.isOnBreak).toBe(false);
    });
  });

  describe('getAllDriversStatsSummary', () => {
    it('should return summary stats for all drivers', async () => {
      // Mock driver count
      mockQueryRawUnsafe.mockResolvedValueOnce([
        { total_active: BigInt(10), on_duty: BigInt(3) },
      ]);

      // Mock aggregate stats
      mockQueryRawUnsafe.mockResolvedValueOnce([
        { total_deliveries: BigInt(50), total_miles: 500 },
      ]);

      // Mock top performers
      mockQueryRawUnsafe.mockResolvedValueOnce([
        {
          driver_id: 'driver-1',
          first_name: 'Top',
          last_name: 'Driver',
          delivery_count: BigInt(15),
          total_miles: 150,
        },
        {
          driver_id: 'driver-2',
          first_name: 'Good',
          last_name: 'Driver',
          delivery_count: BigInt(12),
          total_miles: 120,
        },
      ]);

      const summary = await getAllDriversStatsSummary('today');

      expect(summary.period).toBe('today');
      expect(summary.totalActiveDrivers).toBe(10);
      expect(summary.driversOnDuty).toBe(3);
      expect(summary.aggregates.totalDeliveries).toBe(50);
      expect(summary.aggregates.totalMiles).toBe(500);
      expect(summary.topPerformers).toHaveLength(2);
      expect(summary.topPerformers[0].driverName).toBe('Top Driver');
    });

    it('should handle empty driver list', async () => {
      mockQueryRawUnsafe.mockResolvedValueOnce([
        { total_active: BigInt(0), on_duty: BigInt(0) },
      ]);

      mockQueryRawUnsafe.mockResolvedValueOnce([
        { total_deliveries: BigInt(0), total_miles: 0 },
      ]);

      mockQueryRawUnsafe.mockResolvedValueOnce([]);

      const summary = await getAllDriversStatsSummary('today');

      expect(summary.totalActiveDrivers).toBe(0);
      expect(summary.aggregates.averageDeliveriesPerDriver).toBe(0);
      expect(summary.topPerformers).toHaveLength(0);
    });
  });
});
