"use client";

import React from "react";
import { OrderConfirmationData } from "../../../types/order-confirmation";
import OrderSummarySection from "./OrderSummarySection";
import NextStepsSection from "./NextStepsSection";
import VendorActionsSection from "./VendorActionsSection";

interface Props {
  data: OrderConfirmationData;
}

const OrderConfirmationCard: React.FC<Props> = ({ data }) => {
  return (
    <div className="order-confirmation-card">
      <h1>Order Confirmed!</h1>
      <p>
        Your order <strong>#{data.orderNumber}</strong> has been successfully
        created.
      </p>
      <OrderSummarySection data={data} />
      <NextStepsSection nextSteps={data.nextSteps} />
      <VendorActionsSection orderNumber={data.orderNumber} />
    </div>
  );
};

export default OrderConfirmationCard;
