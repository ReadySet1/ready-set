'use client';

/**
 * Location Simulator Hook
 *
 * Provides React state management for the location simulator.
 * Integrates with the geolocation mock and route utilities.
 *
 * DEVELOPMENT ONLY - This hook should only be used in development mode.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { RouteWaypoint, SimulatedPosition } from '@/lib/dev/geolocation-mock';
import {
  enableMock,
  disableMock,
  isMockEnabled,
  setRoute,
  setSpeedMultiplier,
  getSpeedMultiplier,
  startSimulation,
  stopSimulation,
  pauseSimulation,
  resumeSimulation,
  isSimulationRunning,
  isSimulationPaused,
  getCurrentPosition,
  getSimulationProgress,
  resetSimulation,
  jumpToProgress,
  onPosition,
  onEnd,
} from '@/lib/dev/geolocation-mock';
import {
  fetchDriverDeliveries,
  generateDeliveryRoute,
  getRouteDistance,
  estimateRouteDuration,
  getPresetRoute,
  getPresetRouteList,
  PRESET_ROUTES,
  type SimulatorDelivery,
  type PresetRouteName,
} from '@/lib/dev/route-utils';

export type SimulatorStatus = 'idle' | 'loading' | 'ready' | 'running' | 'paused' | 'completed';

export interface UseLocationSimulatorReturn {
  // State
  status: SimulatorStatus;
  isEnabled: boolean;
  currentPosition: SimulatedPosition | null;
  progress: number;
  speedMultiplier: number;
  error: string | null;

  // Delivery data
  deliveries: SimulatorDelivery[];
  selectedDelivery: SimulatorDelivery | null;
  presetRoutes: Array<{ name: PresetRouteName; description: string }>;
  selectedPresetRoute: PresetRouteName | null;

  // Route info
  routeDistance: number;
  estimatedDuration: number;
  waypoints: RouteWaypoint[];

  // Actions
  enable: () => void;
  disable: () => void;
  refreshDeliveries: () => Promise<void>;
  selectDelivery: (delivery: SimulatorDelivery | null) => void;
  selectPresetRoute: (routeName: PresetRouteName | null) => void;
  setSpeed: (multiplier: number) => void;
  start: () => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  seekTo: (percent: number) => void;
}

const STORAGE_KEY = 'location-simulator-settings';

interface StoredSettings {
  speedMultiplier: number;
  enabled: boolean;
}

function loadSettings(): StoredSettings {
  if (typeof window === 'undefined') {
    return { speedMultiplier: 1, enabled: false };
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('[LocationSimulator] Failed to load settings:', e);
  }
  return { speedMultiplier: 1, enabled: false };
}

function saveSettings(settings: Partial<StoredSettings>): void {
  if (typeof window === 'undefined') return;
  try {
    const current = loadSettings();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...settings }));
  } catch (e) {
    console.warn('[LocationSimulator] Failed to save settings:', e);
  }
}

export function useLocationSimulator(): UseLocationSimulatorReturn {
  // Load initial settings
  const initialSettings = useRef(loadSettings());

  // State
  const [status, setStatus] = useState<SimulatorStatus>('idle');
  const [isEnabled, setIsEnabled] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<SimulatedPosition | null>(null);
  const [progress, setProgress] = useState(0);
  const [speedMultiplier, setSpeedState] = useState(initialSettings.current.speedMultiplier);
  const [error, setError] = useState<string | null>(null);

  // Delivery state
  const [deliveries, setDeliveries] = useState<SimulatorDelivery[]>([]);
  const [selectedDelivery, setSelectedDelivery] = useState<SimulatorDelivery | null>(null);
  const [selectedPresetRoute, setSelectedPresetRoute] = useState<PresetRouteName | null>(null);

  // Route state
  const [waypoints, setWaypoints] = useState<RouteWaypoint[]>([]);
  const [routeDistance, setRouteDistance] = useState(0);
  const [estimatedDuration, setEstimatedDuration] = useState(0);

  // Progress update interval
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update progress periodically when running
  useEffect(() => {
    if (status === 'running') {
      progressIntervalRef.current = setInterval(() => {
        setProgress(getSimulationProgress());
        setCurrentPosition(getCurrentPosition());
      }, 500);
    } else {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [status]);

  // Set up position and end callbacks
  useEffect(() => {
    onPosition((pos) => {
      setCurrentPosition(pos);
    });

    onEnd(() => {
      setStatus('completed');
      setProgress(100);
    });

    return () => {
      onPosition(null);
      onEnd(null);
    };
  }, []);

  // Auto-enable if was previously enabled
  useEffect(() => {
    if (initialSettings.current.enabled && process.env.NODE_ENV === 'development') {
      enableMock();
      setIsEnabled(true);
      setStatus('ready');
    }
  }, []);

  // Calculate route info when waypoints change
  useEffect(() => {
    if (waypoints.length > 0) {
      const distance = getRouteDistance(waypoints);
      setRouteDistance(distance);
      setEstimatedDuration(estimateRouteDuration(waypoints, 13.4 * speedMultiplier));
    } else {
      setRouteDistance(0);
      setEstimatedDuration(0);
    }
  }, [waypoints, speedMultiplier]);

  // Enable the mock
  const enable = useCallback(() => {
    if (process.env.NODE_ENV !== 'development') {
      console.warn('[LocationSimulator] Cannot enable in production mode');
      return;
    }
    enableMock();
    setIsEnabled(true);
    setStatus('ready');
    saveSettings({ enabled: true });
  }, []);

  // Disable the mock
  const disable = useCallback(() => {
    disableMock();
    setIsEnabled(false);
    setStatus('idle');
    setCurrentPosition(null);
    setProgress(0);
    saveSettings({ enabled: false });
  }, []);

  // Refresh deliveries from API
  const refreshDeliveries = useCallback(async () => {
    setStatus('loading');
    setError(null);

    try {
      const fetched = await fetchDriverDeliveries();
      setDeliveries(fetched);

      // Filter to only active deliveries
      const active = fetched.filter(
        (d) => !['delivered', 'cancelled'].includes(d.status.toLowerCase())
      );

      if (active.length === 0 && fetched.length === 0) {
        setError('No deliveries found. Try using a preset route instead.');
      }

      setStatus(isEnabled ? 'ready' : 'idle');
    } catch (err) {
      console.error('[LocationSimulator] Error fetching deliveries:', err);
      setError('Failed to fetch deliveries');
      setStatus(isEnabled ? 'ready' : 'idle');
    }
  }, [isEnabled]);

  // Select a delivery and generate route
  const selectDelivery = useCallback((delivery: SimulatorDelivery | null) => {
    setSelectedDelivery(delivery);
    setSelectedPresetRoute(null);

    if (delivery) {
      const route = generateDeliveryRoute(delivery);
      if (route.length > 0) {
        setWaypoints(route);
        setRoute(route);
        setError(null);
      } else {
        setWaypoints([]);
        setError('Could not generate route - missing location data');
      }
    } else {
      setWaypoints([]);
      setRoute([]);
    }

    // Reset simulation state
    resetSimulation();
    setProgress(0);
    setCurrentPosition(getCurrentPosition());
    setStatus(isMockEnabled() ? 'ready' : 'idle');
  }, []);

  // Select a preset route
  const selectPresetRoute = useCallback((routeName: PresetRouteName | null) => {
    setSelectedPresetRoute(routeName);
    setSelectedDelivery(null);

    if (routeName) {
      const route = getPresetRoute(routeName);
      setWaypoints(route);
      setRoute(route);
      setError(null);
    } else {
      setWaypoints([]);
      setRoute([]);
    }

    // Reset simulation state
    resetSimulation();
    setProgress(0);
    setCurrentPosition(getCurrentPosition());
    setStatus(isMockEnabled() ? 'ready' : 'idle');
  }, []);

  // Set speed multiplier
  const setSpeed = useCallback((multiplier: number) => {
    setSpeedMultiplier(multiplier);
    setSpeedState(multiplier);
    saveSettings({ speedMultiplier: multiplier });
  }, []);

  // Start simulation
  const start = useCallback(() => {
    if (waypoints.length < 2) {
      setError('Please select a delivery or preset route first');
      return;
    }

    if (!isMockEnabled()) {
      enableMock();
      setIsEnabled(true);
    }

    startSimulation();
    setStatus('running');
    setError(null);
  }, [waypoints]);

  // Stop simulation
  const stop = useCallback(() => {
    stopSimulation();
    resetSimulation();
    setStatus(isMockEnabled() ? 'ready' : 'idle');
    setProgress(0);
    setCurrentPosition(getCurrentPosition());
  }, []);

  // Pause simulation
  const pause = useCallback(() => {
    pauseSimulation();
    setStatus('paused');
  }, []);

  // Resume simulation
  const resume = useCallback(() => {
    resumeSimulation();
    setStatus('running');
  }, []);

  // Reset to beginning
  const reset = useCallback(() => {
    resetSimulation();
    setProgress(0);
    setCurrentPosition(getCurrentPosition());
    setStatus(isMockEnabled() ? 'ready' : 'idle');
  }, []);

  // Seek to position
  const seekTo = useCallback((percent: number) => {
    jumpToProgress(percent);
    setProgress(percent);
    setCurrentPosition(getCurrentPosition());
  }, []);

  return {
    // State
    status,
    isEnabled,
    currentPosition,
    progress,
    speedMultiplier,
    error,

    // Delivery data
    deliveries,
    selectedDelivery,
    presetRoutes: getPresetRouteList(),
    selectedPresetRoute,

    // Route info
    routeDistance,
    estimatedDuration,
    waypoints,

    // Actions
    enable,
    disable,
    refreshDeliveries,
    selectDelivery,
    selectPresetRoute,
    setSpeed,
    start,
    stop,
    pause,
    resume,
    reset,
    seekTo,
  };
}

// Re-export types
export type { SimulatorDelivery, PresetRouteName } from '@/lib/dev/route-utils';
export type { SimulatedPosition, RouteWaypoint } from '@/lib/dev/geolocation-mock';
