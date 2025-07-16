"use client";

import React from 'react';
import { OrderSuccessData } from '@/types/order-success';
import { OrderSuccessLayout } from '@/components/Vendor/OrderSuccess/OrderSuccessLayout';

interface Props {
  orderData: OrderSuccessData;
  fromModal?: boolean;
}

export const OrderSuccessPageClient: React.FC<Props> = ({ 
  orderData, 
  fromModal = false 
}) => {
  return (
    <OrderSuccessLayout 
      orderData={orderData} 
      fromModal={fromModal}
    />
  );
};
