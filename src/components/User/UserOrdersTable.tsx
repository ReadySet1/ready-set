"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
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
import { Loader2, Truck } from "lucide-react";

interface Order {
  id: string;
  order_number: string;
  order_type: "catering" | "on_demand";
  status: string;
  date?: string;
  pickup_time?: string;
  arrival_time?: string;
  order_total?: string;
  client_attention?: string;
  address?: {
    street1: string | null;
    city: string | null;
    state: string | null;
  } | null;
  delivery_address?: {
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
  const [limit] = useState(10);

  useEffect(() => {
    const fetchOrders = async () => {
      setIsLoading(true);
      const apiUrl = `/api/user-orders?page=${page}&limit=${limit}`;
      try {
        const response = await fetch(apiUrl, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        if (!response.ok) {
          if (response.status === 401) {
            throw new Error("Authentication required. Please log in again.");
          }
          throw new Error("Failed to fetch orders");
        }
        const data: Order[] = await response.json();
        setOrders(data);
      } catch (error) {
        setError(error instanceof Error ? error.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrders();
  }, [page, limit]);

  const handleNextPage = () => setPage((prev) => prev + 1);
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

  if (error) {
    return (
      <section id="orders" className="relative py-20 md:py-[120px]">
        <div className="absolute left-0 top-0 -z-[1] h-full w-full dark:bg-dark"></div>
        <div className="absolute left-0 top-0 -z-[1] h-1/2 w-full bg-[#E9F9FF] dark:bg-dark-700 lg:h-[45%] xl:h-1/2"></div>
        <div className="container px-4">
          <div className="-mx-4 flex flex-wrap items-center">
            <div className="w-full px-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Your Orders</CardTitle>
                  <CardDescription className="max-w-lg text-balance leading-relaxed">
                    View and manage your orders.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="mb-4 rounded-full bg-red-100 p-3">
                      <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                      Unable to load orders
                    </h3>
                    <p className="mb-4 max-w-md text-gray-500 dark:text-gray-400">
                      {error}
                    </p>
                    <Button 
                      onClick={() => window.location.reload()} 
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Try Again
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
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
              <CardHeader className="pb-3">
                <CardTitle>Your Orders</CardTitle>
                <CardDescription className="max-w-lg text-balance leading-relaxed">
                  View and manage your orders.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-10 w-10 animate-spin text-gray-500" />
                  </div>
                ) : orders.length === 0 ? (
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
                              {order.client_attention && (
                                <>
                                  <br />
                                  <div className="text-muted-foreground hidden text-sm md:inline">
                                    {order.client_attention}
                                  </div>
                                </>
                              )}
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
                              {order.date
                                ? (() => {
                                    const date = new Date(order.date);
                                    return isNaN(date.getTime())
                                      ? "N/A"
                                      : date.toLocaleDateString();
                                  })()
                                : "N/A"}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              {order.address
                                ? `${order.address.street1 || "N/A"}, ${order.address.city || "N/A"}, ${order.address.state || "N/A"}`
                                : "N/A"}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              {order.delivery_address
                                ? `${order.delivery_address.street1 || "N/A"}, ${order.delivery_address.city || "N/A"}, ${order.delivery_address.state || "N/A"}`
                                : "N/A"}
                            </TableCell>
                            <TableCell className="text-right">
                              $
                              {order.order_total
                                ? (() => {
                                    const total = parseFloat(order.order_total);
                                    return isNaN(total)
                                      ? "0.00"
                                      : total.toFixed(2);
                                  })()
                                : "0.00"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="mt-4 flex justify-between">
                      <Button onClick={handlePrevPage} disabled={page === 1}>
                        Previous
                      </Button>
                      <Button
                        onClick={handleNextPage}
                        disabled={orders.length < limit}
                      >
                        Next
                      </Button>
                    </div>
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
