import React from "react";
import { notFound, redirect } from "next/navigation";
import { OrderSuccessPageClient } from "./OrderSuccessPageClient";
import { fetchOrderSuccessData } from "@/lib/order-success-data";

interface Props {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ fromModal?: string }>;
}

const OrderSuccessPage = async ({ params, searchParams }: Props) => {
  const { orderNumber } = await params;
  const { fromModal } = await searchParams;
  const decodedOrderNumber = decodeURIComponent(orderNumber);

  try {
    const orderData = await fetchOrderSuccessData(decodedOrderNumber);

    if (!orderData) {
      notFound();
    }

    return (
      <OrderSuccessPageClient
        orderData={orderData}
        fromModal={fromModal === "true"}
      />
    );
  } catch (error) {
    console.error("Error fetching order success data:", error);
    notFound();
  }
};

export default OrderSuccessPage;

// Generate metadata for the page
export async function generateMetadata({ params }: Props) {
  const { orderNumber } = await params;
  const decodedOrderNumber = decodeURIComponent(orderNumber);

  return {
    title: `Order ${decodedOrderNumber} - Success | Ready Set`,
    description: `Order confirmation and details for order ${decodedOrderNumber}`,
  };
}
