import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  OrderSuccessWrapper,
  useOrderSuccessWrapper,
} from "@/components/Common/OrderSuccessWrapper";
import { OrderSuccessData, SuccessAction } from "@/types/order-success";

// Mock Supabase client first
jest.mock("@/utils/supabase/client", () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn(),
    },
  })),
}));

// Mock UserContext
jest.mock("@/contexts/UserContext", () => ({
  UserProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  useUser: () => ({
    user: { id: "test-user", email: "test@example.com" },
    loading: false,
  }),
}));

// Mock the OrderSuccessModal component
jest.mock(
  "@/components/Orders/CateringOrders/OrderSuccess/OrderSuccessModal",
  () => ({
    OrderSuccessModal: ({
      isOpen,
      onClose,
      orderData,
      onViewDetails,
      onCreateAnother,
      onGoToDashboard,
      onDownloadConfirmation,
      onShareOrder,
    }: any) => (
      <div
        data-testid="order-success-modal"
        style={{ display: isOpen ? "block" : "none" }}
      >
        <div data-testid="order-number">{orderData?.orderNumber}</div>
        <div data-testid="order-type">{orderData?.orderType}</div>
        <div data-testid="order-total">{orderData?.orderTotal}</div>
        <button data-testid="close-button" onClick={onClose}>
          Close
        </button>
        <button data-testid="view-details-button" onClick={onViewDetails}>
          View Details
        </button>
        <button data-testid="create-another-button" onClick={onCreateAnother}>
          Create Another
        </button>
        <button data-testid="go-to-dashboard-button" onClick={onGoToDashboard}>
          Go to Dashboard
        </button>
        <button
          data-testid="download-confirmation-button"
          onClick={onDownloadConfirmation}
        >
          Download Confirmation
        </button>
        <button data-testid="share-order-button" onClick={onShareOrder}>
          Share Order
        </button>
      </div>
    ),
  }),
);

// Mock the useOrderSuccess hook
jest.mock("@/hooks/useOrderSuccess", () => ({
  useOrderSuccess: jest.fn(() => ({
    isModalOpen: false,
    orderData: null,
    showSuccessModal: jest.fn(),
    handleAction: jest.fn(),
  })),
}));

// Mock router
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Test component that uses the hook
const TestComponent: React.FC = () => {
  const { showSuccessModal, isProcessing, reset } = useOrderSuccessWrapper();

  return (
    <div>
      <button
        data-testid="show-success"
        onClick={() =>
          showSuccessModal({
            orderNumber: "TEST-123",
            orderType: "CATERING",
            orderTotal: 150.0,
            clientName: "Test Client",
            pickupDateTime: new Date("2024-01-15T10:00:00Z"),
            arrivalDateTime: new Date("2024-01-15T11:00:00Z"),
            pickupAddress: {
              street1: "123 Test St",
              city: "Test City",
              state: "TX",
              zip: "12345",
            },
            deliveryAddress: {
              street1: "456 Test Ave",
              city: "Test City",
              state: "TX",
              zip: "12345",
            },
            needHost: "NO",
            nextSteps: [],
            createdAt: new Date("2024-01-15T09:00:00Z"),
          })
        }
      >
        Show Success
      </button>
      <button data-testid="reset" onClick={reset}>
        Reset
      </button>
      <div data-testid="processing-state">
        {isProcessing ? "processing" : "idle"}
      </div>
    </div>
  );
};

describe("OrderSuccessWrapper", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Component Rendering", () => {
    it("renders children correctly", () => {
      render(
        <OrderSuccessWrapper>
          <div data-testid="test-child">Test Child</div>
        </OrderSuccessWrapper>,
      );

      expect(screen.getByTestId("test-child")).toBeInTheDocument();
    });

    it("renders modal when not visible initially", () => {
      render(
        <OrderSuccessWrapper>
          <div>Test Content</div>
        </OrderSuccessWrapper>,
      );

      const modal = screen.getByTestId("order-success-modal");
      expect(modal).toHaveStyle({ display: "none" });
    });
  });

  describe("useOrderSuccessWrapper Hook", () => {
    it("provides the correct context values", () => {
      render(
        <OrderSuccessWrapper>
          <TestComponent />
        </OrderSuccessWrapper>,
      );

      expect(screen.getByTestId("processing-state")).toHaveTextContent("idle");
      expect(screen.getByTestId("show-success")).toBeInTheDocument();
      expect(screen.getByTestId("reset")).toBeInTheDocument();
    });

    it("throws error when used outside of wrapper", () => {
      // Suppress console.error for this test
      const originalError = console.error;
      console.error = jest.fn();

      expect(() => {
        render(<TestComponent />);
      }).toThrow(
        "useOrderSuccessWrapper must be used within an OrderSuccessWrapper",
      );

      console.error = originalError;
    });

    it("shows success modal when showSuccessModal is called", async () => {
      render(
        <OrderSuccessWrapper>
          <TestComponent />
        </OrderSuccessWrapper>,
      );

      const showButton = screen.getByTestId("show-success");
      fireEvent.click(showButton);

      await waitFor(() => {
        const modal = screen.getByTestId("order-success-modal");
        expect(modal).toHaveStyle({ display: "block" });
      });

      expect(screen.getByTestId("order-number")).toHaveTextContent("TEST-123");
      expect(screen.getByTestId("order-type")).toHaveTextContent("CATERING");
      expect(screen.getByTestId("order-total")).toHaveTextContent("150");
    });

    it("resets state when reset is called", async () => {
      render(
        <OrderSuccessWrapper>
          <TestComponent />
        </OrderSuccessWrapper>,
      );

      // Show modal first
      const showButton = screen.getByTestId("show-success");
      fireEvent.click(showButton);

      await waitFor(() => {
        expect(screen.getByTestId("order-success-modal")).toHaveStyle({
          display: "block",
        });
      });

      // Reset
      const resetButton = screen.getByTestId("reset");
      fireEvent.click(resetButton);

      await waitFor(() => {
        expect(screen.getByTestId("order-success-modal")).toHaveStyle({
          display: "none",
        });
      });
    });
  });

  describe("Modal Actions", () => {
    beforeEach(async () => {
      render(
        <OrderSuccessWrapper>
          <TestComponent />
        </OrderSuccessWrapper>,
      );

      // Show modal
      const showButton = screen.getByTestId("show-success");
      fireEvent.click(showButton);

      await waitFor(() => {
        expect(screen.getByTestId("order-success-modal")).toHaveStyle({
          display: "block",
        });
      });
    });

    it("closes modal when close button is clicked", async () => {
      const closeButton = screen.getByTestId("close-button");
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.getByTestId("order-success-modal")).toHaveStyle({
          display: "none",
        });
      });
    });

    it("handles view details action", async () => {
      const viewDetailsButton = screen.getByTestId("view-details-button");
      fireEvent.click(viewDetailsButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          "/catering-request/success/TEST-123",
        );
      });
    });

    it("handles create another action", async () => {
      const createAnotherButton = screen.getByTestId("create-another-button");
      fireEvent.click(createAnotherButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/catering-request");
      });
    });

    it("handles go to dashboard action", async () => {
      const goToDashboardButton = screen.getByTestId("go-to-dashboard-button");
      fireEvent.click(goToDashboardButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/dashboard");
      });
    });

    it("handles download confirmation action", async () => {
      // Mock window.open
      const originalOpen = window.open;
      window.open = jest.fn();

      const downloadButton = screen.getByTestId("download-confirmation-button");
      fireEvent.click(downloadButton);

      await waitFor(() => {
        expect(window.open).toHaveBeenCalledWith(
          "/api/orders/TEST-123/confirmation",
          "_blank",
        );
      });

      window.open = originalOpen;
    });

    it("handles share order action", async () => {
      // Mock navigator.share
      const mockShare = jest.fn();
      Object.defineProperty(navigator, "share", {
        value: mockShare,
        writable: true,
      });

      const shareButton = screen.getByTestId("share-order-button");
      fireEvent.click(shareButton);

      await waitFor(() => {
        expect(mockShare).toHaveBeenCalledWith({
          title: "Order Confirmation - TEST-123",
          text: "Check out my order details",
          url: expect.stringContaining("/catering-request/success/TEST-123"),
        });
      });
    });
  });

  describe("Custom Actions", () => {
    it("executes custom actions when provided", async () => {
      const customViewDetails = jest.fn();
      const customCreateAnother = jest.fn();

      render(
        <OrderSuccessWrapper
          customActions={{
            VIEW_DETAILS: customViewDetails,
            CREATE_ANOTHER: customCreateAnother,
          }}
        >
          <TestComponent />
        </OrderSuccessWrapper>,
      );

      // Show modal
      const showButton = screen.getByTestId("show-success");
      fireEvent.click(showButton);

      await waitFor(() => {
        expect(screen.getByTestId("order-success-modal")).toHaveStyle({
          display: "block",
        });
      });

      // Test custom view details
      const viewDetailsButton = screen.getByTestId("view-details-button");
      fireEvent.click(viewDetailsButton);

      await waitFor(() => {
        expect(customViewDetails).toHaveBeenCalledWith({
          orderNumber: "TEST-123",
          orderType: "CATERING",
          orderTotal: 150.0,
          clientName: "Test Client",
          pickupDateTime: new Date("2024-01-15T10:00:00Z"),
          arrivalDateTime: new Date("2024-01-15T11:00:00Z"),
          pickupAddress: {
            street1: "123 Test St",
            city: "Test City",
            state: "TX",
            zip: "12345",
          },
          deliveryAddress: {
            street1: "456 Test Ave",
            city: "Test City",
            state: "TX",
            zip: "12345",
          },
          needHost: "NO",
          nextSteps: [],
          createdAt: new Date("2024-01-15T09:00:00Z"),
        });
      });

      // Test custom create another
      const createAnotherButton = screen.getByTestId("create-another-button");
      fireEvent.click(createAnotherButton);

      await waitFor(() => {
        expect(customCreateAnother).toHaveBeenCalledWith(
          expect.objectContaining({
            orderNumber: "TEST-123",
          }),
        );
      });
    });
  });

  describe("onSuccess Callback", () => {
    it("calls onSuccess callback when provided", async () => {
      const onSuccessCallback = jest.fn();

      render(
        <OrderSuccessWrapper onSuccess={onSuccessCallback}>
          <TestComponent />
        </OrderSuccessWrapper>,
      );

      // Show modal
      const showButton = screen.getByTestId("show-success");
      fireEvent.click(showButton);

      await waitFor(() => {
        expect(onSuccessCallback).toHaveBeenCalledWith({
          orderNumber: "TEST-123",
          orderType: "CATERING",
          orderTotal: 150.0,
          clientName: "Test Client",
          pickupDateTime: new Date("2024-01-15T10:00:00Z"),
          arrivalDateTime: new Date("2024-01-15T11:00:00Z"),
          pickupAddress: {
            street1: "123 Test St",
            city: "Test City",
            state: "TX",
            zip: "12345",
          },
          deliveryAddress: {
            street1: "456 Test Ave",
            city: "Test City",
            state: "TX",
            zip: "12345",
          },
          needHost: "NO",
          nextSteps: [],
          createdAt: new Date("2024-01-15T09:00:00Z"),
        });
      });
    });
  });

  describe("Error Handling", () => {
    it("handles action errors gracefully", async () => {
      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      // Mock router.push to throw an error
      mockPush.mockImplementationOnce(() => {
        throw new Error("Navigation failed");
      });

      render(
        <OrderSuccessWrapper>
          <TestComponent />
        </OrderSuccessWrapper>,
      );

      // Show modal
      const showButton = screen.getByTestId("show-success");
      fireEvent.click(showButton);

      await waitFor(() => {
        expect(screen.getByTestId("order-success-modal")).toHaveStyle({
          display: "block",
        });
      });

      // Try to navigate (this should fail)
      const viewDetailsButton = screen.getByTestId("view-details-button");
      fireEvent.click(viewDetailsButton);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          "Error handling success action:",
          expect.any(Error),
        );
      });

      consoleSpy.mockRestore();
    });
  });
});
