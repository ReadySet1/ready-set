"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  CalendarIcon,
  MapPinIcon,
  UsersIcon,
  ClockIcon,
  DollarSignIcon,
  ArrowLeftIcon,
  FileTextIcon,
} from "lucide-react";
import { format } from "date-fns";

interface CateringOrderDetails {
  id: string;
  orderNumber: string;
  status: string;
  driverStatus: string | null;
  pickupDateTime: string;
  arrivalDateTime: string;
  completeDateTime: string | null;
  updatedAt: string;
  headcount: number;
  needHost: "YES" | "NO";
  hoursNeeded: number | null;
  numberOfHosts: number | null;
  brokerage: string;
  orderTotal: string;
  tip: string;
  clientAttention: string;
  pickupNotes: string | null;
  specialNotes: string | null;
  pickupAddress: {
    street1: string;
    street2: string | null;
    city: string;
    state: string;
    zip: string;
    locationNumber: string | null;
    parkingLoading: string | null;
  };
  deliveryAddress: {
    street1: string;
    street2: string | null;
    city: string;
    state: string;
    zip: string;
    locationNumber: string | null;
    parkingLoading: string | null;
  };
  dispatches: Array<{
    id: string;
    driverId: string;
    createdAt: string;
    driver: {
      id: string;
      name: string | null;
      contactNumber: string | null;
    };
  }>;
}

const CateringOrderDetailsPage: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const [orderDetails, setOrderDetails] = useState<CateringOrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const orderId = params.orderId as string;

  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/catering-requests/${orderId}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch order details');
        }

        const data = await response.json();
        setOrderDetails(data.order);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (orderId) {
      fetchOrderDetails();
    }
  }, [orderId]);

  const formatAddress = (address: any) => {
    if (!address) return "N/A";
    return `${address.street1}${address.street2 ? `, ${address.street2}` : ""}, ${address.city}, ${address.state} ${address.zip}`;
  };

  const formatDateTime = (dateString: string) => {
    try {
      return format(new Date(dateString), "MMMM do, yyyy 'at' h:mm a");
    } catch {
      return "N/A";
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      ACTIVE: { color: "bg-blue-100 text-blue-800", label: "Active" },
      COMPLETED: { color: "bg-green-100 text-green-800", label: "Completed" },
      CANCELLED: { color: "bg-red-100 text-red-800", label: "Cancelled" },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || { color: "bg-gray-100 text-gray-800", label: status };
    
    return (
      <Badge className={config.color}>
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-32">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading order details...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !orderDetails) {
    return (
      <div className="min-h-screen bg-gray-50 pt-32">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center">
            <div className="text-center">
              <p className="text-red-600 mb-4">{error || "Order not found"}</p>
              <Button onClick={() => router.push("/client")}>
                <ArrowLeftIcon className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-32">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push("/client")}
            className="mb-4"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Order Details</h1>
              <p className="text-gray-600 mt-2">Order #{orderDetails.orderNumber}</p>
            </div>
            {getStatusBadge(orderDetails.status)}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Order Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileTextIcon className="h-5 w-5 mr-2" />
                Order Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Order Number</p>
                  <p className="text-lg font-semibold">{orderDetails.orderNumber}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Brokerage</p>
                  <p className="text-lg">{orderDetails.brokerage}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Client Attention</p>
                  <p className="text-lg">{orderDetails.clientAttention}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Headcount</p>
                  <p className="text-lg">{orderDetails.headcount}</p>
                </div>
              </div>

              {orderDetails.needHost === "YES" && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-blue-800">Host Services</p>
                  <p className="text-blue-600">
                    {orderDetails.numberOfHosts} hosts for {orderDetails.hoursNeeded} hours
                  </p>
                </div>
              )}

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Order Total</p>
                  <p className="text-lg font-semibold">${orderDetails.orderTotal}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Tip</p>
                  <p className="text-lg">${orderDetails.tip || "0.00"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timing Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <ClockIcon className="h-5 w-5 mr-2" />
                Timing Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Pickup Time</p>
                <p className="text-lg">{formatDateTime(orderDetails.pickupDateTime)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Delivery Time</p>
                <p className="text-lg">{formatDateTime(orderDetails.arrivalDateTime)}</p>
              </div>
              {orderDetails.completeDateTime && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Completion Time</p>
                  <p className="text-lg">{formatDateTime(orderDetails.completeDateTime)}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-500">Last Updated</p>
                <p className="text-lg">{formatDateTime(orderDetails.updatedAt)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Pickup Location */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <MapPinIcon className="h-5 w-5 mr-2" />
                Pickup Location
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg">{formatAddress(orderDetails.pickupAddress)}</p>
              {orderDetails.pickupAddress.locationNumber && (
                <p className="text-sm text-gray-600 mt-2">
                  Location: {orderDetails.pickupAddress.locationNumber}
                </p>
              )}
              {orderDetails.pickupAddress.parkingLoading && (
                <p className="text-sm text-gray-600">
                  Parking/Loading: {orderDetails.pickupAddress.parkingLoading}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Delivery Location */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <MapPinIcon className="h-5 w-5 mr-2" />
                Delivery Location
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg">{formatAddress(orderDetails.deliveryAddress)}</p>
              {orderDetails.deliveryAddress.locationNumber && (
                <p className="text-sm text-gray-600 mt-2">
                  Location: {orderDetails.deliveryAddress.locationNumber}
                </p>
              )}
              {orderDetails.deliveryAddress.parkingLoading && (
                <p className="text-sm text-gray-600">
                  Parking/Loading: {orderDetails.deliveryAddress.parkingLoading}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Notes Section */}
        {(orderDetails.pickupNotes || orderDetails.specialNotes) && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Additional Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {orderDetails.pickupNotes && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Pickup Notes</p>
                  <p className="text-lg">{orderDetails.pickupNotes}</p>
                </div>
              )}
              {orderDetails.specialNotes && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Special Notes</p>
                  <p className="text-lg">{orderDetails.specialNotes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Driver Information */}
        {orderDetails.dispatches.length > 0 && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Driver Details</CardTitle>
            </CardHeader>
            <CardContent>
              {orderDetails.dispatches.map((dispatch) => (
                <div key={dispatch.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{dispatch.driver.name || "Unknown Driver"}</p>
                    <p className="text-sm text-gray-600">
                      Contact: {dispatch.driver.contactNumber || "N/A"}
                    </p>
                  </div>
                  <Badge variant="outline">
                    Assigned {format(new Date(dispatch.createdAt), "MMM do, yyyy")}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default CateringOrderDetailsPage; 