'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useRealtimeLocationTracking } from '@/hooks/tracking/useRealtimeLocationTracking';
import { useDriverShift } from '@/hooks/tracking/useDriverShift';
import { useDriverDeliveries } from '@/hooks/tracking/useDriverDeliveries';
import { useOfflineQueue } from '@/hooks/tracking/useOfflineQueue';
import { DriverStatus } from '@/types/user';
import type { LocationUpdate, DriverShift, DeliveryTracking } from '@/types/tracking';

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
  } = useRealtimeLocationTracking();

  // Shift management
  const {
    currentShift,
    isShiftActive,
    startShift,
    endShift,
    loading: shiftLoading,
    error: shiftError,
  } = useDriverShift();

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
