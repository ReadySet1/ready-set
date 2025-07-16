import React from "react";
import { notFound, redirect } from "next/navigation";
import { OrderSuccessPageClient } from "./OrderSuccessPageClient";
import { fetchOrderSuccessData } from "@/lib/order-success-data";

interface Props {
  params: { orderNumber: string };
  searchParams: { fromModal?: string };
}

const OrderSuccessPage = async ({ params, searchParams }: Props) => {
  const orderNumber = decodeURIComponent(params.orderNumber);
  
  try {
    const orderData = await fetchOrderSuccessData(orderNumber);
    
    if (!orderData) {
      notFound();
    }

    return (
      <OrderSuccessPageClient 
        orderData={orderData} 
        fromModal={searchParams.fromModal === 'true'}
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
  const orderNumber = decodeURIComponent(params.orderNumber);
  
  return {
    title: `Order ${orderNumber} - Success | Ready Set`,
    description: `Order confirmation and details for order ${orderNumber}`,
  };
}
