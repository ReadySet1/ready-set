'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { TrackedDriver, DeliveryTracking } from '@/types/tracking';

/**
 * Delivery info extracted from legacy dispatches for driver enrichment.
 */
interface DriverDeliveryInfo {
  name: string;
  activeDeliveryCount: number;
  hasActiveDelivery: boolean;
}

/**
 * Enriches driver data from delivery/dispatch information when missing.
 *
 * This handles the data scenario where:
 * - drivers.profile_id is NULL (data issue in the database)
 * - dispatches.driverId correctly points to the driver's profile
 * - The delivery/dispatch data has the correct driver name and activity status
 *
 * Enriches:
 * - name: Driver name from dispatch profile
 * - isOnDuty: Set to true if driver has active deliveries/dispatches
 * - activeDeliveries: Count of active dispatches for this driver
 *
 * Strategy:
 * 1. Build a map of driver info from deliveries (legacy dispatches have driverName)
 * 2. For drivers with missing data, try to match by ID or by name
 * 3. For single-driver cases, use heuristics to match
 */
function enrichDriverNamesFromDeliveries(
  drivers: TrackedDriver[],
  deliveries: DeliveryTracking[]
): TrackedDriver[] {
  // Build maps of driver info from deliveries (legacy dispatches include driverName)
  // Key can be driver ID or driver name (for matching when ID is unavailable)
  const driverInfoByName = new Map<string, DriverDeliveryInfo>();
  const driverInfoById = new Map<string, DriverDeliveryInfo>();

  for (const delivery of deliveries) {
    // Legacy dispatches (source: 'dispatches') have driverName field
    const deliveryWithDriverInfo = delivery as DeliveryTracking & {
      driverName?: string;
      source?: string;
    };

    if (deliveryWithDriverInfo.driverName && deliveryWithDriverInfo.source === 'dispatches') {
      const name = deliveryWithDriverInfo.driverName;
      // Check if delivery is active (not completed or cancelled)
      // Status can be DriverStatus enum values or order status strings
      const statusString = String(delivery.status).toUpperCase();
      const isActiveDelivery = statusString !== 'COMPLETED' && statusString !== 'CANCELLED';

      // Update or create entry by name
      const existingByName = driverInfoByName.get(name) || {
        name,
        activeDeliveryCount: 0,
        hasActiveDelivery: false,
      };
      if (isActiveDelivery) {
        existingByName.activeDeliveryCount++;
        existingByName.hasActiveDelivery = true;
      }
      driverInfoByName.set(name, existingByName);

      // Also map by driver ID if available
      if (delivery.driverId) {
        driverInfoById.set(delivery.driverId, existingByName);
      }
    }
  }

  // If no dispatch info to enrich from, return original drivers
  if (driverInfoByName.size === 0) {
    return drivers;
  }

  // Enrich drivers with info from deliveries/dispatches
  return drivers.map(driver => {
    // Try to find driver info by ID first
    let driverInfo = driverInfoById.get(driver.id);

    // If not found by ID, try by name (for drivers that already have names)
    if (!driverInfo && driver.name) {
      driverInfo = driverInfoByName.get(driver.name);
    }

    // For drivers without names, try heuristic matching
    if (!driverInfo && !driver.name) {
      // Count how many drivers don't have names and could be matched
      const driversWithoutNames = drivers.filter(d => !d.name);

      // If there's only one driver without a name, match to unmatched dispatch info
      if (driversWithoutNames.length === 1) {
        // Find dispatch driver names that aren't already matched to a driver
        const matchedNames = new Set(
          drivers.filter(d => d.name).map(d => d.name)
        );
        const unmatchedInfos = Array.from(driverInfoByName.entries())
          .filter(([name]) => !matchedNames.has(name));

        // Use the first unmatched driver info if available
        const firstUnmatched = unmatchedInfos[0];
        if (firstUnmatched) {
          driverInfo = firstUnmatched[1];
        }
      }
    }

    // Apply enrichment if we found matching info
    if (driverInfo) {
      return {
        ...driver,
        name: driver.name || driverInfo.name,
        // If driver has active dispatches, they should be considered "on duty"
        isOnDuty: driver.isOnDuty || driverInfo.hasActiveDelivery,
        // Add dispatch deliveries to the count
        activeDeliveries: (driver.activeDeliveries || 0) + driverInfo.activeDeliveryCount,
      };
    }

    return driver;
  });
}

interface LocationData {
  driverId: string;
  location: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  accuracy: number;
  speed: number;
  heading: number;
  batteryLevel?: number;
  isMoving: boolean;
  activityType: 'walking' | 'driving' | 'stationary';
  recordedAt: string;
}

interface RealtimeData {
  activeDrivers: TrackedDriver[];
  recentLocations: LocationData[];
  activeDeliveries: DeliveryTracking[];
}

interface UseRealTimeTrackingReturn {
  activeDrivers: TrackedDriver[];
  recentLocations: LocationData[];
  activeDeliveries: DeliveryTracking[];
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  reconnect: () => void;
}

export function useRealTimeTracking(): UseRealTimeTrackingReturn {
  const [activeDrivers, setActiveDrivers] = useState<TrackedDriver[]>([]);
  const [recentLocations, setRecentLocations] = useState<LocationData[]>([]);
  const [activeDeliveries, setActiveDeliveries] = useState<DeliveryTracking[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const connectRef = useRef<(() => void) | null>(null);

  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000; // 1 second

  // Schedule reconnection with exponential backoff
  const scheduleReconnect = useCallback((): void => {
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      setError(`Connection failed after ${maxReconnectAttempts} attempts. Please refresh the page.`);
      return;
    }

    const delay = baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current);
    reconnectAttemptsRef.current += 1;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    reconnectTimeoutRef.current = setTimeout(() => {
            connectRef.current?.();
    }, delay);
  }, []);

  // Connect to SSE endpoint
  const connect = useCallback((): void => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      setError(null);
      const eventSource = new EventSource('/api/tracking/live');
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
                setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'connection') {
                      } else if (data.type === 'driver_update') {
            const realtimeData: RealtimeData = data.data;

            // Enrich driver names from delivery data when missing
            // This handles the case where drivers.profile_id is NULL in the database
            // but dispatches.driverId correctly points to the driver's profile
            const enrichedDrivers = enrichDriverNamesFromDeliveries(
              realtimeData.activeDrivers || [],
              realtimeData.activeDeliveries || []
            );

            setActiveDrivers(enrichedDrivers);
            setRecentLocations(realtimeData.recentLocations || []);
            setActiveDeliveries(realtimeData.activeDeliveries || []);
            setIsLoading(false);
          } else if (data.type === 'error') {
            console.error('SSE error:', data.message);
            setError(data.message);
          }
        } catch (parseError) {
          console.error('Error parsing SSE data:', parseError);
          setError('Error parsing real-time data');
        }
      };

      eventSource.onerror = (event) => {
        // Only log actual errors, not normal close events
        if (eventSource.readyState !== EventSource.CLOSED) {
          console.error('SSE connection error:', event);
          setError('Connection error occurred');
        }
        setIsConnected(false);

        if (eventSource.readyState === EventSource.CLOSED) {
          scheduleReconnect();
        }
      };

    } catch (connectionError) {
      console.error('Failed to establish SSE connection:', connectionError);
      setError('Failed to connect to real-time tracking');
      setIsConnected(false);
      scheduleReconnect();
    }
  }, [scheduleReconnect]);

  // Update the ref whenever connect changes
  connectRef.current = connect;

  // Manual reconnect function
  const reconnect = useCallback((): void => {
    reconnectAttemptsRef.current = 0;
    setIsLoading(true);
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    connect();
  }, [connect]);

  // Initialize connection on mount
  useEffect(() => {
    connect();

    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden, we could optionally pause connection
              } else {
        // Page is visible, ensure connection is active
        if (!isConnected && eventSourceRef.current?.readyState !== EventSource.CONNECTING) {
                    reconnect();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isConnected, reconnect]);

  // Health check - if we haven't received data in a while, try to reconnect
  useEffect(() => {
    if (!isConnected) return;

    const healthCheckInterval = setInterval(() => {
      // If we're connected but no drivers, might indicate a problem
      if (isConnected && activeDrivers.length === 0) {
                // Could implement a ping mechanism here
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(healthCheckInterval);
  }, [isConnected, activeDrivers.length]);

  return {
    activeDrivers,
    recentLocations,
    activeDeliveries,
    isConnected,
    isLoading,
    error,
    reconnect
  };
}
