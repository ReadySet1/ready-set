import React from "react";
import { OrderConfirmationData } from "../../../types/order-confirmation";

interface Props {
  data: OrderConfirmationData;
}

const OrderSummarySection: React.FC<Props> = ({ data }) => {
  const { eventDetails, customerInfo, estimatedDelivery, orderType } = data;
  return (
    <section className="order-summary-section">
      <h2>Order Summary</h2>
      <ul>
        <li>
          <strong>Order Type:</strong> {orderType}
        </li>
        <li>
          <strong>Event:</strong> {eventDetails.eventName} on{" "}
          {new Date(eventDetails.eventDate).toLocaleDateString()}
        </li>
        <li>
          <strong>Location:</strong> {eventDetails.location}
        </li>
        <li>
          <strong>Customer:</strong> {customerInfo.name} ({customerInfo.email},{" "}
          {customerInfo.phone})
        </li>
        <li>
          <strong>Estimated Delivery:</strong>{" "}
          {new Date(estimatedDelivery).toLocaleString()}
        </li>
      </ul>
    </section>
  );
};

export default OrderSummarySection;
