'use client';

import React, { createContext, useContext, useCallback, ReactNode } from 'react';
import { useRealtimeLocationTracking } from '@/hooks/tracking/useRealtimeLocationTracking';
import { useDriverShift } from '@/hooks/tracking/useDriverShift';
import { useDriverDeliveries } from '@/hooks/tracking/useDriverDeliveries';
import { useOfflineQueue } from '@/hooks/tracking/useOfflineQueue';
import { DriverStatus } from '@/types/user';
import type { LocationUpdate, DriverShift, DeliveryTracking } from '@/types/tracking';
import {
  startNativeShiftTrackingForDriver,
  stopNativeShiftTrackingForDriver,
} from '@/lib/tracking/native-shift-tracking';

interface DriverTrackingContextValue {
  // Location tracking
  currentLocation: LocationUpdate | null;
  isTracking: boolean;
  accuracy: number | null;
  locationError: string | null;
  isRealtimeConnected: boolean;
  isRealtimeEnabled: boolean;
  connectionMode: 'realtime' | 'rest' | 'hybrid';
  permissionState: 'prompt' | 'granted' | 'denied' | 'unknown';
  isRequestingPermission: boolean;
  startTracking: () => void;
  stopTracking: () => void;
  requestLocationPermission: () => Promise<boolean>;
  updateLocationManually: () => Promise<void>;

  // Shift management
  currentShift: DriverShift | null;
  isShiftActive: boolean;
  shiftLoading: boolean;
  shiftError: string | null;
  startShift: (location: LocationUpdate) => Promise<boolean>;
  endShift: (shiftId: string, location: LocationUpdate, finalMileage?: number) => Promise<boolean>;

  // Deliveries
  activeDeliveries: DeliveryTracking[];
  deliveriesLoading: boolean;
  deliveriesError: string | null;
  updateDeliveryStatus: (
    deliveryId: string,
    status: DriverStatus,
    location?: LocationUpdate
  ) => Promise<boolean>;

  // Offline support
  isOnline: boolean;
  queuedItems: number;
}

const DriverTrackingContext = createContext<DriverTrackingContextValue | null>(null);

export function useDriverTracking(): DriverTrackingContextValue {
  const context = useContext(DriverTrackingContext);
  if (!context) {
    throw new Error('useDriverTracking must be used within a DriverTrackingProvider');
  }
  return context;
}

interface DriverTrackingProviderProps {
  children: ReactNode;
}

export function DriverTrackingProvider({ children }: DriverTrackingProviderProps) {
  // Offline support
  const { offlineStatus, queuedItems } = useOfflineQueue();

  // Location tracking - this now persists across page navigations
  const {
    currentLocation,
    isTracking,
    accuracy,
    error: locationError,
    isRealtimeConnected,
    isRealtimeEnabled,
    connectionMode,
    permissionState,
    isRequestingPermission,
    startTracking,
    stopTracking,
    requestLocationPermission,
    updateLocationManually,
    syncOfflineLocations,
  } = useRealtimeLocationTracking();

  // Shift management
  const {
    currentShift,
    isShiftActive,
    startShift: startShiftBase,
    endShift: endShiftBase,
    loading: shiftLoading,
    error: shiftError,
  } = useDriverShift();

  // Supplement the foreground web tracker with native background GPS while the
  // /driver app runs inside the Capacitor shell — so the trail survives a locked
  // screen or a switch to Waze. Both calls no-op in a normal browser (the native
  // plugin is only dynamically imported inside the native shell).
  const startShift = useCallback(
    async (location: LocationUpdate): Promise<boolean> => {
      const started = await startShiftBase(location);
      if (started) void startNativeShiftTrackingForDriver();
      return started;
    },
    [startShiftBase],
  );

  // Flush any queued GPS points before ending the shift, so the server-side
  // shift mileage (summed from driver_locations) reflects the full trail rather
  // than dropping breadcrumbs that were only sitting in the offline queue.
  // Also stop the native background watcher (no-op on web).
  const endShift = useCallback(
    async (shiftId: string, location: LocationUpdate) => {
      void stopNativeShiftTrackingForDriver();
      try {
        await syncOfflineLocations();
      } catch {
        /* best-effort flush — never block ending the shift */
      }
      return endShiftBase(shiftId, location);
    },
    [syncOfflineLocations, endShiftBase],
  );

  // Deliveries
  const {
    activeDeliveries,
    updateDeliveryStatus,
    loading: deliveriesLoading,
    error: deliveriesError,
  } = useDriverDeliveries();

  const value: DriverTrackingContextValue = {
    // Location
    currentLocation,
    isTracking,
    accuracy,
    locationError,
    isRealtimeConnected,
    isRealtimeEnabled,
    connectionMode,
    permissionState,
    isRequestingPermission,
    startTracking,
    stopTracking,
    requestLocationPermission,
    updateLocationManually,

    // Shift
    currentShift,
    isShiftActive,
    shiftLoading,
    shiftError,
    startShift,
    endShift,

    // Deliveries
    activeDeliveries,
    deliveriesLoading,
    deliveriesError,
    updateDeliveryStatus,

    // Offline
    isOnline: offlineStatus.isOnline,
    queuedItems,
  };

  return (
    <DriverTrackingContext.Provider value={value}>
      {children}
    </DriverTrackingContext.Provider>
  );
}

export default DriverTrackingContext;
