import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/utils/prismaDB";

export async function GET(req: NextRequest, props: { params: Promise<{ order_number: string }> }) {
  const params = await props.params;
  try {
    // Create Supabase client
    const supabase = await createClient();
    
    // Get the authenticated user
    const { data: { user } } = await supabase.auth.getUser();

    // Check authentication
    if (!user?.id) {
      console.error("Unauthorized access attempt to user-orders API");
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { order_number } = params;
    console.log(`Fetching order details for order number: ${order_number}`);

    // Try to find catering request
    let order: any = await prisma.cateringRequest.findFirst({
      where: { 
        orderNumber: {
          equals: order_number,
          mode: 'insensitive'
        },
        userId: user.id  // Ensure user can only access their own orders
      },
      include: {
        user: { select: { name: true, email: true } },
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

    // If not found in catering requests, try on-demand orders
    if (!order) {
      order = await prisma.onDemand.findFirst({
        where: { 
          orderNumber: {
            equals: order_number,
            mode: 'insensitive'
          },
          userId: user.id  // Ensure user can only access their own orders
        },
        include: {
          user: { select: { name: true, email: true } },
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
    }

    // If no order found, return 404
    if (!order) {
      console.error(`No order found with order number: ${order_number}`);
      return NextResponse.json({ 
        error: "Order not found", 
        details: `No order found with order number: ${order_number}` 
      }, { status: 404 });
    }

    // Determine order type
    const orderType = 'brokerage' in order ? 'catering' : 'on_demand';
    console.log(`Order found: ${order.orderNumber}, Type: ${orderType}`);

    // Serialize the order, handling BigInt and adding order type
    const serializedOrder = {
      ...JSON.parse(JSON.stringify(order, (key, value) =>
        typeof value === 'bigint'
          ? value.toString()
          : value
      )),
      order_type: orderType,
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
      dispatch: order.dispatches && order.dispatches.length > 0 ? {
        id: order.dispatches[0].id.toString(),
        driver: order.dispatches[0].driver ? {
          id: order.dispatches[0].driver.id,
          name: order.dispatches[0].driver.name,
          email: order.dispatches[0].driver.email,
          contact_number: order.dispatches[0].driver.contactNumber
        } : null
      } : null
    };

    return NextResponse.json(serializedOrder);
  } catch (error) {
    console.error("Error fetching order:", error);
    return NextResponse.json(
      { 
        error: "Error fetching order", 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }, 
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}