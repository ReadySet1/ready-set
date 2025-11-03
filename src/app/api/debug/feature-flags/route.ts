/**
 * Debug endpoint to check feature flags configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  FEATURE_FLAGS,
  isFeatureEnabled,
  getAllFeatureConfigs,
} from '@/lib/feature-flags';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Get all feature flag configurations
    const allConfigs = getAllFeatureConfigs();

    // Check specific Realtime flags
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
      REALTIME_FALLBACK_TO_SSE: {
        key: FEATURE_FLAGS.REALTIME_FALLBACK_TO_SSE,
        enabled: isFeatureEnabled(FEATURE_FLAGS.REALTIME_FALLBACK_TO_SSE),
        config: allConfigs[FEATURE_FLAGS.REALTIME_FALLBACK_TO_SSE],
      },
      REALTIME_FALLBACK_TO_REST: {
        key: FEATURE_FLAGS.REALTIME_FALLBACK_TO_REST,
        enabled: isFeatureEnabled(FEATURE_FLAGS.REALTIME_FALLBACK_TO_REST),
        config: allConfigs[FEATURE_FLAGS.REALTIME_FALLBACK_TO_REST],
      },
    };

    // Supabase configuration check
    const supabaseConfig = {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL
        ? `${process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 30)}...`
        : 'NOT SET',
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        ? `Set (${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length} chars)`
        : 'NOT SET',
    };

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      supabaseConfig,
      realtimeFlags,
      allFeatureFlags: allConfigs,
    });
  } catch (error) {
    console.error('Error in feature flags debug endpoint:', error);
    return NextResponse.json(
      {
        error: 'Failed to retrieve feature flags',
        message: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
