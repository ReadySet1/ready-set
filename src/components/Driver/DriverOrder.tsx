"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CalendarIcon,
  MapPinIcon,
  FileTextIcon,
  CarIcon,
  UsersIcon,
  ArrowLeftIcon,
  Camera,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePathname, useRouter, useParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { decodeOrderNumber } from "@/utils/order";
import { ProofOfDeliveryCapture } from "./ProofOfDeliveryCapture";
import { ProofOfDeliveryViewer } from "./ProofOfDeliveryViewer";

// Shared types
interface Driver {
  id: string;
  name: string | null;
  email: string | null;
  contact_number: string | null;
}

interface Address {
  street1?: string;
  city?: string;
  state?: string;
  zip?: string;
  locationNumber?: string;
  parkingLoading?: string;
}

interface FileUpload {
  id: string;
  fileUrl: string;
  category?: string | null;
  uploadedAt?: string;
}

interface BaseOrder {
  id: string;
  orderNumber: string;
  pickupDateTime: string;
  status: string;
  driverStatus: string | null;
  orderTotal: string;
  tip?: string;
  specialNotes: string | null;
  pickupNotes?: string | null;
  clientAttention?: string | null;
  pickupAddress: Address;
  deliveryAddress: Address | null;
  userId: string;
  arrivalDateTime: string;
  completeDateTime: string;
  updatedAt: string | null;
  user?: {
    name?: string;
    email?: string;
  };
  dispatches: Array<{
    driver: Driver;
  }>;
  fileUploads?: FileUpload[];
}

interface CateringOrder extends BaseOrder {
  order_type: "catering";
  headcount: string | null;
  needHost: "YES" | "NO" | null;
  brokerage: string | null;
}

interface OnDemandOrder extends BaseOrder {
  order_type: "on_demand";
  itemDelivered: string | null;
  vehicleType: "CAR" | "VAN" | "TRUCK" | null;
}

type Order = CateringOrder | OnDemandOrder;

// DriverStatusCard component
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
  updateDriverStatus: (newStatus: string) => Promise<void>;
  onCompletionRequest?: () => void;
  hasExistingPOD?: boolean;
}

const BackButton: React.FC<{ href: string }> = ({ href }) => {
  const router = useRouter();

  return (
    <Button
      variant="ghost"
      size="sm"
      className="hover:bg-accent flex items-center gap-2"
      onClick={() => router.push(href)}
    >
      <ArrowLeftIcon className="h-4 w-4" />
      Back to Dashboard
    </Button>
  );
};

const driverStatusMap: Record<string, string> = {
  assigned: "🚗 Assigned",
  arrived_at_vendor: "🏪 At Vendor",
  en_route_to_client: "🚚 On the Way",
  arrived_to_client: "🏁 Arrived",
  completed: "✅ Completed",
};

const driverStatusProgress: Record<string, number> = {
  assigned: 0,
  arrived_at_vendor: 25,
  en_route_to_client: 50,
  arrived_to_client: 75,
  completed: 100,
};

const DriverStatusCard: React.FC<DriverStatusCardProps> = ({
  order,
  driverInfo,
  updateDriverStatus,
  onCompletionRequest,
  hasExistingPOD = false,
}) => {
  const getProgressValue = (status: string | null) => {
    return driverStatusProgress[status || "assigned"] || 0;
  };

  const getDisplayStatus = (status: string | null) => {
    return status
      ? driverStatusMap[status] || status
      : driverStatusMap["assigned"];
  };

  /**
   * Handle status change - intercept "completed" to show POD option
   */
  const handleStatusChange = (newStatus: string) => {
    if (newStatus === "completed" && !hasExistingPOD && onCompletionRequest) {
      onCompletionRequest();
    } else {
      updateDriverStatus(newStatus);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Driver Details</CardTitle>
      </CardHeader>
      <CardContent>
        {driverInfo ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
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
                <span className="mb-2 text-xl font-medium">Drive Status</span>
                <div className="flex justify-center">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline">Update Status</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {Object.entries(driverStatusMap).map(
                        ([status, label]) => (
                          <DropdownMenuItem
                            key={status}
                            onClick={() => handleStatusChange(status)}
                          >
                            {label}
                          </DropdownMenuItem>
                        ),
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <Progress
                value={getProgressValue(order.driver_status)}
                className="w-full"
                indicatorClassName="bg-yellow-400"
              />
              <div className="text-muted-foreground flex justify-between text-xs">
                <span>Not Started</span>
                <span>Completed</span>
              </div>
            </div>
            <div className="flex justify-center">
              <Badge
                variant="outline"
                className={cn("px-4 py-2 text-lg font-medium", {
                  "border-yellow-300 bg-yellow-100 text-yellow-800":
                    order.driver_status === "assigned" || !order.driver_status,
                  "border-blue-300 bg-blue-100 text-blue-800":
                    order.driver_status === "arrived_at_vendor",
                  "border-green-300 bg-green-100 text-green-800":
                    order.driver_status === "en_route_to_client",
                  "border-purple-300 bg-purple-100 text-purple-800":
                    order.driver_status === "arrived_to_client",
                  "border-gray-300 bg-gray-100 text-gray-800":
                    order.driver_status === "completed",
                })}
              >
                {getDisplayStatus(order.driver_status)}
              </Badge>
            </div>
          </div>
        ) : (
          <div>No driver assigned to this order.</div>
        )}
      </CardContent>
    </Card>
  );
};

const OrderPage: React.FC<{ backHref: string }> = ({ backHref }) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [driverInfo, setDriverInfo] = useState<Driver | null>(null);
  const [showPODConfirm, setShowPODConfirm] = useState(false);
  const [showPODCapture, setShowPODCapture] = useState(false);
  const params = useParams();

  /**
   * Get POD photo URL from fileUploads
   */
  const getPODUrl = () => {
    return order?.fileUploads?.find(
      (f) => f.category === "proof_of_delivery"
    )?.fileUrl;
  };

  const hasExistingPOD = !!getPODUrl();

  // Extract order number from URL params with proper decoding for slashes
  const orderNumber = (() => {
    if (params?.order_number) {
      const rawOrderNumber = Array.isArray(params.order_number)
        ? params.order_number[0]
        : params.order_number;

      if (rawOrderNumber) {
        return decodeOrderNumber(rawOrderNumber);
      }
    }
    return "";
  })();

  useEffect(() => {
    const fetchOrder = async () => {
      // Prevent fetching if orderNumber is somehow undefined or empty
      if (!orderNumber) {
        setError("Could not determine order number from URL.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true); // Set loading true only when fetching
        setError(null);
        const response = await fetch(
          `/api/orders/${encodeURIComponent(orderNumber)}`,
        );
        if (!response.ok) {
          throw new Error("Failed to fetch order");
        }
        const data: Order = await response.json();
        setOrder(data);

        if (
          data.dispatches &&
          Array.isArray(data.dispatches) &&
          data.dispatches.length > 0 &&
          data.dispatches[0]?.driver
        ) {
          setDriverInfo(data.dispatches[0].driver);
        } else {
          setDriverInfo(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    if (orderNumber) {
      fetchOrder();
    } else {
      setLoading(false);
    }
  }, [orderNumber]);

  const updateDriverStatus = async (newStatus: string) => {
    if (!order) return;

    try {
      const response = await fetch(
        `/api/orders/${encodeURIComponent(order.orderNumber)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ driver_status: newStatus }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to update driver status");
      }

      const updatedOrder: Order = await response.json();
      setOrder(updatedOrder);
      if (
        updatedOrder.dispatches &&
        Array.isArray(updatedOrder.dispatches) &&
        updatedOrder.dispatches.length > 0 &&
        updatedOrder.dispatches[0]?.driver
      ) {
        setDriverInfo(updatedOrder.dispatches[0].driver);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  /**
   * Handle completion request - show POD confirmation dialog
   */
  const handleCompletionRequest = () => {
    setShowPODConfirm(true);
  };

  /**
   * Complete without POD - just update status to completed
   */
  const handleCompleteWithoutPOD = () => {
    setShowPODConfirm(false);
    updateDriverStatus("completed");
  };

  /**
   * Complete with POD - show capture dialog
   */
  const handleCompleteWithPOD = () => {
    setShowPODConfirm(false);
    setShowPODCapture(true);
  };

  /**
   * POD upload completed successfully
   */
  const handlePODUploadComplete = async (url: string) => {
    setShowPODCapture(false);
    // Refresh order to get updated fileUploads
    if (order) {
      try {
        const response = await fetch(
          `/api/orders/${encodeURIComponent(order.orderNumber)}`
        );
        if (response.ok) {
          const data: Order = await response.json();
          setOrder(data);
        }
      } catch {
        // Ignore refresh errors
      }
    }
    // Then complete the delivery
    updateDriverStatus("completed");
  };

  /**
   * POD capture cancelled
   */
  const handlePODCancel = () => {
    setShowPODCapture(false);
    // Re-show confirmation dialog so user can choose again
    setShowPODConfirm(true);
  };

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p className="text-lg font-semibold">Loading...</p>
      </div>
    );

  if (error)
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p className="text-lg font-semibold">Error: {error}</p>
      </div>
    );

  if (!order)
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p className="text-lg font-semibold">Sorry, order not found.</p>
      </div>
    );

  return (
    <div className="bg-background min-h-screen">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <BackButton href={backHref} />
        </div>

        <h1 className="mb-6 text-center text-3xl font-bold">Order Dashboard</h1>
        <div className="space-y-8">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl">
                  Order #{order.orderNumber}
                </CardTitle>
                <Badge
                  variant={
                    order.order_type === "catering" ? "secondary" : "default"
                  }
                  className="text-sm"
                >
                  {order.order_type === "catering" ? "Catering" : "On Demand"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Order summary stats - 4 columns */}
              <div className="grid grid-cols-4 gap-4">
                <div className="rounded-lg border bg-gray-50 p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">
                    ${Number(order.orderTotal).toFixed(2)}
                  </p>
                  <p className="text-sm text-gray-600">Total</p>
                </div>
                <div className="rounded-lg border bg-gray-50 p-4 text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    ${Number(order.tip || 0).toFixed(2)}
                  </p>
                  <p className="text-sm text-gray-600">Tip</p>
                </div>
                <div className="rounded-lg border bg-gray-50 p-4 text-center">
                  <p className="text-lg font-semibold text-gray-800">
                    {new Date(order.pickupDateTime).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-gray-600">Pickup</p>
                  <p className="text-xs text-gray-500">
                    {new Date(order.pickupDateTime).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div className="rounded-lg border bg-gray-50 p-4 text-center">
                  <p className="text-lg font-semibold text-gray-800">
                    {new Date(order.arrivalDateTime).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-gray-600">Delivery</p>
                  <p className="text-xs text-gray-500">
                    {new Date(order.arrivalDateTime).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>

              {/* Location information - side by side */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border bg-gray-50 p-4">
                  <div className="mb-3 flex items-center space-x-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100">
                      <MapPinIcon className="h-4 w-4 text-blue-600" />
                    </div>
                    <span className="font-semibold text-gray-800">
                      Pickup Location
                    </span>
                  </div>
                  <p className="mb-2 text-sm text-gray-900">
                    {order.pickupAddress
                      ? (() => {
                          const addressParts = [
                            order.pickupAddress.street1,
                            order.pickupAddress.city,
                            order.pickupAddress.state,
                            order.pickupAddress.zip,
                          ].filter((part) => part && part !== "undefined");
                          return addressParts.length > 0
                            ? addressParts.join(", ")
                            : "N/A";
                        })()
                      : "N/A"}
                  </p>
                  <p className="text-xs text-gray-500">
                    Location:{" "}
                    {order.pickupAddress?.locationNumber || "415343421"}
                  </p>
                </div>
                <div className="rounded-lg border bg-gray-50 p-4">
                  <div className="mb-3 flex items-center space-x-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100">
                      <MapPinIcon className="h-4 w-4 text-green-600" />
                    </div>
                    <span className="font-semibold text-gray-800">
                      Delivery Location
                    </span>
                  </div>
                  <p className="mb-2 text-sm text-gray-900">
                    {order.deliveryAddress
                      ? (() => {
                          const addressParts = [
                            order.deliveryAddress.street1,
                            order.deliveryAddress.city,
                            order.deliveryAddress.state,
                            order.deliveryAddress.zip,
                          ].filter((part) => part && part !== "undefined");
                          return addressParts.length > 0
                            ? addressParts.join(", ")
                            : "N/A";
                        })()
                      : "N/A"}
                  </p>
                  <p className="text-xs text-gray-500">
                    Parking:{" "}
                    {order.deliveryAddress?.parkingLoading || "yes we have"}
                  </p>
                </div>
              </div>

              {/* Order type specific details */}
              {order.order_type === "catering" ? (
                <div className="rounded-lg border bg-gray-50 p-4">
                  <div className="mb-3 flex items-center space-x-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-100">
                      <UsersIcon className="h-4 w-4 text-purple-600" />
                    </div>
                    <span className="font-semibold text-gray-800">
                      Catering Details
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Headcount:</span>{" "}
                    {order.headcount || "40"} &nbsp;&nbsp;
                    <span className="font-medium">Need Host:</span>{" "}
                    {order.needHost || "NO"}
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border bg-gray-50 p-4">
                  <div className="mb-3 flex items-center space-x-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-100">
                      <FileTextIcon className="h-4 w-4 text-orange-600" />
                    </div>
                    <span className="font-semibold text-gray-800">
                      On-Demand Details
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Item Delivered:</span>{" "}
                    {order.itemDelivered || "N/A"} &nbsp;&nbsp;
                    <span className="font-medium">Vehicle Type:</span>{" "}
                    {order.vehicleType || "N/A"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes section - separate card with yellow background */}
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-yellow-100">
                    <FileTextIcon className="h-4 w-4 text-yellow-600" />
                  </div>
                  <span className="font-semibold text-gray-800">Notes</span>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Special:</span>{" "}
                    {order.specialNotes || "Testing Order"}
                  </p>
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Pickup:</span>{" "}
                    {order.pickupNotes || "Testing Order"}
                  </p>
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Client:</span>{" "}
                    {order.user?.name ||
                      order.clientAttention ||
                      "Meadow Soprano"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <DriverStatusCard
            order={{
              id: order.id,
              status: order.status,
              driver_status: order.driverStatus,
              user_id: order.userId,
              pickup_time: order.pickupDateTime,
              arrival_time: order.arrivalDateTime,
              complete_time: order.completeDateTime,
              updated_at: order.updatedAt,
            }}
            driverInfo={driverInfo}
            updateDriverStatus={updateDriverStatus}
            onCompletionRequest={handleCompletionRequest}
            hasExistingPOD={hasExistingPOD}
          />

          {/* POD Photo Viewer - show existing photo if available */}
          {hasExistingPOD && getPODUrl() && (
            <Card className="border-green-200 bg-green-50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Camera className="h-4 w-4 text-green-600" />
                  Proof of Delivery
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ProofOfDeliveryViewer
                  photoUrl={getPODUrl()!}
                  deliveryId={order.id}
                  orderNumber={order.orderNumber}
                  showDownload={true}
                  className="max-w-xs"
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* POD Confirmation Dialog */}
      <Dialog open={showPODConfirm} onOpenChange={setShowPODConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Complete Delivery
            </DialogTitle>
            <DialogDescription>
              Would you like to add a proof of delivery photo before marking this
              order as complete?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={handleCompleteWithoutPOD}
              className="w-full sm:w-auto"
            >
              Complete without Photo
            </Button>
            <Button
              onClick={handleCompleteWithPOD}
              className="w-full sm:w-auto"
            >
              <Camera className="mr-2 h-4 w-4" />
              Add Photo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* POD Capture Dialog */}
      <Dialog open={showPODCapture} onOpenChange={setShowPODCapture}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Proof of Delivery Photo
            </DialogTitle>
            <DialogDescription>
              Take or upload a photo showing the delivery has been completed.
            </DialogDescription>
          </DialogHeader>
          {order && (
            <ProofOfDeliveryCapture
              deliveryId={order.id}
              orderNumber={order.orderNumber}
              onUploadComplete={handlePODUploadComplete}
              onCancel={handlePODCancel}
              uploadEndpoint={`/api/orders/${encodeURIComponent(order.orderNumber)}/pod`}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Page wrapper component that includes the order page with proper layout
type DriverDashboardPageProps = { backHref?: string };

const DriverDashboardPage: React.FC<DriverDashboardPageProps> = ({
  backHref = "/driver",
}) => {
  const [orderNumber, setOrderNumber] = useState("");
  const pathname = usePathname();

  useEffect(() => {
    if (pathname) {
      const pathSegments = pathname.split("/");
      const lastSegment = pathSegments[pathSegments.length - 1];
      // Ensure lastSegment is not undefined before setting state
      if (lastSegment) {
        setOrderNumber(lastSegment);
      }
    }
  }, [pathname]);

  return (
    <div className="bg-background relative min-h-screen w-full">
      <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-stroke/0 via-stroke to-stroke/0 dark:via-dark-3" />

      {/* Main content area with responsive padding */}
      <main className="mx-auto w-full max-w-[1440px] px-4 pb-16 sm:px-6 md:pt-8 lg:px-8 lg:pt-8">
        <div className="grid grid-cols-1 gap-8">
          {/* Breadcrumb can be added here if needed */}
          <OrderPage backHref={backHref} />
        </div>
      </main>
    </div>
  );
};

export default DriverDashboardPage;
