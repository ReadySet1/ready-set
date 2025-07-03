"use client";

import VendorOrderDetails from "@/components/Orders/VendorOrderDetails";
import Breadcrumb from "@/components/Common/Breadcrumb";

const OrderPage = () => {
  return (
    <>
      <Breadcrumb pageName="Order Details" />
      <VendorOrderDetails />
    </>
  );
};

export default OrderPage;
