// src/components/Dashboard/ui/RecentOrders.tsx

import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { CateringOrder } from "@/types/user"; // Import the shared type
import { encodeOrderNumber } from "@/utils/order";

interface RecentOrdersTableProps {
  orders: CateringOrder[];
}

export const RecentOrdersTable: React.FC<RecentOrdersTableProps> = ({
  orders,
}) => {
  // Function to determine badge color based on order status
  const getBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return "secondary";
      case "pending":
        return "warning";
      case "confirmed":
        return "default";
      case "in_progress":
        return "info";
      case "completed":
        return "success";
      case "cancelled":
        return "destructive";
      default:
        return "outline";
    }
  };

  return (
    <div className="flex min-h-[320px] flex-col justify-between">
      <div>
        {orders.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order Number</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/admin/catering-orders/${encodeOrderNumber(order.orderNumber)}`}
                      className="hover:underline"
                    >
                      {order.orderNumber}
                    </Link>
                  </TableCell>
                  <TableCell>Catering</TableCell>
                  <TableCell>
                    <Badge variant={getBadgeVariant(order.status)}>
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    ${order.orderTotal?.toFixed(2) || "0.00"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="py-4 text-center text-gray-500">
            No active orders at this moment
          </div>
        )}
      </div>
    </div>
  );
};
