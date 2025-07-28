import React, { useState } from "react";
import { CateringOrderSuccessModal } from "../Orders/CateringOrders/CateringOrderSuccessModal";

export const TestModal: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [orderData, setOrderData] = useState<any>(null);

  const handleTestModal = () => {
    const testData = {
      orderId: "12345678-1234-1234-1234-123456789abc", // UUID format like real order IDs
      orderNumber: "TEST-123",
      clientName: "Test Client",
      pickupDateTime: new Date(),
      deliveryDateTime: new Date(),
      pickupAddress: {
        street1: "123 Test St",
        city: "Test City",
        state: "CA",
        zip: "12345",
      },
      deliveryAddress: {
        street1: "456 Test Ave",
        city: "Test City",
        state: "CA",
        zip: "12345",
      },
      headcount: 10,
      needHost: "NO" as const,
    };

    setOrderData(testData);
    setShowModal(true);
  };

  const handleViewOrderDetails = (orderId: string) => {
    console.log(
      "Test modal - navigating to order details for order ID:",
      orderId,
    );
    // For testing, navigate to the order details page
    window.location.href = `/client/catering-order-details/${orderId}`;
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Modal Test Component</h2>
      <button
        onClick={handleTestModal}
        style={{ padding: "10px", background: "blue", color: "white" }}
      >
        Test Success Modal
      </button>

      <CateringOrderSuccessModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setOrderData(null);
        }}
        orderData={orderData}
        onViewOrderDetails={handleViewOrderDetails}
      />
    </div>
  );
};
