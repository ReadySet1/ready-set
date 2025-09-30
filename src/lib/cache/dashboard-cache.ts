/**
 * Dashboard and API Response Cache Implementation
 *
 * Provides in-memory caching with TTL for dashboard metrics and vendor API responses
 * to reduce database load and improve performance.
 * Can be extended to use Redis or other caching strategies in the future.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  etag?: string; // For HTTP caching support
}

interface DashboardMetricsCache {
  totalRevenue: number;
  deliveriesRequests: number;
  salesTotal: number;
  totalVendors: number;
  period?: {
    startDate?: string;
    endDate?: string;
  };
}

// Vendor-specific cache types
interface VendorMetricsCache {
  activeOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  orderGrowth: number;
}

interface VendorOrdersCache {
  orders: any[];
  hasMore: boolean;
  total: number;
  page: number;
  limit: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private cleanupInterval: NodeJS.Timeout;

  constructor(cleanupIntervalMs = 60000) { // Cleanup every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, cleanupIntervalMs);
  }

  set<T>(key: string, data: T, ttlMs: number, etag?: string): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
      etag
    };
    this.cache.set(key, entry);
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  getWithEtag<T>(key: string): { data: T | null; etag?: string } {
    const entry = this.cache.get(key);

    if (!entry) {
      return { data: null };
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return { data: null };
    }

    return { data: entry.data, etag: entry.etag };
  }

  generateEtag(data: any): string {
    // Simple ETag generation based on data content and timestamp
    const content = JSON.stringify(data);
    const hash = Buffer.from(content).toString('base64').slice(0, 16);
    return `"${hash}-${Date.now()}"`;
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }
}

// Global cache instance
const dashboardCache = new MemoryCache();

// Cache key generators
export function generateDashboardMetricsCacheKey(params: {
  startDate?: string;
  endDate?: string;
  vendorId?: string;
  userType?: string;
}): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}:${params[key as keyof typeof params] || 'all'}`)
    .join('|');

  return `dashboard_metrics:${sortedParams}`;
}

// Cache operations
export function setDashboardMetricsCache(
  params: {
    startDate?: string;
    endDate?: string;
    vendorId?: string;
    userType?: string;
  },
  data: DashboardMetricsCache,
  ttlMs = 5 * 60 * 1000 // 5 minutes default
): void {
  const key = generateDashboardMetricsCacheKey(params);
  const etag = dashboardCache.generateEtag(data);
  dashboardCache.set(key, data, ttlMs, etag);
}

export function getDashboardMetricsCache(params: {
  startDate?: string;
  endDate?: string;
  vendorId?: string;
  userType?: string;
}): DashboardMetricsCache | null {
  const key = generateDashboardMetricsCacheKey(params);
  return dashboardCache.get<DashboardMetricsCache>(key);
}

export function getDashboardMetricsCacheWithEtag(params: {
  startDate?: string;
  endDate?: string;
  vendorId?: string;
  userType?: string;
}): { data: DashboardMetricsCache | null; etag?: string } {
  const key = generateDashboardMetricsCacheKey(params);
  return dashboardCache.getWithEtag<DashboardMetricsCache>(key);
}

export function invalidateDashboardMetricsCache(params?: {
  startDate?: string;
  endDate?: string;
  vendorId?: string;
  userType?: string;
}): void {
  if (params) {
    const key = generateDashboardMetricsCacheKey(params);
    dashboardCache.delete(key);
  } else {
    // Clear all dashboard cache if no specific params
    dashboardCache.clear();
  }
}

export function getCacheStats(): { size: number; keys: string[] } {
  return dashboardCache.getStats();
}

// Vendor-specific cache functions
export function generateVendorMetricsCacheKey(userId: string): string {
  return `vendor_metrics:${userId}`;
}

export function generateVendorOrdersCacheKey(
  userId: string,
  page: number = 1,
  limit: number = 10
): string {
  return `vendor_orders:${userId}:${page}:${limit}`;
}

export function setVendorMetricsCache(
  userId: string,
  data: VendorMetricsCache,
  ttlMs = 5 * 60 * 1000 // 5 minutes default
): string {
  const key = generateVendorMetricsCacheKey(userId);
  const etag = dashboardCache.generateEtag(data);
  dashboardCache.set(key, data, ttlMs, etag);
  return etag;
}

export function getVendorMetricsCache(userId: string): VendorMetricsCache | null {
  const key = generateVendorMetricsCacheKey(userId);
  return dashboardCache.get<VendorMetricsCache>(key);
}

export function getVendorMetricsCacheWithEtag(userId: string): { data: VendorMetricsCache | null; etag?: string } {
  const key = generateVendorMetricsCacheKey(userId);
  return dashboardCache.getWithEtag<VendorMetricsCache>(key);
}

export function setVendorOrdersCache(
  userId: string,
  page: number,
  limit: number,
  data: VendorOrdersCache,
  ttlMs = 2 * 60 * 1000 // 2 minutes default
): string {
  const key = generateVendorOrdersCacheKey(userId, page, limit);
  const etag = dashboardCache.generateEtag(data);
  dashboardCache.set(key, data, ttlMs, etag);
  return etag;
}

export function getVendorOrdersCache(
  userId: string,
  page: number = 1,
  limit: number = 10
): VendorOrdersCache | null {
  const key = generateVendorOrdersCacheKey(userId, page, limit);
  return dashboardCache.get<VendorOrdersCache>(key);
}

export function getVendorOrdersCacheWithEtag(
  userId: string,
  page: number = 1,
  limit: number = 10
): { data: VendorOrdersCache | null; etag?: string } {
  const key = generateVendorOrdersCacheKey(userId, page, limit);
  return dashboardCache.getWithEtag<VendorOrdersCache>(key);
}

export function invalidateVendorMetricsCache(userId: string): void {
  const key = generateVendorMetricsCacheKey(userId);
  dashboardCache.delete(key);
}

export function invalidateVendorOrdersCache(userId: string, page?: number, limit?: number): void {
  if (page !== undefined && limit !== undefined) {
    const key = generateVendorOrdersCacheKey(userId, page, limit);
    dashboardCache.delete(key);
  } else {
    // Clear all vendor orders cache for this user (more aggressive approach)
    const stats = dashboardCache.getStats();
    stats.keys.forEach(key => {
      if (key.startsWith(`vendor_orders:${userId}:`)) {
        dashboardCache.delete(key);
      }
    });
  }
}

export function invalidateAllVendorCache(userId: string): void {
  invalidateVendorMetricsCache(userId);
  invalidateVendorOrdersCache(userId);
}

// Graceful shutdown
if (typeof process !== 'undefined') {
  process.on('beforeExit', () => {
    dashboardCache.destroy();
  });
}

export { dashboardCache };

