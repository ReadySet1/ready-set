// src/types/dashboard.ts
import { z } from 'zod';

// Dashboard metrics types
export interface DashboardMetrics {
  totalRevenue: number;
  deliveriesRequests: number;
  salesTotal: number;
  totalVendors: number;
  period?: {
    startDate?: string;
    endDate?: string;
  };
}

// Error response type
export interface DashboardMetricsError {
  error: string;
  details?: string | z.ZodError;
}

// Combined response type
export type DashboardMetricsResponse = DashboardMetrics | DashboardMetricsError;

// Query parameters schema
export const dashboardQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  vendorId: z.string().uuid().optional(),
});

export type DashboardQueryParams = z.infer<typeof dashboardQuerySchema>;

// Type guards
export function isDashboardMetrics(response: DashboardMetricsResponse): response is DashboardMetrics {
  return 'totalRevenue' in response;
}

export function isDashboardError(response: DashboardMetricsResponse): response is DashboardMetricsError {
  return 'error' in response;
}

// Additional metrics that could be added in the future
export interface ExtendedDashboardMetrics extends DashboardMetrics {
  averageOrderValue?: number;
  topVendors?: Array<{
    id: string;
    name: string;
    revenue: number;
  }>;
  recentOrders?: Array<{
    id: string;
    orderNumber: string;
    total: number;
    status: string;
    createdAt: string;
  }>;
  growthRate?: {
    revenue: number;
    orders: number;
    vendors: number;
  };
}

// Cache configuration
export const DASHBOARD_CACHE_CONFIG = {
  TTL: 300, // 5 minutes
  STALE_WHILE_REVALIDATE: 600, // 10 minutes
  TAGS: ['dashboard', 'metrics'],
} as const;

// Performance thresholds
export const PERFORMANCE_THRESHOLDS = {
  SLOW_QUERY_MS: 1000,
  CRITICAL_QUERY_MS: 5000,
} as const;
