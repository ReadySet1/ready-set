// src/hooks/useDashboardMetrics.ts
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  DashboardMetrics, 
  DashboardMetricsError, 
  DashboardQueryParams,
  isDashboardMetrics,
  isDashboardError 
} from '@/types/dashboard';

interface UseDashboardMetricsOptions {
  refreshInterval?: number; // in milliseconds
  enabled?: boolean;
  onError?: (error: DashboardMetricsError) => void;
  onSuccess?: (data: DashboardMetrics) => void;
}

interface UseDashboardMetricsReturn {
  data: DashboardMetrics | null;
  error: DashboardMetricsError | null;
  isLoading: boolean;
  isRefreshing: boolean;
  refetch: () => Promise<void>;
  lastFetchTime: Date | null;
}

export function useDashboardMetrics(
  options: UseDashboardMetricsOptions = {}
): UseDashboardMetricsReturn {
  const {
    refreshInterval,
    enabled = true,
    onError,
    onSuccess,
  } = options;

  const searchParams = useSearchParams();
  const [data, setData] = useState<DashboardMetrics | null>(null);
  const [error, setError] = useState<DashboardMetricsError | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);

  // Build query string from search params
  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const vendorId = searchParams.get('vendorId');

    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (vendorId) params.append('vendorId', vendorId);

    const queryString = params.toString();
    return queryString ? `?${queryString}` : '';
  }, [searchParams]);

  // Fetch function
  const fetchMetrics = useCallback(async (isRefresh = false) => {
    if (!enabled) return;

    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      const queryString = buildQueryString();
      const response = await fetch(`/api/dashboard-metrics${queryString}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // Include credentials for authentication
        credentials: 'include',
      });

      const result = await response.json();

      if (!response.ok) {
        const errorData = result as DashboardMetricsError;
        setError(errorData);
        onError?.(errorData);
        return;
      }

      if (isDashboardMetrics(result)) {
        setData(result);
        setLastFetchTime(new Date());
        onSuccess?.(result);
      } else if (isDashboardError(result)) {
        setError(result);
        onError?.(result);
      }
    } catch (err) {
      const errorData: DashboardMetricsError = {
        error: 'Failed to fetch dashboard metrics',
        details: err instanceof Error ? err.message : 'Unknown error',
      };
      setError(errorData);
      onError?.(errorData);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [enabled, buildQueryString, onError, onSuccess]);

  // Refetch function
  const refetch = useCallback(async () => {
    await fetchMetrics(true);
  }, [fetchMetrics]);

  // Initial fetch
  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // Set up refresh interval if specified
  useEffect(() => {
    if (!refreshInterval || !enabled) return;

    const intervalId = setInterval(() => {
      fetchMetrics(true);
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [refreshInterval, enabled, fetchMetrics]);

  return {
    data,
    error,
    isLoading,
    isRefreshing,
    refetch,
    lastFetchTime,
  };
}

// Example usage in a component:
/*
export function DashboardMetricsCard() {
  const { data, error, isLoading, isRefreshing, refetch } = useDashboardMetrics({
    refreshInterval: 30000, // Refresh every 30 seconds
    onError: (error) => {
      toast.error(error.error);
    },
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return <DashboardError error={error} onRetry={refetch} />;
  }

  if (!data) {
    return null;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        title="Total Revenue"
        value={formatCurrency(data.totalRevenue)}
        icon={<DollarSign className="h-4 w-4" />}
        isRefreshing={isRefreshing}
      />
      <MetricCard
        title="Delivery Requests"
        value={data.deliveriesRequests.toString()}
        icon={<Package className="h-4 w-4" />}
        isRefreshing={isRefreshing}
      />
      <MetricCard
        title="Completed Sales"
        value={data.salesTotal.toString()}
        icon={<CheckCircle className="h-4 w-4" />}
        isRefreshing={isRefreshing}
      />
      <MetricCard
        title="Total Vendors"
        value={data.totalVendors.toString()}
        icon={<Users className="h-4 w-4" />}
        isRefreshing={isRefreshing}
      />
    </div>
  );
}
*/
