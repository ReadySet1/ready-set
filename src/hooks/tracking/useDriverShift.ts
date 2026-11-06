'use client';

import { useState, useEffect, useCallback } from 'react';
import type { DriverShift, LocationUpdate } from '@/types/tracking';
import { captureException, addSentryBreadcrumb } from '@/lib/monitoring/sentry';
import { withBearerAuth } from '@/lib/auth/bearer-session';
import { estimateClockOffsetMs, nextClockOffsetMs } from '@/lib/driver/shift-clock';
import { DeadlineExceededError, withDeadline } from '@/lib/driver/with-deadline';
import {
  startShiftBreak,
  endShiftBreak
} from '@/app/actions/tracking/driver-actions';

/**
 * Fetch the driver's active shift via the stable API route. Was the `getActiveShift`
 * Server Action; the shift ops moved off Server Actions because a stale action digest
 * (after a mid-shift deploy) throws "Server Action not found" and broke shift state.
 * See /api/tracking/shifts/*.
 */
interface ActiveShiftResult {
  shift: DriverShift | null;
  /** Server-minus-device clock offset (ms); null when the server sent no time. */
  clockOffsetMs: number | null;
}

/**
 * Upper bound for one shift operation (session read + driver id + shift
 * fetches). 2026-10 field failure: on iOS 16 Safari a hung request left the
 * Start-shift spinner running until the driver reloaded the page.
 */
export const SHIFT_REQUEST_TIMEOUT_MS = 20_000;
export const START_SHIFT_TIMEOUT_MESSAGE =
  "Couldn't start your shift. Check your connection and try again.";
export const LOAD_SHIFT_TIMEOUT_MESSAGE =
  "Couldn't load your shift. Check your connection and try again.";

async function fetchActiveShift(
  driverId: string,
  signal?: AbortSignal,
): Promise<ActiveShiftResult> {
  const headers = await withBearerAuth();
  const sentAt = Date.now();
  const res = await fetch(
    `/api/tracking/shifts/active?driverId=${encodeURIComponent(driverId)}`,
    // Bearer token + cookies: the token survives the stale-cookie failure
    // mode (see @/lib/auth/bearer-session); cookies remain the fallback.
    { credentials: 'include', headers, signal },
  );
  if (!res.ok) throw new Error(`Failed to load shift (${res.status})`);
  const data = await res.json();
  return {
    shift: (data?.shift ?? null) as DriverShift | null,
    clockOffsetMs: estimateClockOffsetMs(data?.serverNow, sentAt, Date.now()),
  };
}

interface UseDriverShiftReturn {
  currentShift: DriverShift | null;
  /** Server clock minus device clock (ms). Add to Date.now() before measuring
   *  shift elapsed time — a phone clock can be off by an hour (2026-10-14). */
  clockOffsetMs: number;
  isShiftActive: boolean;
  loading: boolean;
  error: string | null;
  startShift: (location: LocationUpdate) => Promise<boolean>;
  endShift: (shiftId: string, location: LocationUpdate) => Promise<boolean>;
  /** Miles driven on the shift ended from this screen (null until one ends). */
  lastShiftMiles: number | null;
  startBreak: (shiftId: string, breakType?: 'rest' | 'meal' | 'fuel' | 'emergency', location?: LocationUpdate) => Promise<boolean>;
  endBreak: (breakId: string, location?: LocationUpdate) => Promise<boolean>;
  refreshShift: () => Promise<void>;
}

export function useDriverShift(): UseDriverShiftReturn {
  const [currentShift, setCurrentShift] = useState<DriverShift | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastShiftMiles, setLastShiftMiles] = useState<number | null>(null);
  const [clockOffsetMs, setClockOffsetMs] = useState(0);

  // Get driver ID from session (simplified)
  const getDriverId = useCallback(async (signal?: AbortSignal): Promise<string | null> => {
    try {
      const response = await fetch('/api/auth/session', { signal });
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
    // Tracked locally so the error report never re-fetches the session (that
    // second, unbounded lookup used to hold `loading` too).
    let driverId: string | null = null;
    try {
      setLoading(true);
      setError(null);

      const loaded = await withDeadline(async (signal) => {
        driverId = await getDriverId(signal);
        if (!driverId) return null;
        return fetchActiveShift(driverId, signal);
      }, SHIFT_REQUEST_TIMEOUT_MS);

      if (!loaded) {
        setError('Driver ID not found');
        return;
      }

      const { shift, clockOffsetMs: measuredOffsetMs } = loaded;
      setClockOffsetMs((prev) => nextClockOffsetMs(prev, measuredOffsetMs));
      setCurrentShift(shift);
    } catch (error) {
      console.error('Error loading active shift:', error);
      setError(
        error instanceof DeadlineExceededError
          ? LOAD_SHIFT_TIMEOUT_MESSAGE
          : error instanceof Error
            ? error.message
            : 'Failed to load shift',
      );
      captureException(error, {
        action: 'load_active_shift',
        feature: 'driver_shift',
        component: 'useDriverShift',
        handled: true,
        metadata: { driverId: driverId ?? undefined },
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

      // Every step below (session read, driver id, active-shift check, start
      // POST) shares one deadline so a hung request can't spin forever.
      const { driverId, result } = await withDeadline(async (signal) => {
        const driverId = await getDriverId(signal);
        if (!driverId) {
          throw new Error('Driver ID not found');
        }

        // Check if there's already an active shift
        const { shift: existingShift } = await fetchActiveShift(driverId, signal);
        if (existingShift) {
          throw new Error('You already have an active shift');
        }

        const res = await fetch('/api/tracking/shifts/start', {
          method: 'POST',
          credentials: 'include',
          headers: await withBearerAuth({ 'Content-Type': 'application/json' }),
          signal,
          body: JSON.stringify({
            driverId,
            location,
            metadata: {
              startedFromApp: true,
              appVersion: '2.0.0',
              deviceInfo: {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
              },
            },
          }),
        });
        const result = await res
          .json()
          .catch(() => ({ success: false, error: `HTTP ${res.status}` }));

        if (!result.success) {
          throw new Error(result.error || 'Failed to start shift');
        }
        return { driverId, result };
      }, SHIFT_REQUEST_TIMEOUT_MS);

      // Reload the shift data. When the server reports `resumed: true` it
      // found an open shift (other device / retried POST) and returned that
      // instead of creating a duplicate; the reload picks it up.
      await loadActiveShift();
      addSentryBreadcrumb(result.resumed ? 'Driver shift resumed' : 'Driver shift started', {
        driverId,
        shiftId: result.shiftId ?? undefined,
      });
      return true;
    } catch (error) {
      console.error('Error starting shift:', error);
      setError(
        error instanceof DeadlineExceededError
          ? START_SHIFT_TIMEOUT_MESSAGE
          : error instanceof Error
            ? error.message
            : 'Failed to start shift',
      );
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

      const res = await fetch('/api/tracking/shifts/end', {
        method: 'POST',
        credentials: 'include',
        headers: await withBearerAuth({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          shiftId,
          location,
          metadata: { endedFromApp: true, finalLocation: location.coordinates },
        }),
      });
      const result = await res
        .json()
        .catch(() => ({ success: false, error: `HTTP ${res.status}` }));

      if (!result.success) {
        throw new Error(result.error || 'Failed to end shift');
      }

      setCurrentShift(null);
      setLastShiftMiles(
        typeof result.totalMiles === 'number' && Number.isFinite(result.totalMiles)
          ? result.totalMiles
          : null,
      );
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
      // The shift may have ended server-side even though the client saw an error
      // (transient network / rate limit). Re-sync the authoritative state so the UI
      // doesn't get stuck showing an active shift that's actually over.
      await loadActiveShift();
      return false;
    } finally {
      setLoading(false);
    }
  }, [loadActiveShift]);

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
    clockOffsetMs,
    isShiftActive,
    loading,
    error,
    startShift,
    endShift,
    lastShiftMiles,
    startBreak,
    endBreak,
    refreshShift
  };
}