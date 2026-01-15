'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import type {
  StatsPeriod,
  AggregatedDriverStats,
  DriverStatsSummary,
} from '@/services/tracking/driver-stats';

// =============================================================================
// Types
// =============================================================================

interface DriverStatsApiResponse {
  success: boolean;
  data: AggregatedDriverStats;
  meta: {
    cachedAt: string | null;
    freshUntil: string | null;
  };
  error?: string;
  details?: string;
}

interface DriverStatsSummaryApiResponse {
  success: boolean;
  data: DriverStatsSummary;
  meta: {
    cachedAt: string | null;
    freshUntil: string | null;
  };
  error?: string;
  details?: string;
}

export interface UseDriverStatsOptions {
  driverId: string;
  period?: StatsPeriod;
  enabled?: boolean;
}

export interface UseDriverStatsSummaryOptions {
  period?: StatsPeriod;
  includeInactive?: boolean;
  enabled?: boolean;
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Fetch driver stats from the API
 */
async function fetchDriverStats(
  driverId: string,
  period: StatsPeriod
): Promise<AggregatedDriverStats> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('Authentication required. Please sign in again.');
  }

  const response = await fetch(
    `/api/drivers/${driverId}/stats?period=${period}`,
    {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    }
  );

  if (!response.ok) {
    const errorData: { error?: string } = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to fetch driver stats');
  }

  const result: DriverStatsApiResponse = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch driver stats');
  }

  return result.data;
}

/**
 * Fetch driver stats summary from the API (admin only)
 */
async function fetchDriverStatsSummary(
  period: StatsPeriod,
  includeInactive: boolean
): Promise<DriverStatsSummary> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('Authentication required. Please sign in again.');
  }

  const params = new URLSearchParams({
    period,
    includeInactive: includeInactive.toString(),
  });

  const response = await fetch(`/api/drivers/stats/summary?${params}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const errorData: { error?: string } = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to fetch driver stats summary');
  }

  const result: DriverStatsSummaryApiResponse = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch driver stats summary');
  }

  return result.data;
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * Hook to fetch stats for a specific driver
 *
 * @param options - Driver ID, period, and query options
 * @returns Query result with driver stats
 *
 * @example
 * ```tsx
 * const { data, isLoading, error, refetch } = useDriverStats({
 *   driverId: 'abc-123',
 *   period: 'today',
 * });
 *
 * if (isLoading) return <Loading />;
 * if (error) return <Error message={error.message} />;
 *
 * return (
 *   <div>
 *     <p>Total deliveries: {data.deliveryStats.total}</p>
 *     <p>Total miles: {data.distanceStats.totalMiles}</p>
 *   </div>
 * );
 * ```
 */
export function useDriverStats(options: UseDriverStatsOptions) {
  const { driverId, period = 'today', enabled = true } = options;

  return useQuery({
    queryKey: ['driver-stats', driverId, period],
    queryFn: () => fetchDriverStats(driverId, period),
    enabled: enabled && !!driverId,
    staleTime: getStaleTime(period),
    gcTime: getGcTime(period),
    refetchOnWindowFocus: period === 'today', // Only refetch "today" on window focus
  });
}

/**
 * Hook to fetch summary stats for all drivers (admin dashboard)
 *
 * @param options - Period, includeInactive flag, and query options
 * @returns Query result with summary stats
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useDriverStatsSummary({
 *   period: 'today',
 * });
 *
 * if (isLoading) return <Loading />;
 * if (error) return <Error message={error.message} />;
 *
 * return (
 *   <div>
 *     <p>Active drivers: {data.totalActiveDrivers}</p>
 *     <p>Total deliveries: {data.aggregates.totalDeliveries}</p>
 *   </div>
 * );
 * ```
 */
export function useDriverStatsSummary(options: UseDriverStatsSummaryOptions = {}) {
  const { period = 'today', includeInactive = false, enabled = true } = options;

  return useQuery({
    queryKey: ['driver-stats-summary', period, includeInactive],
    queryFn: () => fetchDriverStatsSummary(period, includeInactive),
    enabled,
    staleTime: getStaleTime(period),
    gcTime: getGcTime(period),
    refetchOnWindowFocus: period === 'today',
  });
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Get staleTime based on period (matches server cache TTL)
 */
function getStaleTime(period: StatsPeriod): number {
  switch (period) {
    case 'today':
      return 2 * 60 * 1000; // 2 minutes
    case 'week':
      return 5 * 60 * 1000; // 5 minutes
    case 'month':
      return 10 * 60 * 1000; // 10 minutes
    case 'all':
      return 15 * 60 * 1000; // 15 minutes
    default:
      return 2 * 60 * 1000;
  }
}

/**
 * Get gcTime (garbage collection time) based on period
 */
function getGcTime(period: StatsPeriod): number {
  switch (period) {
    case 'today':
      return 5 * 60 * 1000; // 5 minutes
    case 'week':
      return 10 * 60 * 1000; // 10 minutes
    case 'month':
      return 15 * 60 * 1000; // 15 minutes
    case 'all':
      return 20 * 60 * 1000; // 20 minutes
    default:
      return 5 * 60 * 1000;
  }
}

/**
 * Query key factory for driver stats
 * Use for cache invalidation
 */
export const driverStatsKeys = {
  all: ['driver-stats'] as const,
  driver: (driverId: string) => ['driver-stats', driverId] as const,
  driverPeriod: (driverId: string, period: StatsPeriod) =>
    ['driver-stats', driverId, period] as const,
  summary: (period: StatsPeriod, includeInactive: boolean) =>
    ['driver-stats-summary', period, includeInactive] as const,
};
