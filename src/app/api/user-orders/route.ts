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

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);
    const type = url.searchParams.get('type');
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const skip = (page - 1) * limit;

    let cateringOrders: CateringOrder[] = [];
    let onDemandOrders: OnDemandOrder[] = [];
    let totalCateringCount = 0;
    let totalOnDemandCount = 0;

    if (type === 'all' || type === 'catering' || !type) {
      // Fetch catering orders with pagination
      cateringOrders = await prisma.cateringRequest.findMany({
        where: { userId: user.id },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { 
          user: { select: { name: true, email: true } },
          pickupAddress: true,
          deliveryAddress: true
        },
      });

      // Get total count of catering orders for this user
      totalCateringCount = await prisma.cateringRequest.count({
        where: { userId: user.id },
      });
    }

    if (type === 'all' || type === 'on_demand' || !type) {
      // Fetch on-demand orders with pagination
      onDemandOrders = await prisma.onDemand.findMany({
        where: { userId: user.id },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { 
          user: { select: { name: true, email: true } },
          pickupAddress: true,
          deliveryAddress: true
        },
      });

      // Get total count of on-demand orders for this user
      totalOnDemandCount = await prisma.onDemand.count({
        where: { userId: user.id },
      });
    }

    const allOrders: Order[] = [
      ...cateringOrders,
      ...onDemandOrders.map(order => {
        const { deliveryAddress, ...rest } = order;
        return rest;
      })
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);

    // Calculate total count of all orders
    const totalOrders = totalCateringCount + totalOnDemandCount;

    // Modify the serializedOrders mapping to ensure robust address handling
    const serializedOrders = allOrders.map(order => {
      // Normalize address fields with fallback values
      const pickupAddress = order.pickupAddress || order.address || {};
      const deliveryAddress = order.deliveryAddress || order.delivery_address || null;

      return {
        ...JSON.parse(JSON.stringify(order, (key, value) =>
          typeof value === 'bigint'
            ? value.toString()
            : value
        )),
        order_type: 'brokerage' in order ? 'catering' : 'on_demand',
        order_number: order.orderNumber || 'Unknown Order', // Fix: Map orderNumber to order_number
        address: {
          street1: pickupAddress.street1 || 'N/A',
          city: pickupAddress.city || 'N/A',
          state: pickupAddress.state || 'N/A',
          zip: pickupAddress.zip || 'N/A'
        },
        delivery_address: deliveryAddress ? {
          street1: deliveryAddress.street1 || 'N/A',
          city: deliveryAddress.city || 'N/A',
          state: deliveryAddress.state || 'N/A',
          zip: deliveryAddress.zip || 'N/A'
        } : null,
        client_attention: order.client_attention || order.specialNotes || 'No special notes',
        status: order.status || 'Unknown',
        date: order.arrivalDateTime || order.pickupDateTime || order.createdAt || new Date().toISOString(), // Fix: Use delivery date instead of creation date
        pickup_time: order.pickupDateTime || order.pickup_time || 'N/A',
        arrival_time: order.arrivalDateTime || order.arrival_time || 'N/A',
        order_total: order.orderTotal || order.order_total || '0.00'
      };
    });

    // Return orders with total count for proper pagination
    return NextResponse.json({
      orders: serializedOrders,
      totalCount: totalOrders,
      currentPage: page,
      totalPages: Math.ceil(totalOrders / limit)
    }, { status: 200 });
  } catch (error) {
    console.error("Error fetching user orders:", error);
    return NextResponse.json({ message: "Error fetching user orders" }, { status: 500 });
  } finally {
    // Disconnect Prisma client
    await prisma.$disconnect();
  }
}