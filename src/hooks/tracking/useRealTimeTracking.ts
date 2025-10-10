'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { TrackedDriver, DeliveryTracking } from '@/types/tracking';

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
  error: string | null;
  reconnect: () => void;
}

export function useRealTimeTracking(): UseRealTimeTrackingReturn {
  const [activeDrivers, setActiveDrivers] = useState<TrackedDriver[]>([]);
  const [recentLocations, setRecentLocations] = useState<LocationData[]>([]);
  const [activeDeliveries, setActiveDeliveries] = useState<DeliveryTracking[]>([]);
  const [isConnected, setIsConnected] = useState(false);
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
            
            setActiveDrivers(realtimeData.activeDrivers || []);
            setRecentLocations(realtimeData.recentLocations || []);
            setActiveDeliveries(realtimeData.activeDeliveries || []);
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
        console.error('SSE connection error:', event);
        setIsConnected(false);
        
        if (eventSource.readyState === EventSource.CLOSED) {
          scheduleReconnect();
        } else {
          setError('Connection error occurred');
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
    error,
    reconnect
  };
}
