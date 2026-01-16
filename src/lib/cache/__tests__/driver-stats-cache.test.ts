import { driverStatsCache } from '../driver-stats-cache';
import type { AggregatedDriverStats, DriverStatsSummary, StatsPeriod } from '@/services/tracking/driver-stats';

// Mock timer functions
jest.useFakeTimers();

// Mock driver stats data
const mockDriverStats: AggregatedDriverStats = {
  driverId: 'driver-123',
  driverName: 'John Doe',
  totalDeliveries: 10,
  completedDeliveries: 8,
  cancelledDeliveries: 1,
  pendingDeliveries: 1,
  averageRating: 4.5,
  totalEarnings: 250.0,
  hoursWorked: 20,
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-31'),
};

const mockSummary: DriverStatsSummary = {
  totalDrivers: 10,
  activeDrivers: 8,
  totalDeliveries: 100,
  averageRating: 4.3,
  totalEarnings: 2500.0,
  period: 'week',
};

describe('DriverStatsCache', () => {
  beforeEach(() => {
    // Clear cache before each test
    driverStatsCache.clear();
    jest.clearAllTimers();
  });

  afterAll(() => {
    // Cleanup
    driverStatsCache.destroy();
    jest.useRealTimers();
  });

  describe('initialization', () => {
    it('should be initialized', () => {
      driverStatsCache.initialize();
      const stats = driverStatsCache.getStats();
      expect(stats.size).toBe(0);
      expect(stats.maxSize).toBe(500);
    });

    it('should be idempotent when calling initialize multiple times', () => {
      driverStatsCache.initialize();
      driverStatsCache.initialize();
      driverStatsCache.initialize();
      const stats = driverStatsCache.getStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('driver stats caching', () => {
    it('should store and retrieve driver stats', () => {
      driverStatsCache.setDriverStats('driver-123', 'week', mockDriverStats);

      const cached = driverStatsCache.getDriverStats('driver-123', 'week');
      expect(cached).not.toBeNull();
      expect(cached?.data).toEqual(mockDriverStats);
      expect(cached?.cachedAt).toBeInstanceOf(Date);
      expect(cached?.freshUntil).toBeInstanceOf(Date);
    });

    it('should return null for non-existent entry', () => {
      const cached = driverStatsCache.getDriverStats('non-existent', 'week');
      expect(cached).toBeNull();
    });

    it('should expire entries based on period TTL', () => {
      // Test with 'today' period (2 minute TTL)
      driverStatsCache.setDriverStats('driver-123', 'today', mockDriverStats);

      // Should be available immediately
      expect(driverStatsCache.getDriverStats('driver-123', 'today')).not.toBeNull();

      // Advance time by 3 minutes (past TTL)
      jest.advanceTimersByTime(3 * 60 * 1000);

      // Should be expired now
      expect(driverStatsCache.getDriverStats('driver-123', 'today')).toBeNull();
    });

    it('should have longer TTL for less frequent periods', () => {
      // Test with 'all' period (15 minute TTL)
      driverStatsCache.setDriverStats('driver-123', 'all', mockDriverStats);

      // Advance time by 10 minutes
      jest.advanceTimersByTime(10 * 60 * 1000);

      // Should still be available
      expect(driverStatsCache.getDriverStats('driver-123', 'all')).not.toBeNull();

      // Advance time by 6 more minutes (past 15 minute TTL)
      jest.advanceTimersByTime(6 * 60 * 1000);

      // Should be expired now
      expect(driverStatsCache.getDriverStats('driver-123', 'all')).toBeNull();
    });

    it('should store stats for different periods independently', () => {
      const periods: StatsPeriod[] = ['today', 'week', 'month', 'all'];

      periods.forEach((period) => {
        driverStatsCache.setDriverStats('driver-123', period, {
          ...mockDriverStats,
          totalDeliveries: period === 'today' ? 5 : 10,
        });
      });

      const todayStats = driverStatsCache.getDriverStats('driver-123', 'today');
      const weekStats = driverStatsCache.getDriverStats('driver-123', 'week');

      expect(todayStats?.data.totalDeliveries).toBe(5);
      expect(weekStats?.data.totalDeliveries).toBe(10);
    });
  });

  describe('summary caching', () => {
    it('should store and retrieve summary stats', () => {
      driverStatsCache.setSummary('week', false, mockSummary);

      const cached = driverStatsCache.getSummary('week', false);
      expect(cached).not.toBeNull();
      expect(cached?.data).toEqual(mockSummary);
    });

    it('should return null for non-existent summary', () => {
      const cached = driverStatsCache.getSummary('month', true);
      expect(cached).toBeNull();
    });

    it('should differentiate between active and all summaries', () => {
      const activeSummary = { ...mockSummary, totalDrivers: 8 };
      const allSummary = { ...mockSummary, totalDrivers: 10 };

      driverStatsCache.setSummary('week', false, activeSummary);
      driverStatsCache.setSummary('week', true, allSummary);

      const cachedActive = driverStatsCache.getSummary('week', false);
      const cachedAll = driverStatsCache.getSummary('week', true);

      expect(cachedActive?.data.totalDrivers).toBe(8);
      expect(cachedAll?.data.totalDrivers).toBe(10);
    });

    it('should expire summary entries', () => {
      driverStatsCache.setSummary('today', false, mockSummary);

      // Advance time past TTL
      jest.advanceTimersByTime(3 * 60 * 1000);

      expect(driverStatsCache.getSummary('today', false)).toBeNull();
    });
  });

  describe('invalidation', () => {
    it('should invalidate driver stats for all periods', () => {
      const periods: StatsPeriod[] = ['today', 'week', 'month', 'all'];

      // Cache all periods
      periods.forEach((period) => {
        driverStatsCache.setDriverStats('driver-123', period, mockDriverStats);
      });

      // Verify cached
      periods.forEach((period) => {
        expect(driverStatsCache.getDriverStats('driver-123', period)).not.toBeNull();
      });

      // Invalidate driver
      driverStatsCache.invalidateDriver('driver-123');

      // Verify all invalidated
      periods.forEach((period) => {
        expect(driverStatsCache.getDriverStats('driver-123', period)).toBeNull();
      });
    });

    it('should invalidate summaries when driver is invalidated', () => {
      driverStatsCache.setSummary('week', false, mockSummary);
      driverStatsCache.setSummary('week', true, mockSummary);

      // Invalidate driver (should also invalidate summaries)
      driverStatsCache.invalidateDriver('driver-123');

      expect(driverStatsCache.getSummary('week', false)).toBeNull();
      expect(driverStatsCache.getSummary('week', true)).toBeNull();
    });

    it('should invalidate all summaries', () => {
      const periods: StatsPeriod[] = ['today', 'week', 'month', 'all'];

      // Cache summaries
      periods.forEach((period) => {
        driverStatsCache.setSummary(period, false, mockSummary);
        driverStatsCache.setSummary(period, true, mockSummary);
      });

      // Invalidate all summaries
      driverStatsCache.invalidateSummaries();

      // Verify all invalidated
      periods.forEach((period) => {
        expect(driverStatsCache.getSummary(period, false)).toBeNull();
        expect(driverStatsCache.getSummary(period, true)).toBeNull();
      });
    });
  });

  describe('clear', () => {
    it('should clear all cached entries', () => {
      driverStatsCache.setDriverStats('driver-1', 'week', mockDriverStats);
      driverStatsCache.setDriverStats('driver-2', 'week', mockDriverStats);
      driverStatsCache.setSummary('week', false, mockSummary);

      expect(driverStatsCache.getStats().size).toBe(3);

      driverStatsCache.clear();

      expect(driverStatsCache.getStats().size).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', () => {
      const stats = driverStatsCache.getStats();

      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('maxSize');
      expect(stats).toHaveProperty('ttlConfig');
      expect(stats.maxSize).toBe(500);
      expect(stats.ttlConfig).toEqual({
        today: 2 * 60 * 1000,
        week: 5 * 60 * 1000,
        month: 10 * 60 * 1000,
        all: 15 * 60 * 1000,
      });
    });

    it('should reflect current cache size', () => {
      expect(driverStatsCache.getStats().size).toBe(0);

      driverStatsCache.setDriverStats('driver-1', 'week', mockDriverStats);
      expect(driverStatsCache.getStats().size).toBe(1);

      driverStatsCache.setDriverStats('driver-2', 'week', mockDriverStats);
      expect(driverStatsCache.getStats().size).toBe(2);
    });
  });

  describe('destroy', () => {
    it('should clear cache and stop cleanup', () => {
      driverStatsCache.initialize();
      driverStatsCache.setDriverStats('driver-1', 'week', mockDriverStats);

      driverStatsCache.destroy();

      expect(driverStatsCache.getStats().size).toBe(0);
    });
  });

  describe('max size enforcement', () => {
    it('should not exceed max entries', () => {
      // Add entries up to the limit
      for (let i = 0; i < 510; i++) {
        driverStatsCache.setDriverStats(`driver-${i}`, 'week', mockDriverStats);
      }

      // Size should be managed (some older entries removed)
      const stats = driverStatsCache.getStats();
      expect(stats.size).toBeLessThanOrEqual(stats.maxSize);
    });
  });
});
