"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { Loader2, Truck, AlertTriangle, ChevronLeft } from "lucide-react";

interface Order {
  id: string;
  order_number: string;
  order_type: "catering" | "on_demand";
  status: string;
  date: string;
  pickup_time: string;
  arrival_time: string;
  order_total: string;
  client_attention: string;
  address: {
    street1: string | null;
    city: string | null;
    state: string | null;
  };
  delivery_address: {
    street1: string | null;
    city: string | null;
    state: string | null;
  } | null;
}

const ClientOrders: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(5);
  const [totalOrders, setTotalOrders] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const fetchOrders = async () => {
      setIsLoading(true);
      setError(null);
      const apiUrl = `/api/user-orders?page=${page}&limit=${limit}`;
      try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error("Failed to fetch orders");
        }
        // Try to get total count from header or response (API update may be needed)
        let data, total;
        try {
          const json = await response.json();
          if (Array.isArray(json)) {
            data = json;
            // Fallback: if no total, estimate by page 1 length
            if (page === 1 && json.length < limit) {
              total = json.length;
            }
          } else {
            data = json.orders || [];
            total = json.totalCount || 0;
          }
        } catch (e) {
          data = [];
          total = 0;
        }
        // Validate and sanitize order data
        const sanitizedOrders = (data as Order[]).map((order: Order) => ({
          ...order,
          address: {
            street1: order.address?.street1 || "N/A",
            city: order.address?.city || "N/A",
            state: order.address?.state || "N/A",
          },
          delivery_address: order.delivery_address
            ? {
                street1: order.delivery_address.street1 || "N/A",
                city: order.delivery_address.city || "N/A",
                state: order.delivery_address.state || "N/A",
              }
            : null,
          order_total: order.order_total
            ? parseFloat(order.order_total).toFixed(2)
            : "0.00",
          status: order.status || "Unknown",
          date: order.date ? new Date(order.date).toLocaleDateString() : "N/A",
        }));
        setOrders(sanitizedOrders);
        if (typeof total === "number" && total > 0) {
          setTotalOrders(total);
          // If the current page is out of range (e.g., user deleted orders or navigated too far), go back to last page with orders
          const lastPage = Math.max(1, Math.ceil(total / limit));
          if (page > lastPage) {
            setPage(lastPage);
            return;
          }
        } else if (page === 1 && sanitizedOrders.length < limit) {
          setTotalOrders(sanitizedOrders.length);
        }
        // If there are no orders on this page but there are orders in total, go back to last page with orders
        if (sanitizedOrders.length === 0 && totalOrders > 0 && page > 1) {
          const lastPage = Math.max(1, Math.ceil(totalOrders / limit));
          setPage(lastPage);
          return;
        }
      } catch (error) {
        console.error("Error fetching orders:", error);
        setError(
          error instanceof Error
            ? error.message
            : "An unexpected error occurred while fetching orders",
        );
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit]);

  const handleNextPage = () => {
    if (!isLastPage) setPage((prev) => prev + 1);
  };
  const handlePrevPage = () => setPage((prev) => Math.max(1, prev - 1));

  const getOrderTypeBadgeClass = (type: "catering" | "on_demand") => {
    switch (type) {
      case "catering":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "on_demand":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      default:
        return "";
    }
  };

  // Calculate total pages based on totalOrders and limit, but never show an empty last page
  const totalPages =
    totalOrders > 0
      ? Math.ceil(totalOrders / limit)
      : orders.length < limit && page === 1
        ? 1
        : page;
  const isLastPage =
    totalOrders > 0 ? page >= totalPages : orders.length < limit;

  // Show pagination if there are any orders displayed or totalOrders > 0
  const showPagination = orders.length > 0 || totalOrders > 0;

  // Render error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <AlertTriangle className="mb-4 h-16 w-16 text-red-500" />
        <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
          Error Loading Orders
        </h3>
        <p className="max-w-md text-gray-500 dark:text-gray-400">{error}</p>
        <Button onClick={() => window.location.reload()} className="mt-4">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <section id="orders" className="relative py-20 md:py-[120px]">
      <div className="absolute left-0 top-0 -z-[1] h-full w-full dark:bg-dark"></div>
      <div className="absolute left-0 top-0 -z-[1] h-1/2 w-full bg-[#E9F9FF] dark:bg-dark-700 lg:h-[45%] xl:h-1/2"></div>
      <div className="container px-4">
        <div className="-mx-4 flex flex-wrap items-center">
          <div className="w-full px-4">
            <Card>
              <CardHeader className="relative pb-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push("/client")}
                  className="text-muted-foreground hover:text-foreground absolute left-4 top-4 flex items-center gap-2 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Back to Dashboard</span>
                </Button>
                <div className="text-center">
                  <CardTitle className="mb-2">Your Orders</CardTitle>
                  <CardDescription className="mx-auto max-w-lg text-center leading-relaxed">
                    View and manage your orders.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-10 w-10 animate-spin text-gray-500" />
                  </div>
                ) : orders.length === 0 && totalOrders === 0 && page === 1 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Truck className="mb-4 h-16 w-16 text-gray-400" />
                    <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                      No orders found
                    </h3>
                    <p className="max-w-md text-gray-500 dark:text-gray-400">
                      You don&apos;t have any orders at the moment. Check back
                      soon or contact us if you need support.
                    </p>
                  </div>
                ) : (
                  <>
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
                            Date
                          </TableHead>
                          <TableHead className="hidden lg:table-cell">
                            Pickup
                          </TableHead>
                          <TableHead className="hidden lg:table-cell">
                            Delivery
                          </TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.map((order, index) => (
                          <TableRow
                            key={`${order.id}-${order.order_number}-${index}`}
                          >
                            <TableCell>
                              <Link
                                href={`/order-status/${order.order_number}`}
                                className="font-medium hover:underline"
                              >
                                {order.order_number}
                              </Link>
                              <br />
                              <div className="text-muted-foreground hidden text-sm md:inline">
                                {order.client_attention}
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <Badge
                                className={`${getOrderTypeBadgeClass(order.order_type)}`}
                              >
                                {order.order_type}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <Badge
                                className="text-xs"
                                variant={
                                  order.status === "active"
                                    ? "secondary"
                                    : "outline"
                                }
                              >
                                {order.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              {order.date}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              {order.address.street1}, {order.address.city},{" "}
                              {order.address.state}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              {order.delivery_address
                                ? `${order.delivery_address.street1}, ${order.delivery_address.city}, ${order.delivery_address.state}`
                                : "N/A"}
                            </TableCell>
                            <TableCell className="text-right">
                              ${parseFloat(order.order_total).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {showPagination && (
                      <div className="mt-4 flex w-full items-center justify-between">
                        <Button onClick={handlePrevPage} disabled={page === 1}>
                          Previous
                        </Button>
                        <div className="flex flex-1 justify-center">
                          <span className="text-sm text-gray-500">
                            {page} of {totalPages}
                          </span>
                        </div>
                        <Button onClick={handleNextPage} disabled={isLastPage}>
                          Next
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ClientOrders;
