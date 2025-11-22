'use client';

import { useState, useEffect, useCallback } from 'react';
import type { DriverShift, LocationUpdate } from '@/types/tracking';
import { captureException, addSentryBreadcrumb } from '@/lib/monitoring/sentry';
import { 
  startDriverShift, 
  endDriverShift, 
  getActiveShift,
  startShiftBreak,
  endShiftBreak 
} from '@/app/actions/tracking/driver-actions';

interface UseDriverShiftReturn {
  currentShift: DriverShift | null;
  isShiftActive: boolean;
  loading: boolean;
  error: string | null;
  startShift: (location: LocationUpdate) => Promise<boolean>;
  endShift: (shiftId: string, location: LocationUpdate) => Promise<boolean>;
  startBreak: (shiftId: string, breakType?: 'rest' | 'meal' | 'fuel' | 'emergency', location?: LocationUpdate) => Promise<boolean>;
  endBreak: (breakId: string, location?: LocationUpdate) => Promise<boolean>;
  refreshShift: () => Promise<void>;
}

export function useDriverShift(): UseDriverShiftReturn {
  const [currentShift, setCurrentShift] = useState<DriverShift | null>(null);
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
        feature: 'driver_shift',
        component: 'useDriverShift',
        handled: true,
      });
      return null;
    }
  }, []);

  // Load current active shift
  const loadActiveShift = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const driverId = await getDriverId();
      if (!driverId) {
        setError('Driver ID not found');
        return;
      }

      const shift = await getActiveShift(driverId);
      setCurrentShift(shift);
    } catch (error) {
      console.error('Error loading active shift:', error);
      setError(error instanceof Error ? error.message : 'Failed to load shift');
      captureException(error, {
        action: 'load_active_shift',
        feature: 'driver_shift',
        component: 'useDriverShift',
        handled: true,
        metadata: { driverId: await getDriverId().catch(() => null) ?? undefined },
      });
    } finally {
      setLoading(false);
    }
  }, [getDriverId]);

  // Start a new shift
  const startShift = useCallback(async (location: LocationUpdate): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const driverId = await getDriverId();
      if (!driverId) {
        throw new Error('Driver ID not found');
      }

      // Check if there's already an active shift
      const existingShift = await getActiveShift(driverId);
      if (existingShift) {
        throw new Error('You already have an active shift');
      }

      const result = await startDriverShift(driverId, location, {
        startedFromApp: true,
        appVersion: '2.0.0',
        deviceInfo: {
          userAgent: navigator.userAgent,
          platform: navigator.platform
        }
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to start shift');
      }

      // Reload the shift data
      await loadActiveShift();
      addSentryBreadcrumb('Driver shift started', {
        driverId,
        shiftId: result.shiftId ?? undefined,
      });
      return true;
    } catch (error) {
      console.error('Error starting shift:', error);
      setError(error instanceof Error ? error.message : 'Failed to start shift');
      captureException(error, {
        action: 'start_shift',
        feature: 'driver_shift',
        component: 'useDriverShift',
        handled: true,
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [getDriverId, loadActiveShift]);

  // End current shift
  const endShift = useCallback(async (shiftId: string, location: LocationUpdate): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const result = await endDriverShift(shiftId, location, undefined, {
        endedFromApp: true,
        finalLocation: location.coordinates
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to end shift');
      }

      setCurrentShift(null);
      addSentryBreadcrumb('Driver shift ended', {
        shiftId,
      });
      return true;
    } catch (error) {
      console.error('Error ending shift:', error);
      setError(error instanceof Error ? error.message : 'Failed to end shift');
      captureException(error, {
        action: 'end_shift',
        feature: 'driver_shift',
        component: 'useDriverShift',
        handled: true,
        metadata: { shiftId },
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Start a break
  const startBreak = useCallback(async (
    shiftId: string, 
    breakType: 'rest' | 'meal' | 'fuel' | 'emergency' = 'rest',
    location?: LocationUpdate
  ): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const result = await startShiftBreak(shiftId, breakType, location);

      if (!result.success) {
        throw new Error(result.error || 'Failed to start break');
      }

      // Reload shift data to get updated break info
      await loadActiveShift();
      return true;
    } catch (error) {
      console.error('Error starting break:', error);
      setError(error instanceof Error ? error.message : 'Failed to start break');
      return false;
    } finally {
      setLoading(false);
    }
  }, [loadActiveShift]);

  // End current break
  const endBreak = useCallback(async (breakId: string, location?: LocationUpdate): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const result = await endShiftBreak(breakId, location);

      if (!result.success) {
        throw new Error(result.error || 'Failed to end break');
      }

      // Reload shift data to get updated break info
      await loadActiveShift();
      return true;
    } catch (error) {
      console.error('Error ending break:', error);
      setError(error instanceof Error ? error.message : 'Failed to end break');
      return false;
    } finally {
      setLoading(false);
    }
  }, [loadActiveShift]);

  // Refresh shift data
  const refreshShift = useCallback(async () => {
    await loadActiveShift();
  }, [loadActiveShift]);

  // Load active shift on mount
  useEffect(() => {
    loadActiveShift();
  }, [loadActiveShift]);

  // Set up periodic refresh of shift data (every 2 minutes)
  useEffect(() => {
    const interval = setInterval(() => {
      if (currentShift) {
        loadActiveShift();
      }
    }, 120000); // 2 minutes

    return () => clearInterval(interval);
  }, [currentShift, loadActiveShift]);

  // Handle page visibility changes - refresh when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && currentShift) {
        loadActiveShift();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentShift, loadActiveShift]);

  const isShiftActive = currentShift ? currentShift.status === 'active' || currentShift.status === 'paused' : false;

  return {
    currentShift,
    isShiftActive,
    loading,
    error,
    startShift,
    endShift,
    startBreak,
    endBreak,
    refreshShift
  };
}