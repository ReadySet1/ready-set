import React, { Suspense } from "react";
import Breadcrumb from "@/components/Common/Breadcrumb";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import { CateringStatus, OnDemandStatus } from "@/types/order-status";
import { CombinedOrder } from "@/types/models";
import { Prisma } from "@prisma/client";
import { CateringRequest, OnDemand, Decimal } from "@/types/prisma";
import { ClientDashboardContent } from "@/components/Dashboard/ClientDashboardContent";

interface DashboardStats {
  activeOrders: number;
  completedOrders: number;
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

// Data fetching function
async function getClientDashboardData(
  userId: string,
): Promise<ClientDashboardData> {
  // Fetch recent catering orders
  const recentCateringOrders = await prisma.cateringRequest.findMany({
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
  });

  // Fetch recent on-demand orders
  const recentOnDemandOrders = await prisma.onDemand.findMany({
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
  });

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

  // Get stats
  const [
    activeCateringCount,
    activeOnDemandCount,
    completedCateringCount,
    completedOnDemandCount,
    savedLocationsCount,
  ] = await Promise.all([
    prisma.cateringRequest.count({
      where: {
        userId,
        status: { in: [CateringStatus.ACTIVE, CateringStatus.ASSIGNED] },
        deletedAt: null,
      },
    }),
    prisma.onDemand.count({
      where: {
        userId,
        status: { in: [OnDemandStatus.ACTIVE, OnDemandStatus.ASSIGNED] },
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
    prisma.userAddress.count({
      where: { userId },
    }),
  ]);

  return {
    recentOrders: combinedOrders,
    stats: {
      activeOrders: activeCateringCount + activeOnDemandCount,
      completedOrders: completedCateringCount + completedOnDemandCount,
      savedLocations: savedLocationsCount,
    },
  };
}



const ClientPage = async () => {
  const user = await getCurrentUser();

  if (!user?.id) {
    redirect("/sign-in");
  }

  // Check if user is a client
  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { type: true }
  });

  if (!profile || profile.type !== 'CLIENT') {
    // Redirect to appropriate dashboard based on user type
    if (profile?.type === 'VENDOR') {
      redirect('/vendor');
    } else if (profile?.type === 'ADMIN' || profile?.type === 'HELPDESK' || profile?.type === 'SUPER_ADMIN') {
      redirect('/admin');
    } else {
      redirect('/sign-in');
    }
  }

  // Fetch dashboard data
  const dashboardData = await getClientDashboardData(user.id);

  return (
    <>
      <Breadcrumb
        pageName="Client Dashboard"
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

          <Suspense
            fallback={
              <div className="py-10 text-center">Loading dashboard...</div>
            }
          >
            <ClientDashboardContent data={dashboardData} />
          </Suspense>
        </div>
      </div>
    </>
  );
};

export default ClientPage;
