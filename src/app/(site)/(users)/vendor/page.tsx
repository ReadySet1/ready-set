"use client";

import React, { useState, useEffect } from "react";
import Breadcrumb from "@/components/Common/Breadcrumb";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  TrendingUp,
  CalendarDays,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { OrderData, VendorMetrics } from "@/lib/services/vendor";
import { AllOrdersModal } from "@/components/Orders/AllOrdersModal";
import { VendorDashboardErrorBoundary } from "@/components/ErrorBoundary/VendorDashboardErrorBoundary";

const VendorPageContent = () => {
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [metrics, setMetrics] = useState<VendorMetrics>({
    activeOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    pendingOrders: 0,
    totalRevenue: 0,
    orderGrowth: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllOrdersModal, setShowAllOrdersModal] = useState(false);
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [ordersPerPage] = useState(5); // Show 5 orders per page
  const [totalOrders, setTotalOrders] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPrevPage, setHasPrevPage] = useState(false);

  useEffect(() => {
    const fetchVendorData = async () => {
      try {
        setIsLoading(true);
        // Fetch orders and metrics in parallel
        const [ordersResponse, metricsResponse] = await Promise.all([
          fetch(
            `/api/vendor/orders?page=${currentPage}&limit=${ordersPerPage}`,
          ),
          fetch("/api/vendor/metrics"),
        ]);

        if (!ordersResponse.ok) {
          throw new Error(
            `Failed to fetch orders: ${ordersResponse.statusText}`,
          );
        }

        if (!metricsResponse.ok) {
          throw new Error(
            `Failed to fetch metrics: ${metricsResponse.statusText}`,
          );
        }

        const ordersData = await ordersResponse.json();
        const metricsData = await metricsResponse.json();

        setOrders(ordersData.orders);
        setMetrics(metricsData);

        // Update pagination state using the hasMore flag from the API
        setHasPrevPage(currentPage > 1);
        setHasNextPage(ordersData.hasMore);
        setTotalOrders(ordersData.total);
      } catch (error) {
        console.error("Error fetching vendor data:", error);
        setError("Failed to load dashboard data. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchVendorData();
  }, [currentPage, ordersPerPage]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Get badge style based on order status
  const getStatusBadge = (status: string) => {
    const statusMap: Record<
      string,
      {
        variant: "default" | "secondary" | "destructive" | "outline";
        label: string;
      }
    > = {
      ACTIVE: { variant: "default", label: "Active" },
      PENDING: { variant: "secondary", label: "Pending" },
      COMPLETED: { variant: "outline", label: "Completed" },
      ASSIGNED: { variant: "secondary", label: "Assigned" },
      CANCELLED: { variant: "destructive", label: "Cancelled" },
    };

    const statusConfig = statusMap[status] || {
      variant: "outline",
      label: status,
    };

    return <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>;
  };

  // Get badge for order type
  const getOrderTypeBadge = (type: string) => {
    return (
      <Badge
        variant="outline"
        className={
          type === "catering"
            ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
            : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
        }
      >
        {type === "catering" ? "Catering" : "On Demand"}
      </Badge>
    );
  };

  // Pagination handlers
  const handlePrevPage = () => {
    if (hasPrevPage) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (hasNextPage) {
      setCurrentPage(currentPage + 1);
    }
  };

  if (error) {
    throw new Error(error);
  }

  return (
    <>
      <Breadcrumb pageName="Vendor Dashboard" />
      <section className="relative py-6 md:py-8">
        <div className="absolute left-0 top-0 -z-[1] h-full w-full dark:bg-dark"></div>
        <div className="absolute left-0 top-0 -z-[1] h-1/2 w-full bg-[#E9F9FF] dark:bg-dark-700 lg:h-[45%] xl:h-1/2"></div>
        <div className="container px-4">
          {isLoading ? (
            <div className="flex min-h-[400px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Metrics Overview Cards */}
              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                {/* Active Orders */}
                <Card className="overflow-hidden">
                  <div className="h-1 bg-blue-500"></div>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="rounded-full bg-blue-50 p-3 text-blue-600">
                        <Clock className="h-5 w-5" />
                      </div>
                      <span className="flex items-center gap-1 text-xs text-green-600">
                        <TrendingUp className="h-3 w-3" /> Active now
                      </span>
                    </div>
                    <h3 className="mt-3 text-3xl font-bold">
                      {metrics.activeOrders}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">Active Orders</p>
                  </CardContent>
                </Card>

                {/* Completed Orders */}
                <Card className="overflow-hidden">
                  <div className="h-1 bg-green-500"></div>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="rounded-full bg-green-50 p-3 text-green-600">
                        <CheckCircle className="h-5 w-5" />
                      </div>
                      <span className="text-xs text-gray-500">
                        Last 30 days
                      </span>
                    </div>
                    <h3 className="mt-3 text-3xl font-bold">
                      {metrics.completedOrders}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Completed Orders
                    </p>
                  </CardContent>
                </Card>

                {/* Pending Orders */}
                <Card className="overflow-hidden">
                  <div className="h-1 bg-yellow-500"></div>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="rounded-full bg-yellow-50 p-3 text-yellow-600">
                        <CalendarDays className="h-5 w-5" />
                      </div>
                      <span className="flex items-center gap-1 text-xs text-yellow-600">
                        Needs attention
                      </span>
                    </div>
                    <h3 className="mt-3 text-3xl font-bold">
                      {metrics.pendingOrders}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">Pending Orders</p>
                  </CardContent>
                </Card>
              </div>

              {/* Orders Table */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Recent Orders</CardTitle>
                      <CardDescription>
                        Manage your recent and upcoming orders across the
                        platform
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        onClick={() => setShowAllOrdersModal(true)}
                      >
                        View All Orders
                      </Button>
                      <Button asChild>
                        <Link href="/catering-request">Create New Order</Link>
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {orders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <Package className="mb-4 h-16 w-16 text-gray-400" />
                      <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                        No Orders Found
                      </h3>
                      <p className="max-w-md text-gray-500 dark:text-gray-400">
                        There are no orders to display at the moment. Check back
                        later or create a new order.
                      </p>
                      <Button className="mt-4" asChild>
                        <Link href="/catering-request">Create New Order</Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Order Number</TableHead>
                            <TableHead className="hidden sm:table-cell">
                              Type
                            </TableHead>
                            <TableHead className="hidden sm:table-cell">
                              Status
                            </TableHead>
                            <TableHead className="hidden md:table-cell">
                              Pickup
                            </TableHead>
                            <TableHead className="hidden md:table-cell">
                              Delivery
                            </TableHead>
                            <TableHead className="text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {orders.map((order) => (
                            <TableRow key={order.id}>
                              <TableCell>
                                <Link
                                  href={`/vendor/deliveries/${order.orderNumber}`}
                                  className="font-medium hover:underline"
                                >
                                  {order.orderNumber}
                                </Link>
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">
                                {getOrderTypeBadge(order.orderType)}
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">
                                {getStatusBadge(order.status)}
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                {new Date(order.pickupDateTime).toLocaleString(
                                  undefined,
                                  {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )}
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                {new Date(order.arrivalDateTime).toLocaleString(
                                  undefined,
                                  {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(order.orderTotal)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>

                      <div className="mt-4 flex items-center justify-between">
                        <Button
                          variant="outline"
                          onClick={handlePrevPage}
                          disabled={!hasPrevPage}
                        >
                          Previous
                        </Button>
                        <span className="text-sm text-gray-500">
                          Page {currentPage} of{" "}
                          {Math.max(1, Math.ceil(totalOrders / ordersPerPage))}{" "}
                          ({totalOrders} total orders)
                        </span>
                        <Button
                          onClick={handleNextPage}
                          disabled={!hasNextPage}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Upcoming Deliveries */}
              <Card>
                <CardHeader>
                  <CardTitle>Upcoming Deliveries</CardTitle>
                  <CardDescription>
                    Track your scheduled deliveries for today and tomorrow
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-start rounded-md bg-blue-50 p-4">
                    <div className="mr-4 rounded-full bg-blue-100 p-2">
                      <Truck className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-blue-800">
                        Delivery Insights
                      </h4>
                      <p className="mt-1 text-sm text-blue-600">
                        You have {metrics.activeOrders + metrics.pendingOrders}{" "}
                        upcoming deliveries in the next 48 hours. Make sure your
                        items are prepared and ready for pickup.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </section>

      {/* All Orders Modal */}
      <AllOrdersModal
        isOpen={showAllOrdersModal}
        onClose={() => setShowAllOrdersModal(false)}
      />
    </>
  );
};

const VendorPage = () => {
  return (
    <VendorDashboardErrorBoundary>
      <VendorPageContent />
    </VendorDashboardErrorBoundary>
  );
};

export default VendorPage;
