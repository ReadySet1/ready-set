'use client';

import { useState, useEffect, useCallback } from 'react';
import type { DeliveryTracking, LocationUpdate } from '@/types/tracking';
import { DriverStatus } from '@/types/user';
import { 
  getDriverActiveDeliveries,
  updateDeliveryStatus as updateDeliveryStatusAction 
} from '@/app/actions/tracking/delivery-actions';
import { captureException, addSentryBreadcrumb } from '@/lib/monitoring/sentry';

interface UseDriverDeliveriesReturn {
  activeDeliveries: DeliveryTracking[];
  loading: boolean;
  error: string | null;
  refreshDeliveries: () => Promise<void>;
  updateDeliveryStatus: (
    deliveryId: string, 
    status: DriverStatus, 
    location?: LocationUpdate,
    proofOfDelivery?: string,
    notes?: string
  ) => Promise<boolean>;
}

export function useDriverDeliveries(): UseDriverDeliveriesReturn {
  const [activeDeliveries, setActiveDeliveries] = useState<DeliveryTracking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get driver ID from session (simplified)
  const getDriverId = useCallback(async (): Promise<string | null> => {
    try {
      const response = await fetch('/api/auth/session');
      if (response.ok) {
        const session = await response.json();
        return session.user?.driverId || null;
      }
      return null;
    } catch (error) {
      console.error('Error getting driver ID:', error);
      captureException(error, {
        action: 'get_driver_id',
        feature: 'driver_deliveries',
        component: 'useDriverDeliveries',
        handled: true,
      });
      return null;
    }
  }, []);

  // Load active deliveries for the driver
  const loadActiveDeliveries = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const driverId = await getDriverId();
      if (!driverId) {
        setError('Driver ID not found');
        return;
      }

      const deliveries = await getDriverActiveDeliveries(driverId);
      setActiveDeliveries(deliveries);
    } catch (error) {
      console.error('Error loading active deliveries:', error);
      setError(error instanceof Error ? error.message : 'Failed to load deliveries');
      captureException(error, {
        action: 'load_active_deliveries',
        feature: 'driver_deliveries',
        component: 'useDriverDeliveries',
        handled: true,
      });
    } finally {
      setLoading(false);
    }
  }, [getDriverId]);

  // Update delivery status
  const updateDeliveryStatus = useCallback(async (
    deliveryId: string,
    status: DriverStatus,
    location?: LocationUpdate,
    proofOfDelivery?: string,
    notes?: string
  ): Promise<boolean> => {
    try {
      setError(null);

      const result = await updateDeliveryStatusAction(
        deliveryId,
        status,
        location,
        proofOfDelivery,
        notes
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to update delivery status');
      }

      // Reload deliveries to get updated data
      await loadActiveDeliveries();
      addSentryBreadcrumb('Driver updated delivery status', {
        deliveryId,
        status,
      });
      return true;
    } catch (error) {
      console.error('Error updating delivery status:', error);
      setError(error instanceof Error ? error.message : 'Failed to update delivery');
      captureException(error, {
        action: 'update_delivery_status',
        feature: 'driver_deliveries',
        component: 'useDriverDeliveries',
        handled: true,
        metadata: {
          deliveryId,
          status,
        },
      });
      return false;
    }
  }, [loadActiveDeliveries]);

  // Refresh deliveries
  const refreshDeliveries = useCallback(async () => {
    await loadActiveDeliveries();
  }, [loadActiveDeliveries]);

  // Load deliveries on mount
  useEffect(() => {
    loadActiveDeliveries();
  }, [loadActiveDeliveries]);

  // Set up periodic refresh of delivery data (every 1 minute)
  useEffect(() => {
    const interval = setInterval(() => {
      loadActiveDeliveries();
    }, 60000); // 1 minute

    return () => clearInterval(interval);
  }, [loadActiveDeliveries]);

  // Handle page visibility changes - refresh when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadActiveDeliveries();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadActiveDeliveries]);

  return {
    activeDeliveries,
    loading,
    error,
    refreshDeliveries,
    updateDeliveryStatus
  };
}