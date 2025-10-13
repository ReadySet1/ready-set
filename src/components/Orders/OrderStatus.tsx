"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle, Clock, XCircle, Truck, AlertCircle, CheckCheck, PlayCircle, PackageCheck } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { OrderStatus, OrderType } from "@/types/order";

interface StatusBadgeProps {
  status: OrderStatus;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.ACTIVE:
        return "bg-blue-500 hover:bg-blue-600";
      case OrderStatus.ASSIGNED:
        return "bg-yellow-500 hover:bg-yellow-600";
      case OrderStatus.PENDING:
        return "bg-orange-500 hover:bg-orange-600";
      case OrderStatus.CONFIRMED:
        return "bg-green-500 hover:bg-green-600";
      case OrderStatus.IN_PROGRESS:
        return "bg-cyan-500 hover:bg-cyan-600";
      case OrderStatus.DELIVERED:
        return "bg-teal-500 hover:bg-teal-600";
      case OrderStatus.CANCELLED:
        return "bg-red-500 hover:bg-red-600";
      case OrderStatus.COMPLETED:
        return "bg-emerald-500 hover:bg-emerald-600";
      default:
        return "bg-gray-500 hover:bg-gray-600";
    }
  };

  const getStatusIcon = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.ACTIVE:
        return <Clock className="mr-1 h-4 w-4" />;
      case OrderStatus.ASSIGNED:
        return <Truck className="mr-1 h-4 w-4" />;
      case OrderStatus.PENDING:
        return <AlertCircle className="mr-1 h-4 w-4" />;
      case OrderStatus.CONFIRMED:
        return <CheckCheck className="mr-1 h-4 w-4" />;
      case OrderStatus.IN_PROGRESS:
        return <PlayCircle className="mr-1 h-4 w-4" />;
      case OrderStatus.DELIVERED:
        return <PackageCheck className="mr-1 h-4 w-4" />;
      case OrderStatus.CANCELLED:
        return <XCircle className="mr-1 h-4 w-4" />;
      case OrderStatus.COMPLETED:
        return <CheckCircle className="mr-1 h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <Badge
      className={`${getStatusColor(status)} flex items-center capitalize text-white`}
    >
      {getStatusIcon(status)}
      {/* Format status for display: convert IN_PROGRESS to "In Progress" */}
      {status
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ")}
    </Badge>
  );
};

interface OrderStatusProps {
  order_type: OrderType;
  initialStatus: OrderStatus;
  orderId: string | number | bigint;
  onStatusChange?: (newStatus: OrderStatus) => void;
  // Role-based access control for status changes
  canChangeStatus?: boolean;
}

export const OrderStatusCard: React.FC<OrderStatusProps> = ({
  order_type,
  initialStatus,
  orderId,
  onStatusChange,
  canChangeStatus = false,
}) => {
  const [status, setStatus] = useState<OrderStatus>(initialStatus);

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  const handleStatusChange = (newStatus: OrderStatus) => {
    setStatus(newStatus);
    if (onStatusChange) {
      onStatusChange(newStatus);
    }
    toast({
      title: "Status Updated",
      description: `Order ${orderId.toString()} status changed to ${newStatus}`,
    });
  };

  const getOrderTypeDisplay = (type: OrderType): string => {
    return type === "catering" ? "Catering Request" : "On-Demand Order";
  };

  // Get all available order statuses
  const availableStatuses: OrderStatus[] = [
    OrderStatus.PENDING,
    OrderStatus.CONFIRMED,
    OrderStatus.ACTIVE,
    OrderStatus.ASSIGNED,
    OrderStatus.IN_PROGRESS,
    OrderStatus.DELIVERED,
    OrderStatus.COMPLETED,
    OrderStatus.CANCELLED,
  ];

  return (
    <div className="w-full">
      <div>
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-medium">Current Status:</span>
          <StatusBadge status={status} />
        </div>

        {/* Change Status dropdown - only visible to admin and super admin */}
        {canChangeStatus && onStatusChange && (
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Change Status:</span>
              <Select
                value={status}
                onValueChange={(newStatus) => {
                  if (newStatus && newStatus !== status) {
                    handleStatusChange(newStatus as OrderStatus);
                  }
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {availableStatuses.map((statusOption) => (
                    <SelectItem key={statusOption} value={statusOption}>
                      <div className="flex items-center gap-2">
                        {statusOption === OrderStatus.ACTIVE && (
                          <Clock className="h-4 w-4" />
                        )}
                        {statusOption === OrderStatus.ASSIGNED && (
                          <Truck className="h-4 w-4" />
                        )}
                        {statusOption === OrderStatus.PENDING && (
                          <AlertCircle className="h-4 w-4" />
                        )}
                        {statusOption === OrderStatus.CONFIRMED && (
                          <CheckCheck className="h-4 w-4" />
                        )}
                        {statusOption === OrderStatus.IN_PROGRESS && (
                          <PlayCircle className="h-4 w-4" />
                        )}
                        {statusOption === OrderStatus.DELIVERED && (
                          <PackageCheck className="h-4 w-4" />
                        )}
                        {statusOption === OrderStatus.COMPLETED && (
                          <CheckCircle className="h-4 w-4" />
                        )}
                        {statusOption === OrderStatus.CANCELLED && (
                          <XCircle className="h-4 w-4" />
                        )}
                        <span className="capitalize">
                          {statusOption.replace(/_/g, " ").toLowerCase()}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderStatusCard;
