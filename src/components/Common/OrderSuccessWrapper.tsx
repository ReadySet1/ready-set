"use client";

import React from "react";
import { OrderSuccessModal } from "@/components/Orders/CateringOrders/OrderSuccess/OrderSuccessModal";
import { useOrderSuccess } from "@/hooks/useOrderSuccess";
import { OrderSuccessData, SuccessAction } from "@/types/order-success";

interface OrderSuccessWrapperProps {
  children: React.ReactNode;
  onSuccess?: (orderData: OrderSuccessData) => void;
  redirectDelay?: number;
  customActions?: {
    [key in SuccessAction]?: (
      orderData: OrderSuccessData,
    ) => Promise<void> | void;
  };
}

interface OrderSuccessContextType {
  showSuccessModal: (orderData: OrderSuccessData) => void;
  isProcessing: boolean;
  reset: () => void;
}

const OrderSuccessContext = React.createContext<OrderSuccessContextType | null>(
  null,
);

export const useOrderSuccessWrapper = () => {
  const context = React.useContext(OrderSuccessContext);
  if (!context) {
    throw new Error(
      "useOrderSuccessWrapper must be used within an OrderSuccessWrapper",
    );
  }
  return context;
};

export const OrderSuccessWrapper: React.FC<OrderSuccessWrapperProps> = ({
  children,
  onSuccess,
  redirectDelay,
  customActions,
}) => {
  const {
    isModalOpen,
    orderData,
    isProcessing,
    showSuccessModal,
    closeModal,
    handleAction,
    reset,
  } = useOrderSuccess({
    onSuccess,
    redirectDelay,
  });

  // Enhanced action handler that supports custom actions
  const handleEnhancedAction = async (action: SuccessAction) => {
    if (customActions && customActions[action] && orderData) {
      try {
        await customActions[action]!(orderData);
      } catch (error) {
        console.error(`Error executing custom action ${action}:`, error);
      }
    } else {
      // Use default action handler
      await handleAction(action);
    }
  };

  const contextValue: OrderSuccessContextType = {
    showSuccessModal,
    isProcessing,
    reset,
  };

  return (
    <OrderSuccessContext.Provider value={contextValue}>
      {children}

      {/* Success Modal - Centralized rendering */}
      {isModalOpen && orderData && (
        <OrderSuccessModal
          isOpen={isModalOpen}
          onClose={closeModal}
          orderData={orderData}
          onViewDetails={() => handleEnhancedAction("VIEW_DETAILS")}
          onCreateAnother={() => handleEnhancedAction("CREATE_ANOTHER")}
          onGoToDashboard={() => handleEnhancedAction("GO_TO_DASHBOARD")}
          onDownloadConfirmation={() =>
            handleEnhancedAction("DOWNLOAD_CONFIRMATION")
          }
          onShareOrder={() => handleEnhancedAction("SHARE_ORDER")}
        />
      )}
    </OrderSuccessContext.Provider>
  );
};
