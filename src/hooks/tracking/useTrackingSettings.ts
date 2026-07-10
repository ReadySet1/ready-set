/**
 * Client-side access to the admin-editable driver-tracking settings.
 *
 * FAIL-OPEN: `settings` is always a fully-populated object — the hardcoded
 * defaults until the fetch resolves, and the defaults again if the fetch or
 * validation fails. A driver must never be stranded by a settings outage.
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import {
  TRACKING_SETTINGS_DEFAULTS,
  TrackingSettingsSchema,
  type TrackingSettings,
} from '@/types/tracking-settings';

async function fetchTrackingSettings(): Promise<TrackingSettings> {
  try {
    const response = await fetch('/api/tracking/settings');
    if (!response.ok) {
      return TRACKING_SETTINGS_DEFAULTS;
    }
    const json = await response.json();
    const parsed = TrackingSettingsSchema.safeParse(json?.data);
    return parsed.success ? parsed.data : TRACKING_SETTINGS_DEFAULTS;
  } catch {
    return TRACKING_SETTINGS_DEFAULTS;
  }
}

export const TRACKING_SETTINGS_QUERY_KEY = ['tracking-settings'] as const;

export function useTrackingSettings(): {
  settings: TrackingSettings;
  isLoaded: boolean;
} {
  const { data, isFetched } = useQuery({
    queryKey: TRACKING_SETTINGS_QUERY_KEY,
    queryFn: fetchTrackingSettings,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    placeholderData: TRACKING_SETTINGS_DEFAULTS,
  });

  return {
    settings: data ?? TRACKING_SETTINGS_DEFAULTS,
    isLoaded: isFetched,
  };
}
