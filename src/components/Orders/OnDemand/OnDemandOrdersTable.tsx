import React from "react";
import Link from "next/link";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { OnDemandOrder, StatusFilter, UserRole } from "./types";
import DeleteOnDemandOrder from "./DeleteOnDemandOrder";

interface OnDemandOrdersTableProps {
  orders: OnDemandOrder[];
  isLoading: boolean;
  statusFilter: StatusFilter;
  onStatusFilterChange: (status: StatusFilter) => void;
  userRoles: UserRole;
  onOrderDeleted?: () => void;
}

export const OnDemandOrdersTable: React.FC<OnDemandOrdersTableProps> = ({
  orders,
  isLoading,
  statusFilter,
  onStatusFilterChange,
  userRoles,
  onOrderDeleted,
}) => {

  // Function to get proper status badge styling
  const getStatusBadgeClass = (status: string) => {
    switch (status.toUpperCase()) {
      case "ACTIVE":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "PENDING":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "ASSIGNED":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "CANCELLED":
        return "bg-red-100 text-red-800 border-red-200";
      case "COMPLETED":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  if (isLoading) {
    return <div>Loading on-demand orders...</div>;
  }

  if (orders.length === 0) {
    return <div>No orders found.</div>;
  }

  return (
    <Tabs
      value={statusFilter}
      onValueChange={(value) => onStatusFilterChange(value as StatusFilter)}
    >
      <TabsContent value={statusFilter}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order Number</TableHead>
              <TableHead className="hidden sm:table-cell">Status</TableHead>
              <TableHead className="hidden md:table-cell">Date</TableHead>
              <TableHead className="text-right">Total</TableHead>
              {(userRoles.isAdmin || userRoles.isSuperAdmin) && (
                <TableHead className="w-10"></TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell>
                  <Link
                    href={`/admin/on-demand-orders/${encodeURIComponent(order.order_number)}`}
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
                    className={`border text-xs ${getStatusBadgeClass(order.status)}`}
                    variant="outline"
                  >
                    {order.status}
                  </Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {new Date(order.date).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  $
                  {typeof order.order_total === "string"
                    ? parseFloat(order.order_total).toFixed(2)
                    : Number(order.order_total).toFixed(2)}
                </TableCell>
                {(userRoles.isAdmin || userRoles.isSuperAdmin) && (
                  <TableCell className="p-0 pr-2 text-right">
                    <DeleteOnDemandOrder
                      orderId={order.id}
                      orderNumber={order.order_number}
                      userRoles={userRoles}
                      onDeleted={onOrderDeleted}
                    />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TabsContent>
    </Tabs>
  );
};

export default OnDemandOrdersTable;
