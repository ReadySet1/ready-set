import React from "react";
import { format } from "date-fns";
import { Check, Calendar, Clock, MapPin, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface CateringOrderSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderData: {
    orderId?: string;
    orderNumber: string;
    clientName: string;
    pickupDateTime: Date;
    deliveryDateTime: Date;
    pickupAddress: {
      street1: string;
      city: string;
      state: string;
      zip: string;
    };
    deliveryAddress: {
      street1: string;
      city: string;
      state: string;
      zip: string;
    };
    headcount: number;
    needHost: "YES" | "NO";
    hoursNeeded?: number;
    numberOfHosts?: number;
  } | null;
  onViewOrderDetails?: (orderId: string) => void;
}

export const CateringOrderSuccessModal: React.FC<
  CateringOrderSuccessModalProps
> = ({ isOpen, onClose, orderData, onViewOrderDetails }) => {
  console.log("🎨 CateringOrderSuccessModal render");
  console.log("isOpen:", isOpen);
  console.log("orderData:", orderData);

  // Don't render if not open
  if (!isOpen) {
    return null;
  }

  // Don't render if no order data
  if (!orderData) {
    console.log("No order data provided, showing fallback modal");
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl p-0">
          <DialogTitle className="sr-only">
            Order Created Successfully
          </DialogTitle>
          <div className="p-6">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                <Check className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-green-600">
                  Order Created Successfully!
                </h2>
                <p className="text-sm text-gray-600">
                  Your catering request has been submitted
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button onClick={onClose}>View Orders</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const formatAddress = (address: {
    street1: string;
    city: string;
    state: string;
    zip: string;
  }) => {
    return `${address.street1}, ${address.city}, ${address.state} ${address.zip}`;
  };

  const formatDateTime = (date: Date) => {
    return format(date, "MMMM do, yyyy 'at' h:mm a");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl p-0">
        <DialogTitle className="sr-only">
          Order Created Successfully - Order #{orderData.orderNumber}
        </DialogTitle>
        <div className="p-6">
          {/* Success Header */}
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <Check className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-green-600">
                Order Created Successfully!
              </h2>
              <p className="text-sm text-gray-600">
                Order #{orderData.orderNumber} has been confirmed
              </p>
            </div>
          </div>

          {/* Order Summary */}
          <div className="mb-6">
            <div className="mb-4 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-600" />
              <h3 className="font-semibold text-gray-900">Order Summary</h3>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-gray-500">Client</p>
                <p className="font-medium text-gray-900">
                  {orderData.clientName}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Order Type</p>
                <Badge variant="secondary" className="mt-1">
                  CATERING
                </Badge>
              </div>
            </div>

            {/* Pickup Details */}
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-600" />
                <span className="font-medium text-gray-900">Pickup</span>
              </div>
              <div className="ml-6 space-y-1">
                <p className="text-sm text-gray-600">
                  {formatDateTime(orderData.pickupDateTime)}
                </p>
                <p className="text-sm text-gray-600">
                  {formatAddress(orderData.pickupAddress)}
                </p>
              </div>
            </div>

            {/* Delivery Details */}
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-gray-600" />
                <span className="font-medium text-gray-900">Delivery</span>
              </div>
              <div className="ml-6 space-y-1">
                <p className="text-sm text-gray-600">
                  {formatDateTime(orderData.deliveryDateTime)}
                </p>
                <p className="text-sm text-gray-600">
                  {formatAddress(orderData.deliveryAddress)}
                </p>
              </div>
            </div>

            {/* Headcount Details */}
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-gray-600" />
                <span className="font-medium text-gray-900">
                  Headcount: {orderData.headcount}
                </span>
              </div>
              {orderData.needHost === "YES" &&
                orderData.hoursNeeded &&
                orderData.numberOfHosts && (
                  <div className="ml-6">
                    <p className="text-sm text-gray-600">
                      Hosts needed: {orderData.numberOfHosts} for{" "}
                      {orderData.hoursNeeded} hours
                    </p>
                  </div>
                )}
            </div>
          </div>

          {/* Next Steps */}
          <div className="mb-6">
            <div className="mb-4 flex items-center gap-2">
              <Check className="h-4 w-4 text-gray-600" />
              <h3 className="font-semibold text-gray-900">Next Steps</h3>
            </div>

            <div className="space-y-3">
              <div className="rounded-lg bg-gray-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1 h-2 w-2 rounded-full bg-blue-600"></div>
                  <div>
                    <h4 className="font-medium text-gray-900">
                      Order Confirmation
                    </h4>
                    <p className="text-sm text-gray-600">
                      You will receive an email confirmation with your order
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-gray-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1 h-2 w-2 rounded-full bg-blue-600"></div>
                  <div>
                    <h4 className="font-medium text-gray-900">
                      Venue & Logistics Coordination
                    </h4>
                    <p className="text-sm text-gray-600">
                      Our team will contact you to confirm delivery details and
                      venue access
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-gray-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1 h-2 w-2 rounded-full bg-blue-600"></div>
                  <div>
                    <h4 className="font-medium text-gray-900">
                      Event Host Arrival
                    </h4>
                    <p className="text-sm text-gray-600">
                      Your assigned hosts will arrive on-site and begin event
                      setup and service
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button
              onClick={() => {
                console.log("🎯 View Order Details button clicked");
                console.log("orderData:", orderData);
                console.log("orderData?.orderId:", orderData?.orderId);
                console.log("onViewOrderDetails function:", onViewOrderDetails);

                if (orderData?.orderId && onViewOrderDetails) {
                  console.log(
                    "✅ Calling onViewOrderDetails with orderId:",
                    orderData.orderId,
                  );
                  onViewOrderDetails(orderData.orderId);
                } else if (onViewOrderDetails) {
                  // Fallback: try to use orderNumber as orderId if orderId is not available
                  console.log(
                    "⚠️ No orderId found, trying to use orderNumber as fallback",
                  );
                  if (orderData?.orderNumber) {
                    console.log(
                      "✅ Using orderNumber as fallback:",
                      orderData.orderNumber,
                    );
                    onViewOrderDetails(orderData.orderNumber);
                  } else {
                    console.log(
                      "❌ No orderId or orderNumber available, falling back to onClose",
                    );
                    onClose();
                  }
                } else {
                  console.log(
                    "❌ onViewOrderDetails function not provided, falling back to onClose",
                  );
                  onClose();
                }
              }}
            >
              View Order Details
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
