import React from "react";
import Link from "next/link";

const VendorOrderConfirmationPage = () => {
  return (
    <div className="vendor-order-confirmation-page">
      <h1>Order Confirmation</h1>
      <p>
        No order number provided. Please return to your{" "}
        <Link href="/vendor">dashboard</Link>.
      </p>
    </div>
  );
};

export default VendorOrderConfirmationPage;
