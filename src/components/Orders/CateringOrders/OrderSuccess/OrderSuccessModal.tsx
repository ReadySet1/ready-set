"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle,
  Clock,
  MapPin,
  Users,
  Calendar,
  ExternalLink,
  Plus,
  LayoutDashboard,
  Download,
  Share2,
} from "lucide-react";
import { format } from "date-fns";
import { SuccessModalProps } from "@/types/order-success";

export const OrderSuccessModal: React.FC<SuccessModalProps> = ({
  isOpen,
  onClose,
  orderData,
  onViewDetails,
  onCreateAnother,
  onGoToDashboard,
  onDownloadConfirmation,
  onShareOrder,
}) => {
  const formatAddress = (address: any) => {
    return `${address.street1}${address.street2 ? `, ${address.street2}` : ""}, ${address.city}, ${address.state} ${address.zip}`;
  };

  const getNextStepsByPriority = () => {
    return orderData.nextSteps
      .filter((step) => !step.completed)
      .sort((a, b) => {
        const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      })
      .slice(0, 3); // Show top 3 next steps
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "HIGH":
        return "bg-red-100 text-red-800 border-red-200";
      case "MEDIUM":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "LOW":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-green-100 p-2">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-bold text-green-800">
                Order Created Successfully!
              </DialogTitle>
              <p className="mt-1 text-gray-600">
                Order #{orderData.orderNumber} has been confirmed
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-6 space-y-6">
          {/* Order Summary Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-gray-700">Client</p>
                  <p className="text-lg">{orderData.clientName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    Order Type
                  </p>
                  <Badge variant="secondary">{orderData.orderType}</Badge>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Clock className="mt-0.5 h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium">Pickup</p>
                    <p className="text-sm text-gray-600">
                      {format(orderData.pickupDateTime, "PPPp")}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatAddress(orderData.pickupAddress)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium">Delivery</p>
                    <p className="text-sm text-gray-600">
                      {format(orderData.arrivalDateTime, "PPPp")}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatAddress(orderData.deliveryAddress)}
                    </p>
                  </div>
                </div>

                {orderData.headcount && (
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-purple-600" />
                    <div>
                      <p className="font-medium">
                        Headcount: {orderData.headcount}
                      </p>
                      {orderData.needHost === "YES" &&
                        orderData.numberOfHosts && (
                          <p className="text-sm text-gray-600">
                            Hosts needed: {orderData.numberOfHosts} for{" "}
                            {orderData.hoursNeeded} hours
                          </p>
                        )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Next Steps Card */}
          {getNextStepsByPriority().length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Next Steps
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {getNextStepsByPriority().map((step) => (
                  <div
                    key={step.id}
                    className="flex items-start gap-3 rounded-lg border bg-gray-50 p-3"
                  >
                    <div className="mt-1">
                      <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                    </div>
                    <div className="flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <p className="font-medium">{step.title}</p>
                      </div>
                      <p className="text-sm text-gray-600">
                        {step.description}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 pt-4 sm:flex-row">
            <Button
              onClick={onViewDetails}
              className="flex flex-1 items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              View Full Details
            </Button>

            <Button
              variant="outline"
              onClick={onCreateAnother}
              className="flex flex-1 items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Create Another Order
            </Button>

            <Button
              variant="outline"
              onClick={onGoToDashboard}
              className="flex flex-1 items-center gap-2"
            >
              <LayoutDashboard className="h-4 w-4" />
              Go to Dashboard
            </Button>
          </div>

          {/* Secondary Actions - Hidden per client request */}
          {/* 
          <div className="flex justify-center gap-4 border-t pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-600"
              onClick={onDownloadConfirmation}
            >
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="text-gray-600"
              onClick={onShareOrder}
            >
              <Share2 className="mr-2 h-4 w-4" />
              Share Order
            </Button>
          </div>
          */}
        </div>
      </DialogContent>
    </Dialog>
  );
};
