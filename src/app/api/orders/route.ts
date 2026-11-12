import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { Decimal } from "@/types/prisma";
import { createClient } from "@/utils/supabase/server";
import { CateringNeedHost } from "@/types/order";
import { CateringStatus, OnDemandStatus } from "@/types/order-status";
import { localTimeToUtc } from "@/lib/utils/timezone";
import { withAuth, type AuthResult } from '@/lib/auth-middleware';
import { ORDER_CREATE_ALLOWED_ROLES, parseCreateOrderBody } from './create-order-schema';
import { generateOrderNumber } from '@/utils/order-number';
import { getCenterCoordinate, calculateDistance } from '@/utils/distance';
import { getAddressInfo } from '@/utils/addresses';
import { sendDeliveryNotifications } from '@/services/notifications/delivery-notifications';
import { invalidateVendorCacheOnOrderCreate } from '@/lib/cache/cache-invalidation';
import { notifyOrderCreated } from '@/services/orders/notifyOrderCreated';
import { runAfterResponse } from '@/lib/api/after-response';

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

/**
 * Staff roles that see every order and may use any address. Matches
 * ORDER_EDIT_ROLES in ./[order_number]/route.ts. Every other role is scoped
 * to its own orders and addresses (deny by default).
 */
const ORDER_STAFF_ROLES = ['ADMIN', 'SUPER_ADMIN', 'HELPDESK'];

/**
 * Roles that may list orders: every known account type. Non-staff are scoped
 * to their own orders below; a missing or unknown role is rejected by withAuth.
 */
const ORDER_LIST_ALLOWED_ROLES = ['CLIENT', 'VENDOR', 'DRIVER', ...ORDER_STAFF_ROLES];

function isOrderStaff(role: unknown): boolean {
  return ORDER_STAFF_ROLES.includes(String(role ?? '').toUpperCase());
}

/** Maps a failed withAuth result to this route's `{ error }` response shape. */
function authFailureResponse(auth: AuthResult, forbiddenMessage: string): NextResponse {
  const status = auth.response?.status ?? 401;
  const error =
    status === 401
      ? 'Authentication required'
      : status === 403
        ? forbiddenMessage
        : 'Authentication error';
  return NextResponse.json({ error }, { status });
}

/**
 * Returns the address-ID fields the caller may not use: missing,
 * soft-deleted, or (for non-staff) neither created by, linked to, nor shared
 * with the caller. Missing and foreign addresses get the same answer so the
 * response can't be used to probe which address IDs exist.
 */
async function findUnusableAddressFields(
  callerId: string,
  isStaff: boolean,
  addressIds: { pickupAddressId: string; deliveryAddressId: string },
): Promise<string[]> {
  const ids = [...new Set([addressIds.pickupAddressId, addressIds.deliveryAddressId])];
  const usable = await prismaClient.address.findMany({
    where: {
      id: { in: ids },
      deletedAt: null,
      ...(isStaff
        ? {}
        : {
            OR: [
              { createdBy: callerId },
              { isShared: true },
              { userAddresses: { some: { userId: callerId } } },
            ],
          }),
    },
    select: { id: true },
  });
  const usableIds = new Set(usable.map((address: { id: string }) => address.id));

  return (['pickupAddressId', 'deliveryAddressId'] as const).filter(
    (field) => !usableIds.has(addressIds[field]),
  );
}

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

    const auth = await withAuth(req, {
      allowedRoles: ORDER_LIST_ALLOWED_ROLES,
      requireAuth: true,
    });
    if (!auth.success) {
      return authFailureResponse(auth, 'Forbidden - this account type cannot list orders');
    }
    const caller = auth.context.user;

    // Build where clauses for both catering and on-demand orders.
    // Soft-deleted orders are never listed; non-staff only see their own.
    const baseWhere: any = { deletedAt: null };

    if (!isOrderStaff(caller.type)) {
      baseWhere.userId = caller.id;
    }
    
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
              driver: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  contactNumber: true,
                  status: true,
                  deletedAt: true,
                },
              },
            },
          },
          user: {
            include: {
              userAddresses: {
                where: { address: { deletedAt: null } },
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
              driver: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  contactNumber: true,
                  status: true,
                  deletedAt: true,
                },
              },
            },
          },
          user: {
            include: {
              userAddresses: {
                where: { address: { deletedAt: null } },
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

    const response = NextResponse.json({
      orders: paginatedOrders,
      totalCount: allOrders.length,
      hasMore: allOrders.length > (skip + take),
    });
    response.headers.set('Cache-Control', 'private, max-age=60');
    return response;

  } catch (error: any) {
    // Full detail goes to the server log only; the client gets a generic message.
    logOrdersRouteError('Error fetching orders', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await withAuth(req, {
      allowedRoles: [...ORDER_CREATE_ALLOWED_ROLES],
      requireAuth: true,
    });
    if (!auth.success) {
      return authFailureResponse(auth, 'Forbidden - this account type cannot create orders');
    }
    const caller = auth.context.user;

    const body = await req.json();

    // Build the order only from the per-type allowlist. Anything else in the
    // body (status, userId, pricing columns, nested relation writes, ...) is
    // rejected here instead of being spread into the create.
    const parsed = parseCreateOrderBody(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error, issues: parsed.issues },
        { status: 400 }
      );
    }

    // Address IDs are only format-checked by the schema; make sure the caller
    // may actually use them before anything is written.
    const unusableAddressFields = await findUnusableAddressFields(
      caller.id,
      isOrderStaff(caller.type),
      parsed.data,
    );
    if (unusableAddressFields.length > 0) {
      return NextResponse.json(
        { error: 'Address not found', fields: unusableAddressFields },
        { status: 400 }
      );
    }

    // Generate order number
    const orderNumber = generateOrderNumber();
    
    // Use transaction with proper typing
    const result = await prismaClient.$transaction(async (tx: Prisma.TransactionClient) => {
      // Server-owned fields are always set here, never taken from the body.
      const serverOwned = {
        orderNumber,
        userId: caller.id,
        status: 'PENDING' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const include = {
        pickupAddress: true,
        deliveryAddress: true,
        user: true,
      } as const;

      if (parsed.type === 'catering') {
        const cateringOrder = await tx.cateringRequest.create({
          data: { ...parsed.data, ...serverOwned },
          include,
        });

        return { order: cateringOrder, type: 'catering' };
      }

      const onDemandOrder = await tx.onDemand.create({
        data: { ...parsed.data, ...serverOwned },
        include,
      });

      return { order: onDemandOrder, type: 'ondemand' };
    });

    // Notifications moved outside transaction — an email failure must never
    // roll back a successful order create.
    runAfterResponse("delivery-notifications", () =>
      sendDeliveryNotifications({
        orderId: result.order.id,
        customerEmail: result.order.user.email,
      }),
    );

    // Admin order notification
    runAfterResponse("admin-order-notification", () =>
      notifyOrderCreated({
        orderId: result.order.id,
        orderType: result.type === "catering" ? "catering" : "on_demand",
        source: "orders_api",
      }),
    );

    // Invalidate vendor cache since new order affects metrics and order lists
    invalidateVendorCacheOnOrderCreate(caller.id, result.order.id);

    return NextResponse.json({
      success: true,
      order: result.order,
      type: result.type,
      message: 'Order created successfully',
    });

  } catch (error: any) {
    // Full detail goes to the server log only; the client gets a generic message.
    logOrdersRouteError('Error creating order', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}

function logOrdersRouteError(context: string, error: any): void {
  if (error && typeof error === 'object' && 'code' in error) {
    console.error(context, { code: error.code, message: error.message, meta: error.meta });
    return;
  }
  console.error(context, error);
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