'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CockpitDelivery } from '@/types/driver-cockpit';

interface UseDriverDeliveryResult {
  delivery: CockpitDelivery | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Fetches a single delivery by order number from the driver-deliveries endpoint.
 * Shared across cockpit, details, and files pages.
 */
export function useDriverDelivery(orderNumber: string): UseDriverDeliveryResult {
  const [delivery, setDelivery] = useState<CockpitDelivery | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDelivery = useCallback(async () => {
    if (!orderNumber) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/driver-deliveries?page=1&limit=999');
      if (!res.ok) throw new Error('Failed to fetch deliveries');
      const data = await res.json();
      const list: CockpitDelivery[] =
        data?.deliveries ?? (Array.isArray(data) ? data : []);
      const match = list.find((d) => d.orderNumber === orderNumber);
      if (match) {
        setDelivery(match);
        setError(null);
      } else {
        setError('Delivery not found');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [orderNumber]);

  useEffect(() => {
    fetchDelivery();
  }, [fetchDelivery]);

  return { delivery, isLoading, error, refetch: fetchDelivery };
}
