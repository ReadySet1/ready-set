import { NextRequest, NextResponse } from "next/server";
import { getUserOrders, checkOrderAccess, getCurrentUserId } from "@/lib/services/vendor";
import {
  CACHE_CONFIGS,
  handleConditionalRequest,
  createCachedResponse,
  recordCacheMetrics
} from "@/lib/cache/http-cache";
import {
  getVendorOrdersCacheWithEtag,
  setVendorOrdersCache
} from "@/lib/cache/dashboard-cache";

export async function GET(req: NextRequest) {
  const startTime = Date.now();

  try {
    // Check if user has access to view orders
    const hasAccess = await checkOrderAccess();
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 403 }
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

    // Get pagination parameters from query params
    const searchParams = req.nextUrl.searchParams;
    const page = searchParams.get("page")
      ? parseInt(searchParams.get("page") as string, 10)
      : 1;
    const limit = searchParams.get("limit")
      ? parseInt(searchParams.get("limit") as string, 10)
      : 10;

    // Check for cached data and handle conditional requests
    const cachedResult = getVendorOrdersCacheWithEtag(userId, page, limit);

    if (cachedResult.data) {
      const conditionalResponse = handleConditionalRequest(
        req,
        cachedResult.data,
        CACHE_CONFIGS.VENDOR_ORDERS
      );

      if (conditionalResponse) {
        // Record cache hit metrics
        const duration = Date.now() - startTime;
        recordCacheMetrics('/api/vendor/orders', true, duration, userId, 'VENDOR');

        return conditionalResponse;
      }
    }

    // No cache hit or conditional request failed, fetch fresh data
    const result = await getUserOrders(limit, page);

    // Prepare cache data
    const cacheData = {
      orders: result.orders,
      hasMore: result.hasMore,
      total: result.total,
      page,
      limit
    };

    // Cache the fresh data
    const etag = setVendorOrdersCache(userId, page, limit, cacheData, CACHE_CONFIGS.VENDOR_ORDERS.maxAge * 1000);

    // Record cache miss metrics
    const duration = Date.now() - startTime;
    recordCacheMetrics('/api/vendor/orders', false, duration, userId, 'VENDOR');

    // Return response with caching headers
    return createCachedResponse(cacheData, CACHE_CONFIGS.VENDOR_ORDERS);

  } catch (error: any) {
    console.error("Error fetching vendor orders:", error);

    // Record error metrics
    const duration = Date.now() - startTime;
    recordCacheMetrics('/api/vendor/orders', false, duration, undefined, 'VENDOR');

    return NextResponse.json(
      { error: error.message || "Failed to fetch vendor orders" },
      { status: 500 }
    );
  }
} 