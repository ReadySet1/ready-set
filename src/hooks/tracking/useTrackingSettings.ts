/**
 * Client-side access to the admin-editable driver-tracking settings.
 *
 * FAIL-OPEN for readers: `settings` is always a fully-populated object — the
 * hardcoded defaults until the fetch resolves, and the defaults again if the
 * fetch or validation fails. A driver must never be stranded by a settings
 * outage.
 *
 * `isServerData` tells WRITER surfaces (the admin Settings tab) whether the
 * values actually came from the server. An editor must never seed its form
 * from the fail-open defaults — saving that form would silently reset every
 * customized setting fleet-wide.
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import {
  TRACKING_SETTINGS_DEFAULTS,
  TrackingSettingsPartialSchema,
  TrackingSettingsSchema,
  type TrackingSettings,
} from '@/types/tracking-settings';

interface TrackingSettingsResult {
  settings: TrackingSettings;
  fromServer: boolean;
}

async function fetchTrackingSettings(): Promise<TrackingSettingsResult> {
  try {
    const response = await fetch('/api/tracking/settings');
    if (!response.ok) {
      return { settings: TRACKING_SETTINGS_DEFAULTS, fromServer: false };
    }
    const json = await response.json();
    // The server may return a driver-scoped subset — accept partial payloads,
    // merge over the defaults, then bounds-check the merged result.
    const partial = TrackingSettingsPartialSchema.safeParse(json?.data);
    if (!partial.success) {
      return { settings: TRACKING_SETTINGS_DEFAULTS, fromServer: false };
    }
    const merged = TrackingSettingsSchema.safeParse({
      ...TRACKING_SETTINGS_DEFAULTS,
      ...partial.data,
    });
    return merged.success
      ? { settings: merged.data, fromServer: true }
      : { settings: TRACKING_SETTINGS_DEFAULTS, fromServer: false };
  } catch {
    return { settings: TRACKING_SETTINGS_DEFAULTS, fromServer: false };
  }
}

export const TRACKING_SETTINGS_QUERY_KEY = ['tracking-settings'] as const;

export function useTrackingSettings(): {
  settings: TrackingSettings;
  isLoaded: boolean;
  /** True only when the current values were fetched and validated from the server. */
  isServerData: boolean;
} {
  const { data, isFetched } = useQuery({
    queryKey: TRACKING_SETTINGS_QUERY_KEY,
    queryFn: fetchTrackingSettings,
    staleTime: 60 * 1000,
    // Long-lived screens (driver portal mid-shift) must converge on admin
    // changes without a remount — matches the server's 60s resolver TTL and
    // the admin UI's "takes effect within a minute" copy.
    refetchInterval: 60 * 1000,
    retry: 1,
    placeholderData: {
      settings: TRACKING_SETTINGS_DEFAULTS,
      fromServer: false,
    } satisfies TrackingSettingsResult,
  });

  return {
    settings: data?.settings ?? TRACKING_SETTINGS_DEFAULTS,
    isLoaded: isFetched,
    isServerData: data?.fromServer ?? false,
  };
}
