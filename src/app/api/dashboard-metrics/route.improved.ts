// app/api/dashboard-metrics/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { CateringStatus } from '@/types/order-status';
import { prisma } from '@/utils/prismaDB';
import { logError } from '@/utils/error-logging';
import { createClient } from '@/utils/supabase/server';

// Type definitions
interface DashboardMetrics {
  totalRevenue: number;
  deliveriesRequests: number;
  salesTotal: number;
  totalVendors: number;
  period?: {
    startDate?: string;
    endDate?: string;
  };
}

interface DashboardMetricsError {
  error: string;
  details?: string | z.ZodError;
}

type DashboardMetricsResponse = DashboardMetrics | DashboardMetricsError;

// Validation schema for query parameters
const querySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  vendorId: z.string().uuid().optional()
});

// Cache configuration
const CACHE_TTL = 300; // 5 minutes
const STALE_WHILE_REVALIDATE = 600; // 10 minutes

export async function GET(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    // Authentication check using Supabase
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' } as DashboardMetricsError,
        { status: 401 }
      );
    }

    // Get user profile to check permissions
    const { data: profile } = await supabase
      .from('profiles')
      .select('type')
      .eq('id', user.id)
      .single();

    if (!profile || !profile.type || !['ADMIN', 'VENDOR'].includes(profile.type)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' } as DashboardMetricsError,
        { status: 403 }
      );
    }

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    let params;
    
    try {
      params = querySchema.parse({
        startDate: searchParams.get('startDate') || undefined,
        endDate: searchParams.get('endDate') || undefined,
        vendorId: searchParams.get('vendorId') || undefined
      });
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        return NextResponse.json(
          { 
            error: 'Invalid query parameters', 
            details: validationError 
          } as DashboardMetricsError,
          { status: 400 }
        );
      }
      throw validationError;
    }

    // Build where clause based on parameters
    const baseWhere = {
      deletedAt: null,
      ...(params.startDate && {
        createdAt: {
          gte: new Date(params.startDate),
          ...(params.endDate && { lte: new Date(params.endDate) })
        }
      }),
      // For vendors, only show their own data
      ...(profile.type === 'VENDOR' ? { userId: user.id } : 
         params.vendorId ? { userId: params.vendorId } : {})
    };

    // Execute queries in parallel for better performance
    const [totalRevenue, deliveriesRequests, salesTotal, totalVendors] =
      await Promise.all([
        // Total revenue from completed orders
        prisma.cateringRequest.aggregate({
          _sum: {
            orderTotal: true,
          },
          where: {
            ...baseWhere,
            status: CateringStatus.COMPLETED,
          },
        }),
        // Total delivery requests
        prisma.cateringRequest.count({
          where: baseWhere,
        }),
        // Total completed sales
        prisma.cateringRequest.count({
          where: {
            ...baseWhere,
            status: CateringStatus.COMPLETED,
          },
        }),
        // Total vendors (only admins can see all vendors)
        profile.type === 'ADMIN' 
          ? prisma.profile.count({
              where: {
                deletedAt: null,
                type: "VENDOR",
              },
            })
          : Promise.resolve(1) // Vendors only see themselves
      ]);

    // Process the revenue value (handle Prisma Decimal type)
    const finalRevenue = totalRevenue._sum.orderTotal 
      ? Number(totalRevenue._sum.orderTotal) 
      : 0;

    // Build response
    const response: DashboardMetrics = {
      totalRevenue: finalRevenue,
      deliveriesRequests,
      salesTotal,
      totalVendors,
      ...(params.startDate && {
        period: {
          startDate: params.startDate,
          endDate: params.endDate
        }
      })
    };

    const duration = performance.now() - startTime;

    // Log slow queries for monitoring
    if (duration > 1000) {
      console.warn(`Slow dashboard metrics query: ${duration.toFixed(2)}ms`, {
        params,
        userId: user.id,
        userType: profile.type
      });
    }

    // Return response with caching headers
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': `public, s-maxage=${CACHE_TTL}, stale-while-revalidate=${STALE_WHILE_REVALIDATE}`,
        'X-Response-Time': `${duration.toFixed(2)}ms`,
        'X-User-Type': profile.type!,
      },
    });

  } catch (error) {
    const duration = performance.now() - startTime;

    // Log the error using your utility
    logError(error, {
      message: 'Failed to fetch dashboard metrics',
      source: 'api:other', // Consider adding 'dashboard:metrics' to ErrorSource enum
      statusCode: 500,
      additionalContext: {
        endpoint: '/api/dashboard-metrics',
        method: 'GET',
        duration: `${duration.toFixed(2)}ms`,
        url: request.url
      }
    });

    // Build error response
    const errorResponse: DashboardMetricsError = {
      error: 'Failed to fetch dashboard metrics',
      ...(process.env.NODE_ENV === 'development' && { 
        details: error instanceof Error ? error.message : 'Unknown error' 
      })
    };

    return NextResponse.json(errorResponse, { 
      status: 500,
      headers: {
        'X-Response-Time': `${duration.toFixed(2)}ms`,
      }
    });
  } finally {
    // Ensure Prisma connection is properly closed
    await prisma.$disconnect();
  }
}

// Optional: Add HEAD method for health checks
export async function HEAD(request: NextRequest) {
  return new NextResponse(null, { status: 200 });
}