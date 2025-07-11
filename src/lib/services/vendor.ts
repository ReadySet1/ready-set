import { prisma } from "@/lib/db/prisma";
import { createClient } from "@/utils/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { Prisma } from "@prisma/client";
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

  const profile = await prisma.profile.findUnique({
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

  const profile = await prisma.profile.findUnique({
    where: { email: user.email },
    select: { id: true, type: true }
  });

  if (!profile || profile.type !== 'VENDOR') {
    return false;
  }

  return true;
}

// Get vendor's orders
export async function getVendorOrders(limit = 10, page = 1) {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  // Calculate offset for pagination
  const offset = (page - 1) * limit;

  // Fetch more records than needed to properly sort and paginate
  const fetchLimit = Math.max(limit * 10, 50); // Fetch more to ensure proper sorting

  // Fetch catering requests
  const cateringRequests = await prisma.cateringRequest.findMany({
    where: {
      userId: userId
    },
    include: {
      pickupAddress: true,
      deliveryAddress: true,
    },
    orderBy: { pickupDateTime: 'desc' },
    take: fetchLimit
  });

  // Fetch on-demand requests
  const onDemandRequests = await prisma.onDemand.findMany({
    where: {
      userId: userId
    },
    include: {
      pickupAddress: true,
      deliveryAddress: true,
    },
    orderBy: { pickupDateTime: 'desc' },
    take: fetchLimit
  });

  // Transform the data to a unified format
  const cateringOrders: OrderData[] = cateringRequests.map((order: any) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    orderType: "catering",
    status: order.status,
    pickupDateTime: order.pickupDateTime?.toISOString() || new Date().toISOString(),
    arrivalDateTime: order.arrivalDateTime?.toISOString() || "",
    completeDateTime: order.completeDateTime?.toISOString() || null,
    orderTotal: Number(order.orderTotal) || 0,
    tip: Number(order.tip) || 0,
    clientAttention: order.clientAttention,
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
    orderNumber: order.orderNumber,
    orderType: "on_demand",
    status: order.status,
    pickupDateTime: order.pickupDateTime?.toISOString() || new Date().toISOString(),
    arrivalDateTime: order.arrivalDateTime?.toISOString() || "",
    completeDateTime: order.completeDateTime?.toISOString() || null,
    orderTotal: Number(order.orderTotal) || 0,
    tip: Number(order.tip) || 0,
    clientAttention: order.clientAttention,
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
  const allOrders = [...cateringOrders, ...onDemandOrders]
    .sort((a, b) => new Date(b.pickupDateTime).getTime() - new Date(a.pickupDateTime).getTime());

  // Get one extra order to check if there are more pages
  const requestedOrders = allOrders.slice(offset, offset + limit + 1);
  
  // Return the requested number of orders and hasMore flag
  return {
    orders: requestedOrders.slice(0, limit),
    hasMore: requestedOrders.length > limit,
    total: allOrders.length
  };
}

// Get vendor metrics
export async function getVendorMetrics() {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  // Count active catering orders
  const activeCateringCount = await prisma.cateringRequest.count({
    where: {
      userId: userId,
      status: "ACTIVE"
    }
  });

  // Count active on-demand orders
  const activeOnDemandCount = await prisma.onDemand.count({
    where: {
      userId: userId,
      status: "ACTIVE"
    }
  });

  // Count completed catering orders
  const completedCateringCount = await prisma.cateringRequest.count({
    where: {
      userId: userId,
      status: "COMPLETED"
    }
  });

  // Count completed on-demand orders
  const completedOnDemandCount = await prisma.onDemand.count({
    where: {
      userId: userId,
      status: "COMPLETED"
    }
  });

  // Count cancelled catering orders
  const cancelledCateringCount = await prisma.cateringRequest.count({
    where: {
      userId: userId,
      status: "CANCELLED"
    }
  });

  // Count cancelled on-demand orders
  const cancelledOnDemandCount = await prisma.onDemand.count({
    where: {
      userId: userId,
      status: "CANCELLED"
    }
  });

  // Count pending catering orders
  const pendingCateringCount = await prisma.cateringRequest.count({
    where: {
      userId: userId,
      status: "PENDING"
    }
  });

  // Count pending on-demand orders
  const pendingOnDemandCount = await prisma.onDemand.count({
    where: {
      userId: userId,
      status: "PENDING"
    }
  });

  // Calculate total revenue from catering orders
  const cateringRevenue = await prisma.cateringRequest.aggregate({
    where: {
      userId: userId,
      status: "COMPLETED"
    },
    _sum: {
      orderTotal: true,
      tip: true
    }
  });

  // Calculate total revenue from on-demand orders
  const onDemandRevenue = await prisma.onDemand.aggregate({
    where: {
      userId: userId,
      status: "COMPLETED"
    },
    _sum: {
      orderTotal: true,
      tip: true
    }
  });

  const totalRevenue = 
    Number(cateringRevenue._sum.orderTotal || 0) + 
    Number(cateringRevenue._sum.tip || 0) +
    Number(onDemandRevenue._sum.orderTotal || 0) + 
    Number(onDemandRevenue._sum.tip || 0);

  // Calculate order growth (simplified - comparing last 30 days vs previous 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  const recentOrders = await prisma.cateringRequest.count({
    where: {
      userId: userId,
      createdAt: {
        gte: thirtyDaysAgo
      }
    }
  }) + await prisma.onDemand.count({
    where: {
      userId: userId,
      createdAt: {
        gte: thirtyDaysAgo
      }
    }
  });

  const previousOrders = await prisma.cateringRequest.count({
    where: {
      userId: userId,
      createdAt: {
        gte: sixtyDaysAgo,
        lt: thirtyDaysAgo
      }
    }
  }) + await prisma.onDemand.count({
    where: {
      userId: userId,
      createdAt: {
        gte: sixtyDaysAgo,
        lt: thirtyDaysAgo
      }
    }
  });

  const orderGrowth = previousOrders > 0 
    ? ((recentOrders - previousOrders) / previousOrders) * 100 
    : 0;

  return {
    activeOrders: activeCateringCount + activeOnDemandCount,
    completedOrders: completedCateringCount + completedOnDemandCount,
    cancelledOrders: cancelledCateringCount + cancelledOnDemandCount,
    pendingOrders: pendingCateringCount + pendingOnDemandCount,
    totalRevenue,
    orderGrowth
  };
}

// Get order by order number
export async function getOrderByNumber(orderNumber: string) {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  // Try to find it in catering requests first
  const cateringRequest = await prisma.cateringRequest.findFirst({
    where: {
      orderNumber: orderNumber,
      userId: userId
    },
    include: {
      pickupAddress: true,
      deliveryAddress: true,
    }
  });

  if (cateringRequest) {
    return {
      id: cateringRequest.id,
      orderNumber: cateringRequest.orderNumber,
      orderType: "catering",
      status: cateringRequest.status,
      pickupDateTime: cateringRequest.pickupDateTime?.toISOString() || "",
      arrivalDateTime: cateringRequest.arrivalDateTime?.toISOString() || "",
      completeDateTime: cateringRequest.completeDateTime?.toISOString() || null,
      orderTotal: Number(cateringRequest.orderTotal) || 0,
      tip: Number(cateringRequest.tip) || 0,
      clientAttention: cateringRequest.clientAttention,
      pickupAddress: {
        id: cateringRequest.pickupAddress.id,
        street1: cateringRequest.pickupAddress.street1,
        street2: cateringRequest.pickupAddress.street2,
        city: cateringRequest.pickupAddress.city,
        state: cateringRequest.pickupAddress.state,
        zip: cateringRequest.pickupAddress.zip
      },
      deliveryAddress: {
        id: cateringRequest.deliveryAddress.id,
        street1: cateringRequest.deliveryAddress.street1,
        street2: cateringRequest.deliveryAddress.street2,
        city: cateringRequest.deliveryAddress.city,
        state: cateringRequest.deliveryAddress.state,
        zip: cateringRequest.deliveryAddress.zip
      }
    };
  }

  // Try to find it in on-demand requests
  const onDemandRequest = await prisma.onDemand.findFirst({
    where: {
      orderNumber: orderNumber,
      userId: userId
    },
    include: {
      pickupAddress: true,
      deliveryAddress: true,
    }
  });

  if (onDemandRequest) {
    return {
      id: onDemandRequest.id,
      orderNumber: onDemandRequest.orderNumber,
      orderType: "on_demand",
      status: onDemandRequest.status,
      pickupDateTime: onDemandRequest.pickupDateTime?.toISOString() || "",
      arrivalDateTime: onDemandRequest.arrivalDateTime?.toISOString() || "",
      completeDateTime: onDemandRequest.completeDateTime?.toISOString() || null,
      orderTotal: Number(onDemandRequest.orderTotal) || 0,
      tip: Number(onDemandRequest.tip) || 0,
      clientAttention: onDemandRequest.clientAttention,
      pickupAddress: {
        id: onDemandRequest.pickupAddress.id,
        street1: onDemandRequest.pickupAddress.street1,
        street2: onDemandRequest.pickupAddress.street2,
        city: onDemandRequest.pickupAddress.city,
        state: onDemandRequest.pickupAddress.state,
        zip: onDemandRequest.pickupAddress.zip
      },
      deliveryAddress: {
        id: onDemandRequest.deliveryAddress.id,
        street1: onDemandRequest.deliveryAddress.street1,
        street2: onDemandRequest.deliveryAddress.street2,
        city: onDemandRequest.deliveryAddress.city,
        state: onDemandRequest.deliveryAddress.state,
        zip: onDemandRequest.deliveryAddress.zip
      }
    };
  }

  return null;
} 