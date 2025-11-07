'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  FEATURE_FLAGS,
  isFeatureEnabled,
  getAllFeatureConfigs,
} from '@/lib/feature-flags';

export function FeatureFlagDebug() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const allConfigs = getAllFeatureConfigs();

  const realtimeFlags = {
    USE_REALTIME_TRACKING: {
      key: FEATURE_FLAGS.USE_REALTIME_TRACKING,
      enabled: isFeatureEnabled(FEATURE_FLAGS.USE_REALTIME_TRACKING),
      config: allConfigs[FEATURE_FLAGS.USE_REALTIME_TRACKING],
      envVar: process.env.NEXT_PUBLIC_FF_USE_REALTIME_TRACKING,
    },
    USE_REALTIME_LOCATION_UPDATES: {
      key: FEATURE_FLAGS.USE_REALTIME_LOCATION_UPDATES,
      enabled: isFeatureEnabled(FEATURE_FLAGS.USE_REALTIME_LOCATION_UPDATES),
      config: allConfigs[FEATURE_FLAGS.USE_REALTIME_LOCATION_UPDATES],
      envVar: process.env.NEXT_PUBLIC_FF_USE_REALTIME_LOCATION_UPDATES,
    },
    USE_REALTIME_ADMIN_DASHBOARD: {
      key: FEATURE_FLAGS.USE_REALTIME_ADMIN_DASHBOARD,
      enabled: isFeatureEnabled(FEATURE_FLAGS.USE_REALTIME_ADMIN_DASHBOARD),
      config: allConfigs[FEATURE_FLAGS.USE_REALTIME_ADMIN_DASHBOARD],
      envVar: process.env.NEXT_PUBLIC_FF_USE_REALTIME_ADMIN_DASHBOARD,
    },
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-sm">Feature Flags Debug</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h4 className="text-xs font-semibold mb-2">Supabase Config</h4>
            <div className="text-xs space-y-1">
              <div>
                <strong>URL:</strong>{' '}
                {process.env.NEXT_PUBLIC_SUPABASE_URL ? (
                  <Badge variant="success">Set</Badge>
                ) : (
                  <Badge variant="destructive">Not Set</Badge>
                )}
              </div>
              <div>
                <strong>Anon Key:</strong>{' '}
                {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? (
                  <Badge variant="success">Set</Badge>
                ) : (
                  <Badge variant="destructive">Not Set</Badge>
                )}
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold mb-2">Realtime Feature Flags</h4>
            <div className="text-xs space-y-2">
              {Object.entries(realtimeFlags).map(([name, flag]) => (
                <div key={name} className="border-l-2 border-gray-200 pl-2">
                  <div className="font-semibold">{name}</div>
                  <div className="ml-2 space-y-1">
                    <div>
                      Enabled:{' '}
                      {flag.enabled ? (
                        <Badge variant="success">Yes</Badge>
                      ) : (
                        <Badge variant="destructive">No</Badge>
                      )}
                    </div>
                    <div>
                      Env Var:{' '}
                      {flag.envVar ? (
                        <span className="text-green-600">{flag.envVar}</span>
                      ) : (
                        <span className="text-red-600">undefined</span>
                      )}
                    </div>
                    <div>
                      Config: enabled={String(flag.config.enabled)},
                      rollout={flag.config.rolloutPercentage ?? 'N/A'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            <strong>Note:</strong> If env vars show "undefined", restart the dev
            server after adding them to .env.local
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
