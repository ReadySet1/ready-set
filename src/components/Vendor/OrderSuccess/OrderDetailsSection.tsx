"use client";

import React from "react";
import { OrderSuccessData } from "@/types/order-success";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar, Clock, MapPin, Users } from "lucide-react";
import { format } from "date-fns";

interface Props {
  orderData: OrderSuccessData;
}

export const OrderDetailsSection: React.FC<Props> = ({ orderData }) => {
  const formatAddress = (address: any) => {
    if (!address) return "-";
    return `${address.street1}${address.street2 ? `, ${address.street2}` : ""}, ${address.city}, ${address.state} ${address.zip}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Order Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Basic Information */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-gray-700">Client</p>
            <p className="text-lg">{orderData.clientName}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">Order Number</p>
            <p className="text-lg">{orderData.orderNumber}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">Order Type</p>
            <Badge variant="secondary">{orderData.orderType}</Badge>
          </div>
          {orderData.orderTotal && (
            <div>
              <p className="text-sm font-medium text-gray-700">Order Total</p>
              <p className="text-lg">${orderData.orderTotal.toFixed(2)}</p>
            </div>
          )}
        </div>

        <Separator />

        {/* Timing & Locations */}
        <div className="space-y-4">
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
                <p className="font-medium">Headcount: {orderData.headcount}</p>
                {orderData.needHost === "YES" && orderData.numberOfHosts && (
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
  );
};
