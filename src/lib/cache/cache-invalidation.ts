/**
 * Cache Invalidation Utilities
 *
 * Provides utilities for invalidating vendor caches when data is updated.
 * This ensures that stale cache data is not served to users.
 */

import { invalidateAllVendorCache, invalidateVendorMetricsCache, invalidateVendorOrdersCache } from './dashboard-cache';

/**
 * Invalidate vendor cache when order data changes
 */
export function invalidateVendorCacheOnOrderUpdate(userId: string): void {
  try {
    // Invalidate both metrics and orders cache for this vendor
    invalidateAllVendorCache(userId);
  } catch (error) {
    console.error(`Failed to invalidate vendor cache for user ${userId}:`, error);
  }
}

/**
 * Invalidate vendor cache when order status changes
 */
export function invalidateVendorCacheOnStatusUpdate(userId: string, orderId?: string): void {
  try {
    // Invalidate vendor cache - status changes affect both metrics and orders
    invalidateAllVendorCache(userId);

    if (orderId) {
    } else {
    }
  } catch (error) {
    console.error(`Failed to invalidate vendor cache for user ${userId}:`, error);
  }
}

/**
 * Invalidate vendor cache when new order is created
 */
export function invalidateVendorCacheOnOrderCreate(userId: string, orderId: string): void {
  try {
    // Invalidate vendor cache - new orders affect both metrics and orders lists
    invalidateAllVendorCache(userId);
  } catch (error) {
    console.error(`Failed to invalidate vendor cache for user ${userId}:`, error);
  }
}

/**
 * Invalidate vendor cache when order is deleted or cancelled
 */
export function invalidateVendorCacheOnOrderDelete(userId: string, orderId?: string): void {
  try {
    // Invalidate vendor cache - deleted orders affect metrics and orders lists
    invalidateAllVendorCache(userId);

    if (orderId) {
    } else {
    }
  } catch (error) {
    console.error(`Failed to invalidate vendor cache for user ${userId}:`, error);
  }
}

/**
 * Batch invalidate multiple vendor caches
 */
export function invalidateVendorCachesBatch(userIds: string[]): void {
  try {
    userIds.forEach(userId => {
      invalidateAllVendorCache(userId);
    });
  } catch (error) {
    console.error(`Failed to invalidate vendor caches for multiple users:`, error);
  }
}
