/**
 * Vendor Cache Integration Tests
 *
 * Tests for vendor metrics and orders caching functionality in real scenarios
 */

import { jest } from '@jest/globals';
import {
  setVendorMetricsCache,
  getVendorMetricsCache,
  getVendorMetricsCacheWithEtag,
  setVendorOrdersCache,
  getVendorOrdersCache,
  invalidateVendorMetricsCache,
  invalidateVendorOrdersCache,
  generateVendorMetricsCacheKey,
  generateVendorOrdersCacheKey
} from '@/lib/cache/dashboard-cache';

describe('Vendor Cache', () => {
  const mockUserId = 'test-user-123';
  const mockMetrics = {
    activeOrders: 5,
    completedOrders: 10,
    cancelledOrders: 2,
    pendingOrders: 3,
    totalRevenue: 1500.50,
    orderGrowth: 15.5
  };

  const mockOrders = {
    orders: [
      { id: '1', orderNumber: 'ORD-001', status: 'ACTIVE' },
      { id: '2', orderNumber: 'ORD-002', status: 'COMPLETED' }
    ],
    hasMore: false,
    total: 2,
    page: 1,
    limit: 10
  };

  describe('Cache Key Generation', () => {
    it('should generate correct cache key for vendor metrics', () => {
      const key = generateVendorMetricsCacheKey(mockUserId);
      expect(key).toBe(`vendor_metrics:${mockUserId}`);
    });

    it('should generate correct cache key for vendor orders', () => {
      const key = generateVendorOrdersCacheKey(mockUserId, 1, 10);
      expect(key).toBe(`vendor_orders:${mockUserId}:1:10`);
    });

    it('should generate different keys for different users', () => {
      const key1 = generateVendorMetricsCacheKey('user1');
      const key2 = generateVendorMetricsCacheKey('user2');
      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different pages', () => {
      const key1 = generateVendorOrdersCacheKey(mockUserId, 1, 10);
      const key2 = generateVendorOrdersCacheKey(mockUserId, 2, 10);
      expect(key1).not.toBe(key2);
    });
  });

  describe('Cache Operations', () => {
    it('should set and get vendor metrics cache', () => {
      // Set cache
      setVendorMetricsCache(mockUserId, mockMetrics);

      // Get cache
      const result = getVendorMetricsCache(mockUserId);
      expect(result).toEqual(mockMetrics);
    });

    it('should set and get vendor orders cache', () => {
      // Set cache
      setVendorOrdersCache(mockUserId, 1, 10, mockOrders);

      // Get cache
      const result = getVendorOrdersCache(mockUserId, 1, 10);
      expect(result).toEqual(mockOrders);
    });

    it('should return null for non-existent cache', () => {
      const result = getVendorMetricsCache('non-existent-user');
      expect(result).toBeNull();
    });

    it('should invalidate vendor metrics cache', () => {
      // Set cache first
      setVendorMetricsCache(mockUserId, mockMetrics);

      // Verify it exists
      expect(getVendorMetricsCache(mockUserId)).toEqual(mockMetrics);

      // Invalidate cache
      invalidateVendorMetricsCache(mockUserId);

      // Verify it's gone
      expect(getVendorMetricsCache(mockUserId)).toBeNull();
    });

    it('should invalidate specific vendor orders cache', () => {
      // Set cache first
      setVendorOrdersCache(mockUserId, 1, 10, mockOrders);

      // Verify it exists
      expect(getVendorOrdersCache(mockUserId, 1, 10)).toEqual(mockOrders);

      // Invalidate specific cache
      invalidateVendorOrdersCache(mockUserId, 1, 10);

      // Verify it's gone
      expect(getVendorOrdersCache(mockUserId, 1, 10)).toBeNull();
    });

    it('should get cache with ETag', () => {
      // Set cache first
      setVendorMetricsCache(mockUserId, mockMetrics);

      // Get cache with ETag
      const result = getVendorMetricsCacheWithEtag(mockUserId);

      expect(result.data).toEqual(mockMetrics);
      expect(result.etag).toBeDefined();
      expect(typeof result.etag).toBe('string');
      expect(result.etag).toMatch(/^".*"$/); // Should be quoted
    });

    it('should handle multiple cache operations correctly', () => {
      // Set multiple caches
      setVendorMetricsCache(mockUserId, mockMetrics);
      setVendorOrdersCache(mockUserId, 1, 10, mockOrders);
      setVendorOrdersCache(mockUserId, 2, 10, mockOrders);

      // Verify all exist
      expect(getVendorMetricsCache(mockUserId)).toEqual(mockMetrics);
      expect(getVendorOrdersCache(mockUserId, 1, 10)).toEqual(mockOrders);
      expect(getVendorOrdersCache(mockUserId, 2, 10)).toEqual(mockOrders);

      // Invalidate one specific orders cache
      invalidateVendorOrdersCache(mockUserId, 1, 10);

      // Verify only the specific one is gone
      expect(getVendorMetricsCache(mockUserId)).toEqual(mockMetrics);
      expect(getVendorOrdersCache(mockUserId, 1, 10)).toBeNull();
      expect(getVendorOrdersCache(mockUserId, 2, 10)).toEqual(mockOrders);
    });
  });
});
