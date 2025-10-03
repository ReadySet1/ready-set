import { NextRequest, NextResponse } from "next/server";
import { getUserOrderMetrics, checkOrderAccess, getCurrentUserId } from "@/lib/services/vendor";
import {
  CACHE_CONFIGS,
  handleConditionalRequest,
  createCachedResponse,
  recordCacheMetrics
} from "@/lib/cache/http-cache";
import {
  getVendorMetricsCacheWithEtag,
  setVendorMetricsCache
} from "@/lib/cache/dashboard-cache";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const startTime = Date.now();

  try {
    // Check if user has access to view orders
    const hasAccess = await checkOrderAccess();
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 400 }
      );
    }

    // Get current user ID for caching
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check for cached data and handle conditional requests
    const cachedResult = getVendorMetricsCacheWithEtag(userId);

    if (cachedResult.data) {
      const conditionalResponse = handleConditionalRequest(
        req,
        cachedResult.data,
        CACHE_CONFIGS.VENDOR_METRICS
      );

      if (conditionalResponse) {
        // Record cache hit metrics
        const duration = Date.now() - startTime;
        recordCacheMetrics('/api/vendor/metrics', true, duration, userId, 'VENDOR');

        return conditionalResponse;
      }
    }

    // No cache hit or conditional request failed, fetch fresh data
    const metrics = await getUserOrderMetrics();

    // Cache the fresh data
    const etag = setVendorMetricsCache(userId, metrics, CACHE_CONFIGS.VENDOR_METRICS.maxAge * 1000);

    // Record cache miss metrics
    const duration = Date.now() - startTime;
    recordCacheMetrics('/api/vendor/metrics', false, duration, userId, 'VENDOR');

    // Return response with caching headers
    return createCachedResponse(metrics, CACHE_CONFIGS.VENDOR_METRICS);

  } catch (error: any) {
    console.error("Error fetching vendor metrics:", error);

    // Record error metrics
    const duration = Date.now() - startTime;
    recordCacheMetrics('/api/vendor/metrics', false, duration, undefined, 'VENDOR');

    return NextResponse.json(
      { error: error.message || "Failed to fetch vendor metrics" },
      { status: 500 }
    );
  }
} 