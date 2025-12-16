import React, { Suspense } from "react";
import Breadcrumb from "@/components/Common/Breadcrumb";
import {
  Calendar,
  Clock,
  Truck,
  MapPin,
  MessageSquare,
  PlusCircle,
  User,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { withDatabaseRetry } from "@/utils/prismaDB";
import { redirect } from "next/navigation";
import {
  CateringStatus,
  OnDemandStatus,
  OrderStatus,
  getStatusColorClasses,
} from "@/types/order-status";
import { CombinedOrder } from "@/types/models";
import { Prisma } from "@prisma/client";
import { CateringRequest, OnDemand, Decimal, UserType } from "@/types/prisma";
import {
  DashboardCardSkeleton,
  OrderCardSkeleton,
  QuickActionsSkeleton,
} from "@/components/Skeleton/AuthSkeleton";

interface DashboardStats {
  activeOrders: number;
  completedOrders: number;
  pendingOrders: number;
  cancelledOrders: number;
  savedLocations: number;
}

interface ClientDashboardData {
  recentOrders: CombinedOrder[];
  stats: DashboardStats;
}

// Add this utility function at the top level
function convertToUTC(date: string, time: string): string {
  // Parse the local date and time
  const [yearStr, monthStr, dayStr] = date.split("-");
  const [hoursStr, minutesStr] = time.split(":");

  // Convert to numbers with defaults if parsing fails
  const year = yearStr ? parseInt(yearStr, 10) : 0;
  const month = monthStr ? parseInt(monthStr, 10) : 1;
  const day = dayStr ? parseInt(dayStr, 10) : 1;
  const hours = hoursStr ? parseInt(hoursStr, 10) : 0;
  const minutes = minutesStr ? parseInt(minutesStr, 10) : 0;

  // Create a date object in the local timezone
  const localDate = new Date(year, month - 1, day, hours, minutes);

  // Convert to UTC
  const utcYear = localDate.getUTCFullYear();
  const utcMonth = (localDate.getUTCMonth() + 1).toString().padStart(2, "0");
  const utcDay = localDate.getUTCDate().toString().padStart(2, "0");
  const utcHours = localDate.getUTCHours().toString().padStart(2, "0");
  const utcMinutes = localDate.getUTCMinutes().toString().padStart(2, "0");

  // Return ISO string
  return `${utcYear}-${utcMonth}-${utcDay}T${utcHours}:${utcMinutes}:00.000Z`;
}

// Update the formatDateTime function in getClientDashboardData
const formatDateTime = (date: string, time: string | null | undefined) => {
  if (!date || !time) return null;

  // Validate time format
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(time)) {
    throw new Error(
      `Invalid time format: ${time}. Please use HH:MM format (24-hour).`,
    );
  }

  try {
    // Convert the local date/time to UTC
    return convertToUTC(date, time);
  } catch (error) {
    console.error("Date/time parsing error:", { date, time, error });
    throw new Error(
      `Invalid date/time format: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

// Data fetching function with database retry logic
async function getClientDashboardData(
  userId: string,
): Promise<ClientDashboardData> {
  // Fetch recent orders with retry logic to handle prepared statement errors
  const [recentCateringOrders, recentOnDemandOrders] = await withDatabaseRetry(
    async () => {
      return Promise.all([
        // Fetch recent catering orders
        prisma.cateringRequest.findMany({
          where: {
            userId,
            deletedAt: null,
          },
          orderBy: { createdAt: "desc" },
          take: 3,
          select: {
            id: true,
            orderNumber: true,
            status: true,
            pickupDateTime: true,
            arrivalDateTime: true,
            orderTotal: true,
          },
        }),

        // Fetch recent on-demand orders
        prisma.onDemand.findMany({
          where: {
            userId,
            deletedAt: null,
          },
          orderBy: { createdAt: "desc" },
          take: 3,
          select: {
            id: true,
            orderNumber: true,
            status: true,
            pickupDateTime: true,
            arrivalDateTime: true,
            orderTotal: true,
          },
        }),
      ]);
    },
  );

  // Combine and sort orders
  const combinedOrders: CombinedOrder[] = [
    ...recentCateringOrders.map(
      (order: {
        id: string;
        orderNumber: string;
        status: CateringRequest["status"];
        pickupDateTime: Date | null;
        arrivalDateTime: Date | null;
        orderTotal: Decimal | null;
      }) => ({
        ...order,
        orderType: "catering" as const,
        orderTotal: order.orderTotal ? Number(order.orderTotal) : null,
        status: order.status.toString(),
      }),
    ),
    ...recentOnDemandOrders.map(
      (order: {
        id: string;
        orderNumber: string;
        status: OnDemand["status"];
        pickupDateTime: Date;
        arrivalDateTime: Date;
        orderTotal: Decimal | null;
      }) => ({
        ...order,
        orderType: "on_demand" as const,
        orderTotal: order.orderTotal ? Number(order.orderTotal) : null,
        status: order.status.toString(),
      }),
    ),
  ]
    .sort(
      (a, b) =>
        (b.pickupDateTime?.getTime() ?? 0) - (a.pickupDateTime?.getTime() ?? 0),
    )
    .slice(0, 3);

  // Get stats with simplified retry logic to avoid nested retries
  const stats = await withDatabaseRetry(
    async () => {
      // Execute all count queries in parallel without nested retries
      const [
        activeCateringCount,
        activeOnDemandCount,
        completedCateringCount,
        completedOnDemandCount,
        pendingCateringCount,
        pendingOnDemandCount,
        cancelledCateringCount,
        cancelledOnDemandCount,
        savedLocationsCount,
      ] = await Promise.all([
        prisma.cateringRequest.count({
          where: {
            userId,
            status: {
              in: [CateringStatus.ACTIVE, CateringStatus.ASSIGNED],
            },
            deletedAt: null,
          },
        }),

        prisma.onDemand.count({
          where: {
            userId,
            status: {
              in: [OnDemandStatus.ACTIVE, OnDemandStatus.ASSIGNED],
            },
            deletedAt: null,
          },
        }),

        prisma.cateringRequest.count({
          where: {
            userId,
            status: CateringStatus.COMPLETED,
            deletedAt: null,
          },
        }),

        prisma.onDemand.count({
          where: {
            userId,
            status: OnDemandStatus.COMPLETED,
            deletedAt: null,
          },
        }),

        prisma.cateringRequest.count({
          where: {
            userId,
            status: CateringStatus.PENDING,
            deletedAt: null,
          },
        }),

        prisma.onDemand.count({
          where: {
            userId,
            status: OnDemandStatus.PENDING,
            deletedAt: null,
          },
        }),

        prisma.cateringRequest.count({
          where: {
            userId,
            status: CateringStatus.CANCELLED,
            deletedAt: null,
          },
        }),

        prisma.onDemand.count({
          where: {
            userId,
            status: OnDemandStatus.CANCELLED,
            deletedAt: null,
          },
        }),

        prisma.userAddress.count({
          where: { userId },
        }),
      ]);

      return {
        activeCateringCount,
        activeOnDemandCount,
        completedCateringCount,
        completedOnDemandCount,
        pendingCateringCount,
        pendingOnDemandCount,
        cancelledCateringCount,
        cancelledOnDemandCount,
        savedLocationsCount,
      };
    },
    3,
    "client dashboard stats",
  );

  return {
    recentOrders: combinedOrders,
    stats: {
      activeOrders:
        (stats.activeCateringCount ?? 0) + (stats.activeOnDemandCount ?? 0),
      completedOrders:
        (stats.completedCateringCount ?? 0) +
        (stats.completedOnDemandCount ?? 0),
      pendingOrders:
        (stats.pendingCateringCount ?? 0) + (stats.pendingOnDemandCount ?? 0),
      cancelledOrders:
        (stats.cancelledCateringCount ?? 0) +
        (stats.cancelledOnDemandCount ?? 0),
      savedLocations: stats.savedLocationsCount ?? 0,
    },
  };
}

const UpcomingOrderCard = ({ order }: { order: CombinedOrder }) => {
  // Use the shared helper function for status colors
  const statusColor = getStatusColorClasses(order.status as OrderStatus);

  const formatDate = (date: Date | null) => {
    if (!date) return "N/A";

    // Create a date object and convert to local time
    const localDate = new Date(date);
    return localDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "America/Los_Angeles",
    });
  };

  const formatTime = (date: Date | null) => {
    if (!date) return "N/A";

    // Create a date object and convert to local time
    const localDate = new Date(date);
    return localDate.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Los_Angeles",
      hour12: true,
    });
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return "$0.00";
    return `$${Number(amount).toFixed(2)}`;
  };

  // Determine the correct route based on order number to the unified Order Dashboard
  const orderDetailsLink = `/order-status/${encodeURIComponent(order.orderNumber)}`;

  return (
    <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-3 flex items-start justify-between">
        <h4 className="font-semibold text-gray-900">{order.orderNumber}</h4>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor}`}
        >
          {order.status.toLowerCase().replace("_", " ")}
        </span>
      </div>

      <div className="mb-2 flex items-center text-sm text-gray-500">
        <Calendar className="mr-1.5 h-4 w-4" />
        <span>{formatDate(order.pickupDateTime)}</span>
      </div>

      <div className="mb-2 flex items-center text-sm text-gray-500">
        <Clock className="mr-1.5 h-4 w-4" />
        <span>Pickup: {formatTime(order.pickupDateTime)}</span>
      </div>

      <div className="mb-3 flex items-center text-sm text-gray-500">
        <Clock className="mr-1.5 h-4 w-4" />
        <span>Arrival: {formatTime(order.arrivalDateTime)}</span>
      </div>

      <div className="flex items-center justify-between border-t border-gray-100 pt-2">
        <span className="text-sm font-medium">
          {formatCurrency(order.orderTotal)}
        </span>
        <Link
          href={orderDetailsLink}
          className="text-sm font-medium text-primary hover:underline"
        >
          View Details
        </Link>
      </div>
    </div>
  );
};

// Skeleton loading component for the full dashboard
const ClientDashboardSkeleton: React.FC = () => (
  <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
    {/* Stats Section Skeleton */}
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:col-span-3 lg:grid-cols-5">
      <DashboardCardSkeleton />
      <DashboardCardSkeleton />
      <DashboardCardSkeleton />
      <DashboardCardSkeleton />
      <DashboardCardSkeleton />
    </div>

    {/* Recent Orders Section Skeleton */}
    <div className="overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm md:col-span-2">
      <div className="border-b border-gray-100 p-5">
        <div className="flex items-center justify-between">
          <div className="h-6 w-32 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
        </div>
      </div>

      <div className="p-5">
        <div className="space-y-4">
          <OrderCardSkeleton />
          <OrderCardSkeleton />
          <OrderCardSkeleton />
        </div>
      </div>
    </div>

    {/* Quick Actions Section Skeleton */}
    <div className="overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm">
      <div className="border-b border-gray-100 p-5">
        <div className="h-6 w-28 animate-pulse rounded bg-gray-200" />
      </div>

      <div className="p-5">
        <QuickActionsSkeleton />
      </div>
    </div>
  </div>
);

const ClientDashboardContent = ({ data }: { data: ClientDashboardData }) => {
  const hasRecentOrders = data.recentOrders.length > 0;

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {/* Stats Section */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:col-span-3 lg:grid-cols-5">
        <div className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center">
            <div className="bg-primary-lighter mr-4 rounded-lg p-3">
              <Truck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Active Orders</p>
              <h4 className="text-2xl font-bold text-gray-900">
                {data.stats.activeOrders}
              </h4>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center">
            <div className="mr-4 rounded-lg bg-yellow-50 p-3">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Pending</p>
              <h4 className="text-2xl font-bold text-gray-900">
                {data.stats.pendingOrders}
              </h4>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center">
            <div className="mr-4 rounded-lg bg-green-50 p-3">
              <Calendar className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Completed</p>
              <h4 className="text-2xl font-bold text-gray-900">
                {data.stats.completedOrders}
              </h4>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center">
            <div className="mr-4 rounded-lg bg-red-50 p-3">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Cancelled</p>
              <h4 className="text-2xl font-bold text-gray-900">
                {data.stats.cancelledOrders}
              </h4>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center">
            <div className="mr-4 rounded-lg bg-purple-50 p-3">
              <MapPin className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Saved Locations</p>
              <h4 className="text-2xl font-bold text-gray-900">
                {data.stats.savedLocations}
              </h4>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Orders Section */}
      <div className="overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm md:col-span-2">
        <div className="border-b border-gray-100 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Recent Orders
            </h3>
            <Link
              href="/client/orders"
              className="text-sm font-medium text-primary hover:underline"
            >
              View All
            </Link>
          </div>
        </div>

        <div className="p-5">
          {hasRecentOrders ? (
            <div className="space-y-4">
              {data.recentOrders.map((order) => (
                <UpcomingOrderCard
                  key={`${order.orderType}-${order.id}`}
                  order={order}
                />
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="mb-4 text-gray-500">
                You haven't placed any orders yet
              </p>
              <Link
                href="/catering-request"
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-center font-medium text-white hover:bg-opacity-90"
              >
                <PlusCircle className="mr-1.5 h-5 w-5" />
                Place Your First Order
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions Section */}
      <div className="overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-5">
          <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
        </div>

        <div className="p-5">
          <div className="space-y-4">
            <Link
              href="/catering-request"
              className="flex items-center rounded-lg border border-gray-100 p-3 transition-colors hover:bg-gray-50"
            >
              <div className="bg-primary-lighter mr-3 rounded-md p-2">
                <PlusCircle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900">New Catering Order</h4>
                <p className="text-xs text-gray-500">
                  Schedule a catering delivery
                </p>
              </div>
            </Link>

            <Link
              href="/client/orders/new"
              className="flex items-center rounded-lg border border-gray-100 p-3 transition-colors hover:bg-gray-50"
            >
              <div className="mr-3 rounded-md bg-emerald-50 p-2">
                <Truck className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900">New On-Demand Order</h4>
                <p className="text-xs text-gray-500">
                  Request immediate delivery
                </p>
              </div>
            </Link>

            <Link
              href="/addresses"
              className="flex items-center rounded-lg border border-gray-100 p-3 transition-colors hover:bg-gray-50"
            >
              <div className="mr-3 rounded-md bg-blue-50 p-2">
                <MapPin className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Manage Addresses</h4>
                <p className="text-xs text-gray-500">
                  Add or edit your locations
                </p>
              </div>
            </Link>

            <Link
              href="/profile"
              className="flex items-center rounded-lg border border-gray-100 p-3 transition-colors hover:bg-gray-50"
            >
              <div className="mr-3 rounded-md bg-purple-50 p-2">
                <User className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Update Profile</h4>
                <p className="text-xs text-gray-500">
                  Manage your account details
                </p>
              </div>
            </Link>

            <Link
              href="/contact"
              className="flex items-center rounded-lg border border-gray-100 p-3 transition-colors hover:bg-gray-50"
            >
              <div className="mr-3 rounded-md bg-orange-50 p-2">
                <MessageSquare className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Contact Us</h4>
                <p className="text-xs text-gray-500">
                  Get in touch with our team
                </p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

const ClientPage = async () => {
  const user = await getCurrentUser();

  if (!user?.id) {
    redirect("/sign-in");
  }

  // Server-side session validation: Ensure user has proper role before rendering
  const userRole = user.role;

  // Add role detection logic for dynamic dashboard title
  const dashboardTitle =
    userRole?.toUpperCase() === "VENDOR"
      ? "Vendor Dashboard"
      : "Client Dashboard";

  if (!userRole) {
    console.error("No user role found for authenticated user:", user.id);
    redirect("/sign-in?error=Profile+not+found");
  }

  // Validate user has CLIENT or VENDOR role for unified dashboard access
  const isAllowedRole =
    userRole.toUpperCase() === UserType.CLIENT ||
    userRole.toUpperCase() === UserType.VENDOR;

  if (!isAllowedRole) {
        // Redirect to their appropriate dashboard based on role
    const roleRoutes: Record<string, string> = {
      admin: "/admin",
      super_admin: "/admin",
      driver: "/driver",
      helpdesk: "/helpdesk",
    };

    const redirectPath = roleRoutes[userRole.toLowerCase()] || "/sign-in";
    redirect(redirectPath);
  }

  // Fetch dashboard data
  const dashboardData = await getClientDashboardData(user.id);

  return (
    <>
      <Breadcrumb
        pageName={dashboardTitle}
        pageDescription="Manage your account"
      />
      <div className="shadow-default dark:border-strokedark dark:bg-boxdark sm:p-7.5 rounded-sm border border-stroke bg-white p-5">
        <div className="max-w-full">
          <h2 className="text-title-md2 mb-2 font-bold text-black dark:text-white">
            Welcome back{user.email ? `, ${user.email.split("@")[0]}` : ""}!
          </h2>
          <p className="mb-8 text-body-color dark:text-gray-400">
            Track orders, manage your deliveries, and update your profile
            information.
          </p>

          <Suspense fallback={<ClientDashboardSkeleton />}>
            <ClientDashboardContent data={dashboardData} />
          </Suspense>
        </div>
      </div>
    </>
  );
};

export default ClientPage;
