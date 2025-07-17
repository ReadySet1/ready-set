import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/prismaDB";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest, props: { params: Promise<{ orderId: string }> }) {
  const params = await props.params;
  const { orderId } = params;

  try {
    // Authenticate the user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Check authentication
    if (!user?.id) {
      console.error("Unauthorized access attempt to dispatch API");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log(`Fetching order details for orderId: ${orderId}`);

    // First, try to find the order directly by ID in both catering and on-demand tables
    let order: any = await prisma.cateringRequest.findFirst({
      where: { 
        orderNumber: {
          equals: orderId,
          mode: 'insensitive'
        },
        userId: user.id  // Ensure user can only access their own orders
      },
      include: {
        pickupAddress: true,
        deliveryAddress: true,
        dispatches: {
          include: {
            driver: {
              select: {
                id: true,
                name: true,
                email: true,
                contactNumber: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
      },
    });

    let orderType: string = 'catering';

    if (!order) {
      order = await prisma.onDemand.findFirst({
        where: { 
          orderNumber: {
            equals: orderId,
            mode: 'insensitive'
          },
          userId: user.id  // Ensure user can only access their own orders
        },
        include: {
          pickupAddress: true,
          deliveryAddress: true,
          dispatches: {
            include: {
              driver: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  contactNumber: true,
                },
              },
            },
            orderBy: {
              createdAt: 'desc'
            }
          },
        },
      });
      orderType = 'on_demand';
    }

    if (!order) {
      console.error(`No order found with order number: ${orderId}`);
      return NextResponse.json({ 
        error: "Order not found", 
        details: `No order found with order number: ${orderId}` 
      }, { status: 404 });
    }

    // Find the most recent dispatch for this order
    const dispatch = order.dispatches.length > 0 
      ? order.dispatches[0] 
      : null;

    console.log(`Order found: ${order.orderNumber}, Type: ${orderType}`);

    return NextResponse.json({
      order: {
        id: order.id.toString(),
        order_number: order.orderNumber,
        order_type: orderType,
        status: order.status || 'UNKNOWN',
        date: order.createdAt.toISOString(),
        pickup_time: order.pickupDateTime?.toISOString() || null,
        arrival_time: order.arrivalDateTime?.toISOString() || null,
        order_total: order.orderTotal?.toString() || '0.00',
        special_notes: order.specialNotes || null,
        address: {
          street1: order.pickupAddress?.street1 || 'N/A',
          city: order.pickupAddress?.city || 'N/A',
          state: order.pickupAddress?.state || 'N/A',
          zip: order.pickupAddress?.zip || 'N/A'
        },
        delivery_address: order.deliveryAddress ? {
          street1: order.deliveryAddress.street1 || 'N/A',
          city: order.deliveryAddress.city || 'N/A',
          state: order.deliveryAddress.state || 'N/A',
          zip: order.deliveryAddress.zip || 'N/A'
        } : null,
        dispatch: dispatch ? {
          id: dispatch.id.toString(),
          driver: dispatch.driver ? {
            id: dispatch.driver.id,
            name: dispatch.driver.name,
            email: dispatch.driver.email,
            contact_number: dispatch.driver.contactNumber
          } : null,
          status: dispatch.status || 'PENDING'
        } : null
      }
    });
  } catch (error) {
    console.error("Error fetching order details:", error);
    return NextResponse.json({ 
      error: "Failed to fetch order details", 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}