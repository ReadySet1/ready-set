import { useState, useEffect, useCallback } from 'react';
import { useApiCache, createCacheKey } from './useApiCache';
import type { 
  PricingCalculation, 
  PricingTier, 
  PricingCalculationRequest,
  PricingApiResponse 
} from '@/types/pricing';

/**
 * Hook for calculating pricing based on head count, food cost, and tip status
 */
export function usePricingCalculation(
  headCount: number,
  foodCost: number,
  hasTip: boolean,
  enabled: boolean = true
) {
  const [data, setData] = useState<PricingCalculation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const { fetchWithCache } = useApiCache<PricingCalculation>({
    cacheDuration: 5 * 60 * 1000, // 5 minutes
  });

  const calculatePricing = useCallback(async () => {
    if (!enabled || headCount <= 0 || foodCost <= 0) {
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const cacheKey = createCacheKey('/api/pricing/calculate', { headCount, foodCost, hasTip });
      
      const result = await fetchWithCache(cacheKey, async () => {
        const response = await fetch('/api/pricing/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ headCount, foodCost, hasTip } as PricingCalculationRequest),
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || `Failed to calculate pricing: ${response.status}`);
        }
        
        const responseData: PricingApiResponse<PricingCalculation> = await response.json();
        
        if (!responseData.success || !responseData.data) {
          throw new Error(responseData.error || 'Failed to get pricing calculation');
        }
        
        return responseData.data;
      });

      setData(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
    } finally {
      setLoading(false);
    }
  }, [headCount, foodCost, hasTip, enabled, fetchWithCache]);

  useEffect(() => {
    calculatePricing();
  }, [calculatePricing]);

  return {
    data,
    loading,
    error,
    refetch: calculatePricing,
  };
}

/**
 * Hook for fetching all pricing tiers
 */
export function usePricingTiers() {
  const [data, setData] = useState<PricingTier[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const { fetchWithCache } = useApiCache<PricingTier[]>({
    cacheDuration: 10 * 60 * 1000, // 10 minutes
  });

  const fetchTiers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const cacheKey = '/api/pricing/tiers';
      
      const result = await fetchWithCache(cacheKey, async () => {
        const response = await fetch('/api/pricing/tiers');
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || `Failed to fetch pricing tiers: ${response.status}`);
        }
        
        const responseData: PricingApiResponse<PricingTier[]> = await response.json();
        
        if (!responseData.success || !responseData.data) {
          throw new Error(responseData.error || 'Failed to get pricing tiers');
        }
        
        return responseData.data;
      });

      setData(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
    } finally {
      setLoading(false);
    }
  }, [fetchWithCache]);

  useEffect(() => {
    fetchTiers();
  }, [fetchTiers]);

  return {
    data,
    loading,
    error,
    refetch: fetchTiers,
  };
}

/**
 * Hook for fetching a single pricing tier by ID
 */
export function usePricingTier(id: string, enabled: boolean = true) {
  const [data, setData] = useState<PricingTier | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const { fetchWithCache } = useApiCache<PricingTier>({
    cacheDuration: 10 * 60 * 1000, // 10 minutes
  });

  const fetchTier = useCallback(async () => {
    if (!enabled || !id) {
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const cacheKey = `/api/pricing/tiers/${id}`;
      
      const result = await fetchWithCache(cacheKey, async () => {
        const response = await fetch(`/api/pricing/tiers/${id}`);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || `Failed to fetch pricing tier: ${response.status}`);
        }
        
        const responseData: PricingApiResponse<PricingTier> = await response.json();
        
        if (!responseData.success || !responseData.data) {
          throw new Error(responseData.error || 'Failed to get pricing tier');
        }
        
        return responseData.data;
      });

      setData(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
    } finally {
      setLoading(false);
    }
  }, [id, enabled, fetchWithCache]);

  useEffect(() => {
    fetchTier();
  }, [fetchTier]);

  return {
    data,
    loading,
    error,
    refetch: fetchTier,
  };
}

/**
 * Hook for creating a new pricing tier
 */
export function useCreatePricingTier() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const createTier = useCallback(async (tierData: Omit<PricingTier, 'id' | 'createdAt' | 'updatedAt'>) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/pricing/tiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tierData),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to create pricing tier: ${response.status}`);
      }
      
      const responseData: PricingApiResponse<PricingTier> = await response.json();
      
      if (!responseData.success || !responseData.data) {
        throw new Error(responseData.error || 'Failed to create pricing tier');
      }
      
      return responseData.data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    createTier,
    loading,
    error,
  };
}

/**
 * Hook for updating an existing pricing tier
 */
export function useUpdatePricingTier() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const updateTier = useCallback(async (tierData: Partial<PricingTier> & { id: string }) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/pricing/tiers/${tierData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tierData),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to update pricing tier: ${response.status}`);
      }
      
      const responseData: PricingApiResponse<PricingTier> = await response.json();
      
      if (!responseData.success || !responseData.data) {
        throw new Error(responseData.error || 'Failed to update pricing tier');
      }
      
      return responseData.data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    updateTier,
    loading,
    error,
  };
}

/**
 * Hook for deleting (deactivating) a pricing tier
 */
export function useDeletePricingTier() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const deleteTier = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/pricing/tiers/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to delete pricing tier: ${response.status}`);
      }
      
      const responseData: PricingApiResponse<{ success: boolean }> = await response.json();
      
      if (!responseData.success) {
        throw new Error(responseData.error || 'Failed to delete pricing tier');
      }
      
      return responseData.data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    deleteTier,
    loading,
    error,
  };
}

/**
 * Helper hook for real-time pricing calculation with debouncing
 */
export function useDebouncedPricingCalculation(
  headCount: number,
  foodCost: number,
  hasTip: boolean,
  debounceMs: number = 500
) {
  const [debouncedValues, setDebouncedValues] = useState({
    headCount,
    foodCost,
    hasTip,
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValues({ headCount, foodCost, hasTip });
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [headCount, foodCost, hasTip, debounceMs]);

  return usePricingCalculation(
    debouncedValues.headCount,
    debouncedValues.foodCost,
    debouncedValues.hasTip
  );
} 