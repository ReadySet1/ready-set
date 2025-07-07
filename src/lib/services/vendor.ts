import { prisma } from "@/lib/db/prisma";
import { createClient } from "@/utils/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { CateringRequest, OnDemand, Decimal } from "@/types/prisma";
import { notFound } from "next/navigation";

// Custom types for cleaner data structure
export interface OrderData {
  id: string;
  orderNumber: string;
  orderType: "catering" | "on_demand";
  status: string;
  pickupDateTime: string;
  arrivalDateTime: string;
  completeDateTime?: string | null;
  orderTotal: number;
  tip?: number;
  clientAttention?: string | null;
  pickupAddress: {
    id: string;
    street1: string;
    street2?: string | null;
    city: string;
    state: string;
    zip: string;
  };
  deliveryAddress: {
    id: string;
    street1: string;
    street2?: string | null;
    city: string;
    state: string;
    zip: string;
  };
}

export interface VendorMetrics {
  activeOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  orderGrowth: number;
}

// Helper function to get the current authenticated user's ID
export async function getCurrentUserId() {
  const user = await getCurrentUser();
  if (!user?.email) {
    return null;
  }

  const profile = await prisma.user.findUnique({
    where: { email: user.email },
    select: { id: true, type: true }
  });

  return profile ? profile.id : null;
}

export async function checkVendorAccess() {
  const user = await getCurrentUser();
  if (!user?.email) {
    return false;
  }

  const profile = await prisma.user.findUnique({
    where: { email: user.email },
    select: { id: true, type: true }
  });

  if (!profile || profile.type !== 'vendor') {
    return false;
  }

  return true;
}

// Get vendor's orders
export async function getVendorOrders(limit = 10) {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  // Fetch catering requests
  const cateringRequests = await prisma.catering_request.findMany({
    where: {
      userId: userId,
      deletedAt: null
    },
    include: {
      pickupAddress: true,
      deliveryAddress: true,
    },
    orderBy: { pickupDateTime: 'desc' },
    take: limit
  });

  // Fetch on-demand requests
  const onDemandRequests = await prisma.on_demand.findMany({
    where: {
      userId: userId,
      deletedAt: null
    },
    include: {
      pickupAddress: true,
      deliveryAddress: true,
    },
    orderBy: { pickupDateTime: 'desc' },
    take: limit
  });

  // Transform the data to a unified format
  const cateringOrders: OrderData[] = cateringRequests.map((order: any) => ({
    id: order.id,
    orderNumber: order.order_number,
    orderType: "catering",
    status: order.status,
    pickupDateTime: order.pickup_time?.toISOString() || new Date().toISOString(),
    arrivalDateTime: order.arrival_time?.toISOString() || "",
    completeDateTime: order.complete_time?.toISOString() || null,
    orderTotal: Number(order.order_total) || 0,
    tip: Number(order.tip) || 0,
    clientAttention: order.client_attention,
    pickupAddress: {
      id: order.pickupAddress.id,
      street1: order.pickupAddress.street1,
      street2: order.pickupAddress.street2,
      city: order.pickupAddress.city,
      state: order.pickupAddress.state,
      zip: order.pickupAddress.zip
    },
    deliveryAddress: {
      id: order.deliveryAddress.id,
      street1: order.deliveryAddress.street1,
      street2: order.deliveryAddress.street2,
      city: order.deliveryAddress.city,
      state: order.deliveryAddress.state,
      zip: order.deliveryAddress.zip
    }
  }));

  const onDemandOrders: OrderData[] = onDemandRequests.map((order: any) => ({
    id: order.id,
    orderNumber: order.order_number,
    orderType: "on_demand",
    status: order.status,
    pickupDateTime: order.pickup_time?.toISOString() || new Date().toISOString(),
    arrivalDateTime: order.arrival_time?.toISOString() || "",
    completeDateTime: order.complete_time?.toISOString() || null,
    orderTotal: Number(order.order_total) || 0,
    tip: Number(order.tip) || 0,
    clientAttention: order.client_attention,
    pickupAddress: {
      id: order.pickupAddress.id,
      street1: order.pickupAddress.street1,
      street2: order.pickupAddress.street2,
      city: order.pickupAddress.city,
      state: order.pickupAddress.state,
      zip: order.pickupAddress.zip
    },
    deliveryAddress: {
      id: order.deliveryAddress.id,
      street1: order.deliveryAddress.street1,
      street2: order.deliveryAddress.street2,
      city: order.deliveryAddress.city,
      state: order.deliveryAddress.state,
      zip: order.deliveryAddress.zip
    }
  }));

  // Combine and sort all orders by pickup date
  return [...cateringOrders, ...onDemandOrders]
    .sort((a, b) => new Date(b.pickupDateTime).getTime() - new Date(a.pickupDateTime).getTime())
    .slice(0, limit);
}

// Get vendor metrics
export async function getVendorMetrics() {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  // Count active catering orders
  const activeCateringCount = await prisma.catering_request.count({
    where: {
      user_id: userId,
      status: "active",
      deleted_at: null
    }
  });

  // Count active on-demand orders
  const activeOnDemandCount = await prisma.on_demand.count({
    where: {
      user_id: userId,
      status: "active",
      deleted_at: null
    }
  });

  // Count completed catering orders
  const completedCateringCount = await prisma.catering_request.count({
    where: {
      user_id: userId,
      status: "completed",
      deleted_at: null
    }
  });

  // Count completed on-demand orders
  const completedOnDemandCount = await prisma.on_demand.count({
    where: {
      user_id: userId,
      status: "completed",
      deleted_at: null
    }
  });

  // Count cancelled catering orders
  const cancelledCateringCount = await prisma.catering_request.count({
    where: {
      user_id: userId,
      status: "cancelled",
      deleted_at: null
    }
  });

  // Count cancelled on-demand orders
  const cancelledOnDemandCount = await prisma.on_demand.count({
    where: {
      user_id: userId,
      status: "cancelled",
      deleted_at: null
    }
  });

  // Count assigned catering orders (treated as pending)
  const assignedCateringCount = await prisma.catering_request.count({
    where: {
      user_id: userId,
      status: "assigned",
      deleted_at: null
    }
  });

  // Count assigned on-demand orders (treated as pending)
  const assignedOnDemandCount = await prisma.on_demand.count({
    where: {
      user_id: userId,
      status: "assigned",
      deleted_at: null
    }
  });

  // Calculate total revenue from completed orders
  const completedOrders = await prisma.$queryRaw`
    SELECT 
      COALESCE(SUM(CAST("order_total" AS DECIMAL(10,2))), 0) as total 
    FROM 
      (
        SELECT "order_total" FROM "catering_requests" 
        WHERE "user_id" = ${userId}::uuid AND "status" = 'completed' AND "deleted_at" IS NULL
        UNION ALL
        SELECT "order_total" FROM "on_demand_requests" 
        WHERE "user_id" = ${userId}::uuid AND "status" = 'completed' AND "deleted_at" IS NULL
      ) as combined
  `;

  // Calculate order growth (comparing current month to previous month)
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  // Current month orders
  const currentMonthOrders = await prisma.$queryRaw`
    SELECT COUNT(*) as count
    FROM (
      SELECT id FROM "catering_requests" 
      WHERE "user_id" = ${userId}::uuid AND "created_at" >= ${currentMonthStart} AND "deleted_at" IS NULL
      UNION ALL
      SELECT id FROM "on_demand_requests" 
      WHERE "user_id" = ${userId}::uuid AND "created_at" >= ${currentMonthStart} AND "deleted_at" IS NULL
    ) as combined
  `;

  // Previous month orders
  const previousMonthOrders = await prisma.$queryRaw`
    SELECT COUNT(*) as count
    FROM (
      SELECT id FROM "catering_requests" 
      WHERE "user_id" = ${userId}::uuid AND "created_at" >= ${lastMonthStart} AND "created_at" < ${currentMonthStart} AND "deleted_at" IS NULL
      UNION ALL
      SELECT id FROM "on_demand_requests" 
      WHERE "user_id" = ${userId}::uuid AND "created_at" >= ${lastMonthStart} AND "created_at" < ${currentMonthStart} AND "deleted_at" IS NULL
    ) as combined
  `;

  // Calculate growth percentage
  const currentCount = Number((currentMonthOrders as any)[0]?.count || 0);
  const previousCount = Number((previousMonthOrders as any)[0]?.count || 0);
  
  let orderGrowth = 0;
  if (previousCount > 0) {
    orderGrowth = Math.round(((currentCount - previousCount) / previousCount) * 100);
  } else if (currentCount > 0) {
    orderGrowth = 100; // If there were 0 orders last month and some this month, that's 100% growth
  }

  // Combine all metrics
  return {
    activeOrders: activeCateringCount + activeOnDemandCount,
    completedOrders: completedCateringCount + completedOnDemandCount,
    cancelledOrders: cancelledCateringCount + cancelledOnDemandCount,
    pendingOrders: assignedCateringCount + assignedOnDemandCount,
    totalRevenue: Number((completedOrders as any)[0]?.total || 0),
    orderGrowth
  };
}

// Get a specific order by orderNumber
export async function getOrderByNumber(orderNumber: string) {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  // Try to find it in catering requests
  const cateringRequest = await prisma.catering_request.findFirst({
    where: {
      order_number: orderNumber,
      user_id: userId,
      deleted_at: null
    },
    include: {
      pickupAddress: true,
      deliveryAddress: true,
      dispatches: {
        include: {
          driver: true
        }
      },
      fileUploads: true
    }
  });

  if (cateringRequest) {
    return {
      id: cateringRequest.id,
      orderNumber: cateringRequest.order_number,
      orderType: "catering",
      status: cateringRequest.status,
      pickupDateTime: cateringRequest.pickup_time?.toISOString() || null,
      arrivalDateTime: cateringRequest.arrival_time?.toISOString() || null,
      completeDateTime: cateringRequest.complete_time?.toISOString() || null,
      orderTotal: Number(cateringRequest.order_total) || 0,
      tip: Number(cateringRequest.tip) || 0,
      brokerage: cateringRequest.brokerage,
      clientAttention: cateringRequest.client_attention,
      pickupNotes: cateringRequest.pickup_notes,
      specialNotes: cateringRequest.special_notes,
      headcount: cateringRequest.headcount,
      needHost: cateringRequest.need_host,
      hoursNeeded: cateringRequest.hours_needed,
      numberOfHosts: cateringRequest.number_of_hosts,
      image: cateringRequest.image,
      driverStatus: cateringRequest.driver_status,
      pickupAddress: cateringRequest.pickupAddress,
      deliveryAddress: cateringRequest.deliveryAddress,
      dispatches: cateringRequest.dispatches,
      fileUploads: cateringRequest.fileUploads
    };
  }

  // If not found in catering, try on-demand
  const onDemandRequest = await prisma.on_demand.findFirst({
    where: {
      order_number: orderNumber,
      user_id: userId,
      deleted_at: null
    },
    include: {
      pickupAddress: true,
      deliveryAddress: true,
      dispatches: {
        include: {
          driver: true
        }
      },
      fileUploads: true
    }
  });

  if (onDemandRequest) {
    return {
      id: onDemandRequest.id,
      orderNumber: onDemandRequest.order_number,
      orderType: "on_demand",
      status: onDemandRequest.status,
      pickupDateTime: onDemandRequest.pickup_time?.toISOString() || null,
      arrivalDateTime: onDemandRequest.arrival_time?.toISOString() || null,
      completeDateTime: onDemandRequest.complete_time?.toISOString() || null,
      orderTotal: Number(onDemandRequest.order_total) || 0,
      tip: Number(onDemandRequest.tip) || 0,
      clientAttention: onDemandRequest.client_attention,
      pickupNotes: onDemandRequest.pickup_notes,
      specialNotes: onDemandRequest.special_notes,
      hoursNeeded: onDemandRequest.hours_needed,
      vehicleType: onDemandRequest.vehicle_type,
      itemDelivered: onDemandRequest.item_delivered,
      image: onDemandRequest.image,
      driverStatus: onDemandRequest.driver_status,
      length: onDemandRequest.length,
      width: onDemandRequest.width,
      height: onDemandRequest.height,
      weight: onDemandRequest.weight,
      pickupAddress: onDemandRequest.pickupAddress,
      deliveryAddress: onDemandRequest.deliveryAddress,
      dispatches: onDemandRequest.dispatches,
      fileUploads: onDemandRequest.fileUploads
    };
  }

  // If order is not found in either table
  notFound();
} 