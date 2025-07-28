import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { CateringRequestForm } from "@/components/CateringRequest/CateringRequestForm";

// Mock Next.js router
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

// Mock Supabase client
jest.mock("@/utils/supabase/client", () => ({
  createClient: jest.fn(() => ({
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: {
          session: {
            user: {
              id: "test-user-id",
              email: "test@example.com",
            },
          },
        },
      }),
    },
  })),
}));

// Mock the success modal
jest.mock(
  "@/components/Orders/CateringOrders/CateringOrderSuccessModal",
  () => ({
    CateringOrderSuccessModal: ({
      isOpen,
      onClose,
      orderData,
      onViewOrderDetails,
    }: {
      isOpen: boolean;
      onClose: () => void;
      orderData: any;
      onViewOrderDetails?: (orderId: string) => void;
    }) => (
      <div
        data-testid="success-modal"
        style={{ display: isOpen ? "block" : "none" }}
      >
        <div data-testid="modal-order-data">
          {orderData ? JSON.stringify(orderData) : "No data"}
        </div>
        <button data-testid="modal-close" onClick={onClose}>
          Close
        </button>
        <button
          data-testid="modal-view-details"
          onClick={() =>
            orderData?.orderId && onViewOrderDetails?.(orderData.orderId)
          }
        >
          View Order Details
        </button>
      </div>
    ),
  }),
);

// Mock AddressManager
jest.mock("@/components/AddressManager", () => ({
  __esModule: true,
  default: ({
    onAddressSelected,
  }: {
    onAddressSelected: (id: string) => void;
  }) => (
    <div data-testid="address-manager">
      <button onClick={() => onAddressSelected("pickup-address-id")}>
        Select Pickup Address
      </button>
      <button onClick={() => onAddressSelected("delivery-address-id")}>
        Select Delivery Address
      </button>
    </div>
  ),
}));

// Mock react-hook-form
jest.mock("react-hook-form", () => ({
  useForm: () => ({
    control: {},
    handleSubmit: (fn: any) => fn,
    setValue: jest.fn(),
    reset: jest.fn(),
    formState: { errors: {} },
  }),
  Controller: ({ render }: { render: any }) => render({ field: {} }),
}));

// Mock react-hot-toast
jest.mock("react-hot-toast", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock fetch
global.fetch = jest.fn();

describe("Catering Order Flow Integration", () => {
  const mockRouter = {
    push: jest.fn(),
    back: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
  });

  describe("Complete Flow: Form Submission → Success Modal → Order Details", () => {
    it("completes the full flow successfully", async () => {
      // Mock successful API response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            message: "Catering request created successfully",
            orderId: "test-order-id-123",
            orderNumber: "TEST-123",
          }),
      });

      render(<CateringRequestForm />);

      // Step 1: Submit the form
      const submitButton = screen.getByText("Submit Catering Request");
      fireEvent.click(submitButton);

      // Step 2: Verify success modal appears
      await waitFor(() => {
        expect(screen.getByTestId("success-modal")).toBeInTheDocument();
      });

      // Step 3: Verify modal contains correct data
      const modalData = screen.getByTestId("modal-order-data");
      const data = JSON.parse(modalData.textContent || "{}");
      expect(data.orderId).toBe("test-order-id-123");
      expect(data.orderNumber).toBe("TEST-123");

      // Step 4: Click "View Order Details" button
      const viewDetailsButton = screen.getByTestId("modal-view-details");
      fireEvent.click(viewDetailsButton);

      // Step 5: Verify navigation to order details page
      expect(mockRouter.push).toHaveBeenCalledWith(
        "/client/catering-order-details/test-order-id-123",
      );
    });

    it("handles fallback to orderNumber when orderId is missing", async () => {
      // Mock API response without orderId
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            message: "Catering request created successfully",
            orderNumber: "TEST-123",
            // No orderId
          }),
      });

      render(<CateringRequestForm />);

      // Submit the form
      const submitButton = screen.getByText("Submit Catering Request");
      fireEvent.click(submitButton);

      // Verify success modal appears
      await waitFor(() => {
        expect(screen.getByTestId("success-modal")).toBeInTheDocument();
      });

      // Click "View Order Details" button
      const viewDetailsButton = screen.getByTestId("modal-view-details");
      fireEvent.click(viewDetailsButton);

      // Verify navigation uses orderNumber as fallback
      expect(mockRouter.push).toHaveBeenCalledWith(
        "/client/catering-order-details/TEST-123",
      );
    });

    it("handles modal close correctly", async () => {
      // Mock successful API response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            message: "Catering request created successfully",
            orderId: "test-order-id-123",
            orderNumber: "TEST-123",
          }),
      });

      render(<CateringRequestForm />);

      // Submit the form
      const submitButton = screen.getByText("Submit Catering Request");
      fireEvent.click(submitButton);

      // Verify success modal appears
      await waitFor(() => {
        expect(screen.getByTestId("success-modal")).toBeInTheDocument();
      });

      // Click close button
      const closeButton = screen.getByTestId("modal-close");
      fireEvent.click(closeButton);

      // Verify modal disappears
      await waitFor(() => {
        expect(screen.queryByTestId("success-modal")).not.toBeInTheDocument();
      });

      // Verify no navigation occurred
      expect(mockRouter.push).not.toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("handles API error during form submission", async () => {
      // Mock API error
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: "Internal server error" }),
      });

      render(<CateringRequestForm />);

      // Submit the form
      const submitButton = screen.getByText("Submit Catering Request");
      fireEvent.click(submitButton);

      // Verify success modal does not appear
      await waitFor(() => {
        expect(screen.queryByTestId("success-modal")).not.toBeInTheDocument();
      });

      // Verify no navigation occurred
      expect(mockRouter.push).not.toHaveBeenCalled();
    });

    it("handles network error during form submission", async () => {
      // Mock network error
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

      render(<CateringRequestForm />);

      // Submit the form
      const submitButton = screen.getByText("Submit Catering Request");
      fireEvent.click(submitButton);

      // Verify success modal does not appear
      await waitFor(() => {
        expect(screen.queryByTestId("success-modal")).not.toBeInTheDocument();
      });

      // Verify no navigation occurred
      expect(mockRouter.push).not.toHaveBeenCalled();
    });
  });

  describe("Accessibility", () => {
    it("includes proper accessibility attributes in success modal", async () => {
      // Mock successful API response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            message: "Catering request created successfully",
            orderId: "test-order-id-123",
            orderNumber: "TEST-123",
          }),
      });

      render(<CateringRequestForm />);

      // Submit the form
      const submitButton = screen.getByText("Submit Catering Request");
      fireEvent.click(submitButton);

      // Verify success modal appears
      await waitFor(() => {
        expect(screen.getByTestId("success-modal")).toBeInTheDocument();
      });

      // Verify modal has proper accessibility structure
      expect(screen.getByTestId("modal-order-data")).toBeInTheDocument();
      expect(screen.getByTestId("modal-close")).toBeInTheDocument();
      expect(screen.getByTestId("modal-view-details")).toBeInTheDocument();
    });
  });

  describe("Data Flow", () => {
    it("passes correct data structure to success modal", async () => {
      // Mock successful API response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            message: "Catering request created successfully",
            orderId: "test-order-id-123",
            orderNumber: "TEST-123",
          }),
      });

      render(<CateringRequestForm />);

      // Submit the form
      const submitButton = screen.getByText("Submit Catering Request");
      fireEvent.click(submitButton);

      // Verify success modal appears with correct data
      await waitFor(() => {
        const modalData = screen.getByTestId("modal-order-data");
        const data = JSON.parse(modalData.textContent || "{}");

        // Verify all expected fields are present
        expect(data).toHaveProperty("orderId");
        expect(data).toHaveProperty("orderNumber");
        expect(data).toHaveProperty("clientName");
        expect(data).toHaveProperty("pickupDateTime");
        expect(data).toHaveProperty("deliveryDateTime");
        expect(data).toHaveProperty("pickupAddress");
        expect(data).toHaveProperty("deliveryAddress");
        expect(data).toHaveProperty("headcount");
        expect(data).toHaveProperty("needHost");

        // Verify specific values
        expect(data.orderId).toBe("test-order-id-123");
        expect(data.orderNumber).toBe("TEST-123");
      });
    });
  });
});
