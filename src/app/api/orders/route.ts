import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { Decimal } from "@/types/prisma";
import { sendOrderEmail, CateringOrder as EmailSenderCateringOrder, OnDemandOrder as EmailSenderOnDemandOrder } from "@/utils/emailSender";
import { createClient } from "@/utils/supabase/server";
import { CateringNeedHost } from "@/types/order";
import { CateringStatus, OnDemandStatus } from "@/types/order-status";
import { updateCaterValleyOrderStatus } from '@/services/caterValleyService';
import { localTimeToUtc } from "@/lib/utils/timezone";
import { cookies } from 'next/headers';
import { validateApiAuth } from '@/utils/api-auth';
import { validateRequiredFields } from '@/utils/field-validation';
import { generateOrderNumber } from '@/utils/order-number';
import { getCenterCoordinate, calculateDistance } from '@/utils/distance';
import { getAddressInfo } from '@/utils/addresses';
import { sendDeliveryNotifications } from '@/app/actions/email';
import { invalidateVendorCacheOnOrderCreate } from '@/lib/cache/cache-invalidation';

import { prisma as prismaClient } from "@/utils/prismaDB";

// Simplified types to avoid Prisma payload complexity
type PrismaCateringOrder = any;
type PrismaOnDemandOrder = any;

type EmailBaseOrder = {
  order_type: string;
  address: any; 
  delivery_address: any; 
  order_number: string;
  date: Date | null;
  pickup_time: Date | null;
  arrival_time: Date | null;
  order_total: string; // Or number/Decimal
  client_attention: string | null;
  // Add other fields expected by email template
  pickup_notes?: string | null;
  special_notes?: string | null;
  status?: string | null;
  user?: { name: string | null; email: string | null; };
  brokerage?: string | null;
  complete_time?: Date | null;
};

type EmailCateringOrder = EmailBaseOrder & {
  headcount: string | null;
  hours_needed: string | null;
  number_of_host: string | null;
  need_host?: string | null;
};

type EmailOnDemandOrder = EmailBaseOrder & {
  item_delivered: string | null;
  vehicle_type: string | null;
  // Add other on_demand fields if needed for email
  length?: string | null;
  width?: string | null;
  height?: string | null;
  weight?: string | null;
};

type PrismaOrder = PrismaCateringOrder | PrismaOnDemandOrder;
type EmailOrder = EmailCateringOrder | EmailOnDemandOrder;

interface OrderData {
  id: string;
  type: 'catering' | 'ondemand';
  orderNumber: string;
  status: string;
  totalAmount: number;
  pickupAddress: any;
  deliveryAddress: any;
  client: any;
  pickupDateTime?: Date;
  createdAt: Date;
  updatedAt: Date;
  orderTotal?: number;
  tip?: number;
  dispatches: any[];
  fileUploads?: any[];
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const take = parseInt(searchParams.get('take') || '10');
    const skip = parseInt(searchParams.get('skip') || '0');
    const status = searchParams.get('status');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const search = searchParams.get('search');

    const cookieStore = await cookies();
    const authValidation = await validateApiAuth(req);
    
    if (!authValidation.isValid || !authValidation.user) {
      return NextResponse.json(
        { error: 'Authentication required' }, 
        { status: 401 }
      );
    }

    // Build where clauses for both catering and on-demand orders
    const baseWhere: any = {};
    
    if (status) {
      baseWhere.status = status;
    }

    if (search) {
      baseWhere.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { 
          user: { 
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } }
            ]
          }
        }
      ];
    }

    // Get both catering and on-demand orders
    const [cateringOrders, onDemandOrders] = await Promise.all([
      prismaClient.cateringRequest.findMany({
        where: baseWhere,
        include: {
          dispatches: {
            include: {
              driver: true,
            },
          },
          user: {
            include: {
              userAddresses: {
                include: {
                  address: true,
                },
              },
            },
          },
          pickupAddress: true,
          deliveryAddress: true,
          fileUploads: true,
        },
        orderBy: {
          [sortBy]: sortOrder as 'asc' | 'desc',
        },
        take,
        skip,
      }),
      prismaClient.onDemand.findMany({
        where: baseWhere,
        include: {
          dispatches: {
            include: {
              driver: true,
            },
          },
          user: {
            include: {
              userAddresses: {
                include: {
                  address: true,
                },
              },
            },
          },
          pickupAddress: true,
          deliveryAddress: true,
          fileUploads: true,
        },
        orderBy: {
          [sortBy]: sortOrder as 'asc' | 'desc',
        },
        take,
        skip,
      }),
    ]);

    // Transform catering orders
    const transformedCateringOrders: OrderData[] = cateringOrders.map((order: any) => ({
      id: order.id,
      type: 'catering' as const,
      orderNumber: order.orderNumber,
      status: order.status,
      totalAmount: order.orderTotal ? parseFloat(order.orderTotal.toString()) : 0,
      pickupAddress: order.pickupAddress,
      deliveryAddress: order.deliveryAddress,
      client: order.user,
      pickupDateTime: order.pickupDateTime,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      orderTotal: order.orderTotal ? parseFloat(order.orderTotal.toString()) : undefined,
      tip: order.tip ? parseFloat(order.tip.toString()) : undefined,
      dispatches: order.dispatches,
      fileUploads: order.fileUploads || [],
    }));

    // Transform on-demand orders
    const transformedOnDemandOrders: OrderData[] = onDemandOrders.map((order: any) => ({
      id: order.id,
      type: 'ondemand' as const,
      orderNumber: order.orderNumber,
      status: order.status,
      totalAmount: order.orderTotal ? parseFloat(order.orderTotal.toString()) : 0,
      pickupAddress: order.pickupAddress,
      deliveryAddress: order.deliveryAddress,
      client: order.user,
      pickupDateTime: order.pickupDateTime,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      orderTotal: order.orderTotal ? parseFloat(order.orderTotal.toString()) : undefined,
      tip: order.tip ? parseFloat(order.tip.toString()) : undefined,
      dispatches: order.dispatches,
      fileUploads: order.fileUploads || [],
    }));

    // Combine and sort orders
    const allOrders = [...transformedCateringOrders, ...transformedOnDemandOrders];
    
    // Sort combined orders by the specified field
    allOrders.sort((a, b) => {
      const aValue = a[sortBy as keyof OrderData] as any;
      const bValue = b[sortBy as keyof OrderData] as any;
      
      if (sortOrder === 'desc') {
        return bValue > aValue ? 1 : -1;
      } else {
        return aValue > bValue ? 1 : -1;
      }
    });

    // Apply pagination to combined results
    const paginatedOrders = allOrders.slice(skip, skip + take);

    return NextResponse.json({
      orders: paginatedOrders,
      totalCount: allOrders.length,
      hasMore: allOrders.length > (skip + take),
    });

  } catch (error: any) {
    console.error('Error fetching orders:', error);
    
    // Handle specific Prisma errors
    if (error && typeof error === 'object' && 'code' in error) {
      console.error("Prisma Error:", error.message);
      console.error("Error Code:", error.code);
      console.error("Meta:", error.meta);
      
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Failed to fetch orders',
        details: error?.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    const cookieStore = await cookies();
    const authValidation = await validateApiAuth(req);
    
          if (!authValidation.isValid || !authValidation.user) {
      return NextResponse.json(
        { error: 'Authentication required' }, 
        { status: 401 }
      );
    }

    // Validate required fields
    const requiredFields = [
      'type', 'pickupAddressId', 'deliveryAddressId'
    ];
    
    const fieldValidation = validateRequiredFields(body, requiredFields);
    if (!fieldValidation.isValid) {
      return NextResponse.json(
        { error: `Missing required fields: ${fieldValidation.missingFields.join(', ')}` },
        { status: 400 }
      );
    }

    const { type, ...orderData } = body;
    
    // Generate order number
    const orderNumber = generateOrderNumber();
    
    // Use transaction with proper typing
    const result = await prismaClient.$transaction(async (tx: Prisma.TransactionClient) => {
      const baseOrderData = {
        ...orderData,
        orderNumber,
        userId: authValidation.user!.id,
        status: 'PENDING' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (type === 'catering') {
        const cateringOrder = await tx.cateringRequest.create({
          data: baseOrderData,
          include: {
            pickupAddress: true,
            deliveryAddress: true,
            user: true,
          },
        });

        // Send notifications
        try {
          await sendDeliveryNotifications({
            orderId: cateringOrder.id,
            customerEmail: cateringOrder.user.email,
          });
        } catch (notificationError) {
          console.error('Failed to send notifications:', notificationError);
          // Don't fail the order creation if notifications fail
        }

        return { order: cateringOrder, type: 'catering' };
      } else if (type === 'ondemand') {
        const onDemandOrder = await tx.onDemand.create({
          data: baseOrderData,
          include: {
            pickupAddress: true,
            deliveryAddress: true,
            user: true,
          },
        });

        // Send notifications
        try {
          await sendDeliveryNotifications({
            orderId: onDemandOrder.id,
            customerEmail: onDemandOrder.user.email,
          });
        } catch (notificationError) {
          console.error('Failed to send notifications:', notificationError);
          // Don't fail the order creation if notifications fail
        }

        return { order: onDemandOrder, type: 'ondemand' };
      } else {
        throw new Error('Invalid order type');
      }
    });

    // Invalidate vendor cache since new order affects metrics and order lists
    invalidateVendorCacheOnOrderCreate(authValidation.user!.id, result.order.id);

    return NextResponse.json({
      success: true,
      order: result.order,
      type: result.type,
      message: 'Order created successfully',
    });

  } catch (error: any) {
    console.error('Error creating order:', error);
    
    // Handle specific Prisma errors
    if (error && typeof error === 'object' && 'code' in error) {
      console.error("Prisma Error:", error.message);
      console.error("Error Code:", error.code);
      console.error("Meta:", error.meta);
      
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Failed to create order',
        details: error?.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Helper function to map Prisma order data (PascalCase fields and relations)
function mapOrderForEmail(order: PrismaOrder): EmailOrder {
    const isCatering = 'brokerage' in order;
    // Base mapping using PascalCase fields from Prisma object
    const base: EmailBaseOrder = {
      order_type: isCatering ? "catering" : "on_demand",
      user: {
        name: order.user?.name ?? null,
        email: order.user?.email ?? null,
      },
      address: order.pickupAddress, // Use PascalCase relation
      delivery_address: order.deliveryAddress, // Use PascalCase relation
      order_number: order.orderNumber, // Use PascalCase field
      brokerage: (order as any).brokerage, // Add brokerage
      date: order.pickupDateTime ?? null, // Use PascalCase field
      pickup_time: order.pickupDateTime ?? null,
      arrival_time: order.arrivalDateTime ?? null,
      complete_time: order.completeDateTime ?? null,
      order_total: order.orderTotal?.toString() ?? "0.00",
      client_attention: order.clientAttention ?? null,
      pickup_notes: order.pickupNotes ?? null,
      special_notes: order.specialNotes ?? null,
      status: order.status ?? null,
    };
    if (isCatering) {
      const cateringOrder = order as any;
      return {
        ...base,
        headcount: cateringOrder.headcount?.toString() ?? null,
        need_host: cateringOrder.needHost ?? null,
        hours_needed: cateringOrder.hoursNeeded?.toString() ?? null,
        number_of_host: cateringOrder.numberOfHosts?.toString() ?? null, // Use PascalCase field
      } as EmailCateringOrder;
    } else {
      const onDemandOrder = order as any;
      return {
        ...base,
        item_delivered: onDemandOrder.itemDelivered ?? null,
        vehicle_type: onDemandOrder.vehicleType ?? null,
        length: onDemandOrder.length?.toString() ?? null,
        width: onDemandOrder.width?.toString() ?? null,
        height: onDemandOrder.height?.toString() ?? null,
        weight: onDemandOrder.weight?.toString() ?? null,
      } as EmailOnDemandOrder;
    }
}