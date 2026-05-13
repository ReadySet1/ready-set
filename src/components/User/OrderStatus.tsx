import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
} from "../ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Driver {
  id: string;
  name: string | null;
  email: string | null;
  contact_number: string | null;
}

interface DriverStatusCardProps {
  order: {
    id: string;
    status: string;
    driver_status: string | null;
    user_id: string;
    pickup_time: string;
    arrival_time: string;
    complete_time: string;
    updated_at: string | null;
  };
  driverInfo: Driver | null;
}

const driverStatusMap: Record<string, string> = {
  ASSIGNED: "🚗 Assigned",
  ARRIVED_AT_VENDOR: "🏪 Arrived at Vendor",
  PICKED_UP: "📦 Pick Up Completed",
  EN_ROUTE_TO_CLIENT: "🚚 En Route to Client",
  ARRIVED_TO_CLIENT: "🏁 Arrived at Client",
  COMPLETED: "✅ Delivered",
  // Legacy lowercase mappings
  assigned: "🚗 Assigned",
  arrived_at_vendor: "🏪 Arrived at Vendor",
  picked_up: "📦 Pick Up Completed",
  en_route_to_client: "🚚 En Route to Client",
  arrived_to_client: "🏁 Arrived at Client",
  completed: "✅ Delivered",
};

const driverStatusProgress: Record<string, number> = {
  ASSIGNED: 0,
  ARRIVED_AT_VENDOR: 20,
  PICKED_UP: 40,
  EN_ROUTE_TO_CLIENT: 60,
  ARRIVED_TO_CLIENT: 80,
  COMPLETED: 100,
  // Legacy lowercase mappings
  assigned: 0,
  arrived_at_vendor: 20,
  picked_up: 40,
  en_route_to_client: 60,
  arrived_to_client: 80,
  completed: 100,
};

const OrderStatusCard: React.FC<DriverStatusCardProps> = ({
  order,
  driverInfo,
}) => {
  const getProgressValue = (status: string | null) => {
    return driverStatusProgress[status || 'assigned'] || 0;
  };

  const getDisplayStatus = (status: string | null) => {
    return status ? driverStatusMap[status] || status : driverStatusMap['assigned'];
  };

  return (
    <Card className="mx-auto w-full max-w-3xl">
      <CardHeader>
        <CardTitle>Driver Details</CardTitle>
      </CardHeader>
      <CardContent>
        {driverInfo ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                Driver Name:{" "}
                <span className="font-medium">
                  {driverInfo.name || "Not assigned"}
                </span>
              </div>
              <div>
                Driver Email:{" "}
                <span className="font-medium">{driverInfo.email || "N/A"}</span>
              </div>
              <div>
                Driver Contact:{" "}
                <span className="font-medium">
                  {driverInfo.contact_number || "N/A"}
                </span>
              </div>
              <div>
                Updated At:{" "}
                <span className="font-medium">
                  {order.updated_at
                    ? new Date(order.updated_at).toLocaleString()
                    : "N/A"}
                </span>
              </div>
            </div>
            <div className="space-y-2 py-4">
              <div className="flex flex-col items-center justify-center">
                <span className="mb-2 text-xl font-medium">Driver Status</span>
                <Badge
                  variant="outline"
                  className={cn("px-4 py-2 text-lg font-medium", {
                    "border-yellow-300 bg-yellow-100 text-yellow-800":
                      order.driver_status === "assigned" || order.driver_status === "ASSIGNED" || !order.driver_status,
                    "border-blue-300 bg-blue-100 text-blue-800":
                      order.driver_status === "arrived_at_vendor" || order.driver_status === "ARRIVED_AT_VENDOR",
                    "border-cyan-300 bg-cyan-100 text-cyan-800":
                      order.driver_status === "picked_up" || order.driver_status === "PICKED_UP",
                    "border-green-300 bg-green-100 text-green-800":
                      order.driver_status === "en_route_to_client" || order.driver_status === "EN_ROUTE_TO_CLIENT",
                    "border-purple-300 bg-purple-100 text-purple-800":
                      order.driver_status === "arrived_to_client" || order.driver_status === "ARRIVED_TO_CLIENT",
                    "border-gray-300 bg-gray-100 text-gray-800":
                      order.driver_status === "completed" || order.driver_status === "COMPLETED",
                  })}
                >
                  {getDisplayStatus(order.driver_status)}
                </Badge>
              </div>
              <Progress
                value={getProgressValue(order.driver_status)}
                className="w-full"
                indicatorClassName={cn("transition-all duration-500", {
                  "bg-yellow-400":
                    order.driver_status === "assigned" || order.driver_status === "ASSIGNED" || !order.driver_status,
                  "bg-blue-500":
                    order.driver_status === "arrived_at_vendor" || order.driver_status === "ARRIVED_AT_VENDOR",
                  "bg-cyan-500":
                    order.driver_status === "picked_up" || order.driver_status === "PICKED_UP",
                  "bg-green-500":
                    order.driver_status === "en_route_to_client" || order.driver_status === "EN_ROUTE_TO_CLIENT",
                  "bg-purple-500":
                    order.driver_status === "arrived_to_client" || order.driver_status === "ARRIVED_TO_CLIENT",
                  "bg-slate-500":
                    order.driver_status === "completed" || order.driver_status === "COMPLETED",
                })}
              />
              <div className="text-muted-foreground flex justify-between text-xs">
                <span>Assigned</span>
                <span>Arrived at Vendor</span>
                <span>Pick Up Completed</span>
                <span>En Route to Client</span>
                <span>Arrived at Client</span>
                <span>Delivered</span>
              </div>
            </div>
            <div className="flex justify-center">
              <DropdownMenu></DropdownMenu>
            </div>
          </div>
        ) : (
          <div>No driver assigned to this order.</div>
        )}
      </CardContent>
    </Card>
  );
};

export default OrderStatusCard;