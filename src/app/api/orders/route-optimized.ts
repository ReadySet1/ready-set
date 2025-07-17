import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { Prisma } from "@prisma/client";
import { prismaPooled, queryMetrics } from "@/lib/db/prisma-pooled";
import { withRateLimit, RateLimitConfigs } from '@/lib/rate-limiting';
import { addSecurityHeaders } from '@/lib/auth-middleware';

// Types for optimized queries
interface OptimizedOrderData {
  id: string;
  orderNumber: string;
  pickupDateTime: Date | null;
  arrivalDateTime: Date | null;
  status: string;
  orderTotal: string;
  orderType: 'catering' | 'ondemand';
  user: {
    id: string;
    name: string | null;
    email: string;
  };
  pickupAddress: {
    id: string;
    street1: string;
    city: string;
    state: string;
    zip: string;
  };
  deliveryAddress: {
    id: string;
    street1: string;
    city: string;
    state: string;
    zip: string;
  };
  driverInfo: {
    id: string | null;
    name: string | null;
    contactNumber: string | null;
  } | null;
  fileCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface OptimizedOrdersResponse {
  orders: OptimizedOrderData[];
  pagination: PaginationInfo;
  performance: {
    queryTime: number;
    totalTime: number;
    cacheHit?: boolean;
  };
}

// Rate limiting for API operations
const apiRateLimit = withRateLimit(RateLimitConfigs.api);

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const orderCache = new Map<string, { data: OptimizedOrdersResponse; timestamp: number }>();

// Optimized query builder
class OrderQueryBuilder {
  private baseWhere: any = { deletedAt: null };
  private sortField: string = 'pickupDateTime';
  private sortOrder: 'asc' | 'desc' = 'desc';
  private page: number = 1;
  private limit: number = 10;
  private userId?: string;

  constructor(userId?: string) {
    this.userId = userId;
  }

  where(conditions: any) {
    this.baseWhere = { ...this.baseWhere, ...conditions };
    return this;
  }

  search(term: string) {
    if (term.trim()) {
      this.baseWhere.OR = [
        { orderNumber: { contains: term, mode: 'insensitive' } },
        { user: { name: { contains: term, mode: 'insensitive' } } },
        { user: { email: { contains: term, mode: 'insensitive' } } }
      ];
    }
    return this;
  }

  status(statusFilter: string) {
    if (statusFilter && statusFilter !== 'all') {
      this.baseWhere.status = statusFilter;
    }
    return this;
  }

  userScope() {
    if (this.userId) {
      this.baseWhere.userId = this.userId;
    }
    return this;
  }

  sort(field: string, order: 'asc' | 'desc') {
    this.sortField = field;
    this.sortOrder = order;
    return this;
  }

  paginate(pageNum: number, pageSize: number) {
    this.page = Math.max(1, pageNum);
    this.limit = Math.min(Math.max(1, pageSize), 100); // Cap at 100
    return this;
  }

  getWhereClause() {
    return this.baseWhere;
  }

  getOrderBy() {
    const validSortFields: Record<string, any> = {
      pickupDateTime: { pickupDateTime: this.sortOrder },
      orderTotal: { orderTotal: this.sortOrder },
      orderNumber: { orderNumber: this.sortOrder },
      createdAt: { createdAt: this.sortOrder },
      'user.name': { user: { name: this.sortOrder } }
    };

    return validSortFields[this.sortField] || { pickupDateTime: 'desc' };
  }

  getPagination() {
    const skip = (this.page - 1) * this.limit;
    return { take: this.limit, skip };
  }

  getCacheKey(userType: string) {
    return `orders:${userType}:${JSON.stringify({
      where: this.baseWhere,
      sort: this.sortField,
      order: this.sortOrder,
      page: this.page,
      limit: this.limit
    })}`;
  }
}

// Optimized data fetcher
async function fetchOptimizedOrders(
  queryBuilder: OrderQueryBuilder
): Promise<{ orders: OptimizedOrderData[]; totalCount: number }> {
  const whereClause = queryBuilder.getWhereClause();
  const orderBy = queryBuilder.getOrderBy();
  const { take, skip } = queryBuilder.getPagination();

  // Use optimized include to reduce data transfer
  const includeClause = {
    user: {
      select: {
        id: true,
        name: true,
        email: true
      }
    },
    pickupAddress: {
      select: {
        id: true,
        street1: true,
        city: true,
        state: true,
        zip: true
      }
    },
    deliveryAddress: {
      select: {
        id: true,
        street1: true,
        city: true,
        state: true,
        zip: true
      }
    },
    dispatches: {
      select: {
        driver: {
          select: {
            id: true,
            name: true,
            contactNumber: true
          }
        }
      },
      take: 1,
      orderBy: { createdAt: 'desc' as const }
    },
    _count: {
      select: {
        fileUploads: true
      }
    }
  };

  // Execute optimized parallel queries
  const [cateringOrders, onDemandOrders, cateringCount, onDemandCount] = await Promise.all([
    queryMetrics.measureQuery('catering-orders-list', () =>
      prismaPooled.cateringRequest.findMany({
        where: whereClause,
        include: includeClause,
        orderBy,
        take,
        skip
      })
    ),
    queryMetrics.measureQuery('ondemand-orders-list', () =>
      prismaPooled.onDemand.findMany({
        where: whereClause,
        include: includeClause,
        orderBy,
        take,
        skip
      })
    ),
    queryMetrics.measureQuery('catering-count', () =>
      prismaPooled.cateringRequest.count({ where: whereClause })
    ),
    queryMetrics.measureQuery('ondemand-count', () =>
      prismaPooled.onDemand.count({ where: whereClause })
    )
  ]);

  // Transform and combine results
  const transformedCatering: OptimizedOrderData[] = cateringOrders.map(order => ({
    id: order.id,
    orderNumber: order.orderNumber,
    pickupDateTime: order.pickupDateTime,
    arrivalDateTime: order.arrivalDateTime,
    status: order.status,
    orderTotal: order.orderTotal?.toString() || '0',
    orderType: 'catering' as const,
    user: order.user,
    pickupAddress: order.pickupAddress,
    deliveryAddress: order.deliveryAddress,
    driverInfo: order.dispatches[0]?.driver || null,
    fileCount: order._count.fileUploads,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt
  }));

  const transformedOnDemand: OptimizedOrderData[] = onDemandOrders.map(order => ({
    id: order.id,
    orderNumber: order.orderNumber,
    pickupDateTime: order.pickupDateTime,
    arrivalDateTime: order.arrivalDateTime,
    status: order.status,
    orderTotal: order.orderTotal?.toString() || '0',
    orderType: 'ondemand' as const,
    user: order.user,
    pickupAddress: order.pickupAddress,
    deliveryAddress: order.deliveryAddress,
    driverInfo: order.dispatches[0]?.driver || null,
    fileCount: order._count.fileUploads,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt
  }));

  // Combine and sort results
  const allOrders = [...transformedCatering, ...transformedOnDemand];
  const totalCount = cateringCount + onDemandCount;

  // Sort combined results in memory (more efficient for small datasets)
  allOrders.sort((a, b) => {
    const sortField = queryBuilder['sortField'];
    const sortOrder = queryBuilder['sortOrder'];
    
    let aValue: any = a[sortField as keyof OptimizedOrderData];
    let bValue: any = b[sortField as keyof OptimizedOrderData];

    // Handle nested user.name sorting
    if (sortField === 'user.name') {
      aValue = a.user.name;
      bValue = b.user.name;
    }

    if (aValue === null) aValue = '';
    if (bValue === null) bValue = '';

    if (sortOrder === 'desc') {
      return bValue > aValue ? 1 : -1;
    } else {
      return aValue > bValue ? 1 : -1;
    }
  });

  return { orders: allOrders, totalCount };
}

// Main optimized GET handler
export async function GET(req: NextRequest) {
  const startTime = performance.now();

  try {
    // Apply rate limiting
    const rateLimitResponse = apiRateLimit(req);
    if (rateLimitResponse) {
      return addSecurityHeaders(rateLimitResponse);
    }

    // Initialize Supabase client
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.id) {
      const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      return addSecurityHeaders(response);
    }

    // Get user profile for access control
    const { data: profile } = await supabase
      .from('profiles')
      .select('type')
      .eq('id', user.id)
      .single();

    if (!profile?.type) {
      const response = NextResponse.json({ error: "User profile not found" }, { status: 404 });
      return addSecurityHeaders(response);
    }

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const sortBy = searchParams.get('sortBy') || 'pickupDateTime';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const status = searchParams.get('status') || 'all';
    const search = searchParams.get('search') || '';

    // Build optimized query
    const queryBuilder = new OrderQueryBuilder(
      profile.type === 'VENDOR' ? user.id : undefined
    )
      .search(search)
      .status(status)
      .userScope()
      .sort(sortBy, sortOrder as 'asc' | 'desc')
      .paginate(page, limit);

    // Check cache
    const cacheKey = queryBuilder.getCacheKey(profile.type);
    const cached = orderCache.get(cacheKey);
    const now = Date.now();

    if (cached && (now - cached.timestamp) < CACHE_TTL) {
      const totalTime = performance.now() - startTime;
      const response = NextResponse.json({
        ...cached.data,
        performance: {
          ...cached.data.performance,
          totalTime,
          cacheHit: true
        }
      });
      return addSecurityHeaders(response);
    }

    // Execute optimized query
    const queryStartTime = performance.now();
    const { orders, totalCount } = await fetchOptimizedOrders(queryBuilder);
    const queryTime = performance.now() - queryStartTime;

    // Build pagination info
    const totalPages = Math.ceil(totalCount / limit);
    const pagination: PaginationInfo = {
      currentPage: page,
      totalPages,
      totalCount,
      pageSize: limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    };

    const totalTime = performance.now() - startTime;

    // Build response
    const responseData: OptimizedOrdersResponse = {
      orders,
      pagination,
      performance: {
        queryTime,
        totalTime,
        cacheHit: false
      }
    };

    // Cache the result
    orderCache.set(cacheKey, {
      data: responseData,
      timestamp: now
    });

    // Clean old cache entries (simple cleanup)
    if (orderCache.size > 100) {
      const cutoff = now - CACHE_TTL;
      for (const [key, value] of orderCache.entries()) {
        if (value.timestamp < cutoff) {
          orderCache.delete(key);
        }
      }
    }

    const response = NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'private, max-age=300', // 5 minute client cache
        'X-Query-Time': `${queryTime.toFixed(2)}ms`,
        'X-Total-Time': `${totalTime.toFixed(2)}ms`,
        'X-Total-Count': totalCount.toString()
      }
    });

    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error('Error in optimized orders API:', error);
    
    const totalTime = performance.now() - startTime;
    const response = NextResponse.json(
      { 
        error: 'Failed to fetch orders',
        details: error?.message || 'Unknown error',
        performance: { totalTime }
      },
      { status: 500 }
    );

    return addSecurityHeaders(response);
  }
}

// Cache invalidation utility
export function invalidateOrdersCache(pattern?: string) {
  if (pattern) {
    for (const key of orderCache.keys()) {
      if (key.includes(pattern)) {
        orderCache.delete(key);
      }
    }
  } else {
    orderCache.clear();
  }
} 