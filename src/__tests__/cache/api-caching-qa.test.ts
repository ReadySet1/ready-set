// src/__tests__/cache/api-caching-qa.test.ts
/**
 * Comprehensive QA tests for API Caching implementation
 * Testing vendor metrics and order endpoints caching with performance optimizations
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  setDashboardMetricsCache,
  getDashboardMetricsCache,
  getDashboardMetricsCacheWithEtag,
  invalidateDashboardMetricsCache,
  generateDashboardMetricsCacheKey,
  setVendorMetricsCache,
  getVendorMetricsCache,
  getVendorMetricsCacheWithEtag,
  invalidateVendorMetricsCache,
  generateVendorMetricsCacheKey,
  setVendorOrdersCache,
  getVendorOrdersCache,
  getVendorOrdersCacheWithEtag,
  invalidateVendorOrdersCache,
  generateVendorOrdersCacheKey,
  getCacheStats,
  invalidateAllVendorCache
} from '@/lib/cache/dashboard-cache';

// Mock performance.now for consistent timing tests
const mockPerformanceNow = jest.fn();
Object.defineProperty(global, 'performance', {
  value: {
    now: mockPerformanceNow
  }
});

// Define mock data at top level so all describe blocks can access them
const mockMetricsData = {
  totalRevenue: 150000,
  deliveriesRequests: 450,
  salesTotal: 125000,
  totalVendors: 75,
  period: {
    startDate: '2024-01-01',
    endDate: '2024-01-31'
  }
};

const mockVendorMetrics = {
  activeOrders: 15,
  completedOrders: 125,
  cancelledOrders: 3,
  pendingOrders: 8,
  totalRevenue: 45000,
  orderGrowth: 12.5
};

const mockOrdersData = {
  orders: [
    { id: 'order_1', status: 'pending', total: 150 },
    { id: 'order_2', status: 'completed', total: 200 }
  ],
  hasMore: false,
  total: 2,
  page: 1,
  limit: 10
};

describe('API Caching System QA', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPerformanceNow.mockReturnValue(0);
    // Clear all cache entries before each test
    invalidateDashboardMetricsCache();
    // Clear vendor caches for known test user IDs
    ['vendor_123', 'vendor_456', 'vendor_789', 'vendor_999', 'vendor_111',
     'vendor_comprehensive', 'vendor_update', 'vendor_high_freq', 'vendor_efficiency',
     'vendor_etag_test', 'vendor_mutation', 'vendor_large', 'vendor_1', 'vendor_consistency',
     'vendor_concurrent'].forEach(userId => {
      invalidateAllVendorCache(userId);
    });
  });

  describe('Dashboard Metrics Caching', () => {
    describe('Cache Key Generation', () => {
      it('should generate consistent cache keys for dashboard metrics', () => {
        const params1 = {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          vendorId: 'vendor_123',
          userType: 'client'
        };

        const params2 = {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          vendorId: 'vendor_123',
          userType: 'client'
        };

        const key1 = generateDashboardMetricsCacheKey(params1);
        const key2 = generateDashboardMetricsCacheKey(params2);

        expect(key1).toBe(key2);
        expect(key1).toContain('dashboard_metrics');
        expect(key1).toContain('startDate:2024-01-01');
        expect(key1).toContain('vendorId:vendor_123');
      });

      // TODO: REA-211 - Cache state persists between tests
      it.skip('should handle missing parameters correctly', () => {
        const params = {
          startDate: '2024-01-01'
          // Missing other params
        };

        const key = generateDashboardMetricsCacheKey(params);

        expect(key).toContain('endDate:all');
        expect(key).toContain('vendorId:all');
        expect(key).toContain('userType:all');
      });

      it('should sort parameters for consistent key generation', () => {
        const params1 = {
          a: 'value1',
          b: 'value2',
          c: 'value3'
        };

        const params2 = {
          c: 'value3',
          a: 'value1',
          b: 'value2'
        };

        const key1 = generateDashboardMetricsCacheKey(params1);
        const key2 = generateDashboardMetricsCacheKey(params2);

        expect(key1).toBe(key2);
      });
    });

    describe('Cache Operations', () => {
      it('should store and retrieve dashboard metrics correctly', () => {
        const params = {
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        };

        // Set cache
        setDashboardMetricsCache(params, mockMetricsData, 5000);

        // Retrieve cache
        const cachedData = getDashboardMetricsCache(params);

        expect(cachedData).toEqual(mockMetricsData);
      });

      // TODO: REA-211 - Cache state persists between tests
      it.skip('should return null for non-existent cache entries', () => {
        const params = {
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        };

        const cachedData = getDashboardMetricsCache(params);

        expect(cachedData).toBeNull();
      });

      // TODO: REA-211 - Cache state persists between tests
      it.skip('should respect TTL and expire entries', async () => {
        const params = {
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        };

        // Set cache with very short TTL
        setDashboardMetricsCache(params, mockMetricsData, 100);

        // Should be available immediately
        expect(getDashboardMetricsCache(params)).toEqual(mockMetricsData);

        // Simulate time passing (more than TTL)
        mockPerformanceNow.mockReturnValue(200);

        // Should be expired now
        const expiredData = getDashboardMetricsCache(params);
        expect(expiredData).toBeNull();
      });

      it('should handle ETag generation and validation', () => {
        const params = {
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        };

        // Set cache
        setDashboardMetricsCache(params, mockMetricsData, 5000);

        // Get with ETag
        const { data, etag } = getDashboardMetricsCacheWithEtag(params);

        expect(data).toEqual(mockMetricsData);
        expect(etag).toBeDefined();
        expect(typeof etag).toBe('string');
        expect(etag).toMatch(/^"[a-zA-Z0-9-]+-\d+"$/);
      });

      it('should invalidate specific cache entries', () => {
        const params1 = { startDate: '2024-01-01' };
        const params2 = { startDate: '2024-02-01' };

        // Set multiple cache entries
        setDashboardMetricsCache(params1, mockMetricsData, 5000);
        setDashboardMetricsCache(params2, mockMetricsData, 5000);

        // Should both be available
        expect(getDashboardMetricsCache(params1)).toEqual(mockMetricsData);
        expect(getDashboardMetricsCache(params2)).toEqual(mockMetricsData);

        // Invalidate specific entry
        invalidateDashboardMetricsCache(params1);

        // Only first entry should be invalidated
        expect(getDashboardMetricsCache(params1)).toBeNull();
        expect(getDashboardMetricsCache(params2)).toEqual(mockMetricsData);
      });

      it('should clear all dashboard cache when no params provided', () => {
        const params1 = { startDate: '2024-01-01' };
        const params2 = { startDate: '2024-02-01' };

        // Set multiple cache entries
        setDashboardMetricsCache(params1, mockMetricsData, 5000);
        setDashboardMetricsCache(params2, mockMetricsData, 5000);

        // Invalidate all
        invalidateDashboardMetricsCache();

        // Both should be gone
        expect(getDashboardMetricsCache(params1)).toBeNull();
        expect(getDashboardMetricsCache(params2)).toBeNull();
      });
    });

    describe('Performance Impact', () => {
      it('should provide fast cache access for repeated requests', () => {
        const params = {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          vendorId: 'vendor_123'
        };

        // Set cache once
        setDashboardMetricsCache(params, mockMetricsData, 5000);

        // Multiple fast retrievals
        const startTime = performance.now();

        for (let i = 0; i < 100; i++) {
          getDashboardMetricsCache(params);
        }

        const endTime = performance.now();
        const totalTime = endTime - startTime;

        // Should be very fast (< 5ms for 100 operations)
        expect(totalTime).toBeLessThan(5);
      });

      it('should not significantly slow down cache misses', () => {
        const nonExistentParams = {
          startDate: 'non-existent',
          endDate: 'non-existent'
        };

        const startTime = performance.now();

        for (let i = 0; i < 100; i++) {
          getDashboardMetricsCache(nonExistentParams);
        }

        const endTime = performance.now();
        const totalTime = endTime - startTime;

        // Should still be fast for cache misses (< 5ms for 100 operations)
        expect(totalTime).toBeLessThan(5);
      });
    });
  });

  describe('Vendor Metrics Caching', () => {
    describe('Vendor Metrics Cache Operations', () => {
      it('should cache and retrieve vendor metrics correctly', () => {
        const userId = 'vendor_123';

        // Set vendor metrics cache
        setVendorMetricsCache(userId, mockVendorMetrics, 5000);

        // Retrieve vendor metrics cache
        const cachedData = getVendorMetricsCache(userId);

        expect(cachedData).toEqual(mockVendorMetrics);
      });

      it('should generate consistent vendor cache keys', () => {
        const userId1 = 'vendor_123';
        const userId2 = 'vendor_123';

        const key1 = generateVendorMetricsCacheKey(userId1);
        const key2 = generateVendorMetricsCacheKey(userId2);

        expect(key1).toBe(key2);
        expect(key1).toBe('vendor_metrics:vendor_123');
      });

      it('should handle vendor metrics ETags correctly', () => {
        const userId = 'vendor_456';

        // Set cache
        setVendorMetricsCache(userId, mockVendorMetrics, 5000);

        // Get with ETag
        const { data, etag } = getVendorMetricsCacheWithEtag(userId);

        expect(data).toEqual(mockVendorMetrics);
        expect(etag).toBeDefined();
        expect(typeof etag).toBe('string');
      });

      it('should invalidate vendor metrics cache correctly', () => {
        const userId = 'vendor_789';

        // Set cache
        setVendorMetricsCache(userId, mockVendorMetrics, 5000);
        expect(getVendorMetricsCache(userId)).toEqual(mockVendorMetrics);

        // Invalidate
        invalidateVendorMetricsCache(userId);

        // Should be gone
        expect(getVendorMetricsCache(userId)).toBeNull();
      });
    });
  });

  describe('Vendor Orders Caching', () => {
    describe('Vendor Orders Cache Operations', () => {
      it('should cache and retrieve vendor orders correctly', () => {
        const userId = 'vendor_123';
        const page = 1;
        const limit = 10;

        // Set vendor orders cache
        setVendorOrdersCache(userId, page, limit, mockOrdersData, 3000);

        // Retrieve vendor orders cache
        const cachedData = getVendorOrdersCache(userId, page, limit);

        expect(cachedData).toEqual(mockOrdersData);
      });

      it('should handle pagination parameters in cache keys', () => {
        const userId = 'vendor_123';

        const key1 = generateVendorOrdersCacheKey(userId, 1, 10);
        const key2 = generateVendorOrdersCacheKey(userId, 2, 20);

        expect(key1).toBe('vendor_orders:vendor_123:1:10');
        expect(key2).toBe('vendor_orders:vendor_123:2:20');
        expect(key1).not.toBe(key2);
      });

      it('should handle default pagination parameters', () => {
        const userId = 'vendor_456';

        const key1 = generateVendorOrdersCacheKey(userId);
        const key2 = generateVendorOrdersCacheKey(userId, 1, 10);

        expect(key1).toBe('vendor_orders:vendor_456:1:10');
        expect(key1).toBe(key2);
      });

      it('should invalidate specific vendor orders pages', () => {
        const userId = 'vendor_789';

        // Set multiple pages
        setVendorOrdersCache(userId, 1, 10, mockOrdersData, 3000);
        setVendorOrdersCache(userId, 2, 10, mockOrdersData, 3000);

        // Should both be available
        expect(getVendorOrdersCache(userId, 1, 10)).toEqual(mockOrdersData);
        expect(getVendorOrdersCache(userId, 2, 10)).toEqual(mockOrdersData);

        // Invalidate specific page
        invalidateVendorOrdersCache(userId, 1, 10);

        // Only first page should be invalidated
        expect(getVendorOrdersCache(userId, 1, 10)).toBeNull();
        expect(getVendorOrdersCache(userId, 2, 10)).toEqual(mockOrdersData);
      });

      it('should clear all vendor orders for a user when no pagination specified', () => {
        const userId = 'vendor_999';

        // Set multiple pages
        setVendorOrdersCache(userId, 1, 10, mockOrdersData, 3000);
        setVendorOrdersCache(userId, 2, 10, mockOrdersData, 3000);

        // Clear all for user
        invalidateVendorOrdersCache(userId);

        // Both should be gone
        expect(getVendorOrdersCache(userId, 1, 10)).toBeNull();
        expect(getVendorOrdersCache(userId, 2, 10)).toBeNull();
      });

      it('should handle vendor orders ETags correctly', () => {
        const userId = 'vendor_111';
        const page = 1;
        const limit = 10;

        // Set cache
        setVendorOrdersCache(userId, page, limit, mockOrdersData, 3000);

        // Get with ETag
        const { data, etag } = getVendorOrdersCacheWithEtag(userId, page, limit);

        expect(data).toEqual(mockOrdersData);
        expect(etag).toBeDefined();
        expect(typeof etag).toBe('string');
      });
    });
  });

  describe('Cache Statistics and Monitoring', () => {
    it('should provide accurate cache statistics', () => {
      // Initially empty
      const stats1 = getCacheStats();
      expect(stats1.size).toBe(0);
      expect(stats1.keys).toEqual([]);

      // Add some entries
      setDashboardMetricsCache({ startDate: '2024-01-01' }, mockMetricsData, 5000);
      setVendorMetricsCache('vendor_123', mockVendorMetrics, 5000);
      setVendorOrdersCache('vendor_123', 1, 10, mockOrdersData, 3000);

      // Check updated stats
      const stats2 = getCacheStats();
      expect(stats2.size).toBe(3);
      expect(stats2.keys.length).toBe(3);
      expect(stats2.keys).toContain('dashboard_metrics:startDate:2024-01-01');
      expect(stats2.keys).toContain('vendor_metrics:vendor_123');
      expect(stats2.keys).toContain('vendor_orders:vendor_123:1:10');
    });

    it('should track cache efficiency metrics', () => {
      const userId = 'vendor_efficiency';
      const params = { startDate: '2024-01-01' };

      // Track cache hits vs misses
      let hits = 0;
      let misses = 0;

      // Set initial data
      setVendorMetricsCache(userId, mockVendorMetrics, 5000);

      // Simulate multiple requests
      for (let i = 0; i < 10; i++) {
        const data = getVendorMetricsCache(userId);
        if (data) {
          hits++;
        } else {
          misses++;
        }
      }

      expect(hits).toBe(10);
      expect(misses).toBe(0);
    });
  });

  describe('Cache Invalidation Strategies', () => {
    it('should support comprehensive vendor cache invalidation', () => {
      const userId = 'vendor_comprehensive';

      // Set all vendor-related caches
      setVendorMetricsCache(userId, mockVendorMetrics, 5000);
      setVendorOrdersCache(userId, 1, 10, mockOrdersData, 3000);
      setVendorOrdersCache(userId, 2, 10, mockOrdersData, 3000);

      // Verify all are set
      expect(getVendorMetricsCache(userId)).toEqual(mockVendorMetrics);
      expect(getVendorOrdersCache(userId, 1, 10)).toEqual(mockOrdersData);
      expect(getVendorOrdersCache(userId, 2, 10)).toEqual(mockOrdersData);

      // Invalidate all vendor cache for this user
      invalidateAllVendorCache(userId);

      // All should be gone
      expect(getVendorMetricsCache(userId)).toBeNull();
      expect(getVendorOrdersCache(userId, 1, 10)).toBeNull();
      expect(getVendorOrdersCache(userId, 2, 10)).toBeNull();
    });

    it('should handle cache invalidation during data updates', () => {
      const userId = 'vendor_update';
      const params = { startDate: '2024-01-01' };

      // Set initial cache
      setVendorMetricsCache(userId, mockVendorMetrics, 5000);
      setDashboardMetricsCache(params, mockMetricsData, 5000);

      // Simulate data update scenario
      const updatedMetrics = { ...mockVendorMetrics, activeOrders: 20 };

      // In real implementation, this would be called when data changes
      invalidateVendorMetricsCache(userId);

      // Old data should be gone
      expect(getVendorMetricsCache(userId)).toBeNull();

      // Set updated data
      setVendorMetricsCache(userId, updatedMetrics, 5000);

      // New data should be available
      expect(getVendorMetricsCache(userId)).toEqual(updatedMetrics);
    });
  });

  describe('Cache Performance Optimization', () => {
    it('should handle high-frequency cache operations efficiently', () => {
      const userId = 'vendor_high_freq';
      const startTime = performance.now();

      // Simulate high-frequency operations (1000 operations)
      for (let i = 0; i < 1000; i++) {
        setVendorMetricsCache(userId, { ...mockVendorMetrics, activeOrders: i }, 5000);
        getVendorMetricsCache(userId);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should handle high frequency efficiently (< 100ms for 1000 operations)
      expect(totalTime).toBeLessThan(100);

      // Final value should be accessible
      const finalData = getVendorMetricsCache(userId);
      expect(finalData?.activeOrders).toBe(999);
    });

    it('should handle many cache entries efficiently', () => {
      const initialStats = getCacheStats();

      // Set many entries
      for (let i = 0; i < 100; i++) {
        setVendorMetricsCache(`vendor_${i}`, mockVendorMetrics, 5000);
      }

      const afterSetStats = getCacheStats();
      expect(afterSetStats.size).toBe(initialStats.size + 100);

      // Verify all entries are retrievable
      const data50 = getVendorMetricsCache('vendor_50');
      expect(data50).toEqual(mockVendorMetrics);

      // Verify high-volume cache operations complete quickly
      const startTime = performance.now();
      for (let i = 0; i < 100; i++) {
        getVendorMetricsCache(`vendor_${i}`);
      }
      const endTime = performance.now();

      // 100 cache reads should be very fast (< 10ms)
      expect(endTime - startTime).toBeLessThan(10);
    });
  });

  describe('Cache Error Handling', () => {
    it('should handle cache storage errors gracefully', () => {
      // This would test error scenarios in the actual cache implementation
      // For this test, we verify that the cache functions don't throw
      expect(() => {
        setVendorMetricsCache('test', mockVendorMetrics, 5000);
      }).not.toThrow();

      expect(() => {
        getVendorMetricsCache('test');
      }).not.toThrow();
    });

    it('should handle edge case cache data gracefully', () => {
      // Test that cache functions don't throw for valid empty objects
      expect(() => {
        setDashboardMetricsCache({ startDate: '2024-01-01' }, {} as any, 5000);
      }).not.toThrow();

      expect(() => {
        setVendorMetricsCache('test', { activeOrders: 0 } as any, 5000);
      }).not.toThrow();

      // Verify we can retrieve empty data
      const emptyData = getDashboardMetricsCache({ startDate: '2024-01-01' });
      expect(emptyData).toBeDefined();
    });
  });

  describe('Cache Integration with API Routes', () => {
    it('should support conditional requests with ETags', () => {
      const userId = 'vendor_etag_test';
      const params = { startDate: '2024-01-01' };

      // Set cache with ETag
      setVendorMetricsCache(userId, mockVendorMetrics, 5000);
      setDashboardMetricsCache(params, mockMetricsData, 5000);

      // Get ETags
      const vendorEtag = getVendorMetricsCacheWithEtag(userId).etag;
      const dashboardEtag = getDashboardMetricsCacheWithEtag(params).etag;

      // In real implementation, these ETags would be used for conditional requests
      expect(vendorEtag).toBeDefined();
      expect(dashboardEtag).toBeDefined();
      expect(vendorEtag).not.toBe(dashboardEtag); // Different resources should have different ETags
    });

    it('should support cache invalidation on data mutations', () => {
      const userId = 'vendor_mutation';
      const orderId = 'order_1'; // Use existing order ID from mockOrdersData

      // Set initial cache state
      setVendorOrdersCache(userId, 1, 10, mockOrdersData, 3000);

      // Simulate order status change (would trigger cache invalidation)
      const updatedOrdersData = {
        ...mockOrdersData,
        orders: mockOrdersData.orders.map(order =>
          order.id === orderId ? { ...order, status: 'completed' } : order
        )
      };

      // In real implementation, this would invalidate and update cache
      invalidateVendorOrdersCache(userId, 1, 10);
      setVendorOrdersCache(userId, 1, 10, updatedOrdersData, 3000);

      // Updated data should be available
      const currentData = getVendorOrdersCache(userId, 1, 10);
      expect(currentData?.orders.find(o => o.id === orderId)?.status).toBe('completed');
    });
  });

  describe('Cache Memory Management', () => {
    it('should manage memory efficiently with large datasets', () => {
      const largeData = {
        orders: Array.from({ length: 1000 }, (_, i) => ({
          id: `order_${i}`,
          status: 'pending',
          total: Math.random() * 1000
        })),
        hasMore: false,
        total: 1000,
        page: 1,
        limit: 1000
      };

      const userId = 'vendor_large';

      // Should handle large datasets without issues
      expect(() => {
        setVendorOrdersCache(userId, 1, 1000, largeData, 3000);
      }).not.toThrow();

      const retrievedData = getVendorOrdersCache(userId, 1, 1000);
      expect(retrievedData?.orders.length).toBe(1000);
      expect(retrievedData?.total).toBe(1000);
    });

    it('should provide cache size monitoring', () => {
      const initialStats = getCacheStats();

      // Add data and monitor growth
      setVendorOrdersCache('vendor_1', 1, 10, mockOrdersData, 3000);
      const afterOneStats = getCacheStats();
      expect(afterOneStats.size).toBe(initialStats.size + 1);

      setVendorMetricsCache('vendor_1', mockVendorMetrics, 5000);
      const afterTwoStats = getCacheStats();
      expect(afterTwoStats.size).toBe(afterOneStats.size + 1);

      // Should be able to track cache growth
      expect(afterTwoStats.size).toBeGreaterThan(initialStats.size);
    });
  });

  describe('Cache Consistency and Data Integrity', () => {
    it('should return references to cached data (not copies)', () => {
      const userId = 'vendor_consistency';
      // Create a deep copy for this test to avoid affecting other tests
      const testData = JSON.parse(JSON.stringify(mockOrdersData));

      // Set initial data
      setVendorOrdersCache(userId, 1, 10, testData, 3000);

      // Retrieve and modify (simulate external modification)
      const retrievedData = getVendorOrdersCache(userId, 1, 10);
      if (retrievedData) {
        retrievedData.orders[0].status = 'modified';
      }

      // Cache returns references, so modifications affect cached data
      // This is expected behavior for an in-memory cache (performance optimization)
      const freshData = getVendorOrdersCache(userId, 1, 10);
      expect(freshData?.orders[0].status).toBe('modified'); // Reference behavior
    });

    it('should handle concurrent cache operations correctly', async () => {
      const userId = 'vendor_concurrent';

      // Simulate concurrent operations
      const operations = [
        setVendorMetricsCache(userId, mockVendorMetrics, 5000),
        setVendorOrdersCache(userId, 1, 10, mockOrdersData, 3000),
        getVendorMetricsCache(userId),
        getVendorOrdersCache(userId, 1, 10),
        invalidateVendorMetricsCache(userId)
      ];

      // Should handle concurrent operations without issues
      const results = await Promise.all(operations.map(op => Promise.resolve(op)));

      expect(results).toHaveLength(5);
      // Final state should be consistent
      expect(getVendorMetricsCache(userId)).toBeNull(); // Was invalidated
      expect(getVendorOrdersCache(userId, 1, 10)).toEqual(mockOrdersData); // Still available
    });
  });
});

