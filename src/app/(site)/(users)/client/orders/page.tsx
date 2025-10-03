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
  PlusCircle,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { getStatusColorClasses } from "@/types/order-status";

interface OrderData {
  id: string;
  orderNumber: string;
  order_type: "catering" | "on_demand";
  status: string;
  pickupDateTime: string;
  arrivalDateTime: string;
  orderTotal: number;
  createdAt: string;
  pickupAddress?: {
    address: string;
    city: string;
    state: string;
  };
  deliveryAddress?: {
    address: string;
    city: string;
    state: string;
  };
}

interface PaginationData {
  currentPage: number;
  totalPages: number;
  totalOrders: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  ordersPerPage: number;
}

interface ClientMetrics {
  activeOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  pendingOrders: number;
  totalOrders: number;
}

const ClientOrdersPage = () => {
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [pagination, setPagination] = useState<PaginationData>({
    currentPage: 1,
    totalPages: 1,
    totalOrders: 0,
    hasNextPage: false,
    hasPrevPage: false,
    ordersPerPage: 5,
  });
  const [metrics, setMetrics] = useState<ClientMetrics>({
    activeOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    pendingOrders: 0,
    totalOrders: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchClientData = async () => {
      try {
        setIsLoading(true);

        // Fetch orders with pagination
        const ordersResponse = await fetch(
          `/api/user-orders?page=${pagination.currentPage}&limit=${pagination.ordersPerPage}`,
        );

        if (!ordersResponse.ok) {
          throw new Error(
            `Failed to fetch orders: ${ordersResponse.statusText}`,
          );
        }

        const responseData = await ordersResponse.json();
        setOrders(responseData.orders);
        setPagination(responseData.pagination);

        // Calculate metrics from the orders data
        const metrics = calculateMetrics(responseData.orders);
        setMetrics(metrics);
      } catch (error) {
        console.error("Error fetching client data:", error);
        setError("Failed to load dashboard data. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchClientData();
  }, [pagination.currentPage, pagination.ordersPerPage]);

  const calculateMetrics = (orders: OrderData[]): ClientMetrics => {
    const metrics = {
      activeOrders: 0,
      completedOrders: 0,
      cancelledOrders: 0,
      pendingOrders: 0,
      totalOrders: orders.length,
    };

    orders.forEach((order) => {
      const status = order.status.toUpperCase();
      if (status === "ACTIVE" || status === "ASSIGNED") {
        metrics.activeOrders++;
      } else if (status === "COMPLETED") {
        metrics.completedOrders++;
      } else if (status === "CANCELLED") {
        metrics.cancelledOrders++;
      } else if (status === "PENDING") {
        metrics.pendingOrders++;
      }
    });

    return metrics;
  };

  const formatCurrency = (amount: number | string | null) => {
    if (!amount) return "$0.00";
    const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(numAmount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatAddress = (address: any) => {
    if (!address) return "N/A";

    const addressParts = [address.address, address.city, address.state].filter(
      (part) => part && part !== "undefined",
    );

    if (addressParts.length === 0) return "N/A";
    return addressParts.join(", ");
  };

  // Get badge style based on order status
  const getStatusBadge = (status: string) => {
    const statusColor = getStatusColorClasses(status as any);

    const statusMap: Record<
      string,
      {
        variant: "default" | "secondary" | "destructive" | "outline";
        label: string;
      }
    > = {
      ACTIVE: { variant: "default", label: "ACTIVE" },
      PENDING: { variant: "secondary", label: "PENDING" },
      COMPLETED: { variant: "outline", label: "COMPLETED" },
      ASSIGNED: { variant: "secondary", label: "ASSIGNED" },
      CANCELLED: { variant: "destructive", label: "CANCELLED" },
    };

    const statusConfig = statusMap[status.toUpperCase()] || {
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
        {type === "catering" ? "catering" : "on_demand"}
      </Badge>
    );
  };

  // Pagination handlers
  const handlePrevPage = () => {
    if (pagination.hasPrevPage) {
      setPagination((prev) => ({ ...prev, currentPage: prev.currentPage - 1 }));
    }
  };

  const handleNextPage = () => {
    if (pagination.hasNextPage) {
      setPagination((prev) => ({ ...prev, currentPage: prev.currentPage + 1 }));
    }
  };

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>
              We encountered a problem loading your dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-red-600">{error}</p>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <Breadcrumb pageName="Client Dashboard" />
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
              {/* Back to Dashboard Link */}
              <div className="flex items-center">
                <Link
                  href="/client"
                  className="flex items-center text-sm text-gray-600 transition-colors hover:text-primary"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Dashboard
                </Link>
              </div>

              {/* Page Title - Centered */}
              <div className="text-center">
                <h1 className="mb-2 text-3xl font-bold text-gray-900">
                  Your Orders
                </h1>
                <p className="text-gray-600">View and manage your orders.</p>
              </div>

              {/* Orders Table */}
              <Card>
                <CardContent className="p-6">
                  {orders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <Package className="mb-4 h-16 w-16 text-gray-400" />
                      <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                        No Orders Found
                      </h3>
                      <p className="max-w-md text-gray-500 dark:text-gray-400">
                        You haven't placed any orders yet. Start by creating
                        your first order.
                      </p>
                      <Button className="mt-4" asChild>
                        <Link href="/catering-request">
                          <PlusCircle className="mr-2 h-4 w-4" />
                          Create New Order
                        </Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Order Number</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Pickup</TableHead>
                            <TableHead>Delivery</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {orders.map((order) => (
                            <TableRow key={order.id}>
                              <TableCell>
                                <Link
                                  href={`/order-status/${order.orderNumber}`}
                                  className="font-medium hover:underline"
                                >
                                  {order.orderNumber}
                                </Link>
                              </TableCell>
                              <TableCell>
                                {getOrderTypeBadge(order.order_type)}
                              </TableCell>
                              <TableCell>
                                {getStatusBadge(order.status)}
                              </TableCell>
                              <TableCell>
                                {formatDate(order.createdAt)}
                              </TableCell>
                              <TableCell>
                                {formatAddress(order.pickupAddress)}
                              </TableCell>
                              <TableCell>
                                {formatAddress(order.deliveryAddress)}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(order.orderTotal)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>

                      {/* Pagination */}
                      <div className="mt-6 flex items-center justify-between">
                        <Button
                          variant="outline"
                          onClick={handlePrevPage}
                          disabled={!pagination.hasPrevPage}
                        >
                          Previous
                        </Button>
                        <span className="text-sm text-gray-500">
                          Page {pagination.currentPage} of{" "}
                          {pagination.totalPages}
                        </span>
                        <Button
                          onClick={handleNextPage}
                          disabled={!pagination.hasNextPage}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </section>
    </>
  );
};

export default ClientOrdersPage;
