// src/app/api/orders/catering-orders/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma, withDatabaseRetry } from "@/utils/prismaDB";
import { Prisma } from "@prisma/client";
import { 
    CateringRequest, 
    Dispatch, 
    Profile, 
    Address, 
    CateringStatus,
    CateringRequestWhereInput
} from "@/types/prisma"; 
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library"; 

const ITEMS_PER_PAGE = 10;

// Define types using Profile based on schema
interface EnrichedDispatch extends Dispatch {
    // Dispatch model has no 'status' field in schema
    // status: DispatchStatus; // Remove this line
    driver: Pick<Profile, 'id' | 'name' | 'email' | 'contactNumber'> | null; // Use Profile
}

interface CateringOrderWithDetails extends CateringRequest {
  status: CateringStatus; // Use the correct enum from CateringRequest
  user: Pick<Profile, 'id' | 'name' | 'email' | 'contactNumber'>; // Use Profile
  pickupAddress: Address | null;
  deliveryAddress: Address | null;
  dispatches: EnrichedDispatch[];
}

export async function GET(req: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Extract the token from header
    const token = authHeader.split(' ')[1];
    
    // Initialize Supabase client
    const supabase = await createClient();
    
    // Verify the token by passing it to getUser
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || `${ITEMS_PER_PAGE}`, 10);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const skip = (page - 1) * limit;
    const statusParam = url.searchParams.get('status');
    const statusFilter = url.searchParams.get('statusFilter'); // 'active' for all active statuses
    const searchTerm = url.searchParams.get('search') || '';
    const sortField = url.searchParams.get('sort') || 'pickupDateTime';
    const sortDirection = url.searchParams.get('direction') || 'desc';
    const recentOnly = url.searchParams.get('recentOnly') === 'true';

    // Build where clause
    let whereClause: any = {
      deletedAt: null
    };

    // Handle statusFilter=active (fetches all orders with active-like statuses)
    if (statusFilter === 'active') {
      whereClause.status = {
        in: [
          CateringStatus.ACTIVE,
          CateringStatus.ASSIGNED,
          CateringStatus.PENDING,
          CateringStatus.CONFIRMED,
          CateringStatus.IN_PROGRESS,
        ]
      };
    } else if (statusParam && statusParam !== 'all') {
      if (Object.values(CateringStatus).includes(statusParam as CateringStatus)) {
         whereClause.status = statusParam as CateringStatus;
      }
    }

    // Only apply 30-day restriction for recentOnly when not using statusFilter
    if (recentOnly && !statusFilter) {
      // Only get orders from the last 30 days for recent view
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      whereClause.createdAt = {
        gte: thirtyDaysAgo
      };
    }

    if (searchTerm) {
      whereClause.OR = [
        { orderNumber: { contains: searchTerm, mode: 'insensitive' } },
        { user: { name: { contains: searchTerm, mode: 'insensitive' } } },
        { user: { email: { contains: searchTerm, mode: 'insensitive' } } },
      ];
    }

    // Build order by clause
    let orderByClause: any = {};
    const effectiveSortDirection = sortDirection === 'asc' ? 'asc' : 'desc';
    
    const validSortFields: { [key: string]: any } = {
      pickupDateTime: { pickupDateTime: effectiveSortDirection },
      date: { pickupDateTime: effectiveSortDirection },
      orderTotal: { orderTotal: effectiveSortDirection },
      orderNumber: { orderNumber: effectiveSortDirection },
      'user.name': { user: { name: effectiveSortDirection } },
      createdAt: { createdAt: effectiveSortDirection },
    };

    orderByClause = validSortFields[sortField] || { pickupDateTime: 'desc' };

    // Fetch data with optimized query and retry logic
    const [cateringOrders, totalCount] = await withDatabaseRetry(async () => {
      return Promise.all([
        prisma.cateringRequest.findMany({
          where: whereClause,
          skip,
          take: limit,
          orderBy: orderByClause,
          include: {
            user: {
              select: { id: true, name: true, email: true, contactNumber: true }
            },
            pickupAddress: true,
            deliveryAddress: true,
            dispatches: {
              include: {
                driver: {
                  select: { id: true, name: true, email: true, contactNumber: true }
                }
              }
            }
          },
        }),
        prisma.cateringRequest.count({ where: whereClause }),
      ]);
    }); 

    const totalPages = Math.ceil(totalCount / limit);

    // Format response with optimized data structure
    const formattedOrders = cateringOrders.map((order: CateringOrderWithDetails) => ({ 
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      pickupDateTime: order.pickupDateTime,
      date: order.pickupDateTime || order.createdAt, 
      orderTotal: order.orderTotal ?? 0, 
      user: {
        id: order.user.id,
        name: order.user.name || 'N/A', 
        email: order.user.email,
        contactNumber: order.user.contactNumber
      },
      pickupAddress: order.pickupAddress,
      deliveryAddress: order.deliveryAddress,
      clientAttention: order.clientAttention,
      specialNotes: order.specialNotes,
      pickupNotes: order.pickupNotes,
      driverStatus: order.driverStatus,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      dispatches: order.dispatches.map((dispatch: EnrichedDispatch) => ({ 
        id: dispatch.id,
        driver: dispatch.driver ? {
          id: dispatch.driver.id,
          name: dispatch.driver.name || 'N/A',
          email: dispatch.driver.email,
          contactNumber: dispatch.driver.contactNumber,
        } : null,
      })),
    }));

    const response = {
      orders: formattedOrders,
      totalPages,
      totalCount,
      currentPage: page
    };

    // Determine cache strategy based on request type
    const cacheHeaders = recentOnly || statusParam === 'ACTIVE' 
      ? { 'Cache-Control': 'private, s-maxage=30, stale-while-revalidate=60' } // Short cache for active data
      : { 'Cache-Control': 'private, s-maxage=300, stale-while-revalidate=600' }; // Longer cache for historical data

    return NextResponse.json(response, { 
      status: 200,
      headers: cacheHeaders
    });

  } catch (error: unknown) { 
    console.error("Error fetching catering orders:", error); 

    let errorMessage = "An internal server error occurred";
    let statusCode = 500;

    if (error instanceof PrismaClientKnownRequestError) { 
       const prismaError = error as PrismaClientKnownRequestError;
       if (prismaError.code === 'P1001') {
          errorMessage = "Database connection issue. Please try again later.";
          statusCode = 503; 
       } else {
          errorMessage = process.env.NODE_ENV === 'development' 
            ? `Database query failed: ${prismaError.message} (Code: ${prismaError.code}).`
            : "Database query failed";
       }
    } else if (error instanceof Error) {
      errorMessage = process.env.NODE_ENV === 'development' ? error.message : "Internal server error";
    }
    
    return NextResponse.json({ 
      message: "Error fetching catering orders", 
      error: errorMessage 
    }, { status: statusCode });
  } 
}