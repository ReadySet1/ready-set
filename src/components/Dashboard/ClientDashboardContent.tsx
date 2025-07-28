import React from "react";
import Link from "next/link";
import {
  Calendar,
  Clock,
  Truck,
  MapPin,
  MessageSquare,
  PlusCircle,
  User,
} from "lucide-react";
import { CombinedOrder } from "@/types/models";
import { getStatusColorClasses } from "@/types/order-status";
import { OrderStatus } from "@/types/order-status";

interface DashboardStats {
  activeOrders: number;
  completedOrders: number;
  savedLocations: number;
}

interface ClientDashboardData {
  recentOrders: CombinedOrder[];
  stats: DashboardStats;
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

  // Determine the correct route based on order type
  const orderDetailsLink =
    order.orderType === "catering"
      ? `/client/orders/${order.id}` // Update this path based on your routing structure
      : `/client/orders/${order.id}`; // Update this path based on your routing structure

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

export const ClientDashboardContent = ({ data }: { data: ClientDashboardData }) => {
  const hasRecentOrders = data.recentOrders.length > 0;

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {/* Stats Section */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:col-span-3 lg:grid-cols-3">
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
                <h4 className="font-medium text-gray-900">New Order</h4>
                <p className="text-xs text-gray-500">
                  Create a new delivery request
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