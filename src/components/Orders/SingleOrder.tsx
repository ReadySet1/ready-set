// src/components/Orders/SingleOrder.tsx

import React, { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ClipboardList,
  AlertCircle,
  Truck,
  User,
  Calendar,
  MapPin,
  FileText,
  ChevronUp,
  ChevronDown,
  Clock,
  Package,
  Phone,
  Mail,
} from "lucide-react";
import toast from "react-hot-toast";
import { DriverStatusCard } from "./DriverStatus";
import OrderHeader from "./ui/OrderHeader";
import OrderDetails from "./ui/OrderDetails";
import AddressInfo from "./ui/AddressInfo";
import CustomerInfo from "./ui/CustomerInfo";
import AdditionalInfo from "./ui/AdditionalInfo";
import DriverAssignmentDialog from "./ui/DriverAssignmentDialog";
import OrderStatusCard from "./OrderStatus";
import { usePathname, useRouter } from "next/navigation";
import { OrderFilesManager } from "./ui/OrderFiles";
import {
  Driver,
  Order,
  OrderStatus,
  OrderType,
  VehicleType,
  DriverStatus,
} from "@/types/order";
import { Skeleton } from "@/components/ui/skeleton";
import { FileUpload } from "@/types/file";
import { createClient } from "@/utils/supabase/client";
import { syncOrderStatusWithBroker } from "@/lib/services/brokerSyncService";
import { UserType } from "@/types/user";

// Make sure the bucket name is user-assets
const STORAGE_BUCKET = "user-assets";

interface SingleOrderProps {
  onDeleteSuccess: () => void;
  showHeader?: boolean;
}

// Enhanced status config with more detailed styling
const statusConfig = {
  active: {
    className:
      "bg-gradient-to-r from-amber-50 to-amber-100 text-amber-800 border border-amber-200",
    icon: <AlertCircle className="mr-1 h-3 w-3" />,
    color: "amber",
  },
  assigned: {
    className:
      "bg-gradient-to-r from-blue-50 to-blue-100 text-blue-800 border border-blue-200",
    icon: <Truck className="mr-1 h-3 w-3" />,
    color: "blue",
  },
  cancelled: {
    className:
      "bg-gradient-to-r from-red-50 to-red-100 text-red-800 border border-red-200",
    icon: <AlertCircle className="mr-1 h-3 w-3" />,
    color: "red",
  },
  completed: {
    className:
      "bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-800 border border-emerald-200",
    icon: <ClipboardList className="mr-1 h-3 w-3" />,
    color: "emerald",
  },
};

const getStatusConfig = (status: string) => {
  return (
    statusConfig[status as keyof typeof statusConfig] || {
      className:
        "bg-gradient-to-r from-gray-50 to-gray-100 text-gray-800 border border-gray-200",
      icon: null,
      color: "gray",
    }
  );
};

// Modern loading skeleton
const OrderSkeleton: React.FC = () => (
  <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
    <div className="container mx-auto px-6 py-8">
      {/* Header Skeleton */}
      <div className="mb-8">
        <Skeleton className="mb-4 h-12 w-80" />
        <Skeleton className="h-6 w-60" />
      </div>

      {/* Main Content Skeleton */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-80 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  </div>
);

const SingleOrder: React.FC<SingleOrderProps> = ({
  onDeleteSuccess,
  showHeader = true,
}) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isDriverDialogOpen, setIsDriverDialogOpen] = useState(false);
  const [isDriverAssigned, setIsDriverAssigned] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [driverInfo, setDriverInfo] = useState<Driver | null>(null);
  const [files, setFiles] = useState<FileUpload[]>([]);

  const router = useRouter();
  const pathname = usePathname();
  const orderNumber = decodeURIComponent(
    (pathname ?? "").split("/").pop() || "",
  );
  const supabase = createClient();
  const [userRoles, setUserRoles] = useState<{
    isAdmin: boolean;
    isSuperAdmin: boolean;
    isHelpdesk: boolean;
  }>({
    isAdmin: false,
    isSuperAdmin: false,
    isHelpdesk: false,
  });

  // Check for bucket existence but don't try to create it (requires admin privileges)
  const ensureStorageBucketExists = useCallback(async () => {
    try {
      console.log("Checking storage bucket configuration:", STORAGE_BUCKET);

      // Refresh auth session
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        console.error("Authentication error:", sessionError?.message);
        return;
      }

      // Check if the bucket exists
      const { data: buckets, error: bucketsError } =
        await supabase.storage.listBuckets();

      if (bucketsError) {
        console.error("Error listing buckets:", bucketsError.message);

        // Don't try to create the bucket - just log the error
        if (bucketsError.message.includes("permission")) {
          console.log(
            "Permission error listing buckets - this is expected for non-admin users",
          );
        }
        return;
      }

      // Just check if the bucket exists, don't try to create it
      const bucketExists =
        buckets &&
        Array.isArray(buckets) &&
        buckets.some((bucket) => bucket.name === STORAGE_BUCKET);
      console.log(
        "Available buckets:",
        buckets?.map((b) => b.name).join(", ") || "none",
      );

      if (!bucketExists) {
        console.log(
          `Bucket '${STORAGE_BUCKET}' not found in the list, but it might still exist with restricted permissions`,
        );

        // Test accessing the bucket to see if it's actually accessible
        const { data, error: accessError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .list();

        if (accessError) {
          if (accessError.message.includes("not found")) {
            console.error(
              `Bucket '${STORAGE_BUCKET}' does not exist or is not accessible`,
            );
            toast.error(
              "File storage is not configured properly. Please contact support.",
            );
          } else {
            console.log(
              `Cannot access bucket contents but it might exist: ${accessError.message}`,
            );
          }
        } else {
          console.log(`Bucket '${STORAGE_BUCKET}' exists and is accessible`);
        }
      } else {
        console.log(`Bucket '${STORAGE_BUCKET}' exists in the list`);
      }
    } catch (error) {
      console.error("Error checking storage bucket:", error);
    }
  }, [supabase]);

  const fetchOrderDetails = useCallback(async () => {
    if (!orderNumber) {
      console.error("No order number available");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    console.log("Fetching order details for:", orderNumber);

    try {
      // Refresh auth session before making the request
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        console.error("Authentication error:", sessionError?.message);
        toast.error("Authentication error. Please try logging in again.");
        router.push("/auth/login"); // Redirect to login if session is invalid
        return;
      }

      // Fetch order details with auth header
      const orderResponse = await fetch(
        `/api/orders/${encodeURIComponent(orderNumber)}?include=dispatch.driver`,
        {
          credentials: "include",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!orderResponse.ok) {
        // Get more detailed error information
        let errorText = "";
        try {
          const errorData = await orderResponse.json();
          errorText = JSON.stringify(errorData);

          // If unauthorized, redirect to login
          if (orderResponse.status === 401) {
            toast.error("Session expired. Please log in again.");
            router.push("/auth/login");
            return;
          }
        } catch (parseError) {
          errorText = "Could not parse error response";
        }

        console.error(
          `Order API error (${orderResponse.status}): ${errorText}`,
        );
        throw new Error(
          `HTTP error! status: ${orderResponse.status}, details: ${errorText}`,
        );
      }

      const orderData = await orderResponse.json();
      console.log("Order data received:", orderData);

      // Transform the data to match our types
      const transformedOrder: Order = {
        ...orderData,
        // Ensure required fields for OnDemand orders
        ...(orderData.order_type === "on_demand" && {
          vehicleType: orderData.vehicleType || VehicleType.CAR,
        }),
        id: String(orderData.id),
      };

      setOrder(transformedOrder);

      // Set driver info if available
      if (orderData.dispatches?.length > 0 && orderData.dispatches[0]?.driver) {
        setDriverInfo(orderData.dispatches[0].driver);
        setIsDriverAssigned(true);
      } else {
        setDriverInfo(null);
        setIsDriverAssigned(false);
      }

      // Fetch files with improved error handling
      try {
        console.log(`Fetching files for order: ${orderNumber}`);
        const filesResponse = await fetch(
          `/api/orders/${encodeURIComponent(orderNumber)}/files`,
          {
            credentials: "include",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
          },
        );

        if (!filesResponse.ok) {
          throw new Error("Failed to fetch files");
        }

        const filesData = await filesResponse.json();
        console.log("Files data received:", filesData);

        const filesArray = Array.isArray(filesData)
          ? filesData
          : Object.values(filesData);
        const transformedFiles = filesArray.map(
          (file: {
            id: string;
            fileName: string;
            fileType: string | null;
            fileSize: number;
            fileUrl: string;
            entityType: string;
            entityId: string;
            category?: string;
            uploadedAt: string | null;
            updatedAt: string | null;
            userId?: string;
            cateringRequestId?: number;
            onDemandId?: number;
            isTemporary?: boolean;
          }): FileUpload => ({
            ...file,
            uploadedAt: file.uploadedAt
              ? new Date(file.uploadedAt)
              : new Date(),
            updatedAt: file.updatedAt ? new Date(file.updatedAt) : new Date(),
            cateringRequestId: file.cateringRequestId
              ? Number(file.cateringRequestId)
              : undefined,
            onDemandId: file.onDemandId ? Number(file.onDemandId) : undefined,
            isTemporary: file.isTemporary || false,
          }),
        );

        setFiles(transformedFiles);
      } catch (fileError) {
        console.error("Error fetching files:", fileError);
        toast.error("Failed to load order files");
      }
    } catch (error) {
      console.error("Error fetching order:", error);
      // Log more details about the error
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
      }
      toast.error("Failed to load order details");
    } finally {
      setIsLoading(false);
    }
  }, [
    orderNumber,
    supabase.auth,
    router,
    setIsLoading,
    setOrder,
    setDriverInfo,
    setIsDriverAssigned,
    setFiles,
  ]);

  // Fetch order details on mount
  useEffect(() => {
    fetchOrderDetails();
    ensureStorageBucketExists(); // Add this line to check the bucket on mount
  }, [fetchOrderDetails, ensureStorageBucketExists]);

  // Fetch drivers on mount
  useEffect(() => {
    const fetchDrivers = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session) {
          console.error("Authentication error:", sessionError?.message);
          toast.error("Authentication error. Please try logging in again.");
          router.push("/auth/login");
          return;
        }

        const response = await fetch("/api/drivers", {
          credentials: "include",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        });
        if (response.ok) {
          const data = await response.json();
          setDrivers(data);
        } else {
          if (response.status === 401) {
            toast.error("Session expired. Please log in again.");
            router.push("/auth/login");
            return;
          }
          console.error("Failed to fetch drivers");
          toast.error("Failed to load available drivers");
        }
      } catch (error) {
        console.error("Error fetching drivers:", error);
        toast.error("An error occurred while loading drivers");
      }
    };

    fetchDrivers();
  }, [setDrivers, supabase.auth, router]);

  const handleOpenDriverDialog = () => {
    setIsDriverDialogOpen(true);
    if (driverInfo) {
      setSelectedDriver(driverInfo.id);
    }
  };

  const handleAssignOrEditDriver = async () => {
    if (!order || !selectedDriver) return;

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        console.error("Authentication error:", sessionError?.message);
        toast.error("Authentication error. Please try logging in again.");
        router.push("/auth/login");
        return;
      }

      const response = await fetch("/api/orders/assignDriver", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          orderId: order.id,
          driverId: selectedDriver,
          orderType:
            order.order_type === "on_demand" ? "on_demand" : "catering",
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          toast.error("Session expired. Please log in again.");
          router.push("/auth/login");
          return;
        }

        // Get error details
        let errorText = "";
        try {
          const errorData = await response.json();
          errorText = errorData.error || errorData.message || "";
        } catch (parseError) {
          errorText = "";
        }

        throw new Error(
          `Failed to assign/edit driver: ${errorText || response.statusText}`,
        );
      }

      await fetchOrderDetails();
      setIsDriverDialogOpen(false);
      toast.success(
        isDriverAssigned
          ? "Driver updated successfully!"
          : "Driver assigned successfully!",
      );
    } catch (error) {
      console.error("Failed to assign/edit driver:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to assign/edit driver. Please try again.",
      );
    }
  };

  const handleDriverSelection = (driverId: string) => {
    setSelectedDriver(driverId);
  };

  const updateDriverStatus = async (newStatus: DriverStatus) => {
    if (!order) return;

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        console.error("Authentication error:", sessionError?.message);
        toast.error("Authentication error. Please try logging in again.");
        router.push("/auth/login");
        return;
      }

      console.log(
        `Updating driver status for order ${order.orderNumber} to:`,
        newStatus,
      );

      const response = await fetch(
        `/api/orders/${encodeURIComponent(order.orderNumber)}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ driverStatus: newStatus }),
        },
      );

      if (!response.ok) {
        if (response.status === 401) {
          toast.error("Session expired. Please log in again.");
          router.push("/auth/login");
          return;
        }

        // Get error details
        let errorText = "";
        try {
          const errorData = await response.json();
          errorText = errorData.error || errorData.message || "";
        } catch (parseError) {
          errorText = "";
        }

        throw new Error(
          `Failed to update driver status: ${errorText || response.statusText}`,
        );
      }

      const updatedOrder = await response.json();
      console.log(
        `Driver status for order ${order.orderNumber} updated response:`,
        updatedOrder,
      );
      setOrder(updatedOrder);
      toast.success("Driver status updated successfully!");

      // If driver status is updated to completed, also update the main order status
      console.log(
        `Checking if driver status '${newStatus}' requires order status update.`,
      );
      if (newStatus === DriverStatus.COMPLETED) {
        console.log(
          `Triggering order status update to COMPLETED for order ${order.orderNumber}`,
        );
        await handleOrderStatusChange(OrderStatus.COMPLETED);
      }
    } catch (error) {
      console.error("Error updating driver status:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update driver status. Please try again.",
      );
    }
  };

  const handleOrderStatusChange = async (newStatus: OrderStatus) => {
    if (!order) return;

    const internalUpdatePromise = async () => {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        console.error("Authentication error:", sessionError?.message);
        toast.error("Authentication error. Please try logging in again.");
        router.push("/auth/login");
        return;
      }

      console.log(
        `Updating internal ORDER status for order ${order.orderNumber} to:`,
        newStatus,
      );

      const response = await fetch(
        `/api/orders/${encodeURIComponent(order.orderNumber)}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ status: newStatus }),
        },
      );

      if (!response.ok) {
        if (response.status === 401) {
          toast.error("Session expired. Please log in again.");
          router.push("/auth/login");
          return;
        }

        let errorText = "";
        try {
          const errorData = await response.json();
          errorText = errorData.error || errorData.message || "";
        } catch (parseError) {
          errorText = "";
        }
        throw new Error(
          `Failed to update internal order status: ${errorText || response.statusText}`,
        );
      }
      const updatedOrderData = await response.json();
      console.log(
        `Internal order status for order ${order.orderNumber} updated response:`,
        updatedOrderData,
      );
      return updatedOrderData as Order;
    };

    try {
      // Perform internal update first
      const updatedOrder = await internalUpdatePromise();
      if (!updatedOrder) return; // Handle case where promise returns undefined due to auth error

      setOrder(updatedOrder); // Update local state immediately after internal success
      toast.success("Order status updated successfully!");

      // Sync with Broker
      await syncOrderStatusWithBroker(updatedOrder, newStatus);
    } catch (error) {
      // Error during internal update
      console.error("Error updating internal order status:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update order status. Please try again.",
      );
    }
  };

  const fetchUserRoles = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        console.error("No authenticated user found");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("type")
        .eq("id", user.id)
        .single();

      if (profile) {
        setUserRoles({
          isAdmin: profile.type === UserType.ADMIN,
          isSuperAdmin: profile.type === UserType.SUPER_ADMIN,
          isHelpdesk: profile.type === UserType.HELPDESK,
        });
      }
    } catch (error) {
      console.error("Error fetching user roles:", error);
    }
  }, [supabase]);

  useEffect(() => {
    fetchUserRoles();
  }, [fetchUserRoles]);

  const userCanEditOrder = () => {
    return userRoles.isAdmin || userRoles.isSuperAdmin || userRoles.isHelpdesk;
  };

  if (isLoading) {
    return <OrderSkeleton />;
  }

  if (!order) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-50">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="mx-4 max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl"
        >
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
            <AlertCircle className="h-8 w-8 text-slate-400" />
          </div>
          <h2 className="mb-3 text-2xl font-bold text-slate-800">
            Order Not Found
          </h2>
          <p className="mb-6 text-slate-500">
            We couldn't find order:{" "}
            <span className="font-medium text-slate-700">{orderNumber}</span>
          </p>
          <Button
            variant="default"
            onClick={() => window.history.back()}
            className="rounded-xl bg-blue-600 px-6 py-2 text-white shadow-lg transition-all duration-200 hover:bg-blue-700 hover:shadow-xl"
          >
            Go Back
          </Button>
        </motion.div>
      </div>
    );
  }

  const statusInfo = getStatusConfig(order.status as string);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="container mx-auto px-6 py-8"
      >
        {/* Modern Header */}
        <div className="mb-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-4">
                <h1 className="text-3xl font-bold text-slate-800">
                  {order.order_type === "catering"
                    ? "Catering Request"
                    : "On-Demand Order"}
                </h1>
                <Badge
                  className={`${statusInfo.className} flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold shadow-sm`}
                >
                  {statusInfo.icon}
                  {order.status}
                </Badge>
              </div>
              <div className="flex items-center gap-6 text-slate-600">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  <span className="font-medium">{order.orderNumber}</span>
                </div>
                {order.pickupDateTime && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {new Date(order.pickupDateTime).toLocaleDateString(
                        undefined,
                        {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        },
                      )}
                    </span>
                  </div>
                )}
                {order.pickupDateTime && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>
                      {new Date(order.pickupDateTime).toLocaleTimeString(
                        undefined,
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleOpenDriverDialog}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-white shadow-lg transition-all duration-200 hover:bg-blue-700 hover:shadow-xl"
              >
                <Truck className="h-4 w-4" />
                {isDriverAssigned ? "Update Driver" : "Assign Driver"}
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Left Column - Main Content */}
          <div className="space-y-8 lg:col-span-2">
            {/* Driver & Status Section */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-6">
                <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-800">
                  <Truck className="h-5 w-5 text-blue-600" />
                  Driver & Status
                </h2>
              </div>
              <div className="space-y-6 p-6">
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
                />
                <Separator />
                <OrderStatusCard
                  order_type={order.order_type}
                  initialStatus={order.status}
                  orderId={order.id}
                  onStatusChange={handleOrderStatusChange}
                />
              </div>
            </div>

            {/* Order Details */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-6">
                <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-800">
                  <ClipboardList className="h-5 w-5 text-amber-600" />
                  Order Details
                </h2>
              </div>
              <div className="p-6">
                <OrderDetails order={order} />
              </div>
            </div>

            {/* Addresses */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-6">
                <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-800">
                  <MapPin className="h-5 w-5 text-green-600" />
                  Locations
                </h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {order.pickupAddress && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                        <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                        Pickup Location
                      </div>
                      <div className="border-l-2 border-blue-100 pl-4">
                        <AddressInfo address={order.pickupAddress} title="" />
                      </div>
                    </div>
                  )}
                  {order.deliveryAddress && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                        <div className="h-2 w-2 rounded-full bg-green-500"></div>
                        Delivery Location
                      </div>
                      <div className="border-l-2 border-green-100 pl-4">
                        <AddressInfo address={order.deliveryAddress} title="" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Additional Information */}
            {(order.clientAttention ||
              order.pickupNotes ||
              order.specialNotes) && (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 p-6">
                  <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-800">
                    <FileText className="h-5 w-5 text-purple-600" />
                    Additional Information
                  </h2>
                </div>
                <div className="p-6">
                  <AdditionalInfo
                    clientAttention={order.clientAttention}
                    pickupNotes={order.pickupNotes}
                    specialNotes={order.specialNotes}
                  />
                </div>
              </div>
            )}

            {/* Order Files */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-6">
                <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-800">
                  <FileText className="h-5 w-5 text-indigo-600" />
                  Order Files
                </h2>
              </div>
              <div className="p-6">
                <OrderFilesManager
                  orderNumber={order.orderNumber}
                  order_type={order.order_type}
                  orderId={order.id.toString()}
                  initialFiles={files}
                />
              </div>
            </div>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Customer Information */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-6">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                  <User className="h-5 w-5 text-blue-600" />
                  Customer
                </h2>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {order.user?.name && (
                    <div>
                      <div className="mb-1 text-sm font-medium text-slate-500">
                        Name
                      </div>
                      <div className="font-medium text-slate-800">
                        {order.user.name}
                      </div>
                    </div>
                  )}
                  {order.user?.email && (
                    <div>
                      <div className="mb-1 text-sm font-medium text-slate-500">
                        Email
                      </div>
                      <div className="flex items-center gap-2 text-slate-800">
                        <Mail className="h-4 w-4 text-slate-400" />
                        <a
                          href={`mailto:${order.user.email}`}
                          className="transition-colors hover:text-blue-600"
                        >
                          {order.user.email}
                        </a>
                      </div>
                    </div>
                  )}
                  {order.user?.contactNumber && (
                    <div>
                      <div className="mb-1 text-sm font-medium text-slate-500">
                        Phone
                      </div>
                      <div className="flex items-center gap-2 text-slate-800">
                        <Phone className="h-4 w-4 text-slate-400" />
                        <a
                          href={`tel:${order.user.contactNumber}`}
                          className="transition-colors hover:text-blue-600"
                        >
                          {order.user.contactNumber}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-6">
                <h2 className="text-lg font-semibold text-slate-800">
                  Quick Actions
                </h2>
              </div>
              <div className="space-y-3 p-6">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 hover:bg-slate-50"
                  onClick={() => window.print()}
                >
                  <FileText className="h-4 w-4" />
                  Print Order
                </Button>
                {order.user?.email && (
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 hover:bg-slate-50"
                    onClick={() =>
                      window.open(
                        `mailto:${order.user?.email}?subject=Regarding Order ${order.orderNumber}`,
                      )
                    }
                  >
                    <Mail className="h-4 w-4" />
                    Email Customer
                  </Button>
                )}
                {order.user?.contactNumber && (
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 hover:bg-slate-50"
                    onClick={() =>
                      window.open(`tel:${order.user?.contactNumber}`)
                    }
                  >
                    <Phone className="h-4 w-4" />
                    Call Customer
                  </Button>
                )}
              </div>
            </div>

            {/* Order Timeline */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-6">
                <h2 className="text-lg font-semibold text-slate-800">
                  Timeline
                </h2>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-2 h-2 w-2 rounded-full bg-blue-500"></div>
                    <div>
                      <div className="text-sm font-medium text-slate-800">
                        Order Created
                      </div>
                      <div className="text-xs text-slate-500">
                        {order.createdAt
                          ? new Date(order.createdAt).toLocaleString()
                          : "N/A"}
                      </div>
                    </div>
                  </div>
                  {order.pickupDateTime && (
                    <div className="flex items-start gap-3">
                      <div className="mt-2 h-2 w-2 rounded-full bg-amber-500"></div>
                      <div>
                        <div className="text-sm font-medium text-slate-800">
                          Scheduled Pickup
                        </div>
                        <div className="text-xs text-slate-500">
                          {new Date(order.pickupDateTime).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  )}
                  {order.arrivalDateTime && (
                    <div className="flex items-start gap-3">
                      <div className="mt-2 h-2 w-2 rounded-full bg-green-500"></div>
                      <div>
                        <div className="text-sm font-medium text-slate-800">
                          Driver Arrived
                        </div>
                        <div className="text-xs text-slate-500">
                          {new Date(order.arrivalDateTime).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  )}
                  {order.completeDateTime && (
                    <div className="flex items-start gap-3">
                      <div className="mt-2 h-2 w-2 rounded-full bg-emerald-500"></div>
                      <div>
                        <div className="text-sm font-medium text-slate-800">
                          Order Completed
                        </div>
                        <div className="text-xs text-slate-500">
                          {new Date(order.completeDateTime).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <DriverAssignmentDialog
        isOpen={isDriverDialogOpen}
        onOpenChange={setIsDriverDialogOpen}
        isDriverAssigned={isDriverAssigned}
        drivers={drivers}
        selectedDriver={selectedDriver}
        onDriverSelection={handleDriverSelection}
        onAssignOrEditDriver={handleAssignOrEditDriver}
      />
    </div>
  );
};

export default SingleOrder;
