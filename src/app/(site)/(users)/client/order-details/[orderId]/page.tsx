"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Breadcrumb from "@/components/Common/Breadcrumb";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  User,
  Users,
  DollarSign,
  FileText,
  Package,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { getStatusColorClasses } from "@/types/order-status";

interface OrderDetails {
  id: string;
  orderNumber: string;
  orderType: "catering" | "on_demand";
  status: string;
  clientAttention: string;
  hostServices?: {
    numberOfHosts: number;
    hoursNeeded: number;
  };
  orderTotal: number;
  brokerage?: string;
  headcount?: number;
  trip?: number;
  pickupDateTime: string;
  arrivalDateTime: string;
  completeDateTime?: string;
  updatedAt: string;
  pickupAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  deliveryAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  pickupNotes?: string;
  specialNotes?: string;
}

const OrderDetailsPage = () => {
  const params = useParams();
  const router = useRouter();
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const orderId = params.orderId as string;

  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        setIsLoading(true);

        // First, get the order number from the user orders API
        const userOrdersResponse = await fetch("/api/user-orders?limit=100");

        if (!userOrdersResponse.ok) {
          throw new Error(
            `Failed to fetch user orders: ${userOrdersResponse.statusText}`,
          );
        }

        // API returns an object with { orders, pagination }
        const { orders: userOrders = [] } = await userOrdersResponse.json();
        const order = Array.isArray(userOrders)
          ? userOrders.find((o: any) => o.id === orderId)
          : undefined;

        if (!order) {
          throw new Error("Order not found");
        }

        // Redirect users to the unified Order Dashboard route
        router.replace(
          `/order-status/${encodeURIComponent(order.orderNumber)}`,
        );

        // Also fetch the detailed order information in case this page is rendered before redirect
        const response = await fetch(
          `/api/orders/${encodeURIComponent(order.orderNumber)}`,
        );

        if (!response.ok) {
          throw new Error(
            `Failed to fetch order details: ${response.statusText}`,
          );
        }

        const data = await response.json();
        setOrderDetails(data);
      } catch (error) {
        console.error("Error fetching order details:", error);
        setError("Failed to load order details. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    if (orderId) {
      fetchOrderDetails();
    }
  }, [orderId]);

  const formatCurrency = (amount: number | string | null) => {
    if (!amount) return "$0.00";
    const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(numAmount);
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return "N/A";

    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Los_Angeles",
    });
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";

    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "America/Los_Angeles",
    });
  };

  const formatAddress = (address: any) => {
    if (!address) return "N/A";

    const addressParts = [
      address.street,
      address.city,
      address.state,
      address.zipCode,
    ].filter((part) => part && part !== "undefined");

    if (addressParts.length === 0) return "N/A";
    return addressParts.join(", ");
  };

  const getStatusBadge = (status: string) => {
    const statusColor = getStatusColorClasses(status as any);

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

    const statusConfig = statusMap[status.toUpperCase()] || {
      variant: "outline",
      label: status,
    };

    return <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>;
  };

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>
              We encountered a problem loading the order details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-red-600">{error}</p>
            <div className="flex gap-2">
              <Button onClick={() => window.location.reload()}>
                Try Again
              </Button>
              <Button variant="outline" asChild>
                <Link href="/client">Back to Dashboard</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <Breadcrumb pageName="Order Details" />

      <div className="shadow-default dark:border-strokedark dark:bg-boxdark sm:p-7.5 rounded-sm border border-stroke bg-white p-5">
        <div className="max-w-full">
          {/* Back to Dashboard Link */}
          <div className="mb-6">
            <Button variant="ghost" asChild className="mb-4">
              <Link href="/client" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
          </div>

          {isLoading ? (
            <div className="flex min-h-[400px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : orderDetails ? (
            <div className="space-y-6">
              {/* Page Header */}
              <div className="border-b border-gray-200 pb-4">
                <h1 className="text-2xl font-bold text-gray-900">
                  Order Details
                </h1>
                <div className="mt-2 flex items-center gap-4">
                  <h2 className="text-lg text-gray-600">
                    Order #{orderDetails.orderNumber}
                  </h2>
                  {getStatusBadge(orderDetails.status)}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Order Information Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      Order Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-500">
                          Order Number
                        </p>
                        <p className="text-sm text-gray-900">
                          {orderDetails.orderNumber}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">
                          Client Attention
                        </p>
                        <p className="text-sm text-gray-900">
                          {orderDetails.clientAttention || "N/A"}
                        </p>
                      </div>
                      {orderDetails.hostServices && (
                        <div>
                          <p className="text-sm font-medium text-gray-500">
                            Host Services
                          </p>
                          <p className="text-sm text-gray-900">
                            {orderDetails.hostServices.numberOfHosts} hosts for{" "}
                            {orderDetails.hostServices.hoursNeeded} hours
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-gray-500">
                          Order Total
                        </p>
                        <p className="text-sm font-semibold text-gray-900">
                          {formatCurrency(orderDetails.orderTotal)}
                        </p>
                      </div>
                      {orderDetails.brokerage && (
                        <div>
                          <p className="text-sm font-medium text-gray-500">
                            Brokerage
                          </p>
                          <p className="text-sm text-gray-900">
                            {orderDetails.brokerage}
                          </p>
                        </div>
                      )}
                      {orderDetails.headcount && (
                        <div>
                          <p className="text-sm font-medium text-gray-500">
                            Headcount
                          </p>
                          <p className="text-sm text-gray-900">
                            {orderDetails.headcount}
                          </p>
                        </div>
                      )}
                      {orderDetails.trip && (
                        <div>
                          <p className="text-sm font-medium text-gray-500">
                            Trip
                          </p>
                          <p className="text-sm text-gray-900">
                            {formatCurrency(orderDetails.trip)}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Timing Information Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Timing Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium text-gray-500">
                          Pickup Time
                        </p>
                        <p className="text-sm text-gray-900">
                          {formatDateTime(orderDetails.pickupDateTime)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">
                          Delivery Time
                        </p>
                        <p className="text-sm text-gray-900">
                          {formatDateTime(orderDetails.arrivalDateTime)}
                        </p>
                      </div>
                      {orderDetails.completeDateTime && (
                        <div>
                          <p className="text-sm font-medium text-gray-500">
                            Completion Time
                          </p>
                          <p className="text-sm text-gray-900">
                            {formatDateTime(orderDetails.completeDateTime)}
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-gray-500">
                          Last Updated
                        </p>
                        <p className="text-sm text-gray-900">
                          {formatDateTime(orderDetails.updatedAt)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Pickup Location Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Truck className="h-5 w-5" />
                      Pickup Location
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-start gap-3">
                      <MapPin className="mt-0.5 h-5 w-5 text-gray-400" />
                      <p className="text-sm text-gray-900">
                        {formatAddress(orderDetails.pickupAddress)}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Delivery Location Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Delivery Location
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-start gap-3">
                      <MapPin className="mt-0.5 h-5 w-5 text-gray-400" />
                      <p className="text-sm text-gray-900">
                        {formatAddress(orderDetails.deliveryAddress)}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Additional Notes Card */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Additional Notes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <p className="mb-2 text-sm font-medium text-gray-500">
                          Pickup Notes
                        </p>
                        <p className="rounded-md bg-gray-50 p-3 text-sm text-gray-900">
                          {orderDetails.pickupNotes ||
                            "No pickup notes provided"}
                        </p>
                      </div>
                      <div>
                        <p className="mb-2 text-sm font-medium text-gray-500">
                          Special Notes
                        </p>
                        <p className="rounded-md bg-gray-50 p-3 text-sm text-gray-900">
                          {orderDetails.specialNotes ||
                            "No special notes provided"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[400px] items-center justify-center">
              <div className="text-center">
                <Package className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-semibold text-gray-900">
                  Order not found
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  The order you're looking for doesn't exist or has been
                  removed.
                </p>
                <div className="mt-6">
                  <Button asChild>
                    <Link href="/client">Back to Dashboard</Link>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default OrderDetailsPage;
