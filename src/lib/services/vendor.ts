import { prisma } from "@/lib/db/prisma";
import { createClient } from "@/utils/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { notFound } from "next/navigation";
import { UserType } from "@/types/prisma";

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

// Helper function to get the current authenticated user's ID and type
export async function getCurrentUserInfo() {
  const user = await getCurrentUser();
  if (!user?.email) {
    return null;
  }

  const profile = await prisma.profile.findUnique({
    where: { email: user.email },
    select: { id: true, type: true }
  });

  return profile ? { id: profile.id, type: profile.type } : null;
}

// Enhanced vendor access check that considers both order ownership and creation
export async function checkVendorAccess() {
  const userInfo = await getCurrentUserInfo();
  if (!userInfo) {
    return { hasAccess: false, userInfo: null };
  }

  // Allow access for vendors, admins, super admins, and helpdesk
  const allowedTypes: UserType[] = [UserType.VENDOR, UserType.ADMIN, UserType.SUPER_ADMIN, UserType.HELPDESK];
  const hasAccess = allowedTypes.includes(userInfo.type);

  return { hasAccess, userInfo };
}

// Build where clause for order queries considering both ownership and creation
function buildOrderWhereClause(userId: string, userType: UserType) {
  const adminTypes = [UserType.ADMIN, UserType.SUPER_ADMIN, UserType.HELPDESK];
  
  if (userType === UserType.VENDOR) {
    // Vendors can only see orders they own (userId)
    // TODO: Add createdByUserId support when schema is updated
    return { userId: userId };
  } else if (adminTypes.includes(userType as any)) {
    // Admins can see all orders for now
    // TODO: Add createdByUserId filtering when schema is updated
    return {};
  } else {
    // Default: only orders they own
    return { userId: userId };
  }
}

// Get vendor's orders with enhanced access control
export async function getVendorOrders(limit = 10, page = 1) {
  const accessCheck = await checkVendorAccess();
  if (!accessCheck.hasAccess || !accessCheck.userInfo) {
    throw new Error("Unauthorized");
  }

  const { id: userId, type: userType } = accessCheck.userInfo;

  // Calculate offset for pagination
  const offset = (page - 1) * limit;

  // Build where clause based on user type and access rules
  const whereClause = buildOrderWhereClause(userId, userType);

  // Count total orders in DB for pagination
  const cateringCount = await prisma.cateringRequest.count({
    where: whereClause
  });
  const onDemandCount = await prisma.onDemand.count({
    where: whereClause
  });
  const totalCount = cateringCount + onDemandCount;

  // Fetch more records than needed to properly sort and paginate
  const fetchLimit = Math.max(limit * 10, 50); // Fetch more to ensure proper sorting

  // Fetch catering requests
  const cateringRequests = await prisma.cateringRequest.findMany({
    where: whereClause,
    include: {
      pickupAddress: true,
      deliveryAddress: true,
      user: {
        select: { name: true, email: true }
      }
    },
    orderBy: { pickupDateTime: 'desc' },
    take: fetchLimit
  });

  // Fetch on-demand requests
  const onDemandRequests = await prisma.onDemand.findMany({
    where: whereClause,
    include: {
      pickupAddress: true,
      deliveryAddress: true,
      user: {
        select: { name: true, email: true }
      }
    },
    orderBy: { pickupDateTime: 'desc' },
    take: fetchLimit
  });

  // Transform the data to a unified format
  // Note: Using any type temporarily due to Prisma client typing issues
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
      id: order.pickupAddress?.id || '',
      street1: order.pickupAddress?.street1 || '',
      street2: order.pickupAddress?.street2 || null,
      city: order.pickupAddress?.city || '',
      state: order.pickupAddress?.state || '',
      zip: order.pickupAddress?.zip || ''
    },
    deliveryAddress: {
      id: order.deliveryAddress?.id || '',
      street1: order.deliveryAddress?.street1 || '',
      street2: order.deliveryAddress?.street2 || null,
      city: order.deliveryAddress?.city || '',
      state: order.deliveryAddress?.state || '',
      zip: order.deliveryAddress?.zip || ''
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
      id: order.pickupAddress?.id || '',
      street1: order.pickupAddress?.street1 || '',
      street2: order.pickupAddress?.street2 || null,
      city: order.pickupAddress?.city || '',
      state: order.pickupAddress?.state || '',
      zip: order.pickupAddress?.zip || ''
    },
    deliveryAddress: {
      id: order.deliveryAddress?.id || '',
      street1: order.deliveryAddress?.street1 || '',
      street2: order.deliveryAddress?.street2 || null,
      city: order.deliveryAddress?.city || '',
      state: order.deliveryAddress?.state || '',
      zip: order.deliveryAddress?.zip || ''
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
    total: totalCount
  };
}

// Get vendor metrics with enhanced access control
export async function getVendorMetrics() {
  const accessCheck = await checkVendorAccess();
  if (!accessCheck.hasAccess || !accessCheck.userInfo) {
    throw new Error("Unauthorized");
  }

  const { id: userId, type: userType } = accessCheck.userInfo;

  // Build where clause based on user type and access rules
  const whereClause = buildOrderWhereClause(userId, userType);

  // Count active catering orders
  const activeCateringCount = await prisma.cateringRequest.count({
    where: {
      ...whereClause,
      status: "ACTIVE"
    }
  });

  // Count active on-demand orders
  const activeOnDemandCount = await prisma.onDemand.count({
    where: {
      ...whereClause,
      status: "ACTIVE"
    }
  });

  // Count completed catering orders
  const completedCateringCount = await prisma.cateringRequest.count({
    where: {
      ...whereClause,
      status: "COMPLETED"
    }
  });

  // Count completed on-demand orders
  const completedOnDemandCount = await prisma.onDemand.count({
    where: {
      ...whereClause,
      status: "COMPLETED"
    }
  });

  // Count cancelled catering orders
  const cancelledCateringCount = await prisma.cateringRequest.count({
    where: {
      ...whereClause,
      status: "CANCELLED"
    }
  });

  // Count cancelled on-demand orders
  const cancelledOnDemandCount = await prisma.onDemand.count({
    where: {
      ...whereClause,
      status: "CANCELLED"
    }
  });

  // Count pending catering orders
  const pendingCateringCount = await prisma.cateringRequest.count({
    where: {
      ...whereClause,
      status: "PENDING"
    }
  });

  // Count pending on-demand orders
  const pendingOnDemandCount = await prisma.onDemand.count({
    where: {
      ...whereClause,
      status: "PENDING"
    }
  });

  // Calculate total revenue from catering orders
  const cateringRevenue = await prisma.cateringRequest.aggregate({
    where: {
      ...whereClause,
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
      ...whereClause,
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
      ...whereClause,
      createdAt: {
        gte: thirtyDaysAgo
      }
    }
  }) + await prisma.onDemand.count({
    where: {
      ...whereClause,
      createdAt: {
        gte: thirtyDaysAgo
      }
    }
  });

  const previousOrders = await prisma.cateringRequest.count({
    where: {
      ...whereClause,
      createdAt: {
        gte: sixtyDaysAgo,
        lt: thirtyDaysAgo
      }
    }
  }) + await prisma.onDemand.count({
    where: {
      ...whereClause,
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

// Get order by order number with enhanced access control
export async function getOrderByNumber(orderNumber: string) {
  const accessCheck = await checkVendorAccess();
  if (!accessCheck.hasAccess || !accessCheck.userInfo) {
    throw new Error("Unauthorized");
  }

  const { id: userId, type: userType } = accessCheck.userInfo;

  // Build where clause based on user type and access rules
  const whereClause = {
    orderNumber: orderNumber,
    ...buildOrderWhereClause(userId, userType)
  };

  // Try to find it in catering requests first
  const cateringRequest = await prisma.cateringRequest.findFirst({
    where: whereClause,
    include: {
      pickupAddress: true,
      deliveryAddress: true,
      user: {
        select: { name: true, email: true }
      }
    }
  });

  if (cateringRequest) {
    const order = cateringRequest as any; // Type assertion for address relations
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      orderType: "catering",
      status: order.status,
      pickupDateTime: order.pickupDateTime?.toISOString() || "",
      arrivalDateTime: order.arrivalDateTime?.toISOString() || "",
      completeDateTime: order.completeDateTime?.toISOString() || null,
      orderTotal: Number(order.orderTotal) || 0,
      tip: Number(order.tip) || 0,
      clientAttention: order.clientAttention,
      pickupAddress: {
        id: order.pickupAddress?.id || '',
        street1: order.pickupAddress?.street1 || '',
        street2: order.pickupAddress?.street2 || null,
        city: order.pickupAddress?.city || '',
        state: order.pickupAddress?.state || '',
        zip: order.pickupAddress?.zip || ''
      },
      deliveryAddress: {
        id: order.deliveryAddress?.id || '',
        street1: order.deliveryAddress?.street1 || '',
        street2: order.deliveryAddress?.street2 || null,
        city: order.deliveryAddress?.city || '',
        state: order.deliveryAddress?.state || '',
        zip: order.deliveryAddress?.zip || ''
      }
    };
  }

  // Try to find it in on-demand requests
  const onDemandRequest = await prisma.onDemand.findFirst({
    where: whereClause,
    include: {
      pickupAddress: true,
      deliveryAddress: true,
      user: {
        select: { name: true, email: true }
      }
    }
  });

  if (onDemandRequest) {
    const order = onDemandRequest as any; // Type assertion for address relations
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      orderType: "on_demand",
      status: order.status,
      pickupDateTime: order.pickupDateTime?.toISOString() || "",
      arrivalDateTime: order.arrivalDateTime?.toISOString() || "",
      completeDateTime: order.completeDateTime?.toISOString() || null,
      orderTotal: Number(order.orderTotal) || 0,
      tip: Number(order.tip) || 0,
      clientAttention: order.clientAttention,
      pickupAddress: {
        id: order.pickupAddress?.id || '',
        street1: order.pickupAddress?.street1 || '',
        street2: order.pickupAddress?.street2 || null,
        city: order.pickupAddress?.city || '',
        state: order.pickupAddress?.state || '',
        zip: order.pickupAddress?.zip || ''
      },
      deliveryAddress: {
        id: order.deliveryAddress?.id || '',
        street1: order.deliveryAddress?.street1 || '',
        street2: order.deliveryAddress?.street2 || null,
        city: order.deliveryAddress?.city || '',
        state: order.deliveryAddress?.state || '',
        zip: order.deliveryAddress?.zip || ''
      }
    };
  }

  return null;
}

// Legacy function for backward compatibility
export async function getCurrentUserId() {
  const userInfo = await getCurrentUserInfo();
  return userInfo ? userInfo.id : null;
} 