import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/utils/prismaDB";

// Updated type definitions
type CateringOrder = any;

type OnDemandOrder = any;

type Order = CateringOrder | Omit<OnDemandOrder, 'deliveryAddress'>;

export async function GET(req: NextRequest) {
  try {
    // Create Supabase client
    const supabase = await createClient();
    
    // Get the authenticated user
    const { data: { user } } = await supabase.auth.getUser();

    // Check authentication
    if (!user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Handle cases where req.url might be undefined (e.g., in tests)
    const url = req.url ? new URL(req.url) : new URL("http://localhost:3000/api/user-orders");
    const limit = parseInt(url.searchParams.get('limit') || '5', 10); // Changed default to 5
    const type = url.searchParams.get('type');
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const skip = (page - 1) * limit;

    // Fetch all orders first (both catering and on-demand)
    const [cateringOrders, onDemandOrders] = await Promise.all([
      prisma.cateringRequest.findMany({
        where: { 
          userId: user.id,
          deletedAt: null 
        },
        orderBy: { createdAt: 'desc' },
        include: { 
          user: { select: { name: true, email: true } },
          pickupAddress: true,
          deliveryAddress: true
        },
      }),
      prisma.onDemand.findMany({
        where: { 
          userId: user.id,
          deletedAt: null 
        },
        orderBy: { createdAt: 'desc' },
        include: { 
          user: { select: { name: true, email: true } },
          pickupAddress: true,
          deliveryAddress: true
        },
      }),
    ]);

    // Combine and sort all orders
    const allOrders: Order[] = [
      ...cateringOrders,
      ...onDemandOrders.map((order: OnDemandOrder) => {
        const { deliveryAddress, ...rest } = order;
        return rest;
      })
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Calculate pagination
    const totalOrders = allOrders.length;
    const totalPages = Math.ceil(totalOrders / limit);
    
    // Apply pagination to the combined result
    const paginatedOrders = allOrders.slice(skip, skip + limit);

    const serializedOrders = paginatedOrders.map(order => ({
      ...JSON.parse(JSON.stringify(order, (key, value) =>
        typeof value === 'bigint'
          ? value.toString()
          : value
      )),
      order_type: 'brokerage' in order ? 'catering' : 'on_demand',
    }));

    return NextResponse.json({
      orders: serializedOrders,
      pagination: {
        currentPage: page,
        totalPages,
        totalOrders,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        ordersPerPage: limit
      }
    }, { status: 200 });
  } catch (error) {
    console.error("Error fetching user orders:", error);
    return NextResponse.json({ message: "Error fetching user orders" }, { status: 500 });
  }
}