"use client";

import React, { useState } from "react";
import { CateringOrderSuccessModal } from "@/components/Orders/CateringOrders/CateringOrderSuccessModal";

export default function TestModalPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const mockOrderData = {
    orderNumber: "SF-03020",
    clientName: "Lorne Malvo",
    pickupDateTime: new Date("2025-08-08T11:00:00"),
    deliveryDateTime: new Date("2025-08-08T11:45:00"),
    pickupAddress: {
      street1: "25 Winter St",
      city: "South San Francisco",
      state: "CA",
      zip: "94080",
    },
    deliveryAddress: {
      street1: "215 Bada Bing Av",
      city: "Millbrae",
      state: "CA",
      zip: "94040",
    },
    headcount: 45,
    needHost: "YES" as const,
    hoursNeeded: 2,
    numberOfHosts: 2,
  };

  const handleShowModal = () => {
    console.log("🔧 Test: Showing modal");
    setIsModalOpen(true);
  };

  const handleTestFormSubmission = () => {
    console.log("🔧 Test: Simulating form submission");
    // Simulate the form submission flow
    const mockFormData = {
      userId: "test-user-id",
      pickupDateTime: new Date("2025-08-08T11:00:00"),
      arrivalDateTime: new Date("2025-08-08T11:45:00"),
      pickupAddress: {
        street1: "25 Winter St",
        city: "South San Francisco",
        state: "CA",
        zip: "94080",
      },
      deliveryAddress: {
        street1: "215 Bada Bing Av",
        city: "Millbrae",
        state: "CA",
        zip: "94040",
      },
      headcount: 45,
      needHost: "YES" as const,
      hoursNeeded: 2,
      numberOfHosts: 2,
    };
    
    // Simulate the success modal call
    const selectedClient = { id: "test-user-id", name: "Lorne Malvo" };
    const orderData = {
      orderNumber: "SF-03020",
      clientName: selectedClient.name,
      pickupDateTime: mockFormData.pickupDateTime,
      deliveryDateTime: mockFormData.arrivalDateTime,
      pickupAddress: mockFormData.pickupAddress,
      deliveryAddress: mockFormData.deliveryAddress,
      headcount: mockFormData.headcount,
      needHost: mockFormData.needHost,
      hoursNeeded: mockFormData.hoursNeeded,
      numberOfHosts: mockFormData.numberOfHosts,
    };
    
    console.log("🔧 Test: Order data for modal:", orderData);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    console.log("🔧 Test: Closing modal");
    setIsModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Catering Order Success Modal Test
        </h1>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Test the Success Modal</h2>
          <p className="text-gray-600 mb-6">
            Click the button below to see the catering order success modal in action.
          </p>
          
          <div className="space-y-3">
            <button
              onClick={handleShowModal}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Show Success Modal
            </button>
            
            <button
              onClick={handleTestFormSubmission}
              className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors ml-3"
            >
              Test Form Submission Flow
            </button>
          </div>
        </div>

        <CateringOrderSuccessModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          orderData={mockOrderData}
        />
      </div>
    </div>
  );
} 