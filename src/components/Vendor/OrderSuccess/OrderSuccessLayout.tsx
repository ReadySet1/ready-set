"use client";

import React from 'react';
import { OrderSuccessData } from '@/types/order-success';
import { OrderSuccessHeader } from './OrderSuccessHeader';
import { OrderTimelineSteps } from './OrderTimelineSteps';
import { OrderActionCards } from './OrderActionCards';
import { OrderDetailsSection } from './OrderDetailsSection';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface Props {
  orderData: OrderSuccessData;
  fromModal?: boolean;
}

export const OrderSuccessLayout: React.FC<Props> = ({ 
  orderData, 
  fromModal = false 
}) => {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header Section */}
        <OrderSuccessHeader 
          orderNumber={orderData.orderNumber}
          clientName={orderData.clientName}
          createdAt={orderData.createdAt}
          fromModal={fromModal}
        />

        <div className="mt-8 space-y-8">
          {/* Quick Actions */}
          <OrderActionCards orderNumber={orderData.orderNumber} />

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Order Details */}
            <div className="lg:col-span-2 space-y-6">
              <OrderDetailsSection orderData={orderData} />
            </div>

            {/* Right Column - Timeline & Next Steps */}
            <div className="lg:col-span-1">
              <OrderTimelineSteps 
                nextSteps={orderData.nextSteps}
                orderNumber={orderData.orderNumber}
              />
            </div>
          </div>

          {/* Additional Information */}
          <Card>
            <CardContent className="pt-6">
              <div className="prose max-w-none">
                <h3 className="text-lg font-semibold mb-4">Important Notes</h3>
                <div className="space-y-3 text-sm text-gray-600">
                  <p>
                    • Please review all order details carefully and contact the client 
                    if any clarification is needed.
                  </p>
                  <p>
                    • Ensure all ingredients are sourced and prepared according to 
                    the agreed timeline.
                  </p>
                  <p>
                    • Coordinate with delivery team at least 4 hours before the 
                    scheduled delivery time.
                  </p>
                  {orderData.needHost === 'YES' && (
                    <p>
                      • Host assignment is required for this order. Please assign 
                      qualified hosts at least 48 hours in advance.
                    </p>
                  )}
                  <p>
                    • For any questions or concerns, contact our support team 
                    immediately.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
