"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  CalendarIcon,
  MapPinIcon,
  FileTextIcon,
  CarIcon,
  UsersIcon,
  ArrowLeftIcon,
  PackageIcon,
  ClockIcon,
  UserIcon,
  PhoneIcon,
  MailIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePathname, useRouter } from "next/navigation";

// Types for vendor order data
interface VendorOrderData {
  id: string;
  orderNumber: string;
  orderType: "catering" | "on_demand";
  status: string;
  pickupDateTime: string | null;
  arrivalDateTime: string | null;
  completeDateTime?: string | null;
  orderTotal: number;
  tip?: number;
  brokerage?: string | null;
  clientAttention?: string | null;
  pickupNotes?: string | null;
  specialNotes?: string | null;
  headcount?: number | null;
  needHost?: string | null;
  hoursNeeded?: number | null;
  numberOfHosts?: number | null;
  vehicleType?: string | null;
  itemDelivered?: string | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  weight?: number | null;
  image?: string | null;
  driverStatus?: string | null;
  pickupAddress: {
    id: string;
    name?: string | null;
    street1: string;
    street2?: string | null;
    city: string;
    state: string;
    zip: string;
    locationNumber?: string | null;
    parkingLoading?: string | null;
    longitude?: number | null;
    latitude?: number | null;
  };
  deliveryAddress: {
    id: string;
    name?: string | null;
    street1: string;
    street2?: string | null;
    city: string;
    state: string;
    zip: string;
    locationNumber?: string | null;
    parkingLoading?: string | null;
    longitude?: number | null;
    latitude?: number | null;
  };
  dispatches?: Array<{
    id: string;
    driver: {
      id: string;
      name: string | null;
      email: string | null;
      contactNumber: string | null;
    };
  }>;
  fileUploads?: Array<{
    id: string;
    fileName: string;
    fileUrl: string;
    fileType: string;
  }>;
}

const BackButton: React.FC = () => {
  const router = useRouter();

  return (
    <Button
      variant="ghost"
      size="sm"
      className="hover:bg-accent flex items-center gap-2"
      onClick={() => router.push("/vendor")}
    >
      <ArrowLeftIcon className="h-4 w-4" />
      Back to Dashboard
    </Button>
  );
};

const VendorOrderDetails: React.FC = () => {
  const [order, setOrder] = useState<VendorOrderData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const fetchOrder = async (currentPathname: string) => {
      const orderNumber = currentPathname.split("/").pop();

      if (!orderNumber) {
        setError("Could not determine order number from URL.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/vendor/orders/${orderNumber}`);

        if (!response.ok) {
          throw new Error("Failed to fetch order");
        }

        const data: VendorOrderData = await response.json();
        setOrder(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    if (pathname) {
      fetchOrder(pathname);
    } else {
      setLoading(false);
    }
  }, [pathname]);

  const formatAddress = (address: VendorOrderData["pickupAddress"]) => {
    if (!address) return "N/A";

    const parts = [
      address.street1,
      address.street2,
      address.city,
      address.state,
      address.zip,
    ].filter(Boolean);

    return parts.join(", ");
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount);
  };

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

  const getOrderTypeBadge = (type: string) => {
    return (
      <Badge
        variant={type === "catering" ? "secondary" : "default"}
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
          <p className="text-lg font-semibold">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-red-600">{error}</p>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Order Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-gray-600">
              The requested order could not be found.
            </p>
            <Button onClick={() => (window.location.href = "/vendor")}>
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const driverInfo = order.dispatches?.[0]?.driver || null;

  return (
    <div className="bg-background min-h-screen">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-4 pt-4">
          <BackButton />
        </div>

        <h1 className="mb-4 text-center text-xl font-bold">Order Details</h1>

        <div className="space-y-4">
          {/* Order Header */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  Order #{order.orderNumber}
                </CardTitle>
                <div className="flex gap-2">
                  {getOrderTypeBadge(order.orderType)}
                  {getStatusBadge(order.status)}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Order Summary - Compact Grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg bg-gray-50 p-3 text-center">
                  <p className="text-muted-foreground text-xs">Total</p>
                  <p className="text-lg font-bold">
                    {formatCurrency(order.orderTotal)}
                  </p>
                </div>

                {order.tip && order.tip > 0 && (
                  <div className="rounded-lg bg-gray-50 p-3 text-center">
                    <p className="text-muted-foreground text-xs">Tip</p>
                    <p className="text-lg font-bold">
                      {formatCurrency(order.tip)}
                    </p>
                  </div>
                )}

                {order.pickupDateTime && (
                  <div className="rounded-lg bg-blue-50 p-3 text-center">
                    <p className="text-muted-foreground text-xs">Pickup</p>
                    <p className="text-sm font-semibold">
                      {new Date(order.pickupDateTime).toLocaleDateString()}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {new Date(order.pickupDateTime).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                )}

                {order.arrivalDateTime && (
                  <div className="rounded-lg bg-green-50 p-3 text-center">
                    <p className="text-muted-foreground text-xs">Delivery</p>
                    <p className="text-sm font-semibold">
                      {new Date(order.arrivalDateTime).toLocaleDateString()}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {new Date(order.arrivalDateTime).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                )}
              </div>

              {/* Addresses - More Compact */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <div className="mb-2 flex items-center space-x-2">
                    <MapPinIcon className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-semibold">
                      Pickup Location
                    </span>
                  </div>
                  <p className="text-sm">
                    {formatAddress(order.pickupAddress)}
                  </p>
                  {(order.pickupAddress.locationNumber ||
                    order.pickupAddress.parkingLoading) && (
                    <div className="text-muted-foreground mt-1 text-xs">
                      {order.pickupAddress.locationNumber &&
                        `Location: ${order.pickupAddress.locationNumber}`}
                      {order.pickupAddress.locationNumber &&
                        order.pickupAddress.parkingLoading &&
                        " • "}
                      {order.pickupAddress.parkingLoading &&
                        `Parking: ${order.pickupAddress.parkingLoading}`}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border p-3">
                  <div className="mb-2 flex items-center space-x-2">
                    <MapPinIcon className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-semibold">
                      Delivery Location
                    </span>
                  </div>
                  <p className="text-sm">
                    {formatAddress(order.deliveryAddress)}
                  </p>
                  {(order.deliveryAddress.locationNumber ||
                    order.deliveryAddress.parkingLoading) && (
                    <div className="text-muted-foreground mt-1 text-xs">
                      {order.deliveryAddress.locationNumber &&
                        `Location: ${order.deliveryAddress.locationNumber}`}
                      {order.deliveryAddress.locationNumber &&
                        order.deliveryAddress.parkingLoading &&
                        " • "}
                      {order.deliveryAddress.parkingLoading &&
                        `Parking: ${order.deliveryAddress.parkingLoading}`}
                    </div>
                  )}
                </div>
              </div>

              {/* Order Type Specific Details - Inline Style */}
              {order.orderType === "catering" ? (
                <div className="rounded-lg bg-blue-50 p-3">
                  <h3 className="mb-2 flex items-center text-sm font-semibold">
                    <UsersIcon className="mr-2 h-4 w-4 text-blue-600" />
                    Catering Details
                  </h3>
                  <div className="flex flex-wrap gap-4 text-sm">
                    {order.headcount && (
                      <span>
                        <strong>Headcount:</strong> {order.headcount}
                      </span>
                    )}
                    {order.needHost && (
                      <span>
                        <strong>Need Host:</strong> {order.needHost}
                      </span>
                    )}
                    {order.numberOfHosts && (
                      <span>
                        <strong>Hosts:</strong> {order.numberOfHosts}
                      </span>
                    )}
                    {order.hoursNeeded && (
                      <span>
                        <strong>Hours:</strong> {order.hoursNeeded}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg bg-green-50 p-3">
                  <h3 className="mb-2 flex items-center text-sm font-semibold">
                    <CarIcon className="mr-2 h-4 w-4 text-green-600" />
                    On-Demand Details
                  </h3>
                  <div className="flex flex-wrap gap-4 text-sm">
                    {order.itemDelivered && (
                      <span>
                        <strong>Item:</strong> {order.itemDelivered}
                      </span>
                    )}
                    {order.vehicleType && (
                      <span>
                        <strong>Vehicle:</strong> {order.vehicleType}
                      </span>
                    )}
                    {order.length && order.width && order.height && (
                      <span>
                        <strong>Size:</strong> {order.length}×{order.width}×
                        {order.height}
                      </span>
                    )}
                    {order.weight && (
                      <span>
                        <strong>Weight:</strong> {order.weight}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Notes - Compact Layout */}
              {(order.specialNotes ||
                order.pickupNotes ||
                order.clientAttention) && (
                <div className="rounded-lg bg-yellow-50 p-3">
                  <h3 className="mb-2 flex items-center text-sm font-semibold">
                    <FileTextIcon className="mr-2 h-4 w-4 text-yellow-600" />
                    Notes
                  </h3>
                  <div className="space-y-1 text-sm">
                    {order.specialNotes && (
                      <div>
                        <strong>Special:</strong> {order.specialNotes}
                      </div>
                    )}
                    {order.pickupNotes && (
                      <div>
                        <strong>Pickup:</strong> {order.pickupNotes}
                      </div>
                    )}
                    {order.clientAttention && (
                      <div>
                        <strong>Client:</strong> {order.clientAttention}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Driver Information */}
          {driverInfo && (
            <Card>
              <CardHeader>
                <CardTitle>Driver Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="flex items-center space-x-2">
                      <UserIcon className="text-muted-foreground h-4 w-4" />
                      <span className="text-sm">
                        Name: {driverInfo.name || "Not provided"}
                      </span>
                    </div>
                    {driverInfo.email && (
                      <div className="flex items-center space-x-2">
                        <MailIcon className="text-muted-foreground h-4 w-4" />
                        <span className="text-sm">
                          Email: {driverInfo.email}
                        </span>
                      </div>
                    )}
                    {driverInfo.contactNumber && (
                      <div className="flex items-center space-x-2">
                        <PhoneIcon className="text-muted-foreground h-4 w-4" />
                        <span className="text-sm">
                          Phone: {driverInfo.contactNumber}
                        </span>
                      </div>
                    )}
                  </div>

                  {order.driverStatus && (
                    <div className="mt-4">
                      <p className="text-sm font-medium">Driver Status:</p>
                      <Badge variant="outline" className="mt-1">
                        {order.driverStatus.replace(/_/g, " ").toUpperCase()}
                      </Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* File Uploads */}
          {order.fileUploads && order.fileUploads.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Files</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {order.fileUploads.map((file) => (
                    <div key={file.id} className="flex items-center space-x-2">
                      <FileTextIcon className="text-muted-foreground h-4 w-4" />
                      <a
                        href={file.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline"
                      >
                        {file.fileName}
                      </a>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default VendorOrderDetails;
