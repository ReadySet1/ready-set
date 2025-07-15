import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Loader2, Package } from "lucide-react";
import Link from "next/link";
import { OrderData } from "@/lib/services/vendor";

interface AllOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AllOrdersModal: React.FC<AllOrdersModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [ordersPerPage] = useState(10); // More orders in modal view
  const [totalOrders, setTotalOrders] = useState(0);

  const fetchAllOrders = useCallback(
    async (page = 1) => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch paginated orders
        const response = await fetch(
          `/api/vendor/orders?page=${page}&limit=${ordersPerPage}`,
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch orders: ${response.statusText}`);
        }

        const ordersData = await response.json();

        // Extract the orders array and total from the response
        if (ordersData && Array.isArray(ordersData.orders)) {
          setOrders(ordersData.orders);
          setTotalOrders(ordersData.total || 0);
        } else {
          console.error("Invalid response format:", ordersData);
          setError("Invalid response format from server.");
        }
      } catch (error) {
        console.error("Error fetching all orders:", error);
        setError("Failed to load orders. Please try again.");
      } finally {
        setIsLoading(false);
      }
    },
    [ordersPerPage],
  );

  useEffect(() => {
    if (isOpen) {
      fetchAllOrders(currentPage);
    }
  }, [isOpen, currentPage, fetchAllOrders]);

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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[80vh] max-w-6xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>All Orders</DialogTitle>
          <DialogDescription>
            View and manage all your orders across the platform
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="mb-4 text-red-600">{error}</p>
              <Button
                onClick={() => fetchAllOrders(currentPage)}
                variant="outline"
              >
                Try Again
              </Button>
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Package className="mb-4 h-16 w-16 text-gray-400" />
              <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                No Orders Found
              </h3>
              <p className="max-w-md text-gray-500 dark:text-gray-400">
                There are no orders to display at the moment. Check back later
                or create a new order.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order Number</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
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
                          href={`/vendor/deliveries/${order.orderNumber}`}
                          className="font-medium hover:underline"
                          onClick={onClose}
                        >
                          {order.orderNumber}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {getOrderTypeBadge(order.orderType)}
                      </TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell>
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
                      <TableCell>
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
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 pt-4">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className="text-sm text-gray-500">
              Page {currentPage} of{" "}
              {Math.max(1, Math.ceil(totalOrders / ordersPerPage))} (
              {totalOrders} total orders)
            </span>
            <Button
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={orders.length < ordersPerPage}
            >
              Next
            </Button>
          </div>
          <div className="flex justify-end">
            <Button onClick={onClose} variant="outline">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
