import React from "react";
import { fetchOrderConfirmationData } from "../../../../../../lib/order-confirmation";
import OrderConfirmationCard from "../../../../../../components/Vendor/OrderConfirmation/OrderConfirmationCard";

interface Props {
  params: Promise<{ orderNumber: string }>;
}

const OrderConfirmationPage = async ({ params }: Props) => {
  const { orderNumber } = await params;
  const data = await fetchOrderConfirmationData(orderNumber);

  if (!data) {
    return (
      <div className="order-confirmation-error">
        <h1>Order Not Found</h1>
        <p>We couldn't find an order with number {orderNumber}.</p>
      </div>
    );
  }

  return (
    <div className="order-confirmation-page">
      <OrderConfirmationCard data={data} />
    </div>
  );
};

export default OrderConfirmationPage;
