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
    const { data: { user }, error: authError } = await supabase.auth.getUser();

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

    if (type === 'all' || type === 'catering' || !type) {
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
    }

    if (type === 'all' || type === 'on_demand' || !type) {
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



    const serializedOrders = allOrders.map(order => {
      // Handle bigint serialization and date conversion
      const baseOrder = JSON.parse(JSON.stringify(order, (key, value) =>
        typeof value === 'bigint'
          ? value.toString()
          : value
      ));

      // Helper function to safely convert to ISO string
      const toISOString = (dateValue: any): string => {
        if (!dateValue) return new Date().toISOString();
        
        // If it's already a string, try to parse it
        if (typeof dateValue === 'string') {
          const parsed = new Date(dateValue);
          return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
        }
        
        // If it's a Date object
        if (dateValue instanceof Date) {
          return dateValue.toISOString();
        }
        
        // Fallback
        return new Date().toISOString();
      };

      // Map database fields to frontend expected fields
      return {
        id: baseOrder.id,
        order_number: baseOrder.orderNumber || `ORDER-${baseOrder.id.slice(0, 8)}`,
        order_type: 'brokerage' in order ? 'catering' : 'on_demand',
        status: baseOrder.status?.toLowerCase() || 'active',
        date: toISOString(baseOrder.pickupDateTime || baseOrder.createdAt),
        pickup_time: baseOrder.pickupDateTime,
        arrival_time: baseOrder.arrivalDateTime,
        order_total: baseOrder.orderTotal ? baseOrder.orderTotal.toString() : '0.00',
        client_attention: baseOrder.clientAttention,
        address: baseOrder.pickupAddress ? {
          street1: baseOrder.pickupAddress.street1,
          city: baseOrder.pickupAddress.city,
          state: baseOrder.pickupAddress.state,
        } : null,
        delivery_address: baseOrder.deliveryAddress ? {
          street1: baseOrder.deliveryAddress.street1,
          city: baseOrder.deliveryAddress.city,
          state: baseOrder.deliveryAddress.state,
        } : null,
      };
    });

    return NextResponse.json(serializedOrders, { status: 200 });
  } catch (error) {
    console.error("Error fetching user orders:", error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('toISOString')) {
        return NextResponse.json(
          { message: 'Error processing order dates' },
          { status: 500 }
        );
      }
    }
    
    return NextResponse.json({ message: "Error fetching user orders" }, { status: 500 });
  } finally {
    // Disconnect Prisma client
    await prisma.$disconnect();
  }
}